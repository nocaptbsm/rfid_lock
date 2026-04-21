import React from 'react';
import { cn } from '@/utils/cn';

const StatusBadge = ({ status, className }) => {
  const isInside = status?.toLowerCase() === 'inside';
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
      isInside 
        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
        : "bg-slate-500/10 text-slate-500 border border-slate-500/20",
      className
    )}>
      <span className={cn(
        "w-2 h-2 rounded-full animate-pulse",
        isInside ? "bg-emerald-500" : "bg-slate-500"
      )}></span>
      {status || 'Unknown'}
    </div>
  );
};

export default StatusBadge;
