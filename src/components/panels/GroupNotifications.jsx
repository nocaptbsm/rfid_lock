import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X, Target } from 'lucide-react';
import { useGroup } from '@/context/GroupContext';
import { useAuth } from '@/context/AuthContext';

const GroupNotifications = () => {
  const { user } = useAuth();
  const { group, pendingInvites, respondToInvite, remainingHours, targetMet, loading } = useGroup();

  // Don't show anything while loading or if no invites and no group
  if (loading) return null;
  if (!pendingInvites?.length && !group) return null;

  // Format hours/minutes nicely
  const fmtRemaining = (hrs) => {
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {/* Pending invite cards */}
        {pendingInvites?.map(invite => (
          <motion.div
            key={invite.id}
            layout
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25 }}
            className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between gap-4 shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center shrink-0">
                <Bell size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Group Invitation</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  <span className="font-semibold text-foreground">{invite.senderName}</span>
                  {' '}invited you to join{' '}
                  <span className="font-semibold text-primary">{invite.groupName}</span>
                  {' '}· Target: {invite.targetHours}h · Penalty: {invite.penaltyPoints}pts
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => respondToInvite(invite.id, true)}
                className="h-8 px-3 rounded-full bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all duration-200 flex items-center gap-1 text-xs font-medium"
                title="Accept"
              >
                <Check size={14} /> Accept
              </button>
              <button
                onClick={() => respondToInvite(invite.id, false)}
                className="h-8 px-3 rounded-full bg-rose-500/20 text-rose-600 hover:bg-rose-500 hover:text-white transition-all duration-200 flex items-center gap-1 text-xs font-medium"
                title="Reject"
              >
                <X size={14} /> Reject
              </button>
            </div>
          </motion.div>
        ))}

        {/* Target reminder — only show if in a group AND target not yet met AND before 10 PM */}
        {group && !targetMet && remainingHours > 0 && group.target_hours && (
          <motion.div
            key="target-reminder"
            layout
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-4 shadow-sm"
          >
            <div className="w-10 h-10 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center shrink-0">
              <Target size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Target Reminder — {group.name}</p>
              <p className="text-xs text-amber-600 mt-0.5 font-medium">
                You still need <span className="font-bold">{fmtRemaining(remainingHours)}</span> to hit today's {group.target_hours}h target. Keep going!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GroupNotifications;
