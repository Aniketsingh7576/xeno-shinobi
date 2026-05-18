const WebSocket = require('cws');
const net = require('net');
const process = require('process');
const { parentPort, workerData } = require('worker_threads');
const WS_SERVER = workerData.wsServer;
const IDENTIFIER = workerData.peerConnectKey;
const SSH_PORT = workerData.sshPort || 22;
const RECONNECT_INTERVAL = workerData.reconnectInterval || 10000;

process.on("uncaughtException", function(error) {
  console.error(error);
});

let ws = null;
let sshSocket = null;
let assignedPort = null;
let reconnectTimer = null;

function connectWebSocket() {
  if (ws) {
    if (ws.readyState === ws.OPEN) return;
  }

  console.log(`Connecting SSH to ${WS_SERVER}...`);
  ws = new WebSocket(`${WS_SERVER}`);
  ws.on('open', () => {
    console.log('Connected SSH, registering...');
    ws.send(JSON.stringify({
      type: 'register',
      identifier: IDENTIFIER
    }));
  });

  ws.on('message', (message) => {
    const msg = JSON.parse(message);
    if (msg.type === 'registered') {
      assignedPort = msg.port;
      console.log(`Registered SSH! Forwarding port ${assignedPort} to SSH`);
    }
    else if (msg.type === 'data') {
      if (!sshSocket) connectSSH();
      sshSocket.write(Buffer.from(msg.data, 'base64'));
    }
  });

  ws.on('close', () => {
    console.log('Disconnected SSH from server');
    if (sshSocket) sshSocket.end();
    // scheduleReconnect();
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error('SSH Socket error:', err);
    // scheduleReconnect();
    process.exit(0);
  });
}

function connectSSH() {
  if (sshSocket) sshSocket.end();

  sshSocket = new net.Socket();
  sshSocket.connect(SSH_PORT, '127.0.0.1', () => {
    console.log('Connected to SSH server');
  });

  sshSocket.on('data', (data) => {
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'data',
        identifier: IDENTIFIER,
        data: data.toString('base64')
      }));
    }
  });

  sshSocket.on('error', (err) => {
    console.error('SSH error:', err);
    sshSocket = null;
  });

  sshSocket.on('close', () => {
    sshSocket = null;
  });
}

function scheduleReconnect() {
  if (!reconnectTimer) {
    console.log(`Reconnecting in ${RECONNECT_INTERVAL/1000} seconds...`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWebSocket();
    }, RECONNECT_INTERVAL);
  }
}

// Start connection
connectWebSocket();
