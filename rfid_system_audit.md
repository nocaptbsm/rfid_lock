# 🔒 RFID Attendance System — Enterprise-Grade Audit

> **Production Readiness Score: 4.2 / 10**
> System works as a prototype but has critical gaps in security, scalability, reliability, and offline resilience that must be addressed before commercial deployment.

---

## Executive Summary

| Area | Score | Verdict |
|------|-------|---------|
| Hardware (ESP32 + RC522) | 3/10 | Hobby-grade; unsuitable for 500+ cards |
| Firmware Architecture | 4/10 | No offline queue, no watchdog, no OTA |
| Backend (Node + Supabase) | 5/10 | Functional but missing rate-limiting, idempotency, and audit trails |
| Database Design | 4/10 | No partitioning, weak indexing, no archival strategy |
| Frontend (React/Vite) | 6/10 | Good UI polish; missing virtualization, token refresh, RBAC |
| Security | 3/10 | JWT in localStorage, no CSRF, RFID cards clonable, no encryption |
| Scalability | 3/10 | Will break at ~200 concurrent users |
| Reliability | 4/10 | No retry logic, no offline sync, no graceful degradation |

---

## 1. CRITICAL Issues

### 1.1 — Auth Token Stored in localStorage (XSS Vulnerable)

- **Severity:** 🔴 CRITICAL
- **Files:** [AuthContext.jsx](file:///c:/Users/adars/Rfid/src/context/AuthContext.jsx#L7-L13), [api/index.js](file:///c:/Users/adars/Rfid/src/api/index.js#L9-L17)
- **Root Cause:** `localStorage.setItem('user', JSON.stringify(userData))` stores JWT token in localStorage, accessible to any XSS payload.
- **Real-world Scenario:** A single stored-XSS or compromised npm package reads `localStorage.user`, exfiltrates the admin JWT, and gains full system control.
- **Impact at Scale:** Complete admin account takeover across all tenants in a SaaS deployment.
- **Fix:**
  - Store JWT in **httpOnly secure cookies** set by the backend
  - Frontend never touches the raw token
  - Use `SameSite=Strict` + `Secure` flags
  - Add CSRF token rotation for state-changing requests
- **Tools:** `helmet`, `csurf`, `cookie-parser` on Express backend

### 1.2 — RFID Cards Are Clonable (MIFARE Classic)

- **Severity:** 🔴 CRITICAL
- **Root Cause:** MFRC522 reads MIFARE Classic UIDs which are **4-byte, unencrypted, and trivially cloneable** with a $5 Proxmark or phone app.
- **Real-world Scenario:** Student A clones Student B's card UID, scans it, and marks B as present without B's knowledge.
- **Reproduction:** Buy a UID-writable card, copy target UID with any NFC app, scan at reader.
- **Impact:** Complete attendance fraud; system integrity destroyed.
- **Fix:**
  - **Short-term:** Use MIFARE Classic **authentication** (key-based sector read) — verify a secret stored in a data block, not just the UID
  - **Medium-term:** Migrate to **MIFARE DESFire EV2/EV3** with AES-128 mutual authentication
  - **Long-term:** Implement challenge-response protocol: reader sends nonce → card signs with secret key → server validates

### 1.3 — No Admin API Authorization Check (Frontend-Only Auth Guard)

- **Severity:** 🔴 CRITICAL
- **Files:** [App.jsx](file:///c:/Users/adars/Rfid/src/App.jsx#L16-L23)
- **Root Cause:** `ProtectedRoute` is a client-side component. Admin endpoints like `DELETE /admin/logs` rely solely on the Bearer token but there's no evidence of server-side role verification beyond token presence.
- **Real-world Scenario:** A student obtains a valid JWT (by inspecting localStorage on a shared computer), calls `DELETE /admin/logs` directly via curl, and wipes all records.
- **Fix:**
  - Backend must decode JWT → verify `role === 'admin'` on **every admin endpoint**
  - Implement middleware: `requireAdmin(req, res, next)`
  - Add **audit logging** for all destructive operations

### 1.4 — No Idempotency on Scan Endpoint

- **Severity:** 🔴 CRITICAL
- **Root Cause:** If ESP32 retries a failed POST (network timeout), the backend may record duplicate ENTRY/EXIT events.
- **Real-world Scenario:** ESP32 sends scan → timeout → retries → backend creates 2 ENTRY records → student shows "inside" but next scan creates a mismatched EXIT.
- **Impact:** Corrupted session data across the entire system.
- **Fix:**
  - Add `idempotency_key` (e.g., `{uid}_{timestamp_rounded_to_5s}`) to scan payloads
  - Backend checks `used_nonces` table (already exists!) before inserting
  - Return `200 OK` with original response for duplicate requests

---

## 2. HIGH Issues

### 2.1 — No Token Expiry / Refresh Mechanism

- **Severity:** 🟠 HIGH
- **Files:** [AuthContext.jsx](file:///c:/Users/adars/Rfid/src/context/AuthContext.jsx#L6-L8)
- **Root Cause:** Token is loaded from localStorage with no expiry check. A token stored months ago still works.
- **Fix:** Check `exp` claim on load; implement silent refresh with rotating refresh tokens.

### 2.2 — WebSocket Reconnection Creates Infinite Loops

- **Severity:** 🟠 HIGH
- **Files:** [useStudentLive.js](file:///c:/Users/adars/Rfid/src/hooks/useStudentLive.js#L135-L139)
- **Root Cause:** `onclose` calls `setTimeout(connect, 5000)` unconditionally. If server is down, this creates infinite reconnection with no backoff, flooding the server on recovery.
- **Fix:** Implement exponential backoff: `delay = Math.min(30000, 1000 * 2^attempt)` with max retries. Use a library like `reconnecting-websocket`.

### 2.3 — `useRealTime` Polling Uses Raw `fetch` (Bypasses Auth)

- **Severity:** 🟠 HIGH
- **Files:** [useRealTime.js](file:///c:/Users/adars/Rfid/src/hooks/useRealTime.js#L60-L63)
- **Root Cause:** Polling fallback uses `fetch(pollUrl)` without Authorization headers, bypassing the axios interceptor.
- **Fix:** Use the `api` axios instance for polling, or attach headers manually.

### 2.4 — No Rate Limiting on Login Endpoints

- **Severity:** 🟠 HIGH
- **Root Cause:** `POST /admin/login` and `POST /student/login` appear to have no server-side rate limiting. Frontend shows "RATE_LIMITED" message but it's unclear if the backend enforces it.
- **Fix:** Implement `express-rate-limit` with sliding window: 5 attempts per 15 minutes per IP.

### 2.5 — Sensitive Delete Operations Lack Confirmation Token

- **Severity:** 🟠 HIGH
- **Files:** [AdminDashboard.jsx](file:///c:/Users/adars/Rfid/src/pages/AdminDashboard.jsx#L828-L849)
- **Root Cause:** `DELETE /admin/logs?from=...&to=...` can wipe months of data with a single API call. No server-side confirmation flow.
- **Fix:** Require a 2-step delete: first `POST /admin/logs/delete-preview` returns count of affected records, then `DELETE /admin/logs` with a signed `confirm_token`.

### 2.6 — No Database Partitioning / Archival Strategy

- **Severity:** 🟠 HIGH
- **Root Cause:** `scans` table grows unbounded. At 500 users × 2 scans/day × 365 days = 365K rows/year. Queries will degrade.
- **Fix:**
  - Add partition by month: `CREATE TABLE scans PARTITION BY RANGE (timestamp)`
  - Archive records older than 90 days to a `scans_archive` table
  - Add composite index: `(uid, timestamp DESC)`

### 2.7 — Frontend Renders All Logs Without Virtualization

- **Severity:** 🟠 HIGH
- **Files:** [AdminDashboard.jsx](file:///c:/Users/adars/Rfid/src/pages/AdminDashboard.jsx) (RfidLogTable renders all `logs`)
- **Root Cause:** The admin dashboard fetches ALL logs from `/admin/logs` and renders them in a table. At 10K+ records, this causes multi-second freezes.
- **Fix:**
  - Server-side pagination: `/admin/logs?page=1&limit=50`
  - Use `react-window` or `@tanstack/react-virtual` for rendering
  - Add date filters to reduce payload size

---

## 3. MEDIUM Issues

### 3.1 — 9 PM Cutoff Is Frontend-Only

- **Files:** [sessionUtils.js](file:///c:/Users/adars/Rfid/src/utils/sessionUtils.js)
- **Root Cause:** The cutoff is computed entirely in the browser. Backend still shows raw data. Mobile app, API consumers, or reports pulled directly from DB won't respect the cutoff.
- **Fix:** Add a backend cron job (Supabase pg_cron or scheduled Edge Function) that runs at 9:01 PM daily to close all open sessions.

### 3.2 — No CORS Configuration Visible

- **Root Cause:** The backend API URL is on a different domain (Render) from the frontend. If CORS is set to `*`, any site can make authenticated requests.
- **Fix:** Set `Access-Control-Allow-Origin` to your exact domain. Never use `*` with credentials.

### 3.3 — JSON.parse Without Error Boundary on WS Messages

- **Files:** [useStudentLive.js](file:///c:/Users/adars/Rfid/src/hooks/useStudentLive.js#L113)
- **Root Cause:** `JSON.parse(event.data)` can throw on malformed messages, crashing the WS handler.
- **Fix:** Wrap in try/catch.

### 3.4 — Leaderboard Fetched Without Caching

- **Files:** [useLeaderboard.js](file:///c:/Users/adars/Rfid/src/hooks/useLeaderboard.js)
- **Root Cause:** Every component mount triggers a fresh `/leaderboard` request. Multiple components on the same page = duplicate requests.
- **Fix:** Use SWR or React Query with `staleTime: 60000` for automatic deduplication and caching.

### 3.5 — Student Can Access Other Student's Dashboard

- **Files:** [App.jsx](file:///c:/Users/adars/Rfid/src/App.jsx#L57-L63)
- **Root Cause:** Route `/student/:roll` allows any authenticated student to view any other student's data by changing the URL.
- **Fix:** In `ProtectedRoute`, verify `params.roll === user.roll` unless the user is admin.

### 3.6 — No Input Sanitization on Card Registration

- **Files:** [AdminDashboard.jsx](file:///c:/Users/adars/Rfid/src/pages/AdminDashboard.jsx) (registerCard)
- **Root Cause:** `uid`, `name`, `roll_no` are sent directly to the API without sanitization.
- **Fix:** Validate UID format (hex, 8-14 chars), name (alpha + spaces, max 100 chars), roll (alphanumeric, max 20 chars) on both frontend and backend.

### 3.7 — ESP32 WiFi Instability Risks

- **Root Cause:** ESP32's WiFi stack has known issues: DHCP lease expiry drops connections, DNS failures block HTTP, power brownouts corrupt flash.
- **Fix:**
  - Implement a **local scan queue** (SPIFFS/LittleFS) that persists scans to flash
  - Sync queue when WiFi is available (offline-first architecture)
  - Add watchdog timer (`esp_task_wdt_init`) to auto-reboot on hangs
  - Use static IP to avoid DHCP issues

### 3.8 — RFID Read Collisions Under Rapid Scanning

- **Root Cause:** MFRC522 has no anti-collision for simultaneous multi-card reads. If 2 students tap at the same time, one read is lost silently.
- **Fix:**
  - Implement a scan-acknowledge LED/buzzer feedback loop
  - Add a 500ms debounce between reads
  - Log "collision detected" events when PCD reports errors
  - For enterprise: upgrade to **PN532** or **ACR122U** with proper ISO 14443A anti-collision

---

## 4. LOW Issues

| # | Issue | Fix |
|---|-------|-----|
| 4.1 | `mockData.js` ships in production bundle | Use `import.meta.env.DEV` guard or move to `__tests__/` |
| 4.2 | `console.log` statements in production code | Use a logger with log levels; strip in production build |
| 4.3 | Search input in TopBar is non-functional | Connect to a search handler or remove to avoid user confusion |
| 4.4 | AdminReports page is minimal | Expand with export-to-CSV, date-range filters, charts |
| 4.5 | No favicon/metadata for SEO | Add proper `<title>`, `<meta>` tags per page |
| 4.6 | `eslint-disable-line` suppression for `motion` imports | Use `/* eslint-disable react/no-unused-vars */` at component level |
| 4.7 | RFID alias storage in localStorage | Will not persist across devices; move to server-side |

---

## 5. Failure Simulations

### Scenario A: 100 Students Scan Within 2 Minutes
- **ESP32:** MFRC522 reads take ~100ms each. At 100 scans in 120s, that's 1 scan/1.2s — **feasible** for sequential scans but HTTP POST takes 200-2000ms on WiFi. Queue will back up.
- **Backend:** 100 concurrent POST requests to Supabase. Free tier allows ~500 req/s → **OK**. Pro tip: use batch inserts.
- **Frontend:** Admin dashboard polling every 10s will show 100 new entries — OK with virtualization, **laggy without it**.
- **Mitigation:** Local queue on ESP32, batch POST every 5 seconds.

### Scenario B: Internet Outage During Attendance
- **Current behavior:** ESP32 scan POST fails → scan is lost permanently.
- **Impact:** Students scanned during outage have no attendance record.
- **Fix:** ESP32 must queue scans in SPIFFS with timestamp, retry on reconnection.

### Scenario C: Duplicate Card Scans (Double-Tap)
- **Current behavior:** Two rapid scans create ENTRY then immediate EXIT (or vice versa).
- **Fix:** Backend debounce: ignore same UID within 30 seconds. Return success but skip insert.

### Scenario D: Card Cloning Attempt
- **Current behavior:** System accepts cloned UID without question.
- **Detection strategy:** Log device_id + scan patterns. If same UID scans from 2 devices within 5 min, flag as suspicious.

### Scenario E: ESP32 Reboots During Scan
- **Current behavior:** Scan data in RAM is lost.
- **Fix:** Write scan to flash BEFORE attempting HTTP POST. Delete from flash only after 200 OK.

### Scenario F: Supabase Downtime
- **Current behavior:** All API calls fail. Frontend shows error. No data recorded.
- **Fix:** Backend should have a PostgreSQL connection retry with circuit breaker. ESP32 should queue locally.

### Scenario G: Database Corruption
- **Fix:** Enable Supabase Point-in-Time Recovery (Pro plan). Schedule daily `pg_dump` to S3.

### Scenario H: 24/7 Uptime for Months
- **ESP32 risks:** Memory fragmentation from String allocations → heap exhaustion → crash.
- **Fix:** Use char arrays, add `ESP.getFreeHeap()` monitoring, auto-reboot at 3 AM daily via `esp_restart()`.

---

## 6. Enterprise Architecture Redesign

### Recommended Stack for 10,000+ Users

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  RFID Reader  │────▶│  Edge Gateway │────▶│  Message Queue   │
│  (PN532/ACR)  │     │  (Raspberry Pi)│    │  (Redis/RabbitMQ) │
└──────────────┘     └──────────────┘     └────────┬─────────┘
                                                    │
                     ┌──────────────────────────────▼───────────┐
                     │         API Server (Node/Go)              │
                     │  - JWT middleware with role verification  │
                     │  - Idempotent scan endpoint               │
                     │  - Rate limiting (express-rate-limit)     │
                     │  - Batch insert processor                 │
                     └──────────────────┬──────────────────────┘
                                        │
              ┌─────────────────────────▼─────────────────────┐
              │            PostgreSQL (Supabase Pro)            │
              │  - Partitioned scans table (by month)          │
              │  - Materialized views for leaderboard/reports  │
              │  - pg_cron for session auto-close at 9 PM      │
              │  - Point-in-Time Recovery enabled               │
              └────────────────────────────────────────────────┘
```

### Hardware Upgrade Path

| Current | Recommended | Why |
|---------|-------------|-----|
| ESP32 | Raspberry Pi 4 + PN532 | Proper OS, local DB, OTA updates, multi-reader support |
| MFRC522 | ACR122U (USB) or PN532 (I2C) | Better anti-collision, DESFire support |
| MIFARE Classic | MIFARE DESFire EV3 | AES-128, unclonable, mutual authentication |
| USB power | PoE (Power over Ethernet) | Eliminates power fluctuations, single cable |
| WiFi | Ethernet (PoE) | Eliminates WiFi instability entirely |

---

## 7. Security Hardening Checklist

- [ ] Move JWT to httpOnly cookies
- [ ] Add CSRF protection
- [ ] Implement server-side RBAC middleware
- [ ] Add request signing for ESP32 → API communication
- [ ] Encrypt RFID data in transit (HTTPS) and at rest
- [ ] Rate-limit all endpoints (5 req/s per IP for auth, 50 req/s for reads)
- [ ] Add audit log table for all admin actions
- [ ] Implement Content-Security-Policy headers
- [ ] Add Subresource Integrity for CDN assets
- [ ] Enable Supabase Row-Level Security on all tables
- [ ] Validate all inputs server-side (UID format, name length, date ranges)
- [ ] Add HMAC signing to scan payloads from ESP32

---

## 8. Database Optimization Strategy

```sql
-- 1. Composite index for fast per-student queries
CREATE INDEX idx_scans_uid_time ON scans(uid, timestamp DESC);

-- 2. Composite index for date-range deletes
CREATE INDEX idx_scans_timestamp ON scans(timestamp);

-- 3. Materialized view for leaderboard (refresh every 15 min via pg_cron)
CREATE MATERIALIZED VIEW leaderboard_mv AS
SELECT s.uid, s.name, s.roll_no,
       SUM(sc.duration_minutes) as total_minutes,
       COUNT(DISTINCT DATE(sc.entry_time)) as days_attended
FROM students s
JOIN sessions sc ON s.uid = sc.uid
WHERE sc.entry_time > NOW() - INTERVAL '30 days'
GROUP BY s.uid, s.name, s.roll_no
ORDER BY total_minutes DESC;

-- 4. Auto-close sessions at 9 PM (pg_cron)
SELECT cron.schedule('close-sessions', '1 21 * * *', $$
  UPDATE sessions
  SET exit_time = DATE_TRUNC('day', entry_time) + INTERVAL '21 hours',
      duration_minutes = EXTRACT(EPOCH FROM
        (DATE_TRUNC('day', entry_time) + INTERVAL '21 hours') - entry_time
      ) / 60
  WHERE exit_time IS NULL
    AND entry_time::date = CURRENT_DATE;
$$);

-- 5. Partition strategy for scans (future)
-- Use Supabase's pg_partman extension or manual range partitioning
```

---

## 9. Implementation Plan

### Phase 1: Critical Security Fixes (Week 1-2)

| Task | Priority | Effort |
|------|----------|--------|
| Move JWT to httpOnly cookies | Critical | 4h |
| Add server-side RBAC middleware for admin routes | Critical | 3h |
| Add idempotency key to scan endpoint | Critical | 3h |
| Add rate-limiting to login endpoints | Critical | 2h |
| Fix student route access control (verify roll matches user) | High | 1h |
| Add try/catch around WS JSON.parse | Medium | 15m |
| Fix `useRealTime` polling to use axios with auth headers | High | 30m |

### Phase 2: Reliability & Data Integrity (Week 3-4)

| Task | Priority | Effort |
|------|----------|--------|
| Backend cron: auto-close sessions at 9:01 PM | High | 2h |
| Add scan debounce (same UID within 30s = skip) on backend | High | 2h |
| Add database indexes (uid+timestamp, timestamp) | High | 30m |
| Server-side pagination for `/admin/logs` | High | 3h |
| Add `react-window` virtualization to log tables | Medium | 3h |
| Implement exponential backoff for WS reconnection | Medium | 1h |
| Add SWR/React Query for leaderboard caching | Medium | 2h |
| Implement 2-step delete confirmation for bulk operations | Medium | 3h |

### Phase 3: ESP32 Hardening (Week 5-6)

| Task | Priority | Effort |
|------|----------|--------|
| Implement local scan queue in SPIFFS | Critical | 6h |
| Add watchdog timer | High | 2h |
| Add scan debounce (500ms) on firmware | High | 1h |
| Add LED/buzzer acknowledgment per scan | Medium | 2h |
| Add heap monitoring + scheduled reboot | Medium | 2h |
| Implement static IP configuration | Low | 30m |
| Add OTA firmware update support | Medium | 4h |

### Phase 4: Scalability (Week 7-8)

| Task | Priority | Effort |
|------|----------|--------|
| Implement materialized views for leaderboard | High | 3h |
| Add data archival strategy (90-day rotation) | Medium | 4h |
| Add export-to-CSV on admin reports | Medium | 3h |
| Add proper error boundaries in React | Medium | 2h |
| Set up monitoring (Sentry for frontend, UptimeRobot for API) | Medium | 2h |
| Add comprehensive E2E tests (Playwright) | Medium | 8h |

### Phase 5: Enterprise Features (Month 3+)

| Task | Priority | Effort |
|------|----------|--------|
| Multi-tenant SaaS architecture | Future | 40h+ |
| Migrate to MIFARE DESFire with challenge-response | Future | 20h |
| Replace ESP32 with Raspberry Pi edge gateway | Future | 16h |
| Add offline-first sync with conflict resolution | Future | 20h |
| Implement CI/CD pipeline (GitHub Actions) | Future | 4h |
| Add automated backup to S3 | Future | 4h |
| QR code hybrid scanning (phone-based fallback) | Future | 16h |

---

## 10. Monitoring & Logging Strategy

| Layer | Tool | What to Monitor |
|-------|------|-----------------|
| Frontend | Sentry | JS errors, slow renders, failed API calls |
| API | Morgan + Winston | Request logs, response times, error rates |
| Database | Supabase Dashboard | Query performance, connection count, storage |
| ESP32 | Serial + MQTT | Heap usage, WiFi RSSI, scan queue depth, uptime |
| Uptime | UptimeRobot / BetterStack | API health, dashboard accessibility |
| Alerts | PagerDuty / Discord webhook | Error rate > 5%, ESP32 offline > 5 min |

---

## 11. Final Verdict

| Dimension | Current | After Phase 1-2 | After Phase 3-4 | Enterprise Target |
|-----------|---------|-----------------|-----------------|-------------------|
| Security | 3/10 | 7/10 | 8/10 | 9/10 |
| Scalability | 3/10 | 5/10 | 7/10 | 9/10 |
| Reliability | 4/10 | 6/10 | 8/10 | 9/10 |
| UX/Frontend | 6/10 | 7/10 | 8/10 | 9/10 |
| Hardware | 3/10 | 3/10 | 6/10 | 8/10 |
| **Overall** | **4.2/10** | **6.2/10** | **7.6/10** | **8.8/10** |

> [!IMPORTANT]
> **Phases 1-2 are non-negotiable before any real-world deployment.** The JWT-in-localStorage and clonable-RFID vulnerabilities alone can compromise the entire system. Implement these first, then iterate on scalability and hardware upgrades.
