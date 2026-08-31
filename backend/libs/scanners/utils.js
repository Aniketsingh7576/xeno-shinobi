var os = require('os');
// Discovery uses the `onvif` (Cam) library — it handles modern cameras (Media2 /
// GetServices) that the old `shinobi-onvif` fork failed to parse (empty GetCapabilities
// → null media service → hung init). Same library the ONVIF event listener already uses.
const { Cam } = require("onvif");
const {
    addCredentialsToUrl,
    stringContains,
    getBuffer,
} = require('../common.js')
module.exports = (s,config,lang) => {
    const ipRange = (start_ip, end_ip) => {
      var startLong = toLong(start_ip);
      var endLong = toLong(end_ip);
      if (startLong > endLong) {
        var tmp = startLong;
        startLong = endLong
        endLong = tmp;
      }
      var rangeArray = [];
      var i;
      for (i = startLong; i <= endLong; i++) {
        rangeArray.push(fromLong(i));
      }
      return rangeArray;
    }
    const portRange = (lowEnd,highEnd) => {
        var list = [];
        for (var i = lowEnd; i <= highEnd; i++) {
            list.push(i);
        }
        return list;
    }
    //toLong taken from NPM package 'ip'
    const toLong = (ip) => {
      var ipl = 0;
      ip.split('.').forEach(function(octet) {
        ipl <<= 8;
        ipl += parseInt(octet);
      });
      return(ipl >>> 0);
    }
    //fromLong taken from NPM package 'ip'
    const fromLong = (ipl) => {
      return ((ipl >>> 24) + '.' +
          (ipl >> 16 & 255) + '.' +
          (ipl >> 8 & 255) + '.' +
          (ipl & 255) );
    }

    // Probe one host over ONVIF using the `onvif` (Cam) library. Resolves with
    // { info, date, uri, isPTZ, snapShot } on a successful ONVIF connection, or rejects
    // with an Error whose message drives the error mapping below (401 / timeout / etc.).
    // The stream URI is the essential field; device info, date and snapshot are best-effort
    // and never block or fail the result.
    const probeOnvifCam = (camera, timeoutMs) => new Promise((resolve, reject) => {
        let settled = false
        const finish = (fn, arg) => { if(settled) return; settled = true; fn(arg) }
        // essential phase: connect + get the RTSP stream URI
        const essentialTimer = setTimeout(() => finish(reject, new Error('onvif timeout')), timeoutMs)
        const onConnected = function(err){
            if(err){ clearTimeout(essentialTimer); return finish(reject, err) }
            const self = this
            const profiles = self.profiles || []
            const firstProfile = profiles[0] || {}
            const mainToken = (self.activeSource && self.activeSource.profileToken)
                || (firstProfile.$ && firstProfile.$.token)
                || firstProfile.token
            const result = {
                info: null,
                date: null,
                uri: '',
                isPTZ: !!(self.capabilities && self.capabilities.PTZ),
                snapShot: undefined,
            }
            self.getDeviceInformation((e1, info) => {
                if(!e1 && info) result.info = info
                self.getStreamUri({ protocol: 'RTSP', profileToken: mainToken }, (e2, stream) => {
                    result.uri = (!e2 && stream && stream.uri) ? stream.uri : ''
                    clearTimeout(essentialTimer)
                    // extras (date, snapshot) — bounded, never block the result
                    const extrasDone = () => finish(resolve, result)
                    const extrasTimer = setTimeout(extrasDone, 3500)
                    self.getSystemDateAndTime((e3, date) => {
                        if(!e3 && date) result.date = date
                        self.getSnapshotUri({ profileToken: mainToken }, async (e4, snap) => {
                            if(!e4 && snap && snap.uri){
                                try{
                                    const snapUrl = addCredentialsToUrl({ username: camera.user, password: camera.pass, url: snap.uri })
                                    result.snapShot = (await getBuffer(snapUrl)).toString('base64')
                                }catch(e){ /* snapshot is optional */ }
                            }
                            clearTimeout(extrasTimer); extrasDone()
                        })
                    })
                })
            })
        }
        try{
            new Cam({
                hostname: camera.ip,
                port: parseInt(camera.port, 10),
                username: camera.user || '',
                password: camera.pass || '',
                timeout: timeoutMs,
            }, onConnected)
        }catch(err){
            clearTimeout(essentialTimer)
            finish(reject, err)
        }
    })

    // Apply video-encoder settings to a single camera over ONVIF (`onvif` Cam library,
    // which handles Media2 SetVideoEncoderConfiguration). `target` selects which stream
    // (sub = lowest resolution, main = highest, both = all) and what to set on it
    // (encoding H264/H265, and optionally resolution "WxH", bitrate kbps, GOP, profile).
    // Resolves { ok, before:[...], applied } or { ok:false, error }.
    const configureOnvifCam = (camera, target, timeoutMs) => new Promise((resolve) => {
        let settled = false
        const done = (r) => { if(settled) return; settled = true; clearTimeout(timer); resolve(r) }
        const timer = setTimeout(() => done({ ok:false, error:'onvif timeout' }), timeoutMs)
        try{
            new Cam({
                hostname: camera.ip,
                port: parseInt(camera.port, 10),
                username: camera.user || '',
                password: camera.pass || '',
                timeout: timeoutMs,
            }, function(err){
                if(err) return done({ ok:false, error: (err && err.message) || String(err) })
                const cam = this
                cam.getVideoEncoderConfigurations((e, cfgs) => {
                    if(e || !cfgs || !cfgs.length) return done({ ok:false, error: (e && e.message) || 'no video encoder configurations' })
                    const sorted = cfgs.slice().sort((a,b) =>
                        (a.resolution.width*a.resolution.height) - (b.resolution.width*b.resolution.height))
                    let targets
                    if(target.stream === 'main') targets = [sorted[sorted.length-1]]
                    else if(target.stream === 'both') targets = sorted
                    else targets = [sorted[0]] // default: sub-stream
                    const before = targets.map(c => ({
                        token: c.$ && c.$.token,
                        encoding: c.encoding,
                        resolution: c.resolution.width + 'x' + c.resolution.height,
                    }))
                    let idx = 0
                    const applyNext = () => {
                        if(idx >= targets.length) return done({ ok:true, before, applied: targets.length })
                        const cfg = targets[idx++]
                        if(target.encoding) cfg.encoding = target.encoding
                        if(cfg.$){
                            if(target.profile) cfg.$.Profile = target.profile
                            if(target.govLength) cfg.$.GovLength = parseInt(target.govLength)
                        }
                        // resolution/bitrate are only meaningful per-stream; apply when provided
                        if(target.resolution && /^\d+x\d+$/.test(target.resolution)){
                            const [w,h] = target.resolution.split('x').map(Number)
                            cfg.resolution = { width: w, height: h }
                        }
                        if(target.bitrate && cfg.rateControl){
                            cfg.rateControl.bitrateLimit = parseInt(target.bitrate)
                        }
                        cam.setVideoEncoderConfiguration(cfg, (e2) => {
                            if(e2) return done({ ok:false, error: (e2 && e2.message) || 'set failed', before })
                            applyNext()
                        })
                    }
                    applyNext()
                })
            })
        }catch(err){
            done({ ok:false, error: (err && err.message) || String(err) })
        }
    })

    // Expand a UI IP string ("a-b", comma list, single) into an IP array.
    const buildIpList = (ipStr) => {
        let list = []
        ;(ipStr || '').replace(/ /g,'').split(',').forEach((range) => {
            if(!range) return
            if(range.indexOf('-') > -1){
                const parts = range.split('-')
                list = list.concat(ipRange(parts[0], parts[1]))
            }else{
                list.push(range)
            }
        })
        return list
    }
    const buildPortList = (portStr) => {
        portStr = (portStr || '80').replace(/ /g,'')
        if(!portStr) return [80]
        if(portStr.indexOf('-') > -1){
            const parts = portStr.split('-')
            return portRange(parseInt(parts[0]), parseInt(parts[1]))
        }
        return portStr.split(',').map((p) => parseInt(p)).filter((n) => !isNaN(n))
    }

    // Bulk-apply video-encoder settings across an IP range over ONVIF. Streams per-camera
    // results back via tx({ f:'onvif_config_result', ... }) and progress via onProgress.
    const runOnvifBulkConfig = async (options, tx, onProgress) => {
        const net = require('net')
        const ipList = buildIpList(options.ip)
        const ports = buildPortList(options.port)
        const user = options.user || ''
        const pass = options.pass || ''
        const target = {
            stream: options.stream || 'sub',
            encoding: options.encoding || 'H264',
            resolution: options.resolution || '',
            bitrate: options.bitrate || '',
            govLength: options.govLength || '',
            profile: options.profile || '',
        }
        const hitList = []
        ipList.forEach((ip) => ports.forEach((port) => hitList.push({ ip, port, user, pass })))
        const totalItems = hitList.length
        let processedItems = 0, okCount = 0, failCount = 0
        const probeTcp = (host, port, timeoutMs = 600) => new Promise((resolve) => {
            const sock = new net.Socket()
            let fin = false
            const finish = (ok) => { if(fin) return; fin = true; try{sock.destroy()}catch(e){}; resolve(ok) }
            sock.setTimeout(timeoutMs)
            sock.once('connect', () => finish(true))
            sock.once('timeout', () => finish(false))
            sock.once('error', () => finish(false))
            sock.connect(port, host)
        })
        tx({ f: 'onvif_config_started', totalItems, target })
        const BATCH_SIZE = 20   // config writes are heavier than probes — smaller batch
        for(let i = 0; i < hitList.length; i += BATCH_SIZE){
            const batch = hitList.slice(i, i + BATCH_SIZE)
            await Promise.all(batch.map(async (camera) => {
                let result
                const portOpen = await probeTcp(camera.ip, camera.port)
                if(!portOpen){
                    result = { ok:false, error:'port closed' }
                }else{
                    result = await configureOnvifCam(camera, target, 12000)
                }
                processedItems++
                if(result.ok) okCount++; else failCount++
                tx(Object.assign({ f:'onvif_config_result', ip:camera.ip, port:camera.port }, result))
                if(onProgress){
                    const percent = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 100
                    onProgress(percent, processedItems, totalItems)
                }
            }))
        }
        tx({ f:'onvif_config_ended', totalItems, okCount, failCount })
        return { ok:true, totalItems, okCount, failCount }
    }

    // --- Scan state controller ---
    // Holds the mutable state for a running scan session.
    // A new controller is created each time runOnvifScanner() is called,
    // so concurrent scans each have independent state.
    const createScanController = () => {
        let cancelled = false;   // true = stop permanently, discard progress
        let paused = false;      // true = hold between batches, resume later
        let resumeResolve = null;// resolve handle for the pause-gate promise

        return {
            // Cancel the scan entirely. Any in-flight batch finishes naturally,
            // then the loop exits. Accumulated results are still returned.
            cancel() {
                cancelled = true;
                // If we are currently paused, unblock so the loop can exit.
                if (resumeResolve) {
                    resumeResolve();
                    resumeResolve = null;
                }
            },
            // Pause between batches. The current batch finishes before halting.
            pause() {
                if (!cancelled) paused = true;
            },
            // Resume a paused scan.
            resume() {
                paused = false;
                if (resumeResolve) {
                    resumeResolve();
                    resumeResolve = null;
                }
            },
            get isCancelled() { return cancelled; },
            get isPaused()    { return paused; },
            // Called by the scan loop between batches to honour pause/cancel.
            // Returns true when the loop should stop (cancelled).
            async wait() {
                if (cancelled) return true;
                if (paused) {
                    // Block until resume() or cancel() is called.
                    await new Promise(resolve => { resumeResolve = resolve; });
                }
                return cancelled;
            }
        };
    }

    // Active controllers keyed by scanId so callers can control them later.
    const activeScans = {};
    const activeScansFound = {};

    // Stop (cancel) a scan by id.
    const cancelScan = (scanId, tx) => {
        if (activeScans[scanId]) {
            tx({ f: 'onvif_scan_cancel' })
            activeScans[scanId].cancel();
            tx({ f: 'onvif_scan_ended', foundNumber: activeScansFound[scanId].filter(item => !item.ff).length })
            delete(activeScans[scanId])
            delete(activeScansFound[scanId])
            return true
        }
        return false
    };

    // Pause a scan by id.
    const pauseScan = (scanId) => {
        if (activeScans[scanId]) {
            activeScans[scanId].pause();
            return true
        }
        return false
    };

    // Resume a paused scan by id.
    const resumeScan = (scanId) => {
        if (activeScans[scanId]) {
            activeScans[scanId].resume();
            return true
        }
        return false
    };

    // Returns a snapshot of all active scan ids and their current state.
    const getScanStatus = (scanId) => {
        if (scanId) {
            const ctrl = activeScans[scanId];
            if (!ctrl) return null;
            return { scanId, cancelled: ctrl.isCancelled, paused: ctrl.isPaused, found: activeScansFound[scanId] };
        }
        return Object.keys(activeScans).map(id => ({
            scanId: id,
            cancelled: activeScans[id].isCancelled,
            paused: activeScans[id].isPaused,
            found: activeScansFound[id]
        }));
    };

    const runOnvifScanner = async (options, tx, onProgress) => {
        const scanId = options.scanId || `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        if(activeScans[scanId]){
            tx({ f: 'onvif_scan_started_before' })
            return
        }
        tx({ f: 'onvif_scan_started' })
        const controller = createScanController();
        activeScans[scanId] = controller;
        activeScansFound[scanId] = [];
        var ip = options.ip.replace(/ /g,'')
        var ports = options.port.replace(/ /g,'')
        function callback(result){
            activeScansFound[scanId].push(result);
            if(tx)tx(result)
        }
        if(options.ip === ''){
            var interfaces = os.networkInterfaces()
            var addresses = []
            for (var k in interfaces) {
                for (var k2 in interfaces[k]) {
                    var address = interfaces[k][k2]
                    if (address.family === 'IPv4' && !address.internal) {
                        addresses.push(address.address)
                    }
                }
            }
            const addressRange = []
            addresses.forEach(function(address){
                if(address.indexOf('0.0.0')>-1){return false}
                var addressPrefix = address.split('.')
                delete(addressPrefix[3]);
                addressPrefix = addressPrefix.join('.')
                addressRange.push(`${addressPrefix}1-${addressPrefix}254`)
            })
            ip = addressRange.join(',')
        }
        if(ports === ''){
            ports = '80,8000,8080'
        }
        if(ports.indexOf('-') > -1){
            ports = ports.split('-')
            var portRangeStart = ports[0]
            var portRangeEnd = ports[1]
            ports = portRange(portRangeStart,portRangeEnd);
        }else{
            ports = ports.split(',')
        }
        var ipList = options.ipList
        var onvifUsername = options.user || ''
        var onvifPassword = options.pass || ''
        ip.split(',').forEach(function(addressRange){
            var ipRangeStart = addressRange[0]
            var ipRangeEnd = addressRange[1]
            if(addressRange.indexOf('-')>-1){
                addressRange = addressRange.split('-');
                ipRangeStart = addressRange[0]
                ipRangeEnd = addressRange[1]
            }else{
                ipRangeStart = addressRange
                ipRangeEnd = addressRange
            }
            if(!ipList){
                ipList = ipRange(ipRangeStart,ipRangeEnd);
            }else{
                ipList = ipList.concat(ipRange(ipRangeStart,ipRangeEnd))
            }
        })
        // Guard: a mistyped range (e.g. port "80-8080" x a /24 = ~2M targets) would build a
        // huge hit list retained in memory for the whole scan. Reject oversized ranges early.
        var MAX_SCAN_TARGETS = 5000;
        if((ipList.length * ports.length) > MAX_SCAN_TARGETS){
            tx({ f: 'onvif_scan_ended', foundNumber: 0, msg: 'Scan range too large (' + (ipList.length * ports.length) + ' targets, max ' + MAX_SCAN_TARGETS + '). Narrow the IP or port range.' })
            delete activeScans[scanId]     // controller was registered at the top; release it
            delete activeScansFound[scanId]
            return
        }
        var hitList = []
        ipList.forEach((ipEntry,n) => {
            ports.forEach((portEntry,nn) => {
                hitList.push({
                    xaddr : 'http://' + ipEntry + ':' + portEntry + '/onvif/device_service',
                    user : onvifUsername,
                    pass : onvifPassword,
                    ip: ipEntry,
                    port: portEntry,
                })
            })
        })
        var responseList = []
        const totalItems = hitList.length
        var processedItems = 0
        const BATCH_SIZE = 120
        const net = require('net')
        const withTimeout = (promise, ms, label = 'onvif') => Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timeout')), ms))
        ])
        const probeTcp = (host, port, timeoutMs = 600) => new Promise((resolve) => {
            const sock = new net.Socket()
            let done = false
            const finish = (ok) => { if(done) return; done = true; try{sock.destroy()}catch(e){}; resolve(ok) }
            sock.setTimeout(timeoutMs)
            sock.once('connect', () => finish(true))
            sock.once('timeout', () => finish(false))
            sock.once('error', () => finish(false))
            sock.connect(port, host)
        })
        for(let i = 0; i < hitList.length; i += BATCH_SIZE){
            const shouldStop = await controller.wait();
            if (shouldStop) break;

            const batch = hitList.slice(i, i + BATCH_SIZE)
            await Promise.all(batch.map(async (camera) => {
                try{
                    const portOpen = await probeTcp(camera.ip, camera.port)
                    if(!portOpen){
                        processedItems++
                        const percent = Math.round((processedItems / totalItems) * 100)
                        callback({ f: 'onvif_scan_progress', percent, processedItems, totalItems })
                        return
                    }
                    const probe = await probeOnvifCam({
                        ip: camera.ip,
                        port: camera.port,
                        user: onvifUsername,
                        pass: onvifPassword,
                    }, 8000)
                    const cameraResponse = {
                        ip: camera.ip,
                        port: camera.port,
                        info: probe.info,
                        date: probe.date,
                        uri: probe.uri,
                    }
                    if(probe.isPTZ) cameraResponse.isPTZ = true
                    responseList.push(cameraResponse)
                    callback(Object.assign(cameraResponse,{f: 'onvif', snapShot: probe.snapShot}))
                }catch(err){
                    const searchError = (find) => {
                        return stringContains(find,err.message,true)
                    }
                    var foundDevice = false
                    var errorMessage = ''
                    switch(true){
                        case searchError('400'):
                            foundDevice = true
                            errorMessage = lang.ONVIFErr400
                        break;
                        case searchError('401'):
                        case searchError('unauthorized'):
                        case searchError('not authorized'):
                            foundDevice = true
                            errorMessage = 'ONVIF device requires credentials (401). Enter Camera Username and Password and re-scan.'
                        break;
                        case searchError('403'):
                            foundDevice = true
                            errorMessage = 'ONVIF device refused (403). Check credentials.'
                        break;
                        case searchError('405'):
                            foundDevice = true
                            errorMessage = lang.ONVIFErr405
                        break;
                        case searchError('404'):
                            foundDevice = true
                            errorMessage = lang.ONVIFErr404
                        break;
                        case searchError('timeout'):
                            foundDevice = true
                            errorMessage = 'Port open but ONVIF did not respond in time. Wrong credentials or non-ONVIF web service.'
                        break;
                    }
                    if(foundDevice){
                        callback({
                            f: 'onvif',
                            ff: 'failed_capture',
                            ip: camera.ip,
                            port: camera.port,
                            error: errorMessage
                        })
                    }
                    if(config.debugLogVerbose)s.debugLog(err);
                }
            }))

            processedItems = Math.min(i + BATCH_SIZE, totalItems)
            const percent = totalItems > 0
                ? Math.round((processedItems / totalItems) * 100)
                : 100
            if(onProgress) onProgress(percent, processedItems, totalItems)
        }

        tx({ f: 'onvif_scan_ended', foundNumber: responseList.length })
        delete(activeScans[scanId]);
        delete(activeScansFound[scanId]);
        return { ok: true, scanId, results: responseList };
    }
    return {
        ipRange,
        portRange,
        runOnvifScanner,
        runOnvifBulkConfig,
        cancelScan,
        pauseScan,
        resumeScan,
        getScanStatus,
    }
}
