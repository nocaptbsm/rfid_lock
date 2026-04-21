import React, { useState, useEffect } from 'react';

const LiveTimer = ({ entryTime }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      const start = new Date(entryTime);
      const now = new Date();
      const diff = Math.max(0, now - start);
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsed(`${hours}h ${mins}m ${secs}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [entryTime]);

  return (
    <span className="flex items-center gap-2 tabular-nums">
      {elapsed}
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
    </span>
  );
};

export default LiveTimer;
