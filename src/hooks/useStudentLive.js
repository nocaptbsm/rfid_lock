import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchStudentStats } from '@/api';

export const useStudentLive = (roll) => {
  const [data, setData] = useState({
    profile: null,
    sessions: [],
    weeklyData: [],
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
      const allSessions = result.weeklySessions || result.todaySessions || [];
      const todaySessions = result.todaySessions || [];
      
      const weeklyData = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const daySessions = allSessions.filter(s => {
          const sDate = new Date(s.entry_time);
          return sDate.toDateString() === d.toDateString();
        });
        const totalMinutes = daySessions.reduce((acc, s) => {
          let mins = s.duration_minutes || 0;
          if (!s.exit_time) {
            const start = new Date(s.entry_time);
            mins = Math.round((new Date() - start) / 60000);
          }
          return acc + mins;
        }, 0);
        weeklyData.push({
          day: i === 0 ? 'Today' : days[d.getDay()],
          hours: Number((totalMinutes / 60).toFixed(2)) // Using 2 decimals so test minutes aren't totally wiped.
        });
      }

      const weeklyTotalMinutes = weeklyData.reduce((acc, d) => acc + (d.hours * 60), 0);
      const weeklyAvgHours = Number((weeklyTotalMinutes / 60 / 7).toFixed(1));

      setData({
        profile: result.student,
        sessions: todaySessions,
        weeklyData,
        weeklyTotalMinutes,
        weeklyAvgHours,
        inside: result.isCurrentlyInside,
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
    
    const connect = () => {
      try {
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          setWsStatus('live');
          console.log('Student Dashboard: WS Connected');
        };

        ws.current.onmessage = (event) => {
          const payload = JSON.parse(event.data);
          // Only refresh if the scan event is for THIS student
          if (payload.type === 'SCAN_EVENT' && payload.data.roll === roll) {
            console.log('Relevant scan detected, refreshing...');
            refresh();
          }

          // Handle targeted record clearing from Admin
          if (payload.type === 'RECORDS_CLEARED' && payload.data.roll === roll) {
            console.log('Admin cleared records, wiping local state...');
            setData(prev => ({
              ...prev,
              sessions: [],
              weeklyData: prev.weeklyData.map(d => ({ ...d, hours: 0 })),
              inside: false,
              loading: false,
              lastSync: new Date()
            }));
          }
        };

        ws.current.onclose = () => {
          setWsStatus('polling');
          // Reconnect logic or fallback to polling
          setTimeout(connect, 5000);
        };

        ws.current.onerror = () => {
          setWsStatus('error');
        };
      } catch (err) {
        setWsStatus('error');
      }
    };

    connect();

    return () => {
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

  // Derived Stats
  const stats = {
    todayEntry: data.sessions.length > 0 
      ? new Date(data.sessions[data.sessions.length - 1].entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--',
    todayExit: (data.sessions.length > 0 && data.sessions[0].exit_time)
      ? new Date(data.sessions[0].exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--',
    totalMinutes: data.sessions.reduce((acc, s) => {
      let mins = s.duration_minutes || 0;
      if (!s.exit_time) {
        const start = new Date(s.entry_time);
        mins = Math.round((new Date() - start) / 60000);
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
