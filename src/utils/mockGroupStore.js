// ─── Group System Mock Store ─────────────────────────────────────────────────
// This simulates a backend database in localStorage so invite state persists
// across all components and across page navigations (multi-tab friendly).
// Each key is prefixed with 'group_' to avoid collisions.

const STORAGE_KEYS = {
  GROUPS: 'group_groups',          // map: groupId → group object
  MEMBERS: 'group_members',        // map: groupId → [student rolls]
  INVITES: 'group_invites',        // array of invite objects
  USER_GROUP: 'group_user_group',  // map: roll → groupId (which group is user in)
};

const read = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const write = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

// ─── Init default mock state if not present ───────────────────────────────────
export const initMockGroupStore = () => {
  // Only seed if no data exists yet
  if (read(STORAGE_KEYS.GROUPS)) return;

  const groups = {
    'g-123': {
      id: 'g-123',
      name: 'Night Owls',
      targetHours: 5,
      penaltyPoints: 20,
      createdBy: '21CS042',
      rank: 1,
      totalPoints: 1250,
      streak: 5,
      leaderboard: [
        { rank: 1, name: 'Night Owls', points: 1250 },
        { rank: 2, name: 'Early Birds', points: 1100 },
        { rank: 3, name: 'Procrastinators', points: 950 },
      ],
    },
  };

  const members = {
    'g-123': [
      { roll: '21CS042', name: 'Abhishek Ranjan', points: 450, todayHours: 6, status: 'Completed', role: 'ADMIN' },
      { roll: '21CS011', name: 'Rahul Sharma',    points: 300, todayHours: 3, status: 'In Progress', role: 'MEMBER' },
      { roll: '21CS088', name: 'Priya Singh',     points: 500, todayHours: 5.5, status: 'Completed', role: 'MEMBER' },
    ],
  };

  const userGroup = {
    '21CS042': 'g-123',
    '21CS011': 'g-123',
    '21CS088': 'g-123',
  };

  const invites = [];

  write(STORAGE_KEYS.GROUPS, groups);
  write(STORAGE_KEYS.MEMBERS, members);
  write(STORAGE_KEYS.USER_GROUP, userGroup);
  write(STORAGE_KEYS.INVITES, invites);
};

// ─── Store API ─────────────────────────────────────────────────────────────────

export const mockGroupStore = {
  // Get group a user belongs to (null if not in any group)
  getGroupForUser(roll) {
    const userGroup = read(STORAGE_KEYS.USER_GROUP) || {};
    const groupId = userGroup[roll];
    if (!groupId) return null;
    const groups = read(STORAGE_KEYS.GROUPS) || {};
    return groups[groupId] || null;
  },

  // Get members for the group a user is in
  getMembersForUser(roll) {
    const userGroup = read(STORAGE_KEYS.USER_GROUP) || {};
    const groupId = userGroup[roll];
    if (!groupId) return [];
    const members = read(STORAGE_KEYS.MEMBERS) || {};
    return members[groupId] || [];
  },

  // Get pending invites where receiver_id === roll
  getInvitesForUser(roll) {
    const invites = read(STORAGE_KEYS.INVITES) || [];
    return invites.filter(inv => inv.receiverRoll === roll && inv.status === 'PENDING');
  },

  // Get all sent invites FROM a group (so creator can see who's pending)
  getSentInvitesForGroup(groupId) {
    const invites = read(STORAGE_KEYS.INVITES) || [];
    return invites.filter(inv => inv.groupId === groupId && inv.status === 'PENDING');
  },

  // Send an invite from a group to a receiver's roll number
  sendInvite({ groupId, groupName, targetHours, penaltyPoints, senderRoll, senderName, receiverRoll }) {
    const invites = read(STORAGE_KEYS.INVITES) || [];

    // Prevent duplicate pending invites to the same group
    const alreadyInvited = invites.some(
      inv => inv.groupId === groupId && inv.receiverRoll === receiverRoll && inv.status === 'PENDING'
    );
    if (alreadyInvited) return { success: false, error: 'Already invited' };

    // Check if receiver is already in a group
    const userGroup = read(STORAGE_KEYS.USER_GROUP) || {};
    if (userGroup[receiverRoll]) return { success: false, error: 'Student is already in a group' };

    // Check max 5 members
    const members = read(STORAGE_KEYS.MEMBERS) || {};
    const currentMembers = members[groupId] || [];
    if (currentMembers.length >= 5) return { success: false, error: 'Group is full (max 5 members)' };

    invites.push({
      id: `inv-${Date.now()}`,
      groupId,
      groupName,
      targetHours,
      penaltyPoints,
      senderRoll,
      senderName,
      receiverRoll,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });

    write(STORAGE_KEYS.INVITES, invites);
    return { success: true };
  },

  // Accept an invite
  acceptInvite(inviteId, receiverRoll, receiverName) {
    const invites = read(STORAGE_KEYS.INVITES) || [];
    const idx = invites.findIndex(inv => inv.id === inviteId);
    if (idx === -1) return false;

    const invite = invites[idx];
    invites[idx] = { ...invite, status: 'ACCEPTED' };
    write(STORAGE_KEYS.INVITES, invites);

    // Add to members
    const members = read(STORAGE_KEYS.MEMBERS) || {};
    members[invite.groupId] = members[invite.groupId] || [];
    members[invite.groupId].push({
      roll: receiverRoll,
      name: receiverName || receiverRoll,
      points: 0,
      todayHours: 0,
      status: 'In Progress',
      role: 'MEMBER',
    });
    write(STORAGE_KEYS.MEMBERS, members);

    // Map user to group
    const userGroup = read(STORAGE_KEYS.USER_GROUP) || {};
    userGroup[receiverRoll] = invite.groupId;
    write(STORAGE_KEYS.USER_GROUP, userGroup);

    return true;
  },

  // Reject an invite
  rejectInvite(inviteId) {
    const invites = read(STORAGE_KEYS.INVITES) || [];
    const idx = invites.findIndex(inv => inv.id === inviteId);
    if (idx === -1) return false;
    invites[idx] = { ...invites[idx], status: 'REJECTED' };
    write(STORAGE_KEYS.INVITES, invites);
    return true;
  },

  // Create a new group
  createGroup({ name, targetHours, penaltyPoints, creatorRoll, creatorName }) {
    const groupId = `g-${Date.now()}`;
    const groups = read(STORAGE_KEYS.GROUPS) || {};
    groups[groupId] = {
      id: groupId,
      name,
      targetHours: parseFloat(targetHours),
      penaltyPoints: parseFloat(penaltyPoints),
      createdBy: creatorRoll,
      rank: Object.keys(groups).length + 1,
      totalPoints: 0,
      streak: 0,
      leaderboard: [{ rank: 1, name, points: 0 }],
    };
    write(STORAGE_KEYS.GROUPS, groups);

    // Add creator as admin member
    const members = read(STORAGE_KEYS.MEMBERS) || {};
    members[groupId] = [{
      roll: creatorRoll,
      name: creatorName || creatorRoll,
      points: 0,
      todayHours: 0,
      status: 'In Progress',
      role: 'ADMIN',
    }];
    write(STORAGE_KEYS.MEMBERS, members);

    // Map creator to group
    const userGroup = read(STORAGE_KEYS.USER_GROUP) || {};
    userGroup[creatorRoll] = groupId;
    write(STORAGE_KEYS.USER_GROUP, userGroup);

    return groups[groupId];
  },

  // Leave a group
  leaveGroup(roll) {
    const userGroup = read(STORAGE_KEYS.USER_GROUP) || {};
    const groupId = userGroup[roll];
    if (!groupId) return;

    // Remove from members
    const members = read(STORAGE_KEYS.MEMBERS) || {};
    members[groupId] = (members[groupId] || []).filter(m => m.roll !== roll);
    write(STORAGE_KEYS.MEMBERS, members);

    // Remove user→group mapping
    delete userGroup[roll];
    write(STORAGE_KEYS.USER_GROUP, userGroup);
  },

  // Reset (for dev/testing)
  reset() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  },
};
