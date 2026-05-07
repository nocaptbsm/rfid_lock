import React, { useState, useEffect } from 'react';
import { getEffectiveNow, getCutoffTime } from '@/utils/sessionUtils';

const LiveTimer = ({ entryTime }) => {
  const [elapsed, setElapsed] = useState('');
  const [capped, setCapped] = useState(false);

  useEffect(() => {
    const update = () => {
      const start = new Date(entryTime);
      const cutoff = getCutoffTime(start);
      const now = new Date();
      const effectiveEnd = getEffectiveNow(entryTime);
      const diff = Math.max(0, effectiveEnd - start);
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsed(`${hours}h ${mins}m ${secs}s`);

      // If past 9 PM, mark as capped and stop the timer
      if (now >= cutoff) {
        setCapped(true);
      }
    };

    update();
    // Only keep ticking if not capped
    if (!capped) {
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [entryTime, capped]);

  return (
    <span className="flex items-center gap-2 tabular-nums">
      {elapsed}
      {capped ? (
        <span className="text-xs text-amber-500 font-medium">(auto-closed)</span>
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      )}
    </span>
  );
};

export default LiveTimer;
