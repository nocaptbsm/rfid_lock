/**
 * Session utility functions.
 *
 * Business rule: All sessions close at 10 PM (22:00) on the day they started.
 * If a session has no exit_time and the current time is past 10 PM,
 * treat the session as closed at 10 PM.
 *
 * Secondary rule: Max session duration is 5 hours (300 minutes).
 */

const CUTOFF_HOUR = 22; // 10 PM
export const MAX_DURATION_MINUTES = 300; // 5 hours
export const PENALTY_MINUTES = 120; // 2 hour penalty if limit reached

/**
 * Returns a 10 PM Date object for the same calendar day as the given date.
 */
export const getCutoffTime = (date) => {
  const cutoff = new Date(date);
  cutoff.setHours(CUTOFF_HOUR, 0, 0, 0);
  return cutoff;
};

/**
 * Given a session object { entry_time, exit_time, duration_minutes, ... },
 * returns a new session with exit_time and duration_minutes adjusted
 * according to the 10 PM cutoff rule and 5-hour cap.
 *
 * Rules:
 * - If exit_time exists and is before 10 PM → keep as-is
 * - If exit_time exists but is after 10 PM → cap at 10 PM, recalculate duration
 * - If no exit_time and now is past 10 PM on that day → set exit to 10 PM, mark auto-closed
 * - If no exit_time and now is before 10 PM on that day → keep open (active session)
 * - Final duration is capped at 5 hours (300 mins)
 */
export const applySessionCutoff = (session) => {
  if (!session || !session.entry_time) return session;

  const entry = new Date(session.entry_time);
  const cutoff = getCutoffTime(entry);
  const now = new Date();

  let exitTime = session.exit_time ? new Date(session.exit_time) : null;
  let autoClosed = false;

  if (exitTime) {
    // Session has an exit — cap it at 10 PM if it went past
    if (exitTime > cutoff) {
      exitTime = cutoff;
    }
  } else {
    // No exit time — session is still "open"
    if (now >= cutoff) {
      // Past 10 PM on that day (or later day) → auto-close at 10 PM
      exitTime = cutoff;
      autoClosed = true;
    }
    // else: before 10 PM today → stays open/active
  }

  // Recalculate duration if we have an exit time
  let durationMinutes = session.duration_minutes;
  if (exitTime) {
    durationMinutes = Math.max(0, Math.round((exitTime - entry) / 60000));
  }

  let durationCapped = false;
  
  // A session is subject to the 5-hour penalty IF:
  // 1. It is currently live and has exceeded 5 hours.
  // 2. OR it was auto-closed (either by frontend logic just now, or by backend status).
  // If it has a legitimate exit_time, NO PENALTY applies.
  const isAutoClosed = autoClosed || session.status === 'AUTO_CLOSED';
  const isLive = !session.exit_time;

  if ((isLive || isAutoClosed) && durationMinutes >= MAX_DURATION_MINUTES) {
    durationMinutes = MAX_DURATION_MINUTES;
    durationCapped = true;
  }

  return {
    ...session,
    exit_time: exitTime ? exitTime.toISOString() : null,
    duration_minutes: durationMinutes,
    _autoClosed: autoClosed,
    _durationCapped: durationCapped,
  };
};

/**
 * Apply cutoff to an array of sessions.
 */
export const applySessionsCutoff = (sessions) => {
  if (!sessions) return [];
  return sessions.map(applySessionCutoff);
};

/**
 * For a running live timer: returns the effective "end" time.
 * If now is past 10 PM on the entry day, returns the 10 PM cutoff.
 * Otherwise returns now.
 */
export const getEffectiveNow = (entryTime) => {
  const entry = new Date(entryTime);
  const cutoff = getCutoffTime(entry);
  const now = new Date();

  if (now >= cutoff) return cutoff;
  return now;
};

/**
 * Check if a session is truly active (open AND before 10 PM cutoff).
 */
export const isSessionActive = (session) => {
  if (!session || !session.entry_time || session.exit_time) return false;
  const cutoff = getCutoffTime(new Date(session.entry_time));
  return new Date() < cutoff;
};
