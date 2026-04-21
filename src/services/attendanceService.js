const supabase = require('../config/supabase');

const attendanceService = {
  /**
   * Main logic for processing a new scan
   */
  processScan: async (uid) => {
    // 1. Fetch student — auto-register if unknown
    let { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('uid', uid)
      .single();

    if (studentError || !student) {
      // Auto-register: create a placeholder student for this new card
      const { data: newStudent, error: insertError } = await supabase
        .from('students')
        .insert({
          uid: uid,
          name: `Unknown (${uid})`,
          roll_no: uid               // use UID as roll_no until renamed
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to register new card: ${insertError.message}`);
      }
      student = newStudent;
    }

    // 2. Check for an active session
    const { data: activeSession, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('student_uid', uid)
      .is('exit_time', null)
      .order('entry_time', { ascending: false })
      .maybeSingle();

    const timestamp = new Date().toISOString();

    if (activeSession) {
      // 3a. EXIT Logic: Close the active session
      const entryTime = new Date(activeSession.entry_time);
      const exitTime = new Date(timestamp);
      const durationMinutes = Math.round((exitTime - entryTime) / (1000 * 60));

      const { data: updatedSession, error: updateError } = await supabase
        .from('sessions')
        .update({ 
          exit_time: timestamp, 
          duration_minutes: durationMinutes,
          status: 'COMPLETED'
        })
        .eq('id', activeSession.id)
        .select()
        .single();

      // Log the scan event
      await supabase.from('scans').insert({ student_uid: uid, type: 'EXIT', timestamp });

      return {
        event: 'EXIT',
        student_name: student.name,
        roll: student.roll_no,
        timestamp,
        duration: durationMinutes
      };
    } else {
      // 3b. ENTRY Logic:
      // First, check if there are any stale sessions (e.g. forgot to scan out yesterday)
      // For simplicity, we just create a new one here. 
      // A more robust system would scan for null exits > 12h and mark them as STALE.

      const { data: newSession, error: insertError } = await supabase
        .from('sessions')
        .insert({ 
          student_uid: uid, 
          entry_time: timestamp,
          status: 'ACTIVE'
        })
        .select()
        .single();

      // Log the scan event
      await supabase.from('scans').insert({ student_uid: uid, type: 'ENTRY', timestamp });

      return {
        event: 'ENTRY',
        student_name: student.name,
        roll: student.roll_no,
        timestamp
      };
    }
  },

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
  }
};

module.exports = attendanceService;
