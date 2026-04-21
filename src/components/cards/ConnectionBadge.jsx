import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';

const ConnectionBadge = ({ status }) => {
  const configs = {
    live: {
      label: 'Live',
      icon: Wifi,
      className: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20',
      dot: 'bg-emerald-500 animate-pulse'
    },
    polling: {
      label: 'Polling',
      icon: RefreshCw,
      className: 'bg-amber-500/10 text-amber-500 ring-amber-500/20',
      dot: 'bg-amber-500'
    },
    connecting: {
      label: 'Connecting',
      icon: RefreshCw,
      className: 'bg-blue-500/10 text-blue-500 ring-blue-500/20',
      dot: 'bg-blue-500 animate-spin'
    },
    error: {
      label: 'Offline',
      icon: WifiOff,
      className: 'bg-rose-500/10 text-rose-500 ring-rose-500/20',
      dot: 'bg-rose-500'
    }
  };

  const config = configs[status] || configs.connecting;
  const Icon = config.icon;

  return (
    <span className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ring-1 transition-all",
      config.className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)}></span>
      <Icon size={10} className={status === 'connecting' ? 'animate-spin' : ''} />
      {config.label}
    </span>
  );
};

export default ConnectionBadge;
