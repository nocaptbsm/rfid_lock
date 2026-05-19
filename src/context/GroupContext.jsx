import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { mockGroupStore, initMockGroupStore } from '@/utils/mockGroupStore';
import { getCutoffTime } from '@/utils/sessionUtils';

const GroupContext = createContext(null);

export const GroupProvider = ({ children }) => {
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [sentInvites, setSentInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteError, setInviteError] = useState(null);

  // ── Refresh all state from the mock store ──────────────────────────────────
  const refresh = useCallback(() => {
    if (!user?.roll) {
      setGroup(null);
      setMembers([]);
      setPendingInvites([]);
      setSentInvites([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Init seed data if first time
    if (import.meta.env.VITE_USE_MOCK) {
      initMockGroupStore();
    }

    const rawGroup = mockGroupStore.getGroupForUser(user.roll);
    const rawMembers = mockGroupStore.getMembersForUser(user.roll);
    const rawInvites = mockGroupStore.getInvitesForUser(user.roll);

    // Apply dynamic 10 PM penalty logic (same as session termination)
    const now = new Date();
    const cutoff = getCutoffTime(now);

    let processedMembers = rawMembers;
    if (rawGroup && now >= cutoff) {
      processedMembers = rawMembers.map(member => {
        if (member.todayHours < rawGroup.targetHours && member.status !== 'Completed') {
          return { ...member, points: member.points - rawGroup.penaltyPoints, status: 'Penalty Applied' };
        }
        return member;
      });
    }

    setGroup(rawGroup);
    setMembers(processedMembers);
    setPendingInvites(rawInvites);

    // Sent invites: only visible if user is group admin
    if (rawGroup) {
      const myMember = rawMembers.find(m => m.roll === user.roll);
      if (myMember?.role === 'ADMIN') {
        setSentInvites(mockGroupStore.getSentInvitesForGroup(rawGroup.id));
      }
    }

    setLoading(false);
  }, [user?.roll]);

  // ── Initial load + re-run when user changes ────────────────────────────────
  useEffect(() => {
    // Small simulated async delay
    const t = setTimeout(() => refresh(), 400);
    return () => clearTimeout(t);
  }, [refresh]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const createGroup = useCallback(async (name, targetHours, penaltyPoints) => {
    const newGroup = mockGroupStore.createGroup({
      name,
      targetHours,
      penaltyPoints,
      creatorRoll: user.roll,
      creatorName: user.name || user.roll,
    });
    refresh();
    return newGroup;
  }, [user, refresh]);

  const inviteMember = useCallback(async (receiverRoll) => {
    setInviteError(null);
    if (!group) return { success: false, error: 'Not in a group' };

    const myMember = members.find(m => m.roll === user.roll);
    const result = mockGroupStore.sendInvite({
      groupId: group.id,
      groupName: group.name,
      targetHours: group.targetHours,
      penaltyPoints: group.penaltyPoints,
      senderRoll: user.roll,
      senderName: myMember?.name || user.roll,
      receiverRoll: receiverRoll.trim().toUpperCase(),
    });

    if (!result.success) {
      setInviteError(result.error);
    } else {
      // Refresh sent invites immediately
      setSentInvites(mockGroupStore.getSentInvitesForGroup(group.id));
    }
    return result;
  }, [group, members, user]);

  const respondToInvite = useCallback(async (inviteId, accept) => {
    if (accept) {
      mockGroupStore.acceptInvite(inviteId, user.roll, user.name || user.roll);
    } else {
      mockGroupStore.rejectInvite(inviteId);
    }
    refresh();
  }, [user, refresh]);

  const leaveGroup = useCallback(async () => {
    mockGroupStore.leaveGroup(user.roll);
    refresh();
  }, [user, refresh]);

  // ── Computed helpers ────────────────────────────────────────────────────────
  const isAdmin = group && members.find(m => m.roll === user?.roll)?.role === 'ADMIN';

  // Calculate current user's remaining hours for reminder
  const myMember = members.find(m => m.roll === user?.roll);
  const remainingHours = group && myMember
    ? Math.max(0, group.targetHours - (myMember.todayHours || 0))
    : 0;

  const targetMet = myMember ? (myMember.todayHours || 0) >= (group?.targetHours || 0) : false;

  return (
    <GroupContext.Provider value={{
      group,
      members,
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
