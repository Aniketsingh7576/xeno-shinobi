/**
 * NAS Live Status — a lightweight, frequently-pollable health check for the
 * primary recording volume (the NAS). It powers the sidebar pill and the
 * dashboard NAS card.
 *
 * The full Storage & Retention page (storageStatus.js) is the detailed, heavier
 * view. This endpoint is the opposite: cheap enough to poll every ~20s, and it
 * answers the one operational question that matters most for a 24/7 recorder —
 * "is footage actually landing on the NAS right now?"
 *
 * It reports: online / mounted / writable, free-used-total space, whether
 * recording is flowing (newest clip age), and a single health level + message.
 *
 * ROBUSTNESS: the NAS is an NFS hard-mount (timeo=600). If the NAS server dies,
 * a bare fs.stat/statfs can BLOCK for up to a minute. Every filesystem call here
 * is wrapped in a short timeout so a dead NAS reports "offline" in ~3s instead of
 * hanging the indicator — which is exactly the failure this indicator exists to
 * surface. Read-only; never mutates anything.
 */
module.exports = function(s,config,lang,app){
    const fs = require('fs')
    const path = require('path')
    const MB = 1048576
    // Minutes without a completed recording before we call it stale (~2x the 15-min
    // segment length + slack). Keep in step with deploy/liveness-check.sh STALE_MIN.
    const STALE_RECORDING_MIN = 35

    function round(v,p){ if(v === null || v === undefined || isNaN(v))return null; const f = Math.pow(10,p||0); return Math.round(v*f)/f }

    // Race a filesystem promise against a timeout so a hung NFS mount can't freeze
    // the request. On timeout we treat the NAS as unreachable — the correct signal.
    function withTimeout(promise,ms){
        return Promise.race([
            promise,
            new Promise((_,reject) => setTimeout(() => reject(new Error('timeout')),ms)),
        ])
    }

    async function writeTest(dir){
        const testFile = path.join(dir,'.nas_write_test_' + process.pid + '_' + Date.now())
        try{
            await withTimeout(fs.promises.writeFile(testFile,'ok'),3000)
            await withTimeout(fs.promises.unlink(testFile),3000).catch(() => {})
            return true
        }catch(err){
            return false
        }
    }

    async function newestRecordingEnd(groupKey){
        try{
            const r = await s.knexQueryPromise({
                action: 'select',
                columns: 'end',
                table: 'Videos',
                where: [['ke','=',groupKey]],
                orderBy: ['end','desc'],
                limit: 1,
            })
            if(r.ok && r.rows && r.rows[0])return r.rows[0].end;
        }catch(err){ /* table may be empty */ }
        return null
    }

    app.get(config.webPaths.apiPrefix+':auth/nasStatus/:ke', function(req,res){
        s.auth(req.params, async function(user){
            const groupKey = req.params.ke
            const targetPath = s.dir.videos
            const out = {
                ok: true,
                path: targetPath || null,
                generatedAt: new Date(),
                online: false,       // path is readable
                mounted: null,       // is a real mount point (separate volume)
                onOsDisk: null,      // shares a volume with / (NAS not mounted)
                writable: false,     // a real write succeeded
                totalGb: null, freeGb: null, usedGb: null, usedPercent: null,
                lastWrite: null, lastWriteAgoMin: null,
                recordingMonitors: 0,
                level: 'critical',
                message: '',
                error: null,
            }
            try{
                if(!targetPath){
                    out.message = 'No recording path configured'
                    return s.closeJsonResponse(res,out)
                }
                // --- filesystem facts (each guarded against a hung mount) ---
                try{
                    const stat = await withTimeout(fs.promises.stat(targetPath),3000)
                    out.online = true
                    try{ const parent = await withTimeout(fs.promises.stat(path.dirname(targetPath)),3000); out.mounted = stat.dev !== parent.dev }catch(e){}
                    try{ const root = await withTimeout(fs.promises.stat('/'),3000); out.onOsDisk = stat.dev === root.dev }catch(e){}
                    const fsStat = await withTimeout(fs.promises.statfs(targetPath),3000)
                    const bs = fsStat.bsize
                    const totalMb = (fsStat.blocks * bs) / MB
                    const freeMb = (fsStat.bavail * bs) / MB
                    const usedMb = ((fsStat.blocks - fsStat.bfree) * bs) / MB
                    out.totalGb = round(totalMb / 1024,1)
                    out.freeGb = round(freeMb / 1024,1)
                    out.usedGb = round(usedMb / 1024,1)
                    const usableMb = usedMb + freeMb
                    out.usedPercent = usableMb > 0 ? round((usedMb / usableMb) * 100,1) : null
                }catch(err){
                    out.online = false
                    out.error = (err && err.code) || (err && err.message) || String(err)
                }

                if(out.online)out.writable = await writeTest(targetPath);

                // --- recording activity: is footage actually flowing to the NAS? ---
                const grp = s.group[groupKey]
                if(grp && grp.rawMonitorConfigurations){
                    out.recordingMonitors = Object.keys(grp.rawMonitorConfigurations)
                        .filter((mid) => grp.rawMonitorConfigurations[mid].mode === 'record').length
                }
                const newest = await newestRecordingEnd(groupKey)
                if(newest){
                    out.lastWrite = newest
                    out.lastWriteAgoMin = round((Date.now() - new Date(newest).getTime()) / 60000,1)
                }

                // --- single health verdict (worst wins) ---
                if(!out.online){ out.level = 'critical'; out.message = 'NAS offline — recording path unreadable' }
                else if(!out.writable){ out.level = 'critical'; out.message = 'NAS not writable — recordings cannot be saved' }
                else if(out.onOsDisk){ out.level = 'critical'; out.message = 'NAS not mounted — writing to the OS disk' }
                else if(out.usedPercent !== null && out.usedPercent >= 95){ out.level = 'critical'; out.message = 'NAS almost full — ' + out.usedPercent + '% used' }
                else if(out.mounted === false){ out.level = 'warning'; out.message = 'Recording path is not a mounted volume' }
                else if(out.usedPercent !== null && out.usedPercent >= 85){ out.level = 'warning'; out.message = 'NAS filling up — ' + out.usedPercent + '% used' }
                // Recordings are written in SEGMENTS (default 15 min) and only land in the
                // Videos table when a segment COMPLETES. So "minutes since last row" is
                // normally up to one full segment even when recording is perfectly healthy —
                // warning at 5 min produced a false "No footage written" alarm for ~2/3 of
                // every cycle. Alarm only after ~2 missed segments, matching the external
                // liveness check (deploy/liveness-check.sh STALE_MIN=35).
                else if(out.recordingMonitors > 0 && out.lastWriteAgoMin !== null && out.lastWriteAgoMin > STALE_RECORDING_MIN){ out.level = 'warning'; out.message = 'No footage written in ' + out.lastWriteAgoMin + ' min' }
                else if(out.recordingMonitors === 0){ out.level = 'warning'; out.message = 'No cameras are set to record' }
                else { out.level = 'ok'; out.message = 'NAS healthy — ' + (out.freeGb !== null ? out.freeGb + ' GB free' : 'online') }

                s.closeJsonResponse(res,out)
            }catch(err){
                s.closeJsonResponse(res,{ ok:false, msg:'Failed to read NAS status', err: String((err && err.message) || err) })
            }
        },res,req)
    })
}
