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
      // Log the denied scan for audit trail
      try {
        await supabase.from('scans').insert({
          student_uid: student?.uid || normalizedUid,
          type: 'DENIED',
          timestamp,
          device_id: deviceId || null,
          authorized: false
        });
      } catch (logError) {
        // If the UID doesn't exist in students table, we can't FK-reference it
        // Log to a separate security log instead
        console.warn(`[SECURITY] Unauthorized scan attempt: UID=${normalizedUid}, status=${status}, device=${deviceId}`);
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

      await supabase.from('scans').insert({
        student_uid: normalizedUid,
        type: 'EXIT',
        timestamp,
        device_id: deviceId || null,
        authorized: true
      });

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
          status: 'ACTIVE'
        });

      await supabase.from('scans').insert({
        student_uid: normalizedUid,
        type: 'ENTRY',
        timestamp,
        device_id: deviceId || null,
        authorized: true
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
  registerCard: async (uid, name, rollNo) => {
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
        name: name.trim(),
        roll_no: rollNo.trim(),
        status: 'AUTHORIZED'
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
      .select('uid, name, roll_no, status, created_at')
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

  /**
   * Get unauthorized / denied scan log (security audit)
   */
  getSecurityLog: async (limit = 100) => {
    const { data, error } = await supabase
      .from('scans')
      .select(`
        id,
        student_uid,
        type,
        timestamp,
        device_id,
        authorized,
        students (
          name,
          roll_no,
          status
        )
      `)
      .eq('authorized', false)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
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
    const { data, error } = await supabase
      .from('scans')
      .select(`
        id,
        type,
        timestamp,
        device_id,
        authorized,
        students (
          uid,
          name,
          roll_no
        )
      `)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
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

    // 2. Clear scans
    const { error: scansError } = await supabase
      .from('scans')
      .delete()
      .filter('id', 'gt', 0);
    
    if (scansError) throw scansError;

    return { message: 'All logs cleared successfully' };
  },

  clearStudentLogs: async (uid) => {
    // 1. Delete sessions for this specific student
    const { error: sessionsError } = await supabase
      .from('sessions')
      .delete()
      .eq('student_uid', uid);
    
    if (sessionsError) throw sessionsError;

    // 2. Clear scans for this specific student
    const { error: scansError } = await supabase
      .from('scans')
      .delete()
      .eq('student_uid', uid);
    
    if (scansError) throw scansError;

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
      .select('*, students(name, roll_no, uid)')
      .gte('entry_time', startOfMonth.toISOString());

    if (sessionError) throw sessionError;

    const studentTotals = {};
    const now = new Date();

    sessions.forEach(s => {
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
  }
};

module.exports = attendanceService;
