const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const attendanceService = require('../services/attendanceService');
const { apiKeyValidator, hmacValidator, requireAdmin, adminLogin, requireStudent } = require('../middleware/auth');
const socketService = require('../services/socketService');
const supabase = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// ─── Rate Limiters ───────────────────────────────────────────────────

/** Scan endpoint: max 10 requests per minute per device */
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.body?.device_id || req.ip,
  message: { error: 'RATE_LIMITED', message: 'Too many scans. Try again in a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Admin login: max 5 attempts per 15 min per IP */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ═══════════════════════════════════════════════════════════════════════
// DEVICE ENDPOINTS (ESP32)
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /scan — Physical RFID Scan handler
 * Uses HMAC validator (falls back to API key if DEVICE_SHARED_SECRET not set)
 * Rate-limited to 10/min per device
 */
router.post('/scan', scanLimiter, hmacValidator, async (req, res) => {
  try {
    const { uid, nonce } = req.body;
    if (!uid) return res.status(400).json({ error: 'UID is required' });

    // Nonce replay check (only if nonce present — Phase 2)
    if (nonce) {
      const nonceOk = await attendanceService.checkNonce(nonce);
      if (!nonceOk) {
        console.warn(`[SECURITY] Replay attack detected! nonce=${nonce}, uid=${uid}`);
        return res.status(409).json({ error: 'REPLAY_DETECTED' });
      }
    }

    const result = await attendanceService.processScan(uid, req.deviceId);
    
    // If card was denied, return 403 or 429
    if (!result.authorized) {
      if (result.error === 'COOLDOWN') {
        return res.status(429).json(result);
      }
      
      socketService.broadcast('SECURITY_ALERT', {
        type: result.error,
        uid: result.uid,
        timestamp: result.timestamp
      });
      return res.status(403).json(result);
    }

    // Broadcast successful scan via WebSocket
    socketService.broadcast('SCAN_EVENT', result);
    res.json(result);
  } catch (error) {
    console.error('Scan error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /device/allowlist — ESP32 syncs its local authorized UID cache
 * Protected by same device auth
 */
router.get('/device/allowlist', hmacValidator, async (req, res) => {
  try {
    const uids = await attendanceService.getAuthorizedUIDs();
    res.json({ uids, count: uids.length, synced_at: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════
// ADMIN AUTH
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /admin/login — Admin login with JWT
 */
router.post('/admin/login', loginLimiter, adminLogin);


// ═══════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS (Protected by JWT)
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /admin/logs — All scan logs for admin table
 */
router.get('/admin/logs', requireAdmin, async (req, res) => {
  try {
    const logs = await attendanceService.getAllScans();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/students — All registered students
 */
router.get('/admin/students', requireAdmin, async (req, res) => {
  try {
    const students = await attendanceService.getAllStudents();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/live — Active sessions for admin monitor
 */
router.get('/admin/live', requireAdmin, async (req, res) => {
  try {
    const activeSessions = await attendanceService.getActiveStudents();
    res.json(activeSessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /admin/logs — Clear all logs (Admin Only)
 */
router.delete('/admin/logs', requireAdmin, async (req, res) => {
  try {
    const result = await attendanceService.clearAllLogs();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /admin/student/:uid/logs — Clear specific student logs
 */
router.delete('/admin/student/:uid/logs', requireAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const { roll } = req.query;
    const result = await attendanceService.clearStudentLogs(uid);

    // Broadcast to clear student dashboard in real-time
    socketService.broadcast('RECORDS_CLEARED', { uid, roll });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /admin/student/:uid — Update student name and/or UID
 * Accepts: { name, uid } — uid is optional (card-edit form sends both)
 * Always regenerates the student's login password to match the new name/UID.
 */
router.put('/admin/student/:uid', requireAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const { name, uid: newUid } = req.body;

    if (!name && !newUid) {
      return res.status(400).json({ error: 'At least name or uid is required' });
    }

    let result;
    if (newUid && newUid.trim().toUpperCase() !== uid.toUpperCase()) {
      // Full card update: name + UID changed — use updateCardDetails
      if (!name) return res.status(400).json({ error: 'Name is required when changing UID' });
      result = await attendanceService.updateCardDetails(uid, { uid: newUid, name });
    } else {
      // Name-only update
      if (!name) return res.status(400).json({ error: 'Name is required' });
      result = await attendanceService.updateStudentName(uid, name);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Card Management ─────────────────────────────────────────────────

/**
 * GET /admin/cards — List all cards with status
 */
router.get('/admin/cards', requireAdmin, async (req, res) => {
  try {
    const cards = await attendanceService.getAllCards();
    res.json(cards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /admin/cards — Register a new RFID card
 */
router.post('/admin/cards', requireAdmin, async (req, res) => {
  try {
    const { uid, name, roll_no, role } = req.body;
    const isMaster = role === 'MASTER';
    
    if (!uid) {
      return res.status(400).json({ error: 'uid is required' });
    }
    if (!isMaster && !name) {
      return res.status(400).json({ error: 'name is required for students' });
    }
    
    const result = await attendanceService.registerCard(uid, name || '', roll_no || uid, role || 'STUDENT');
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /admin/cards/:uid/suspend — Suspend a card
 */
router.post('/admin/cards/:uid/suspend', requireAdmin, async (req, res) => {
  try {
    const result = await attendanceService.suspendCard(req.params.uid);
    socketService.broadcast('CARD_STATUS_CHANGED', { uid: req.params.uid, status: 'SUSPENDED' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /admin/cards/:uid/activate — Reactivate a suspended card
 */
router.post('/admin/cards/:uid/activate', requireAdmin, async (req, res) => {
  try {
    const result = await attendanceService.activateCard(req.params.uid);
    socketService.broadcast('CARD_STATUS_CHANGED', { uid: req.params.uid, status: 'AUTHORIZED' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /admin/cards/:uid — Delete a registered card
 */
router.delete('/admin/cards/:uid', requireAdmin, async (req, res) => {
  try {
    const result = await attendanceService.deleteCard(req.params.uid);
    socketService.broadcast('CARD_DELETED', { uid: req.params.uid });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/security-log — Unauthorized scan log
 */
router.get('/admin/security-log', requireAdmin, async (req, res) => {
  try {
    const log = await attendanceService.getSecurityLog();
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /student/login — Student login with UID and password
 */
router.post('/student/login', async (req, res) => {
  try {
    const { uid, password } = req.body;
    if (!uid || !password) return res.status(400).json({ error: 'UID and password required' });
    const stats = await attendanceService.verifyStudentLogin(uid, password);
    res.json(stats);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

/**
 * GET /student/:roll — Student stats (public, per-student)
 */
router.get('/student/:roll', async (req, res) => {
  try {
    const stats = await attendanceService.getStudentStats(req.params.roll);
    res.json(stats);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * GET /leaderboard — Monthly leaderboard (public)
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = await attendanceService.getLeaderboard();
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════
// FEEDBACK ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /feedback — Submit feedback (any authenticated user)
 * Body: { message: string, role: 'student'|'admin' }
 * Identifies user from JWT (admin) or X-Student-UID header (student)
 */
router.post('/feedback', async (req, res) => {
  try {
    const { message, role } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Feedback message is required' });
    }
    if (message.trim().length > 500) {
      return res.status(400).json({ error: 'Feedback must be 500 characters or less' });
    }

    // Determine who's submitting
    let userUid = null;
    let userName = 'Unknown';
    let userRole = role || 'student';

    // Try JWT first (admin users)
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(auth.slice(7), JWT_SECRET);
        if (payload.role === 'admin') {
          userUid = 'admin';
          userName = payload.sub || 'Admin';
          userRole = 'admin';
        }
      } catch (e) {
        // Token invalid — not admin, check student uid
      }
    }

    // For students, extract uid from custom header
    if (!userUid) {
      const studentUid = req.headers['x-student-uid'];
      if (studentUid) {
        userUid = studentUid.toUpperCase();
        // Look up student name
        const { data: student } = await supabase
          .from('students')
          .select('name')
          .eq('uid', userUid)
          .single();
        userName = student?.name || 'Student';
        userRole = 'student';
      }
    }

    if (!userUid) {
      return res.status(401).json({ error: 'Unable to identify user. Please log in again.' });
    }

    // Check weekly limit (4 per week per user)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from('feedbacks')
      .select('*', { count: 'exact', head: true })
      .eq('user_uid', userUid)
      .gte('created_at', weekStart.toISOString());

    if (countError) throw countError;

    if (count >= 4) {
      return res.status(429).json({
        error: 'Weekly feedback limit reached (4 per week). Please try again next week.'
      });
    }

    // Insert feedback
    const { data, error } = await supabase
      .from('feedbacks')
      .insert({
        user_uid: userUid,
        user_name: userName,
        user_role: userRole,
        message: message.trim(),
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('[FEEDBACK] Submit error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /feedback/mine — Get feedbacks for the current user
 * Uses JWT (admin) or X-Student-UID header (student)
 */
router.get('/feedback/mine', async (req, res) => {
  try {
    let userUid = null;

    // Try JWT first (admin)
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(auth.slice(7), JWT_SECRET);
        if (payload.role === 'admin') {
          userUid = 'admin';
        }
      } catch (e) {
        // Not admin
      }
    }

    // Student uid from header
    if (!userUid) {
      const studentUid = req.headers['x-student-uid'];
      if (studentUid) {
        userUid = studentUid.toUpperCase();
      }
    }

    if (!userUid) {
      return res.status(401).json({ error: 'Unable to identify user' });
    }

    const { data, error } = await supabase
      .from('feedbacks')
      .select('*')
      .eq('user_uid', userUid)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('[FEEDBACK] Fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/feedbacks — Get ALL feedbacks (admin only)
 */
router.get('/admin/feedbacks', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('feedbacks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('[FEEDBACK] Admin fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});



// ═══════════════════════════════════════════════════════════════════════
// GROUP SYSTEM ENDPOINTS (Student Only)
// Completely isolated from attendance data, scans, and overall leaderboard.
// ═══════════════════════════════════════════════════════════════════════

const MAX_GROUP_MEMBERS = 5;
const POINTS_PER_HOUR = 10;

/**
 * GET /groups/me — Get the group the authenticated student belongs to
 */
router.get('/groups/me', requireStudent, async (req, res) => {
  try {
    const { uid } = req.student;

    // Find membership
    const { data: membership, error: mErr } = await supabase
      .from('group_members')
      .select('group_id, role, joined_at')
      .eq('student_id', uid)
      .single();

    if (mErr || !membership) return res.json(null);

    // Fetch group details
    const { data: group, error: gErr } = await supabase
      .from('groups')
      .select('*')
      .eq('id', membership.group_id)
      .single();

    if (gErr) throw gErr;

    // Fetch all members with their today's score
    const today = new Date().toISOString().split('T')[0];
    const { data: members } = await supabase
      .from('group_members')
      .select('student_id, role, joined_at, students(name, roll_no)')
      .eq('group_id', group.id);

    const { data: scores } = await supabase
      .from('group_daily_scores')
      .select('user_id, actual_hours, earned_points, penalty_points, final_points')
      .eq('group_id', group.id)
      .eq('date', today);

    const scoreMap = {};
    (scores || []).forEach(s => { scoreMap[s.user_id] = s; });

    const enrichedMembers = (members || []).map(m => ({
      uid: m.student_id,
      name: m.students?.name || m.student_id,
      roll: m.students?.roll_no,
      role: m.role,
      joinedAt: m.joined_at,
      todayHours: scoreMap[m.student_id]?.actual_hours || 0,
      points: scoreMap[m.student_id]?.final_points || 0,
    }));

    res.json({ ...group, members: enrichedMembers, myRole: membership.role });
  } catch (error) {
    console.error('[GROUPS] /groups/me error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /groups — Create a new group
 * Body: { name, target_hours, penalty_points }
 */
router.post('/groups', requireStudent, async (req, res) => {
  try {
    const { uid } = req.student;
    const { name, target_hours, penalty_points } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Group name is required' });
    if (!target_hours || target_hours < 0.5 || target_hours > 24)
      return res.status(400).json({ error: 'target_hours must be between 0.5 and 24' });
    if (!penalty_points || penalty_points < 5 || penalty_points > 500)
      return res.status(400).json({ error: 'penalty_points must be between 5 and 500' });

    // Check if student is already in a group
    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('student_id', uid)
      .single();
    if (existing) return res.status(409).json({ error: 'You are already in a group' });

    // Create group
    const { data: group, error: gErr } = await supabase
      .from('groups')
      .insert({ name: name.trim(), created_by: uid, target_hours, penalty_points })
      .select()
      .single();
    if (gErr) throw gErr;

    // Add creator as ADMIN member
    const { error: mErr } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, student_id: uid, role: 'ADMIN' });
    if (mErr) throw mErr;

    res.status(201).json(group);
  } catch (error) {
    console.error('[GROUPS] Create error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /groups/invites — Pending invites received by the current student
 */
router.get('/groups/invites', requireStudent, async (req, res) => {
  try {
    const { uid } = req.student;
    const { data, error } = await supabase
      .from('group_invites')
      .select('id, group_id, sender_id, created_at, status, groups(name, target_hours, penalty_points), students!sender_id(name)')
      .eq('receiver_id', uid)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const invites = (data || []).map(inv => ({
      id: inv.id,
      groupId: inv.group_id,
      groupName: inv.groups?.name,
      targetHours: inv.groups?.target_hours,
      penaltyPoints: inv.groups?.penalty_points,
      senderUid: inv.sender_id,
      senderName: inv.students?.name || inv.sender_id,
      createdAt: inv.created_at,
    }));

    res.json(invites);
  } catch (error) {
    console.error('[GROUPS] Get invites error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /groups/invites — Send an invite to another student
 * Body: { receiver_roll } — receiver identified by roll number
 */
router.post('/groups/invites', requireStudent, async (req, res) => {
  try {
    const { uid } = req.student;
    const { receiver_roll } = req.body;

    if (!receiver_roll?.trim()) return res.status(400).json({ error: 'receiver_roll is required' });

    // Sender must be in a group and be ADMIN
    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id, role')
      .eq('student_id', uid)
      .single();

    if (!membership) return res.status(403).json({ error: 'You must be in a group to invite others' });
    if (membership.role !== 'ADMIN') return res.status(403).json({ error: 'Only the group admin can send invites' });

    // Resolve receiver by roll_no
    const { data: receiver } = await supabase
      .from('students')
      .select('uid, name')
      .eq('roll_no', receiver_roll.trim().toUpperCase())
      .single();

    if (!receiver) return res.status(404).json({ error: `No student found with roll number ${receiver_roll}` });
    if (receiver.uid === uid) return res.status(400).json({ error: 'Cannot invite yourself' });

    // Check receiver is not already in a group
    const { data: receiverMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('student_id', receiver.uid)
      .single();
    if (receiverMember) return res.status(409).json({ error: 'That student is already in a group' });

    // Check max 5 members
    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', membership.group_id);
    if (count >= MAX_GROUP_MEMBERS)
      return res.status(400).json({ error: `Group is full (max ${MAX_GROUP_MEMBERS} members)` });

    // No duplicate pending invite
    const { data: dup } = await supabase
      .from('group_invites')
      .select('id')
      .eq('group_id', membership.group_id)
      .eq('receiver_id', receiver.uid)
      .eq('status', 'PENDING')
      .single();
    if (dup) return res.status(409).json({ error: 'Invite already sent to this student' });

    // Insert invite
    const { data: invite, error: iErr } = await supabase
      .from('group_invites')
      .insert({ group_id: membership.group_id, sender_id: uid, receiver_id: receiver.uid, status: 'PENDING' })
      .select()
      .single();
    if (iErr) throw iErr;

    res.status(201).json({ message: 'Invite sent', invite });
  } catch (error) {
    console.error('[GROUPS] Send invite error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /groups/invites/:id/respond — Accept or reject an invite
 * Body: { action: 'ACCEPT' | 'REJECT' }
 */
router.post('/groups/invites/:id/respond', requireStudent, async (req, res) => {
  try {
    const { uid } = req.student;
    const { id } = req.params;
    const { action } = req.body;

    if (!['ACCEPT', 'REJECT'].includes(action))
      return res.status(400).json({ error: 'action must be ACCEPT or REJECT' });

    // Fetch invite and confirm ownership
    const { data: invite, error: iErr } = await supabase
      .from('group_invites')
      .select('*, groups(name, target_hours, penalty_points)')
      .eq('id', id)
      .eq('receiver_id', uid)
      .eq('status', 'PENDING')
      .single();

    if (iErr || !invite) return res.status(404).json({ error: 'Invite not found or already responded' });

    // Update status
    await supabase.from('group_invites').update({ status: action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED' }).eq('id', id);

    if (action === 'ACCEPT') {
      // Check max members still holds
      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', invite.group_id);
      if (count >= MAX_GROUP_MEMBERS) {
        await supabase.from('group_invites').update({ status: 'REJECTED' }).eq('id', id);
        return res.status(400).json({ error: 'Group is now full — invite auto-rejected' });
      }

      // Add member
      const { error: mErr } = await supabase
        .from('group_members')
        .insert({ group_id: invite.group_id, student_id: uid, role: 'MEMBER' });
      if (mErr) throw mErr;
    }

    res.json({ message: `Invite ${action === 'ACCEPT' ? 'accepted' : 'rejected'}` });
  } catch (error) {
    console.error('[GROUPS] Respond invite error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /groups/me/leave — Leave current group
 */
router.delete('/groups/me/leave', requireStudent, async (req, res) => {
  try {
    const { uid } = req.student;
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('student_id', uid);
    if (error) throw error;
    res.json({ message: 'Left group successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /groups/leaderboard — All groups ranked by total cumulative points
 * Uses group_daily_scores only — completely isolated from overall leaderboard.
 */
router.get('/groups/leaderboard', requireStudent, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('group_daily_scores')
      .select('group_id, final_points, groups(name)');
    if (error) throw error;

    // Aggregate total points per group
    const totals = {};
    (data || []).forEach(row => {
      if (!totals[row.group_id]) totals[row.group_id] = { name: row.groups?.name, points: 0 };
      totals[row.group_id].points += row.final_points || 0;
    });

    const leaderboard = Object.entries(totals)
      .map(([id, { name, points }]) => ({ group_id: id, name, points }))
      .sort((a, b) => b.points - a.points)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /groups/penalty/run — Internal endpoint to trigger the 10 PM penalty evaluation.
 * Called by the backend server's own 10 PM scheduler (node-schedule / cron).
 * Protected by admin JWT (optional — use INTERNAL_SECRET env to restrict to server-only).
 * 
 * Logic mirrors the frontend's getCutoffTime check:
 *   for each group_member, fetch today's study hours from 'scans',
 *   if actual_hours < target_hours → deduct penalty_points.
 */
router.post('/groups/penalty/run', requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch all groups with their members
    const { data: groups, error: gErr } = await supabase.from('groups').select('*');
    if (gErr) throw gErr;

    const { data: allMembers, error: mErr } = await supabase.from('group_members').select('*');
    if (mErr) throw mErr;

    // For each member, compute study hours from scans today
    let processed = 0;
    for (const group of groups) {
      const members = allMembers.filter(m => m.group_id === group.id);
      for (const member of members) {
        // Sum completed session durations for this student today
        const { data: scans, error: sErr } = await supabase
          .from('scans')
          .select('entry_time, exit_time')
          .eq('uid', member.student_id)
          .eq('type', 'ENTRY')
          .gte('entry_time', `${today}T00:00:00`)
          .lt('entry_time', `${today}T22:00:00`); // only count up to 10 PM

        if (sErr) continue;

        // Calculate actual hours: sum of (exit - entry) capped at 10 PM
        const cutoff = new Date(`${today}T22:00:00`);
        let totalMinutes = 0;
        for (const scan of scans || []) {
          const entry = new Date(scan.entry_time);
          const exit = scan.exit_time ? new Date(scan.exit_time) : cutoff;
          const effectiveExit = exit > cutoff ? cutoff : exit;
          if (effectiveExit > entry) {
            totalMinutes += (effectiveExit - entry) / 60000;
          }
        }
        const actualHours = totalMinutes / 60;
        const targetMet = actualHours >= group.target_hours;

        const earnedPoints = Math.round(actualHours * POINTS_PER_HOUR);
        const penaltyPoints = targetMet ? 0 : group.penalty_points;
        const finalPoints = earnedPoints - penaltyPoints;

        // Upsert daily score (idempotent — safe to re-run)
        await supabase.from('group_daily_scores').upsert({
          group_id: group.id,
          user_id: member.student_id,
          date: today,
          actual_hours: parseFloat(actualHours.toFixed(2)),
          earned_points: earnedPoints,
          penalty_points: penaltyPoints,
          final_points: finalPoints,
        }, { onConflict: 'group_id,user_id,date' });

        processed++;
      }
    }

    res.json({ message: 'Penalty run complete', date: today, processed });
  } catch (error) {
    console.error('[GROUPS] Penalty run error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
