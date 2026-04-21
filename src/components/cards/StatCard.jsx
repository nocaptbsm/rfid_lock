import React from 'react';
import { cn } from '@/utils/cn';

const StatCard = ({ title, value, icon: Icon, trend, subValue, className }) => {
  return (
    <div className={cn("glass-card p-6 rounded-2xl space-y-4 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300", className)}>
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
          <Icon size={24} />
        </div>
        {trend && (
          <div className={cn(
            "px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1",
            trend > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
          )}>
            {trend > 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
          {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
