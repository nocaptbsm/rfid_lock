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

server.listen(PORT, () => {
  console.log(`
🚀 LibraryTrack Backend is running!
📡 URL: http://localhost:${PORT}
🔌 WebSocket Server is active
🔒 Security: HMAC + JWT + Rate Limiting enabled
🧹 Nonce cleanup every ${NONCE_CLEANUP_INTERVAL / 1000}s
  `);
});
