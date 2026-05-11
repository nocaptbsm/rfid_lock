const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const attendanceService = require('../services/attendanceService');
const { apiKeyValidator, hmacValidator, requireAdmin, adminLogin } = require('../middleware/auth');
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

module.exports = router;
