const WebSocket = require('ws');

let wss = null;

const socketService = {
  init: (server) => {
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
      console.log('New WebSocket Client Connected');
      
      ws.send(JSON.stringify({ 
        type: 'CONNECTION_ACK', 
        message: 'Connected to LibraryTrack Real-time Stream' 
      }));

      ws.on('close', () => {
        console.log('Client Disconnected');
      });
    });

    console.log('WebSocket Server Initialized');
    return wss;
  },

  broadcast: (type, data) => {
    if (!wss) {
      console.warn('WSS not initialized. Cannot broadcast.');
      return;
    }

    const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
};

module.exports = socketService;
