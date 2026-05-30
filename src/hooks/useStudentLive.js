import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchStudentStats } from '@/api';
import { applySessionsCutoff, getEffectiveNow, isSessionActive } from '@/utils/sessionUtils';

export const useStudentLive = (roll) => {
  const [data, setData] = useState({
    profile: null,
    sessions: [],
    weeklyData: [],
    monthlyData: [],
    inside: false,
    loading: true,
    error: '',
    lastSync: null
  });
  const [wsStatus, setWsStatus] = useState('connecting');
  const ws = useRef(null);

  const refresh = useCallback(async (showLoading = false) => {
    if (!roll) return;
    if (showLoading) setData(prev => ({ ...prev, loading: true }));
    
    try {
      const result = await fetchStudentStats(roll);

      // Apply 10 PM cutoff to all sessions
      const allSessionsRaw = result.weeklySessions || result.todaySessions || [];
      const todaySessionsRaw = result.todaySessions || [];
      const allSessions = applySessionsCutoff(allSessionsRaw);
      const todaySessions = applySessionsCutoff(todaySessionsRaw);
      
      const monthlyData = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const daySessions = allSessions.filter(s => {
          const sDate = new Date(s.entry_time);
          return sDate.toDateString() === d.toDateString();
        });
        const totalMinutes = Math.min(1440, daySessions.reduce((acc, s) => {
          let mins = s.duration_minutes || 0;
          // For sessions still open (before 10 PM cutoff today), calculate live duration
          if (!s.exit_time && isSessionActive(s)) {
            const start = new Date(s.entry_time);
            const effectiveEnd = getEffectiveNow(s.entry_time);
            mins = Math.round((effectiveEnd - start) / 60000);
          }
          return acc + mins;
        }, 0));
        monthlyData.push({
          day: i === 0 ? 'Today' : days[d.getDay()],
          date: d.getDate().toString(),
          hours: Number((totalMinutes / 60).toFixed(2))
        });
      }

      const weeklyData = monthlyData.slice(-7);

      const weeklyTotalMinutes = weeklyData.reduce((acc, d) => acc + (d.hours * 60), 0);
      const weeklyAvgHours = Number((weeklyTotalMinutes / 60 / 7).toFixed(1));

      // Determine if student is truly "inside" — only if they have an active session
      // that hasn't been auto-closed by the 10 PM cutoff
      const isInside = result.isCurrentlyInside && todaySessions.some(s => isSessionActive(s));

      setData({
        profile: result.student,
        sessions: todaySessions,
        weeklyData,
        monthlyData,
        weeklyTotalMinutes,
        weeklyAvgHours,
        inside: isInside,
        loading: false,
        error: '',
        lastSync: new Date()
      });
    } catch (err) {
      console.error('Failed to fetch student stats:', err);
      setData(prev => ({ 
        ...prev, 
        loading: false, 
        error: err.message || 'Failed to sync data' 
      }));
    }
  }, [roll]);

  // Initial fetch
  useEffect(() => {
    refresh(true);
  }, [refresh]);

  // WebSocket Live Connection
  useEffect(() => {
    if (!roll) return;

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    let retries = 0;
    const MAX_RETRIES = 5;
    let retryTimer = null;

    const connect = () => {
      try {
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          retries = 0; // reset on successful connect
          setWsStatus('live');
          console.log('Student Dashboard: WS Connected');
        };

        ws.current.onmessage = (event) => {
          const payload = JSON.parse(event.data);
          if (payload.type === 'SCAN_EVENT' && payload.data.roll === roll) {
            console.log('Relevant scan detected, refreshing...');
            refresh();
          }
          if (payload.type === 'RECORDS_CLEARED' && payload.data.roll === roll) {
            console.log('Admin cleared records, wiping local state...');
            setData(prev => ({
              ...prev,
              sessions: [],
              weeklyData: prev.weeklyData.map(d => ({ ...d, hours: 0 })),
              monthlyData: prev.monthlyData?.map(d => ({ ...d, hours: 0 })) || [],
              inside: false,
              loading: false,
              lastSync: new Date()
            }));
          }
        };

        ws.current.onclose = () => {
          setWsStatus('polling');
          if (retries < MAX_RETRIES) {
            // Exponential backoff: 2s, 4s, 8s, 16s, 32s
            const delay = Math.min(2000 * Math.pow(2, retries), 32000);
            retries++;
            console.log(`WS reconnect attempt ${retries}/${MAX_RETRIES} in ${delay}ms`);
            retryTimer = setTimeout(connect, delay);
          } else {
            console.warn('WS max retries reached — falling back to polling only.');
            setWsStatus('polling');
          }
        };

        ws.current.onerror = () => {
          setWsStatus('error');
        };
      } catch (err) { // eslint-disable-line no-unused-vars
        setWsStatus('error');
      }
    };

    connect();

    return () => {
      clearTimeout(retryTimer);
      if (ws.current) ws.current.close();
    };
  }, [roll, refresh]);

  // Polling Fallback - runs if WS is not live
  useEffect(() => {
    if (wsStatus !== 'live') {
      const interval = setInterval(() => {
        refresh();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [wsStatus, refresh]);

  // Derived Stats — with 10 PM cutoff applied
  const stats = {
    // Entry time = first session's entry (sessions are ordered newest-first from API)
    todayEntry: data.sessions.length > 0 
      ? new Date(data.sessions[data.sessions.length - 1].entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--',
    // Exit time = most recent session's exit (first in the array)
    todayExit: (data.sessions.length > 0 && data.sessions[0].exit_time)
      ? new Date(data.sessions[0].exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--',
    totalMinutes: data.sessions.reduce((acc, s) => {
      let mins = s.duration_minutes || 0;
      // For still-active sessions (before 10 PM), use live elapsed time
      if (!s.exit_time && isSessionActive(s)) {
        const start = new Date(s.entry_time);
        const effectiveEnd = getEffectiveNow(s.entry_time);
        mins = Math.round((effectiveEnd - start) / 60000);
      }
      return acc + mins;
    }, 0),
    lastScanTime: data.sessions.length > 0 
      ? new Date(data.sessions[0].entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null
  };

  return { 
    ...data, 
    ...stats, 
    wsStatus, 
    refresh 
  };
};
