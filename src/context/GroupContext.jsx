import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

  // ── Refresh: parallel fetch from real API ─────────────────────────────────
  const refresh = useCallback(async () => {
    if (!user?.roll) {
      setGroup(null); setMembers([]); setPendingInvites([]);
      setSentInvites([]); setLeaderboard([]); setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [groupData, invitesData, lbData] = await Promise.all([
        fetchMyGroup(),
        fetchMyGroupInvites(),
        fetchGroupLeaderboard(),
      ]);
      setGroup(groupData || null);
      setMembers(groupData?.members || []);
      setPendingInvites(invitesData || []);
      setLeaderboard(lbData || []);
      setSentInvites([]);  // reset; populated optimistically on sendInvite
    } catch (err) {
      console.error('[GroupContext] refresh error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.roll]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const createGroup = useCallback(async (name, targetHours, penaltyPoints) => {
    const newGroup = await apiCreateGroup(
      name,
      parseFloat(targetHours),
      parseFloat(penaltyPoints),
    );
    await refresh();
    return newGroup;
  }, [refresh]);

  const inviteMember = useCallback(async (receiverRoll) => {
    setInviteError(null);
    try {
      await sendGroupInvite(receiverRoll.trim().toUpperCase());
      // Optimistic: show in "sent" list immediately
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
      await refresh();
    } catch (err) {
      console.error('[GroupContext] respondToInvite:', err.message);
    }
  }, [refresh]);

  const leaveGroup = useCallback(async () => {
    await apiLeaveGroup();
    await refresh();
  }, [refresh]);

  const transferAdmin = useCallback(async (newAdminUid) => {
    await transferGroupAdmin(newAdminUid);
    await refresh();
  }, [refresh]);

  // ── Computed helpers ──────────────────────────────────────────────────────
  // Backend returns myRole on the group object; use it for admin check
  const isAdmin = group?.myRole === 'ADMIN';

  // Identify the current user's member record (matched by uid or roll)
  const myMember = members.find(
    m => m.uid === user?.uid || m.roll === user?.roll,
  );

  // target_hours is snake_case from the Supabase row
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
