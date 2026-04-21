import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, LogOut, User } from 'lucide-react';
import { cn } from '@/utils/cn';

const LiveScanFeed = ({ events }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Real-time Feed</h3>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase ring-1 ring-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Live
        </span>
      </div>
      
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-3 bg-secondary/30 rounded-xl border border-border/50 flex items-center gap-3 group hover:border-primary/30 transition-colors"
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                event.type === 'ENTRY' 
                  ? "bg-emerald-500/10 text-emerald-500" 
                  : "bg-rose-500/10 text-rose-500"
              )}>
                {event.type === 'ENTRY' ? <LogIn size={18} /> : <LogOut size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{event.roll}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{event.type}</p>
              </div>
              <div className="text-[11px] font-medium text-muted-foreground tabular-nums">
                {event.time}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LiveScanFeed;
