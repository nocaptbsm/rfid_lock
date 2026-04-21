const http = require('http');
const app = require('./app');
const socketService = require('./services/socketService');
require('dotenv').config();

const PORT = process.env.PORT || 8000;

const server = http.createServer(app);

// Initialize WebSocket stream
socketService.init(server);

server.listen(PORT, () => {
  console.log(`
🚀 LibraryTrack Backend is running!
📡 URL: http://localhost:${PORT}
🔌 WebSocket Server is active
  `);
});
