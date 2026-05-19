import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Target, ShieldAlert, Award, ArrowLeft, Plus,
  Clock, Trophy, CheckCircle, XCircle, UserPlus, LogOut, Bell
} from 'lucide-react';
import { useGroup } from '@/context/GroupContext';
import { useAuth } from '@/context/AuthContext';
import CreateGroupModal from '@/components/modals/CreateGroupModal';
import InviteMemberModal from '@/components/modals/InviteMemberModal';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } }
};

const StudentGroupDashboard = () => {
  const { user } = useAuth();
  const { roll } = useParams();
  const {
    group, members, pendingInvites, loading,
    createGroup, respondToInvite, leaveGroup,
    isAdmin, remainingHours, targetMet
  } = useGroup();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const fmtRemaining = (hrs) => {
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground animate-pulse">Loading group data...</p>
      </div>
    );
  }

  // ── NO GROUP STATE — show empty state + any pending invites ────────────────
  if (!group) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <Link to={`/student/${roll}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        {/* Pending invites even when not in a group */}
        <AnimatePresence mode="popLayout">
          {pendingInvites?.length > 0 && (
            <motion.div variants={item} className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Bell size={14} /> Pending Group Invitations
              </p>
              {pendingInvites.map(invite => (
                <motion.div
                  key={invite.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-5 glass-card rounded-2xl border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0">
                      <Users size={22} />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{invite.groupName}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Invited by <span className="font-medium text-foreground">{invite.senderName}</span>
                        {' · '}Daily target: <span className="font-medium text-primary">{invite.targetHours}h</span>
                        {' · '}Penalty: <span className="font-medium text-rose-500">-{invite.penaltyPoints}pts</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => respondToInvite(invite.id, false)}
                      className="px-4 py-2 rounded-full bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm font-medium flex items-center gap-1.5"
                    >
                      <XCircle size={16} /> Decline
                    </button>
                    <button
                      onClick={() => respondToInvite(invite.id, true)}
                      className="px-4 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium flex items-center gap-1.5 shadow-md shadow-primary/20"
                    >
                      <CheckCircle size={16} /> Accept
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state CTA */}
        <motion.div variants={item} className="max-w-2xl mx-auto text-center">
          <div className="glass-card p-12 rounded-3xl border border-primary/20 bg-gradient-to-b from-secondary/50 to-background">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="text-primary" size={40} />
            </div>
            <h2 className="text-3xl font-bold mb-4">Study Better Together</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Create a productivity group with your friends. Set daily targets, track hours, and hold each other accountable with a shared leaderboard and penalty system.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-medium hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto shadow-lg shadow-primary/20"
            >
              <Plus size={20} /> Create a Group
            </button>
          </div>
        </motion.div>

        <CreateGroupModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={createGroup}
        />
      </motion.div>
    );
  }

  // ── IN GROUP STATE ──────────────────────────────────────────────────────────
  const totalGroupPoints = members.reduce((sum, m) => sum + (m.points || 0), 0);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <Link to={`/student/${roll}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-2 transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 flex-wrap">
            {group.name}
            <span className="text-sm font-normal px-3 py-1 bg-primary/10 text-primary rounded-full">
              Rank #{group.rank}
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {members.length}/5 members · {isAdmin ? 'You are the group admin' : 'Member'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2 text-sm font-semibold text-emerald-500 border border-emerald-500/20">
            <Trophy size={16} /> {totalGroupPoints} pts
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2"
            >
              <UserPlus size={16} /> Invite Member
            </button>
          )}
          <button
            onClick={leaveGroup}
            className="bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2"
          >
            <LogOut size={16} /> Leave
          </button>
        </div>
      </div>

      {/* Target reminder banner for the current user */}
      <AnimatePresence>
        {!targetMet && remainingHours > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-4"
          >
            <div className="w-10 h-10 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center shrink-0">
              <Target size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold">Your Daily Target</p>
              <p className="text-xs text-amber-600 mt-0.5">
                You need <span className="font-bold">{fmtRemaining(remainingHours)}</span> more to hit today's {group.targetHours}h target. Penalty applies at 10:00 PM.
              </p>
            </div>
          </motion.div>
        )}
        {targetMet && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4"
          >
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-600">Target Complete! 🎉</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You've hit today's {group.targetHours}h target. No penalty for you today!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div variants={item} className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="flex items-center gap-4 mb-3 relative">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500">
              <Target size={22} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Daily Target</p>
              <h3 className="text-2xl font-bold">{group.targetHours}h</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground relative">Set by the group creator</p>
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="flex items-center gap-4 mb-3 relative">
            <div className="w-12 h-12 bg-rose-500/20 rounded-xl flex items-center justify-center text-rose-500">
              <ShieldAlert size={22} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Miss Penalty</p>
              <h3 className="text-2xl font-bold text-rose-500">-{group.penaltyPoints}pts</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground relative">Applied at 10:00 PM if target missed</p>
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="flex items-center gap-4 mb-3 relative">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
              <Award size={22} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Group Streak</p>
              <h3 className="text-2xl font-bold">{group.streak} Days</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground relative">Everyone met target consecutively</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Members Progress */}
        <motion.div variants={item} className="lg:col-span-2 glass-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Users size={20} className="text-primary" /> Members Progress (Today)
          </h3>
          <div className="space-y-5">
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground italic text-center py-6">No members yet.</p>
            )}
            {members.map((member, idx) => {
              const progress = Math.min(100, ((member.todayHours || 0) / group.targetHours) * 100);
              const isCompleted = (member.todayHours || 0) >= group.targetHours;
              const isPenalized = member.status === 'Penalty Applied';
              const isMe = member.roll === user?.roll;

              return (
                <motion.div
                  key={member.roll || idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-4 rounded-xl ${isMe ? 'bg-primary/5 border border-primary/10' : 'bg-secondary/30'}`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {member.name}
                        {isMe && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-normal">You</span>}
                        {member.role === 'ADMIN' && <span className="text-xs bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded-full font-normal">Admin</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{member.todayHours || 0}h studied · {member.points || 0} pts</p>
                    </div>
                    <div className={`text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                      isPenalized
                        ? 'bg-rose-500/15 text-rose-500'
                        : isCompleted
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'bg-amber-500/15 text-amber-500'
                    }`}>
                      {isPenalized ? <XCircle size={13} /> : isCompleted ? <CheckCircle size={13} /> : <Clock size={13} />}
                      {isPenalized ? 'Penalty Applied' : isCompleted ? 'Target Met' : 'In Progress'}
                    </div>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        isPenalized ? 'bg-rose-500' : isCompleted ? 'bg-emerald-500' : 'bg-primary'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: idx * 0.1 }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                    <span>{member.todayHours || 0}h done</span>
                    <span>{group.targetHours}h target</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Group Leaderboard */}
        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" /> Group Leaderboard
          </h3>
          <div className="space-y-3">
            {(group.leaderboard || []).map((team, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl flex items-center justify-between transition-colors ${
                  team.name === group.name ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/50 hover:bg-secondary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx === 0 ? 'bg-amber-400 text-black'
                    : idx === 1 ? 'bg-slate-300 text-black'
                    : idx === 2 ? 'bg-amber-700 text-white'
                    : 'bg-secondary text-muted-foreground'
                  }`}>
                    {team.rank}
                  </div>
                  <p className={`font-medium text-sm ${team.name === group.name ? 'text-primary' : ''}`}>{team.name}</p>
                </div>
                <div className="font-bold text-sm">
                  {team.points} <span className="text-muted-foreground font-normal text-xs">pts</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <InviteMemberModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} />
    </motion.div>
  );
};

export default StudentGroupDashboard;
