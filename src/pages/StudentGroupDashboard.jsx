import React, { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Target, ShieldAlert, Award, ArrowLeft, Plus,
  Clock, Trophy, CheckCircle, XCircle, UserPlus, LogOut, Bell, ShieldCheck,
} from 'lucide-react';
import { useGroup } from '@/context/GroupContext';
import { useAuth } from '@/context/AuthContext';
import CreateGroupModal from '@/components/modals/CreateGroupModal';
import InviteMemberModal from '@/components/modals/InviteMemberModal';
import PushPermissionBanner from '@/components/notifications/PushPermissionBanner';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ── Leave / Transfer-Admin flow ────────────────────────────────────────────
const LeaveModal = ({ members, isAdmin, myUid, onConfirm, onCancel }) => {
  const [selectedUid, setSelectedUid] = useState('');
  const otherMembers = members.filter(m => m.uid !== myUid);
  const needsTransfer = isAdmin && otherMembers.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-card w-full max-w-md p-6 rounded-2xl border border-border shadow-xl"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-500">
            <LogOut size={20} />
          </div>
          <h2 className="text-xl font-bold">
            {needsTransfer ? 'Transfer Admin Before Leaving' : 'Leave Group?'}
          </h2>
        </div>

        {needsTransfer ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              You are the group admin. Pick a member to take over before you leave.
            </p>
            <select
              value={selectedUid}
              onChange={e => setSelectedUid(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">— Select new admin —</option>
              {otherMembers.map(m => (
                <option key={m.uid} value={m.uid}>{m.name} ({m.roll})</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
              >Cancel</button>
              <button
                disabled={!selectedUid}
                onClick={() => onConfirm(selectedUid)}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >Transfer & Leave</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-5">
              {isAdmin
                ? 'You are the only member. Leaving will permanently delete this group.'
                : 'Are you sure you want to leave the group?'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
              >Cancel</button>
              <button
                onClick={() => onConfirm(null)}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors text-sm font-medium"
              >{isAdmin ? 'Delete & Leave' : 'Leave'}</button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const StudentGroupDashboard = () => {
  const { user } = useAuth();
  const { roll } = useParams();

  // G-9: Block access to another student's group page
  if (roll && user?.roll && roll !== user.roll) {
    return <Navigate to={`/student/${user.roll}/group`} replace />;
  }

  const {
    group, members, leaderboard, pendingInvites, loading,
    createGroup, respondToInvite, leaveGroup, transferAdmin,
    isAdmin, remainingHours, targetMet,
  } = useGroup();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Contextual push prompt: show after user has been on the group page for 3s
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowPushPrompt(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const fmtRemaining = (hrs) => {
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const myUid = user?.uid;

  const handleLeaveConfirm = async (newAdminUid) => {
    setLeaveLoading(true);
    try {
      if (newAdminUid) await transferAdmin(newAdminUid);
      await leaveGroup();
    } finally {
      setLeaveLoading(false);
      setShowLeaveModal(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground animate-pulse">Loading group data...</p>
      </div>
    );
  }

  // ── NO GROUP ──────────────────────────────────────────────────────────────
  if (!group) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Contextual push notification prompt */}
        <PushPermissionBanner trigger={showPushPrompt} context="invite" />

        <Link to={`/student/${roll}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        <AnimatePresence mode="popLayout">
          {pendingInvites?.length > 0 && (
            <motion.div variants={item} className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Bell size={14} /> Pending Group Invitations
              </p>
              {pendingInvites.map(invite => (
                <motion.div
                  key={invite.id} layout
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
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
                    <button onClick={() => respondToInvite(invite.id, false)}
                      className="px-4 py-2 rounded-full bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm font-medium flex items-center gap-1.5">
                      <XCircle size={16} /> Decline
                    </button>
                    <button onClick={() => respondToInvite(invite.id, true)}
                      className="px-4 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium flex items-center gap-1.5 shadow-md shadow-primary/20">
                      <CheckCircle size={16} /> Accept
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Hero CTA: only show when no pending invites ── */}
        {!pendingInvites?.length ? (
          <motion.div variants={item} className="max-w-2xl mx-auto text-center">
            <div className="glass-card p-12 rounded-3xl border border-primary/20 bg-gradient-to-b from-secondary/50 to-background">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="text-primary" size={40} />
              </div>
              <h2 className="text-3xl font-bold mb-4">Study Better Together</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Create a productivity group with your friends. Set daily targets, track hours,
                and hold each other accountable with a shared leaderboard and penalty system.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-medium hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto shadow-lg shadow-primary/20"
              >
                <Plus size={20} /> Create a Group
              </button>
            </div>
          </motion.div>
        ) : (
          /* When invites exist, show a subtle "create instead" link */
          <motion.div variants={item} className="text-center">
            <p className="text-sm text-muted-foreground">
              Not interested in these invites?{' '}
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="text-primary underline-offset-2 hover:underline font-medium"
              >
                Create your own group
              </button>
            </p>
          </motion.div>
        )}

        <CreateGroupModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={createGroup} />
      </motion.div>
    );
  }

  // ── IN GROUP ──────────────────────────────────────────────────────────────
  // G-8: use live leaderboard from context, not the stale group.leaderboard
  const totalGroupPoints = members.reduce((sum, m) => sum + (m.points || 0), 0);
  // Find this group's rank from the live leaderboard
  const myRank = leaderboard.findIndex(l => l.group_id === group.id) + 1;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">

      {/* Leave / Transfer-Admin modal */}
      {showLeaveModal && (
        <LeaveModal
          members={members}
          isAdmin={isAdmin}
          myUid={myUid}
          onCancel={() => setShowLeaveModal(false)}
          onConfirm={handleLeaveConfirm}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <Link to={`/student/${roll}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-2 transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 flex-wrap">
            {group.name}
            {myRank > 0 && (
              <span className="text-sm font-normal px-3 py-1 bg-primary/10 text-primary rounded-full">
                Rank #{myRank}
              </span>
            )}
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
            <button onClick={() => setIsInviteModalOpen(true)}
              className="bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2">
              <UserPlus size={16} /> Invite Member
            </button>
          )}
          <button
            onClick={() => setShowLeaveModal(true)}
            disabled={leaveLoading}
            className="bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
          >
            <LogOut size={16} /> {leaveLoading ? 'Leaving…' : 'Leave'}
          </button>
        </div>
      </div>

      {/* Target reminder banner */}
      <AnimatePresence>
        {!targetMet && remainingHours > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center shrink-0">
              <Target size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold">Your Daily Target</p>
              <p className="text-xs text-amber-600 mt-0.5">
                You need <span className="font-bold">{fmtRemaining(remainingHours)}</span> more to hit today's {group.target_hours}h target. Penalty applies at 10:00 PM.
              </p>
            </div>
          </motion.div>
        )}
        {targetMet && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-600">Target Complete! 🎉</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You've hit today's {group.target_hours}h target. No penalty for you today!
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
              <h3 className="text-2xl font-bold">{group.target_hours}h</h3>
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
              <h3 className="text-2xl font-bold text-rose-500">-{group.penalty_points}pts</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground relative">Applied at 10:00 PM if target missed</p>
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="flex items-center gap-4 mb-3 relative">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Admin</p>
              <h3 className="text-xl font-bold truncate">{members.find(m => m.role === 'ADMIN')?.name || '—'}</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground relative">Current group admin</p>
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
              const progress = Math.min(100, ((member.todayHours || 0) / group.target_hours) * 100);
              const isCompleted = (member.todayHours || 0) >= group.target_hours;
              // penaltyApplied comes from the backend enriched member (points < 0 or explicit flag)
              const isPenalized = member.penaltyApplied || false;
              const isMe = member.uid === user?.uid || member.roll === user?.roll;

              return (
                <motion.div key={member.uid || idx}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
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
                      isPenalized ? 'bg-rose-500/15 text-rose-500'
                      : isCompleted ? 'bg-emerald-500/15 text-emerald-500'
                      : 'bg-amber-500/15 text-amber-500'
                    }`}>
                      {isPenalized ? <XCircle size={13} /> : isCompleted ? <CheckCircle size={13} /> : <Clock size={13} />}
                      {isPenalized ? 'Penalty Applied' : isCompleted ? 'Target Met' : 'In Progress'}
                    </div>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${isPenalized ? 'bg-rose-500' : isCompleted ? 'bg-emerald-500' : 'bg-primary'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: idx * 0.1 }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                    <span>{member.todayHours || 0}h done</span>
                    <span>{group.target_hours}h target</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* G-8: Live Group Leaderboard from context */}
        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" /> Group Leaderboard
          </h3>
          <div className="space-y-3">
            {leaderboard.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No groups ranked yet.</p>
            )}
            {leaderboard.map((team, idx) => (
              <div key={team.group_id || idx}
                className={`p-4 rounded-xl flex items-center justify-between transition-colors ${
                  team.group_id === group.id ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/50 hover:bg-secondary'
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
                  <p className={`font-medium text-sm ${team.group_id === group.id ? 'text-primary' : ''}`}>{team.name}</p>
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
