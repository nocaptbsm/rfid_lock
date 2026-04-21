const express = require('express');
const router = express.Router();
const attendanceService = require('../services/attendanceService');
const { apiKeyValidator } = require('../middleware/auth');
const socketService = require('../services/socketService');

/**
 * Physical RFID Scan handler
 * Authenticated via X-API-KEY
 */
router.post('/scan', apiKeyValidator, async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ error: 'UID is required' });

    const result = await attendanceService.processScan(uid);
    
    // Broadcast via WebSocket
    socketService.broadcast('SCAN_EVENT', result);

    res.json(result);
  } catch (error) {
    console.error('Scan error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all scan logs for Admin log table
 */
router.get('/admin/logs', async (req, res) => {
  try {
    const logs = await attendanceService.getAllScans();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all registered students
 */
router.get('/admin/students', async (req, res) => {
  try {
    const students = await attendanceService.getAllStudents();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get active sessions for Admin monitor
 */
router.get('/admin/live', async (req, res) => {
  try {
    const activeSessions = await attendanceService.getActiveStudents();
    res.json(activeSessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get student specifics
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
 * Clear all logs (Admin Only / Use with caution)
 */
router.delete('/admin/logs', async (req, res) => {
  try {
    const result = await attendanceService.clearAllLogs();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clear specific student logs
 */
router.delete('/admin/student/:uid/logs', async (req, res) => {
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
 * Update student name
 */
router.put('/admin/student/:uid', async (req, res) => {
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

/**
 * Get monthly leaderboard
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
