const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const attendanceService = require('../services/attendanceService');
const { apiKeyValidator, hmacValidator, requireAdmin, adminLogin } = require('../middleware/auth');
const socketService = require('../services/socketService');

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
    
    // If card was denied, return 403
    if (!result.authorized) {
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
 * PUT /admin/student/:uid — Update student name
 */
router.put('/admin/student/:uid', requireAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await attendanceService.updateStudentName(uid, name);
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

module.exports = router;
