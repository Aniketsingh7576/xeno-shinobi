"use strict";
//
// Shinobi – Plugin Base (Refactored 2025‑05‑24)
// Copyright (C) 2016‑2025 Moe Alam, moeiscool
//
// • Memory‑leak hardening
// • Clear separation of concerns
// • Re‑usable helper utilities
//
const fs = require("fs");
const { exec, spawn } = require("child_process");
const path = require("path");
const moment = require("moment");
const express = require("express");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");
const SocketIOClient = require("socket.io-client");
const CWSServer = require("cws").Server;
let stayDisconnected = false;

// ────────────────────────────────────────────────────────────────────────────────
// Globals guarded so that multiple require() calls don’t duplicate listeners
// ────────────────────────────────────────────────────────────────────────────────
if (!process.__PLUGIN_BASE_LISTENERS__) {
  process.__PLUGIN_BASE_LISTENERS__ = true;
  process.once("uncaughtException", (err) => console.error("uncaughtException", err));
  ["SIGINT", "SIGTERM"].forEach((sig) =>
    process.once(sig, () => {
      console.log("\nReceived ", sig, " – exiting cleanly.");
      process.exit(0);
    }),
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────────
const bytesToMiB = (b) => (b / (1024 * 1024)).toFixed(2);

const ensureTrailing = (str, t = "/") => (str.endsWith(t) ? str : str + t);

const gid = (len = 10) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[(Math.random() * chars.length) | 0]).join("");
};

const safeJSON = (x) => JSON.stringify(x, null, 2);

// ────────────────────────────────────────────────────────────────────────────────
// Main exported factory
// ────────────────────────────────────────────────────────────────────────────────
module.exports = function makePluginBase(__dirname, cfg = {}) {
  const config = { ...cfg }; // don’t mutate caller’s object
  if (!config.plug) throw new Error("config.plug is required");

  // basic defaults ----------------------------------------------------------------
  Object.assign(config, {
    dirname: ".",
    port: 8080,
    hostPort: 8082,
    systemLog: true,
    connectionType: "websocket",
    streamDir: config.streamDir || (process.platform === "win32" ? config.windowsTempDir : "/dev/shm"),
  });
  config.streamDir = ensureTrailing(config.streamDir || path.join(config.dirname, "streams"));

  // logging helpers ----------------------------------------------------------------
  const plugLog = (...msg) => console.log(new Date(), config.plug, ...msg);
  const sysLog = (...msg) => config.systemLog && console.log(moment().format(), ...msg);
  const dbgLog = (...msg) => config.debugLog && console.log(new Date(), ...msg);

  // leak‑detector (does nothing if the lib is missing)
  try {
    require("../libs/basic/leakDetector").start({
      sampleInterval: 15_000,
      absGrowthLimit: 10 * 1024 * 1024,
      consecutiveHits: 4,
      snapshotDir: "/tmp",
    });
  } catch (_) {}

  // ensure stream directory exists --------------------------------------------------
  fs.mkdirSync(config.streamDir, { recursive: true });

  // in‑memory state -----------------------------------------------------------------
  const s = {
    group: {},
    monitors: new Map(), // keyed by `${ke}${mid}`
    monitorInfo: new Map(),
    callbacks: new Map(), // Python RPC callbacks with timeout
    ext: {
      cameraInit: new Set(),
      pluginEvent: new Set(),
      cpuUsage: new Set(),
    },
    dir: { streams: config.streamDir },
    isWin: process.platform === "win32",
    getWebsocket: () => io,
  };

  // ───────────────────────────── image buffering & guard ──────────────────────────
  const imageBuffers = new Map(); // Map<monitorKey,{chunks:Buffer[], ts:number}>
  const MAX_IMG_AGE_MS = 5_000; // drop partial frames after 5 s

  function appendImageChunk(monitorKey, chunk) {
    const entry = imageBuffers.get(monitorKey) || { chunks: [], ts: Date.now() };
    entry.chunks.push(chunk);
    entry.ts = Date.now();
    imageBuffers.set(monitorKey, entry);

    // older than MAX_IMG_AGE_MS ➜ discard
    for (const [k, v] of imageBuffers) {
      if (Date.now() - v.ts > MAX_IMG_AGE_MS) imageBuffers.delete(k);
    }

    if (chunk.at(-2) === 0xff && chunk.at(-1) === 0xd9) {
      const buf = Buffer.concat(entry.chunks);
      imageBuffers.delete(monitorKey);
      return buf;
    }
    return null;
  }

  // ───────────────────────────────── cpu / nvidia helpers ─────────────────────────
  const getCpuUsage = (cb) => {
    const cmd = (() => {
      switch (process.platform) {
        case "win32":
          return "wmic cpu get loadpercentage /value";
        case "darwin":
          return "ps -A -o %cpu | awk '{s+=$1} END {print s}'";
        case "linux":
          return "top -b -n 2 | awk 'toupper($0) ~ /^.?CPU/ {gsub(\"id,\",\"100\",$8); gsub(\"%\",$8); print 100-$8}' | tail -n 1";
        default:
          return null;
      }
    })();

    if (!cmd) return cb(0);
    const child = spawn(cmd, { shell: true });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("close", () => cb(parseFloat(out.trim())));
  };

  // ───────────────────────────────── event dispatch helpers ────────────────────────
  function runExtenders(set, ...args) {
    for (const fn of set) {
      try {
        fn(...args);
      } catch (e) {
        console.error("extender error", e);
      }
    }
  }

  // ───────────────────────────────── processImage wrapper ─────────────────────────
  let overallProcessingCount = 0;
  async function processImage(buffer, d, tx, frameLocation) {
    const socket = s.getWebsocket();
    ++overallProcessingCount;
    socket?.emit("processCount", overallProcessingCount);

    // async detectObject ➜ user‑provided
    s.detectObject?.(buffer, d, tx, frameLocation, () => {
      --overallProcessingCount;
      socket?.emit("processCount", overallProcessingCount);
    });
  }

  // placeholder overridable
  s.detectObject = (_buf, _d, _tx, _frameLoc, done) => {
    console.warn("detectObject handler not set");
    done?.();
  };

  // ─────────────────────────────────── socket.io setup ────────────────────────────
  const app = express();
  const server = http.createServer(app);
  let io; // will hold either server or client instance

  // reusable cleanup of socket listeners -------------------------------------------
  function cleanupSocket(sock) {
    if (!sock) return;
    sock.removeAllListeners();
    sock.disconnect?.();
  }

  // server / host mode --------------------------------------------------------------
  function startHost() {
    const sio = new SocketIOServer(server, { transports: ["websocket"] });
    sio.engine.ws = new CWSServer({ noServer: true, perMessageDeflate: false });

    s.connectedClients = new Map();

    sio.on("connection", (cn) => {
      plugLog("Client connected", cn.id);
      const tx = (data) => cn.emit("ocv", { ...data, pluginKey: config.key, plug: config.plug });
      s.connectedClients.set(cn.id, { cn, tx });

      cn.on("f", (d) => mainEventController(d, cn, tx));
      cn.once("disconnect", () => {
        plugLog("Client disconnected", cn.id);
        s.connectedClients.delete(cn.id);
        cleanupSocket(cn);
      });
    });

    s.disconnectWebSocket = () => {
      for (const { cn } of s.connectedClients.values()) cleanupSocket(cn);
      s.connectedClients.clear();
    };

    io = sio;
  }

  // client mode --------------------------------------------------------------------
  function startClient() {
    let retry = 0;
    const MAX_RETRY = parseInt(config.maxRetryConnection, 10) || 5;
    const url = `ws://${config.host || "localhost"}:${config.port}`;

    function connect() {
        cleanupSocket(io)
      const sock = SocketIOClient(url, { transports: ["websocket"] });
      io = sock;

      const reconnect = () => {
          if(stayDisconnected)return;
        if (++retry > MAX_RETRY){
            stayDisconnected = true;
            s.disconnectWebSocket()
            return plugLog("Max retries reached");
        }
        setTimeout(connect, 3_000);
      };

      sock.once("connect", () => {
        retry = 0;
        plugLog("Connected to host");
        sock.emit("ocv", { f: "init", plug: config.plug, notice: config.notice, type: config.type, connectionType: config.connectionType, pluginKey: config.key });
      });

      ["disconnect", "connect_error", "error"].forEach((ev) => sock.on(ev, reconnect));

      sock.on("f", (d) => mainEventController(d, null, (data) => sock.emit("ocv", { ...data, pluginKey: config.key, plug: config.plug })));

      s.disconnectWebSocket = () => cleanupSocket(sock);
    }

    connect();
  }

  // choose host vs client -----------------------------------------------------------
  if (config.mode === "host") startHost();
  else startClient();

  // start http server with retry ----------------------------------------------------
  (function listen(tries = 0) {
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE" && tries < 5) {
        const old = config.hostPort;
        config.hostPort = parseInt(config.hostPort, 10) + 1;
        plugLog(`Port ${old} busy – trying ${config.hostPort}`);
        return listen(tries + 1);
      }
      throw err;
    });

    server.listen(config.hostPort, () => plugLog(`HTTP server on ${config.hostPort}`));
  })();

  // ─────────────────────────── main event controller ──────────────────────────────
  function mainEventController(d, cn, tx) {
    switch (d.f) {
      case "init_plugin_as_host": {
        if (!cn) return plugLog("No CN for init_plugin_as_host", d);
        if (d.key !== config.key) {
          plugLog("Plugin key mismatch from", cn.request?.connection?.remoteAddress);
          cn.emit("init", { ok: false });
          cn.disconnect();
          return;
        }
        cn.emit("init", { ok: true, plug: config.plug, notice: config.notice, type: config.type });
        break;
      }

      case "monitorUpdate": {
        const m = d.monitorConfig;
        const mKey = `${m.ke}${m.mid}`;
        s.monitors.set(mKey, { ...m });

        const det = m.details;
        const separate = det.detector_use_detect_object === "1";
        const width = parseFloat(separate && det.detector_scale_x_object ? det.detector_scale_x_object : det.detector_scale_x);
        const height = parseFloat(separate && det.detector_scale_y_object ? det.detector_scale_y_object : det.detector_scale_y);
        s.monitorInfo.set(mKey, { isObjectDetectionSeparate: separate, separate, width, height });

        imageBuffers.delete(mKey);
        runExtenders(s.ext.cameraInit, m, cn, tx);
        break;
      }

      case "frame": {
        const mKey = `${d.id}${d.ke}`;
        const buf = appendImageChunk(mKey, d.frame);
        if (buf) processImage(buf, d, tx);
        break;
      }

      case "frameFromRam": {
        processImage(d.buffer, d, tx, d.frameLocation);
        break;
      }
    }

    runExtenders(s.ext.pluginEvent, d, cn, tx);
  }

  // expose API to caller -----------------------------------------------------------
  s.onCameraInit = (fn) => s.ext.cameraInit.add(fn);
  s.onPluginEventExtender = (fn) => s.ext.pluginEvent.add(fn);
  s.onGetCpuUsageExtensions = new Set();

  // cpu usage polling for cluster mode --------------------------------------------
  if (config.clusterMode) {
    setInterval(() => {
      if (config.clusterBasedOnGpu) return; // left as exercise to parse nvidia‑smi
      getCpuUsage((pct) => io?.emit("cpuUsage", pct));
    }, 10_000);
  }

  // python integration (simplified) -----------------------------------------------
  if (config.createPythonBridge) {
    startPythonBridge();
  }

  function startPythonBridge() {
    const pyPort = config.pythonPort || 7990;
    const script = config.pythonScript || path.join(config.dirname, "pumpkin.py");

    let pyProc;
    const launch = () => {
      pyProc = spawn("python3", [script, pyPort], { env: { ...process.env, PYTHONUNBUFFERED: 1 } });
      pyProc.stdout.on("data", (d) => dbgLog("PY", d.toString()));
      pyProc.stderr.on("data", (d) => console.error("PYERR", d.toString()));
      pyProc.once("close", () => setTimeout(launch, 3_000));
    };
    launch();

    // RPC bridge
    s.createCameraBridgeToPython = (uniqueId) => {
      const sock = SocketIOClient(`ws://localhost:${pyPort}`, { transports: ["websocket"] });
      const pending = new Map();

      function sendToPython(data, cb, timeout = 5_000) {
        const id = data.id || gid();
        data.id = id;
        pending.set(id, cb);
        sock.emit("f", data);
        setTimeout(() => pending.delete(id), timeout); // auto‑cleanup
      }

      sock.on("f", (d) => {
        pending.get(d.id)?.(d.data);
        pending.delete(d.id);
      });

      sock.on("disconnect", () => setTimeout(() => sock.connect(), 3_000));

      return {
        refreshTracker: (trackerId) => sock.emit("refreshTracker", { trackerId }),
        sendToPython,
        destroy: () => cleanupSocket(sock),
      };
    };
  }

  // helper to get scaled dims ------------------------------------------------------
  s.getImageDimensions = (d) => {
    const det = d.mon;
    const height = det.detector_scale_y_object || det.detector_scale_y;
    const width = det.detector_scale_x_object || det.detector_scale_x;
    return { height: parseFloat(height), width: parseFloat(width) };
  };

  return s;
};
