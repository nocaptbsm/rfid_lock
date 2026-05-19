const http = require('http');
const app = require('./app');
const socketService = require('./services/socketService');
const attendanceService = require('./services/attendanceService');
require('dotenv').config();

const PORT = process.env.PORT || 8000;
const NONCE_CLEANUP_INTERVAL = parseInt(process.env.NONCE_CLEANUP_INTERVAL_MS) || 5 * 60 * 1000; // 5 min

const server = http.createServer(app);

// Initialize WebSocket stream
socketService.init(server);

// Schedule nonce cleanup every 5 minutes
setInterval(() => {
  attendanceService.cleanupNonces().catch(err =>
    console.error('[NONCE] Cleanup failed:', err.message)
  );
}, NONCE_CLEANUP_INTERVAL);

// Schedule old log cleanup every 24 hours
const LOG_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
setInterval(() => {
  attendanceService.cleanupOldLogs().catch(err =>
    console.error('[CLEANUP] Failed:', err.message)
  );
}, LOG_CLEANUP_INTERVAL);

// Run old log cleanup once on startup
attendanceService.cleanupOldLogs().catch(() => {});

// ─── Group Penalty Scheduler — runs every day at exactly 10:00 PM ────────────
// This mirrors the frontend's 10 PM cutoff logic (getCutoffTime) on the server side.
// It calls the /api/groups/penalty/run endpoint internally via an HTTP request,
// which upserts group_daily_scores with earned/penalty points for each member.
const scheduleGroupPenalty = () => {
  const now = new Date();
  const target = new Date();
  target.setHours(22, 0, 0, 0); // 10:00 PM today

  // If 10 PM has already passed today, schedule for tomorrow
  if (now >= target) target.setDate(target.getDate() + 1);

  const msUntilTarget = target - now;
  console.log(`[GROUPS] Next penalty run scheduled in ${Math.round(msUntilTarget / 60000)} minutes (at 10:00 PM)`);

  setTimeout(async () => {
    console.log(`[GROUPS] Running 10 PM penalty evaluation — ${new Date().toISOString()}`);
    try {
      // Require supabase and run penalty logic inline (no HTTP self-call needed)
      const supabase = require('./config/supabase');
      const POINTS_PER_HOUR = 10;
      const today = new Date().toISOString().split('T')[0];

      const { data: groups } = await supabase.from('groups').select('*');
      const { data: allMembers } = await supabase.from('group_members').select('*');

      let processed = 0;
      for (const group of groups || []) {
        const members = (allMembers || []).filter(m => m.group_id === group.id);
        for (const member of members) {
          const { data: scans } = await supabase
            .from('scans')
            .select('entry_time, exit_time')
            .eq('uid', member.student_id)
            .eq('type', 'ENTRY')
            .gte('entry_time', `${today}T00:00:00`)
            .lt('entry_time', `${today}T22:00:00`);

          const cutoff = new Date(`${today}T22:00:00`);
          let totalMinutes = 0;
          for (const scan of scans || []) {
            const entry = new Date(scan.entry_time);
            const exit = scan.exit_time ? new Date(scan.exit_time) : cutoff;
            const effectiveExit = exit > cutoff ? cutoff : exit;
            if (effectiveExit > entry) totalMinutes += (effectiveExit - entry) / 60000;
          }

          const actualHours = totalMinutes / 60;
          const targetMet = actualHours >= group.target_hours;
          const earnedPoints = Math.round(actualHours * POINTS_PER_HOUR);
          const penaltyPoints = targetMet ? 0 : group.penalty_points;
          const finalPoints = earnedPoints - penaltyPoints;

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
      console.log(`[GROUPS] Penalty run complete — ${processed} records processed`);
    } catch (err) {
      console.error('[GROUPS] Penalty scheduler error:', err.message);
    }

    // Reschedule for the next day
    scheduleGroupPenalty();
  }, msUntilTarget);
};

scheduleGroupPenalty();

server.listen(PORT, () => {
  console.log(`
🚀 LibraryTrack Backend is running!
📡 URL: http://localhost:${PORT}
🔌 WebSocket Server is active
🔒 Security: HMAC + JWT + Rate Limiting enabled
🧹 Nonce cleanup every ${NONCE_CLEANUP_INTERVAL / 1000}s
👥 Group penalty scheduler active (runs daily at 10:00 PM)
  `);
});
