import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for real-time data with WebSocket and Polling fallback
 * @param {string} url - WebSocket URL
 * @param {function} onMessage - Callback for new data
 * @param {number} pollInterval - Fallback polling interval in ms
 */
export const useRealTime = (wsUrl, pollUrl, onMessage, pollInterval = 5000) => {
  const [status, setStatus] = useState('connecting'); // 'connecting', 'live', 'polling', 'error'
  const ws = useRef(null);

  useEffect(() => {
    // 1. Try WebSocket
    if (wsUrl && !import.meta.env.VITE_USE_MOCK) {
       const connectWS = () => {
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          setStatus('live');
          console.log('WS Connected');
        };

        ws.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          onMessage(data);
        };

        ws.current.onerror = () => {
          setStatus('error');
        };

        ws.current.onclose = () => {
          if (status !== 'error') setStatus('polling');
        };
      };

      connectWS();
    } else {
      // Use polling if mock mode or no wsUrl
      setStatus('polling');
    }

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [wsUrl]);

  // 2. Polling Fallback
  useEffect(() => {
    if (status === 'polling' || import.meta.env.VITE_USE_MOCK) {
      const interval = setInterval(async () => {
        try {
          // If in mock mode, we just trigger the callback with mock data
          if (import.meta.env.VITE_USE_MOCK) {
             // Mock random update logic could go here
             return;
          }
          
          if (pollUrl) {
            const response = await fetch(pollUrl);
            const data = await response.json();
            onMessage(data);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, pollInterval);

      return () => clearInterval(interval);
    }
  }, [status, pollUrl, pollInterval]);

  return { status };
};
