require('dotenv').config();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRY = '8h';

// ─── Device API Key Validator (legacy — kept for backward compat) ────
const apiKeyValidator = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const masterKey = process.env.MASTER_API_KEY || 'rfid_secret_123';

  if (!apiKey || apiKey !== masterKey) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or missing API key in X-API-KEY header' 
    });
  }

  next();
};

// ─── HMAC Signature Validator (Phase 2 — replaces apiKeyValidator) ────
const hmacValidator = (req, res, next) => {
  const { uid, event, timestamp, nonce, signature, device_id } = req.body;
  const sharedSecret = process.env.DEVICE_SHARED_SECRET;

  // If DEVICE_SHARED_SECRET is not set, fall back to API key validation
  if (!sharedSecret) {
    return apiKeyValidator(req, res, next);
  }

  if (!uid || !event || !timestamp || !nonce || !signature) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'uid, event, timestamp, nonce, signature are required' });
  }

  // Step 1: Timestamp window check (±300 seconds = 5 min)
  const drift = Math.abs(Date.now() / 1000 - timestamp);
  if (drift > 300) {
    console.warn(`[AUTH] Expired request from device ${device_id || 'unknown'}, drift=${drift.toFixed(0)}s`);
    return res.status(401).json({ error: 'REQUEST_EXPIRED' });
  }

  // Step 2: HMAC-SHA256 verification
  const message = `${nonce}:${timestamp}:${uid}:${event}`;
  const expected = crypto
    .createHmac('sha256', sharedSecret)
    .update(message)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature || '', 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    console.warn(`[AUTH] Invalid HMAC from device ${device_id || 'unknown'}`);
    return res.status(401).json({ error: 'INVALID_SIGNATURE' });
  }

  // Attach device_id to request for downstream use
  req.deviceId = device_id || 'unknown';
  next();
};

// ─── Admin JWT Middleware ─────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' });
  }

  try {
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
    }
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Token expired or invalid' });
  }
};

// ─── Admin Login Handler ──────────────────────────────────────────────
const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Username and password required' });
  }

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (username.toLowerCase() !== adminUsername.toLowerCase()) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  }

  // If ADMIN_PASSWORD_HASH is set, use bcrypt comparison
  // Otherwise, fall back to plain-text ADMIN_PASSWORD for backward compat
  let valid = false;
  if (adminPasswordHash) {
    valid = await bcrypt.compare(password, adminPasswordHash);
  } else {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    valid = (password === adminPassword);
    if (valid) {
      console.warn('[AUTH] ⚠ Using plain-text ADMIN_PASSWORD. Set ADMIN_PASSWORD_HASH for production!');
    }
  }

  if (!valid) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  }

  const token = jwt.sign(
    { role: 'admin', sub: username, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  res.json({ token, role: 'admin', expiresIn: JWT_EXPIRY });
};


// ─── Student JWT / UID Middleware ─────────────────────────────────────
// Groups are student-only. A student is identified by their JWT token
// (issued at /student/login) which carries { role: 'student', uid, roll }.
const requireStudent = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Student login required' });
  }
  try {
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'student') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Student access required' });
    }
    req.student = payload; // { uid, roll, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Token expired or invalid' });
  }
};

module.exports = { apiKeyValidator, hmacValidator, requireAdmin, adminLogin, requireStudent };
