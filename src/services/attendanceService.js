const supabase = require('../config/supabase');

const attendanceService = {
  /**
   * Authorize a UID — check if the card is registered and active.
   * Returns { authorized, status, student } 
   *   status: 'AUTHORIZED' | 'SUSPENDED' | 'UNKNOWN'
   */
  authorizeUID: async (uid) => {
    const { data: student, error } = await supabase
      .from('students')
      .select('*')
      .eq('uid', uid.toUpperCase())
      .single();

    if (error || !student) {
      return { authorized: false, status: 'UNKNOWN', student: null };
    }

    // Check the status column (defaults to 'AUTHORIZED' for existing rows)
    const cardStatus = student.status || 'AUTHORIZED';
    if (cardStatus === 'SUSPENDED') {
      return { authorized: false, status: 'SUSPENDED', student };
    }

    return { authorized: true, status: 'AUTHORIZED', student };
  },

  /**
   * Check nonce uniqueness to prevent replay attacks.
   * Returns true if the nonce is fresh (not seen before).
   */
  checkNonce: async (nonce) => {
    if (!nonce) return false;

    const { data: existing } = await supabase
      .from('used_nonces')
      .select('nonce')
      .eq('nonce', nonce)
      .maybeSingle();

    if (existing) return false; // Replay!

    // Store the nonce
    await supabase.from('used_nonces').insert({ nonce });
    return true;
  },

  /**
   * Main logic for processing a new scan.
   * Now includes authorization checks.
   */
  processScan: async (uid, deviceId) => {
    const normalizedUid = uid.toUpperCase();

    // 1. Authorize the card
    const { authorized, status, student } = await attendanceService.authorizeUID(normalizedUid);

    // 2. Log ALL scan attempts (including unauthorized)
    const timestamp = new Date().toISOString();

    if (!authorized) {
      // Log the denied scan for audit trail in lightweight security_log
      try {
        await supabase.from('security_log').insert({
          uid: student?.uid || normalizedUid,
          reason: status === 'SUSPENDED' ? 'CARD_SUSPENDED' : 'UNKNOWN_CARD',
          device_id: deviceId || null
        });
      } catch (logError) {
        console.warn(`[SECURITY] Failed to write security log:`, logError.message);
      }

      return {
        authorized: false,
        error: status === 'SUSPENDED' ? 'CARD_SUSPENDED' : 'UNKNOWN_CARD',
        uid: normalizedUid,
        student_name: student?.name || null,
        timestamp
      };
    }

    // 3. Check for an active session (authorized cards only)
    const { data: activeSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('student_uid', normalizedUid)
      .is('exit_time', null)
      .order('entry_time', { ascending: false })
      .maybeSingle();

    if (activeSession) {
      // EXIT Logic: Close the active session
      const entryTime = new Date(activeSession.entry_time);
      const exitTime = new Date(timestamp);
      const durationMinutes = Math.round((exitTime - entryTime) / (1000 * 60));

      await supabase
        .from('sessions')
        .update({ 
          exit_time: timestamp, 
          duration_minutes: durationMinutes,
          status: 'COMPLETED'
        })
        .eq('id', activeSession.id);

      return {
        authorized: true,
        event: 'EXIT',
        student_name: student.name,
        roll: student.roll_no,
        timestamp,
        duration: durationMinutes
      };
    } else {
      // ENTRY Logic: Create a new session
      await supabase
        .from('sessions')
        .insert({ 
          student_uid: normalizedUid, 
          entry_time: timestamp,
          status: 'ACTIVE',
          device_id: deviceId || null
        });

      return {
        authorized: true,
        event: 'ENTRY',
        student_name: student.name,
        roll: student.roll_no,
        timestamp
      };
    }
  },

  // ─── Card Management ───────────────────────────────────────────

  /**
   * Register a new RFID card (admin action)
   */
  registerCard: async (uid, name, rollNo, role = 'STUDENT') => {
    const normalizedUid = uid.toUpperCase();
    
    const { data: existing } = await supabase
      .from('students')
      .select('uid')
      .eq('uid', normalizedUid)
      .maybeSingle();

    if (existing) {
      throw new Error('Card already registered');
    }

    const { data, error } = await supabase
      .from('students')
      .insert({
        uid: normalizedUid,
        name: role === 'MASTER' ? 'Master Key' : name.trim(),
        roll_no: role === 'MASTER' ? `MASTER_${normalizedUid}` : (rollNo ? rollNo.trim() : normalizedUid),
        status: 'AUTHORIZED',
        role: role
      })
      .select()
      .single();

    if (error) throw new Error(`Registration failed: ${error.message}`);
    return data;
  },

  /**
   * Suspend a card (deny access but keep records)
   */
  suspendCard: async (uid) => {
    const { data, error } = await supabase
      .from('students')
      .update({ status: 'SUSPENDED' })
      .eq('uid', uid.toUpperCase())
      .select()
      .single();

    if (error) throw new Error(`Suspend failed: ${error.message}`);
    return data;
  },

  /**
   * Reactivate a suspended card
   */
  activateCard: async (uid) => {
    const { data, error } = await supabase
      .from('students')
      .update({ status: 'AUTHORIZED' })
      .eq('uid', uid.toUpperCase())
      .select()
      .single();

    if (error) throw new Error(`Activate failed: ${error.message}`);
    return data;
  },

  /**
   * Get all cards with their status (for admin card management UI)
   */
  getAllCards: async () => {
    const { data, error } = await supabase
      .from('students')
      .select('uid, name, roll_no, status, role, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Get authorized UID list (for ESP32 allowlist sync)
   */
  getAuthorizedUIDs: async () => {
    const { data, error } = await supabase
      .from('students')
      .select('uid')
      .eq('status', 'AUTHORIZED');

    if (error) throw error;
    return data.map(s => s.uid);
  },

  getSecurityLog: async (limit = 100) => {
    const { data, error } = await supabase
      .from('security_log')
      .select('id, uid, reason, device_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    // Map to expected frontend format
    return data.map(log => ({
      id: log.id,
      student_uid: log.uid,
      type: 'DENIED',
      timestamp: log.created_at,
      device_id: log.device_id,
      authorized: false,
      students: {
        name: log.reason, // Display reason in name column
        roll_no: '',
        status: 'DENIED'
      }
    }));
    return data;
  },

  // ─── Existing service methods (unchanged) ──────────────────────

  getActiveStudents: async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        id,
        entry_time,
        students (
          name,
          roll_no,
          uid
        )
      `)
      .is('exit_time', null);

    if (error) throw error;
    return data;
  },

  getAllScans: async (limit = 200) => {
    // Dynamically compute the scan timeline from sessions and security_log
    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('id, entry_time, exit_time, device_id, students(uid, name, roll_no)')
      .order('entry_time', { ascending: false })
      .limit(limit);

    if (sessErr) throw sessErr;

    const { data: secLogs, error: secErr } = await supabase
      .from('security_log')
      .select('id, uid, reason, device_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (secErr) throw secErr;

    let timeline = [];
    
    sessions.forEach(s => {
      timeline.push({
        id: `entry_${s.id}`,
        type: 'ENTRY',
        timestamp: s.entry_time,
        device_id: s.device_id,
        authorized: true,
        students: s.students
      });
      
      if (s.exit_time) {
        timeline.push({
          id: `exit_${s.id}`,
          type: 'EXIT',
          timestamp: s.exit_time,
          device_id: s.device_id, // Note: device_id might be from entry, but that's fine for logs
          authorized: true,
          students: s.students
        });
      }
    });
    
    secLogs.forEach(sl => {
      timeline.push({
        id: `sec_${sl.id}`,
        type: 'DENIED',
        timestamp: sl.created_at,
        device_id: sl.device_id,
        authorized: false,
        students: { uid: sl.uid, name: sl.reason, roll_no: '' }
      });
    });
    
    // Sort combined timeline by timestamp desc
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return timeline.slice(0, limit);
  },

  getAllStudents: async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  getStudentStats: async (roll) => {
    // 1. Get student basic info
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('roll_no', roll)
      .single();

    if (studentError) throw studentError;

    // 2. Get last 7 days of sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 6); // 7 days including today

    const { data: allSessions, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('student_uid', student.uid)
      .gte('entry_time', lastWeek.toISOString())
      .order('entry_time', { ascending: false });

    if (sessionError) throw sessionError;

    const todaySessions = allSessions.filter(s => new Date(s.entry_time) >= today);

    return {
      student,
      todaySessions,
      weeklySessions: allSessions, // For history charts
      isCurrentlyInside: todaySessions.some(s => !s.exit_time)
    };
  },

  clearAllLogs: async () => {
    // 1. Clear sessions
    const { error: sessionsError } = await supabase
      .from('sessions')
      .delete()
      .filter('id', 'gt', 0);
    
    if (sessionsError) throw sessionsError;

    // 2. Clear security log
    const { error: secError } = await supabase
      .from('security_log')
      .delete()
      .filter('id', 'gt', 0);
    
    if (secError) throw secError;

    return { message: 'All logs cleared successfully' };
  },

  clearStudentLogs: async (uid) => {
    // 1. Delete sessions for this specific student
    const { error: sessionsError } = await supabase
      .from('sessions')
      .delete()
      .eq('student_uid', uid);
    
    if (sessionsError) throw sessionsError;

    // 2. Clear security log for this student
    const { error: secError } = await supabase
      .from('security_log')
      .delete()
      .eq('uid', uid);
    
    if (secError) throw secError;

    return { message: `Records cleared for UID: ${uid}`, uid };
  },

  updateStudentName: async (uid, name) => {
    const { data, error } = await supabase
      .from('students')
      .update({ name: name.trim() })
      .eq('uid', uid)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getLeaderboard: async () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: sessions, error: sessionError } = await supabase
      .from('sessions')
      .select('*, students(name, roll_no, uid, role)')
      .gte('entry_time', startOfMonth.toISOString());

    if (sessionError) throw sessionError;

    const studentTotals = {};
    const now = new Date();

    sessions.forEach(s => {
      if (s.students?.role === 'MASTER') return;

      const roll = s.students?.roll_no || s.student_uid;
      const name = s.students?.name || 'Unknown';
      
      if (!studentTotals[roll]) {
        studentTotals[roll] = { roll, name, uid: s.student_uid, totalMinutes: 0 };
      }
      
      let mins = s.duration_minutes || 0;
      if (!s.exit_time) {
         mins = Math.round((now - new Date(s.entry_time)) / 60000);
      }
      studentTotals[roll].totalMinutes += mins;
    });

    const leaderboard = Object.values(studentTotals)
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .map((student, index) => ({
        ...student,
        rank: index + 1,
        totalHours: Number((student.totalMinutes / 60).toFixed(1))
      }));

    return leaderboard;
  },

  /**
   * Cleanup stale nonces older than 10 minutes
   */
  cleanupNonces: async () => {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('used_nonces')
      .delete()
      .lt('used_at', cutoff);

    if (error) {
      console.error('[NONCE] Cleanup error:', error.message);
    }
  },

  /**
   * Cleanup old sessions and security logs
   */
  cleanupOldLogs: async () => {
    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Delete completed sessions older than 30 days
    const { error: sessionErr } = await supabase
      .from('sessions')
      .delete()
      .eq('status', 'COMPLETED')
      .lt('entry_time', cutoff30d);
      
    if (sessionErr) console.error('[CLEANUP] Sessions:', sessionErr.message);

    // Delete old security logs older than 7 days
    const { error: secErr } = await supabase
      .from('security_log')
      .delete()
      .lt('created_at', cutoff7d);
      
    if (secErr) console.error('[CLEANUP] Security log:', secErr.message);
  }
};

module.exports = attendanceService;
