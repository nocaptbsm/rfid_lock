/**
 * Session utility functions.
 *
 * Business rule: All sessions close at 9 PM (21:00) on the day they started.
 * If a session has no exit_time and the current time is past 9 PM,
 * treat the session as closed at 9 PM.
 */

const CUTOFF_HOUR = 21; // 9 PM

/**
 * Returns a 9 PM Date object for the same calendar day as the given date.
 */
export const getCutoffTime = (date) => {
  const cutoff = new Date(date);
  cutoff.setHours(CUTOFF_HOUR, 0, 0, 0);
  return cutoff;
};

/**
 * Given a session object { entry_time, exit_time, duration_minutes, ... },
 * returns a new session with exit_time and duration_minutes adjusted
 * according to the 9 PM cutoff rule.
 *
 * Rules:
 * - If exit_time exists and is before 9 PM → keep as-is
 * - If exit_time exists but is after 9 PM → cap at 9 PM, recalculate duration
 * - If no exit_time and now is past 9 PM on that day → set exit to 9 PM, mark auto-closed
 * - If no exit_time and now is before 9 PM on that day → keep open (active session)
 */
export const applySessionCutoff = (session) => {
  if (!session || !session.entry_time) return session;

  const entry = new Date(session.entry_time);
  const cutoff = getCutoffTime(entry);
  const now = new Date();

  let exitTime = session.exit_time ? new Date(session.exit_time) : null;
  let autoClosed = false;

  if (exitTime) {
    // Session has an exit — cap it at 9 PM if it went past
    if (exitTime > cutoff) {
      exitTime = cutoff;
    }
  } else {
    // No exit time — session is still "open"
    if (now >= cutoff) {
      // Past 9 PM on that day (or later day) → auto-close at 9 PM
      exitTime = cutoff;
      autoClosed = true;
    }
    // else: before 9 PM today → stays open/active
  }

  // Recalculate duration if we have an exit time
  let durationMinutes = session.duration_minutes;
  if (exitTime) {
    durationMinutes = Math.max(0, Math.round((exitTime - entry) / 60000));
  }

  return {
    ...session,
    exit_time: exitTime ? exitTime.toISOString() : null,
    duration_minutes: durationMinutes,
    _autoClosed: autoClosed,
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
 * If now is past 9 PM on the entry day, returns the 9 PM cutoff.
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
 * Check if a session is truly active (open AND before 9 PM cutoff).
 */
export const isSessionActive = (session) => {
  if (!session || !session.entry_time || session.exit_time) return false;
  const cutoff = getCutoffTime(new Date(session.entry_time));
  return new Date() < cutoff;
};
