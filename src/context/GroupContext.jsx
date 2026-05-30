import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchMyGroup,
  createGroup as apiCreateGroup,
  fetchMyGroupInvites,
  sendGroupInvite,
  respondToGroupInvite,
  leaveGroup as apiLeaveGroup,
  transferGroupAdmin,
  fetchGroupLeaderboard,
} from '@/api/index';

// How often to poll for new invites (ms)
const INVITE_POLL_INTERVAL = 15_000;

const GroupContext = createContext(null);

export const GroupProvider = ({ children }) => {
  const { user } = useAuth();
  const [group, setGroup]               = useState(null);
  const [members, setMembers]           = useState([]);
  const [leaderboard, setLeaderboard]   = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [sentInvites, setSentInvites]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [inviteError, setInviteError]   = useState(null);

  // Ref keeps the latest invite count so the polling closure can compare
  const prevInviteCount = useRef(0);

  // ── Refresh: uses allSettled so one failing call doesn't kill the rest ────
  const refresh = useCallback(async () => {
    if (!user?.roll) {
      setGroup(null); setMembers([]); setPendingInvites([]);
      setSentInvites([]); setLeaderboard([]); setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        fetchMyGroup(),
        fetchMyGroupInvites(),
        fetchGroupLeaderboard(),
      ]);

      const groupData   = results[0].status === 'fulfilled' ? results[0].value : null;
      const invitesData = results[1].status === 'fulfilled' ? results[1].value : [];
      const lbData      = results[2].status === 'fulfilled' ? results[2].value : [];

      // Log any failures for debugging
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          const names = ['fetchMyGroup', 'fetchMyGroupInvites', 'fetchGroupLeaderboard'];
          console.warn(`[GroupContext] ${names[i]} failed:`, r.reason?.message || r.reason);
        }
      });

      setGroup(groupData || null);
      setMembers(groupData?.members || []);
      setPendingInvites(invitesData || []);
      setLeaderboard(lbData || []);
      setSentInvites([]);
    } catch (err) {
      console.error('[GroupContext] refresh error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.roll]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Invite polling: check for new invites every 15 s ─────────────────────
  useEffect(() => {
    if (!user?.roll) return;

    const poll = async () => {
      try {
        const invites = await fetchMyGroupInvites();
        const incoming = Array.isArray(invites) ? invites : [];
        setPendingInvites(incoming);
        // If the count grew since last check, also refresh full state
        if (incoming.length > prevInviteCount.current) {
          refresh().catch(() => {});
        }
        prevInviteCount.current = incoming.length;
      } catch {
        // Silently ignore — main refresh handles error surfacing
      }
    };

    const timer = setInterval(poll, INVITE_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [user?.roll, refresh]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const createGroup = useCallback(async (name, targetHours, penaltyPoints) => {
    const thours = parseFloat(targetHours);
    const ppoints = parseFloat(penaltyPoints);

    const newGroup = await apiCreateGroup(name, thours, ppoints);

    // Optimistically set group state from the create response so the UI
    // switches to "in group" view immediately — don't depend on refresh.
    setGroup({
      ...newGroup,
      target_hours: newGroup.target_hours ?? thours,
      penalty_points: newGroup.penalty_points ?? ppoints,
      myRole: 'ADMIN',
      members: [{
        uid:  user?.uid,
        name: user?.name || 'You',
        roll: user?.roll,
        role: 'ADMIN',
        todayHours: 0,
        points: 0,
      }],
    });
    setMembers([{
      uid:  user?.uid,
      name: user?.name || 'You',
      roll: user?.roll,
      role: 'ADMIN',
      todayHours: 0,
      points: 0,
    }]);

    // Background refresh for full authoritative data (leaderboard etc.)
    refresh().catch(() => {});
    return newGroup;
  }, [refresh, user]);

  const inviteMember = useCallback(async (receiverRoll) => {
    setInviteError(null);
    try {
      await sendGroupInvite(receiverRoll.trim().toUpperCase());
      setSentInvites(prev => [
        ...prev,
        { id: `opt-${Date.now()}`, receiverRoll: receiverRoll.trim().toUpperCase(), status: 'PENDING' },
      ]);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send invite';
      setInviteError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const respondToInvite = useCallback(async (inviteId, accept) => {
    try {
      await respondToGroupInvite(inviteId, accept ? 'ACCEPT' : 'REJECT');
      refresh().catch(() => {});
    } catch (err) {
      console.error('[GroupContext] respondToInvite:', err.message);
    }
  }, [refresh]);

  const leaveGroup = useCallback(async () => {
    await apiLeaveGroup();
    // Optimistically clear group state
    setGroup(null);
    setMembers([]);
    refresh().catch(() => {});
  }, [refresh]);

  const transferAdmin = useCallback(async (newAdminUid) => {
    await transferGroupAdmin(newAdminUid);
    refresh().catch(() => {});
  }, [refresh]);

  // ── Computed helpers ──────────────────────────────────────────────────────
  const isAdmin = group?.myRole === 'ADMIN';

  const myMember = members.find(
    m => m.uid === user?.uid || m.roll === user?.roll,
  );

  const remainingHours = group && myMember
    ? Math.max(0, (group.target_hours ?? 0) - (myMember.todayHours || 0))
    : 0;

  const targetMet = myMember
    ? (myMember.todayHours || 0) >= (group?.target_hours || 0)
    : false;

  return (
    <GroupContext.Provider value={{
      group,
      members,
      leaderboard,
      pendingInvites,
      sentInvites,
      loading,
      inviteError,
      setInviteError,
      isAdmin,
      remainingHours,
      targetMet,
      createGroup,
      inviteMember,
      respondToInvite,
      leaveGroup,
      transferAdmin,
      refresh,
    }}>
      {children}
    </GroupContext.Provider>
  );
};

export const useGroup = () => {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroup must be used inside <GroupProvider>');
  return ctx;
};
