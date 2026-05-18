const { spawn } = require('child_process');
const { parentPort, workerData } = require('worker_threads');
const fs = require("fs").promises;
const net = require("net");
const bson = require('bson');
const WebSocket = require('cws');
const os = require('os');
const { EventEmitter } = require('node:events');

// Constants
const EXPECTED_CONFIG_PATH = './conf.json';
const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const SOCKET_CHECK_INTERVAL = 20000; // 20 seconds
const RECONNECT_DELAY = 2000; // 2 seconds
const HEARTBEAT_TIMEOUT_MULTIPLIER = 1.5;

// Error handling
process.on("uncaughtException", (error) => {
  console.error('Uncaught Exception:', error);
});

class CentralConnection {
  constructor() {
    this.activeTerminalCommands = {};
    this.requestConnections = {};
    this.requestConnectionsData = {};
    this.responseTunnels = {};
    this.timers = {
      socketCheck: null,
      heartbeat: null,
      heartbeatCheck: null,
      onClosed: null
    };
    this.stayDisconnected = false;
    this.allMessageHandlers = [];
    this.internalEvents = new EventEmitter();

    this.initConfig();
    this.initLogging();
    this.setupParentPortHandlers();
  }

  initConfig() {
    const { config, serverIp: hostPeerServer, p2pKey: peerConnectKey } = workerData;
    this.config = config;
    this.hostPeerServer = hostPeerServer;
    this.peerConnectKey = peerConnectKey;
    this.sslInfo = config.ssl || {};
  }

  initLogging() {
    this.logger = {
      debugLog: () => {},
      systemLog: (...args) => {
        parentPort.postMessage({ f: 'systemLog', data: args });
      }
    };

    // if (this.config.debugLog) {
      this.logger.debugLog = (...args) => {
        parentPort.postMessage({ f: 'debugLog', data: args });
      };
    // }
  }

  setupParentPortHandlers() {
      const _this = this;
    parentPort.on('message', (data) => {
      switch (data.f) {
        case 'init':
          _this.initialize();
          break;
        case 'connectDetails':
          data.connectDetails.peerConnectKey = this.peerConnectKey;
          _this.internalEvents.emit('connectDetails', data.connectDetails);
          break;
        case 'onTriggerNotificationSend':
          data.peerConnectKey = this.peerConnectKey;
          _this.internalEvents.emit('onTriggerNotificationSend', data);
          break;
        case 'exit':
          _this.logger.debugLog('Closing Central Connection...');
          process.exit(0);
          break;
      }
    });
    this.internalEvents.on('onTriggerNotificationSend', (data) => {
        this.sendDataToTunnel({ f: 'onTriggerNotificationSend', data });
    });
  }

  clearAllTimers() {
    Object.values(this.timers).forEach(timer => {
      if (timer) clearTimeout(timer);
    });
    this.timers = {
      socketCheck: null,
      heartbeat: null,
      heartbeatCheck: null,
      onClosed: null
    };
  }

  getServerIPAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const interfaceName in interfaces) {
      for (const iface of interfaces[interfaceName]) {
        if (iface.family === 'IPv4' && !iface.internal && iface.address !== '127.0.0.1' && !iface.address.includes(':')) {
          addresses.push(iface.address);
        }
      }
    }
    return addresses;
  }

  getRequestConnection(requestId) {
    return this.requestConnections[requestId] || {
      write: () => {}
    };
  }

  async getConnectionDetails() {
    return new Promise((resolve) => {
      this.internalEvents.once('connectDetails', (data) => {
        resolve(data);
      });
      parentPort.postMessage({ f: 'connectDetailsRequest' });
    });
  }

  async startConnection() {
    this.stayDisconnected = false;
    await this.startWebsocketConnection();
  }

  async startWebsocketConnection() {
    this.logger.debugLog('startWebsocketConnection EXECUTE', new Error());
    console.log('Central : Connecting to Central Server...');

    try {
      this.clearAllTimers();
      // this.stayDisconnected = true;
      if (this.tunnelToP2P){
          this.tunnelToP2P.removeAllListeners('open');
          this.tunnelToP2P.removeAllListeners('error');
          this.tunnelToP2P.removeAllListeners('close');
          this.tunnelToP2P.close();
      }
    } catch (err) {
      console.log('Error closing previous connection:', err);
    }

    // this.stayDisconnected = false;
    this.tunnelToP2P = new WebSocket(this.hostPeerServer);

    this.tunnelToP2P.on('open', () => this.onWebsocketOpen());
    this.tunnelToP2P.on('error', (err) => this.onWebsocketError(err));
    this.tunnelToP2P.on('close', () => this.onWebsocketClose());
    this.tunnelToP2P.onmessage = (event) => this.handleWebsocketMessage(event);

    this.setupSocketCheckTimer();
  }

  onWebsocketOpen() {
    console.log('Central : Connected! Authenticating...');
    this.authenticateConnection();
  }

  onWebsocketError(err) {
    console.log('Central tunnelToCentral Error:', err);
    console.log('Central Restarting...');
    this.disconnectedConnection();
  }

  onWebsocketClose() {
    console.log('Central Connection Closed!');
    this.clearAllTimers();
    this.timers.onClosed = setTimeout(() => {
      this.disconnectedConnection();
    }, 5000);
  }

  async authenticateConnection() {
    const connectDetails = await this.getConnectionDetails();
    const configData = JSON.parse(await fs.readFile(EXPECTED_CONFIG_PATH, 'utf8'));

    this.sendDataToTunnel({
      isXenocipher: !!this.config.passwordType,
      peerConnectKey: this.peerConnectKey,
      connectDetails,
      ipAddresses: this.getServerIPAddresses(),
      config: configData,
    });

    this.setupHeartbeat();
    this.scheduleHeartbeatCheck();
  }

  sendDataToTunnel(data) {
    if (this.tunnelToP2P.readyState === 1) {
        this.tunnelToP2P.send(bson.serialize(data));
    }else{
        console.log('Cant Send Data, Tunnel Not Ready!')
    }
  }

  setupSocketCheckTimer() {
    this.timers.socketCheck = setInterval(() => {
      if (this.tunnelToP2P.readyState !== 1) {
        this.logger.debugLog('Tunnel NOT Ready! Reconnecting...');
        this.disconnectedConnection();
      }
    }, SOCKET_CHECK_INTERVAL);
  }

  setupHeartbeat() {
    this.clearAllTimers();
    this.timers.heartbeat = setInterval(() => {
      this.sendDataToTunnel({ f: 'ping' });
    }, HEARTBEAT_INTERVAL);
  }

  scheduleHeartbeatCheck() {
    setTimeout(() => {
      if (this.tunnelToP2P.readyState !== 1) {
        this.refreshHeartBeatCheck();
      }
    }, 5000);
  }

  refreshHeartBeatCheck() {
    this.clearAllTimers();
    this.timers.heartbeatCheck = setTimeout(() => {
      this.startWebsocketConnection();
    }, HEARTBEAT_INTERVAL * HEARTBEAT_TIMEOUT_MULTIPLIER);
  }

  disconnectedConnection() {
    this.logger.debugLog('stayDisconnected', this.stayDisconnected);
    this.clearAllTimers();
    this.logger.debugLog('DISCONNECTED!');

    if (this.stayDisconnected) return;

    this.logger.debugLog('RESTARTING!');
    setTimeout(() => {
      if (!this.tunnelToP2P || this.tunnelToP2P.readyState !== 1) {
        this.startWebsocketConnection();
      }
    }, RECONNECT_DELAY);
  }

  handleWebsocketMessage(event) {
    const data = bson.deserialize(Buffer.from(event.data));
    this.allMessageHandlers.forEach((handler) => {
      if (data.f === handler.key) {
        handler.callback(data.data, data.rid);
      }
    });
  }

  onIncomingMessage(key, callback) {
    this.allMessageHandlers.push({ key, callback });
  }

  outboundMessage(key, data, requestId) {
    this.sendDataToTunnel({
      f: key,
      data: data,
      rid: requestId
    });
  }

  async createRemoteSocket(host, port, requestId, initData) {
    const responseTunnel = await this.getResponseTunnel(requestId);
    const remoteSocket = new net.Socket();

    remoteSocket.on('ready', () => {
      remoteSocket.write(initData.buffer);
    });

    remoteSocket.on('error', (err) => {
      this.logger.debugLog('createRemoteSocket ERROR', err);
    });

    remoteSocket.on('data', (data) => {
      this.requestConnectionsData[requestId] = data.toString();
      responseTunnel.send('data', data);
    });

    remoteSocket.on('drain', () => {
      responseTunnel.send('resume', {});
    });

    remoteSocket.on('close', () => {
      delete this.requestConnectionsData[requestId];
      responseTunnel.send('end', {});
      setTimeout(() => {
        if (responseTunnel && (responseTunnel.readyState === 0 || responseTunnel.readyState === 1)) {
          responseTunnel.close();
        }
      }, 5000);
    });

    remoteSocket.connect(port, host || 'localhost');
    this.requestConnections[requestId] = remoteSocket;
    return remoteSocket;
  }

  writeToServer(data, requestId) {
    const flushed = this.getRequestConnection(requestId).write(data.buffer);
    if (!flushed) {
      this.outboundMessage('pause', {}, requestId);
    }
  }

  async getResponseTunnel(originalRequestId) {
    return this.responseTunnels[originalRequestId] || await this.createResponseTunnel(originalRequestId);
  }

  createResponseTunnel(originalRequestId) {
    return new Promise((resolve) => {
      const responseTunnelMessageHandlers = [];
      const responseTunnel = new WebSocket(this.hostPeerServer);

      const sendToResponseTunnel = (data) => {
        responseTunnel.send(bson.serialize(data));
      };

      const sendData = (key, data) => {
        sendToResponseTunnel({
          f: key,
          data: data,
          rid: originalRequestId
        });
      };

      const onMessage = (key, callback) => {
        responseTunnelMessageHandlers.push({ key, callback });
      };

      responseTunnel.on('error', (err) => {
        this.logger.debugLog('responseTunnel ERROR', err);
      });

      responseTunnel.on('open', () => {
        sendToResponseTunnel({
          responseTunnel: originalRequestId,
          peerConnectKey: this.peerConnectKey,
        });
      });

      responseTunnel.on('close', () => {
        delete this.responseTunnels[originalRequestId];
      });

      responseTunnel.onmessage = (event) => {
        const data = bson.deserialize(Buffer.from(event.data));
        responseTunnelMessageHandlers.forEach((handler) => {
          if (data.f === handler.key) {
            handler.callback(data.data, data.rid);
          }
        });
      };

      onMessage('ready', () => {
        const finalData = {
          onMessage,
          send: sendData,
          sendRaw: sendToResponseTunnel,
          close: responseTunnel.close.bind(responseTunnel)
        };
        this.responseTunnels[originalRequestId] = finalData;
        resolve(finalData);
      });
    });
  }

  closeResponseTunnel(originalRequestId) {
    try {
      this.responseTunnels[originalRequestId]?.close();
    } catch (err) {
      this.logger.debugLog('closeResponseTunnel', err);
    }
  }

  initialize() {
    this.setupMessageHandlers();
    this.startConnection();
  }

  setupMessageHandlers() {
    this.onIncomingMessage('connect', async (data, requestId) => {
      this.logger.debugLog('New Request Incoming', 'localhost', this.config.port, requestId);
      await this.createRemoteSocket('localhost', this.config.port, requestId, data.init);
    });

    this.onIncomingMessage('data', (data, requestId) => this.writeToServer(data, requestId));
    this.onIncomingMessage('resume', (data, requestId) => this.requestConnections[requestId].resume());
    this.onIncomingMessage('pause', (data, requestId) => this.requestConnections[requestId].pause());
    this.onIncomingMessage('pong', () => {}); // Heartbeat response

    this.onIncomingMessage('init', () => {
      console.log('Central : Authenticated!');
      parentPort.postMessage({ f: 'authenticated' });
    });

    this.onIncomingMessage('modifyConfiguration', (data) => {
      parentPort.postMessage({ f: 'modifyConfiguration', data });
    });

    this.onIncomingMessage('getConfiguration', (data, requestId) => {
      this.outboundMessage('getConfigurationResponse', { ...this.config }, requestId);
    });

    this.onIncomingMessage('restart', () => {
      parentPort.postMessage({ f: 'restart' });
    });

    this.onIncomingMessage('end', (data, requestId) => {
      try {
        this.requestConnections[requestId]?.end();
      } catch (err) {
        this.logger.debugLog(`Request Failed to END ${requestId}`);
        this.logger.debugLog(`Failed Request ${this.requestConnectionsData[requestId]}`);
        delete this.requestConnectionsData[requestId];
        this.logger.debugLog(err);
      }
    });

    this.onIncomingMessage('disconnect', (data) => {
      console.log('FAILED LICENSE CHECK ON P2P');
      this.stayDisconnected = !data?.retryLater;
      if (data?.retryLater) console.log('Retrying Central Later...');
    });
  }
}

// Start the connection
const centralConnection = new CentralConnection();
centralConnection.initialize();
