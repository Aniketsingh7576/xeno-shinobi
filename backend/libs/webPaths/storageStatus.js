/**
 * Storage & Retention Status — a read-only operational view of every value that
 * governs how long footage is kept and where it is written.
 *
 * WHY THIS EXISTS
 * These values live in three different places — Account Settings (retention days,
 * storage quota), conf.json (videosDir, addStorage, cron flags) and the OS itself
 * (is the NAS actually mounted, how big is the volume really). Several of them
 * default to values that silently destroy footage at fleet scale:
 *
 *   - video retention defaults to 5 days      (libs/cron/worker.js)
 *   - the storage quota defaults to 10000 MB  (libs/startup.js, libs/user.js)
 *   - an unmounted NAS is silently recreated as a local directory (libs/folders.js)
 *
 * None of those produce an error. The system looks healthy right up until someone
 * goes looking for footage that no longer exists. This endpoint gathers the
 * EFFECTIVE values in one place and flags the dangerous combinations explicitly.
 *
 * This module is strictly read-only — it never mutates configuration.
 */
module.exports = function(s,config,lang,app){
    const fs = require('fs')
    const path = require('path')

    const MB = 1048576

    // Mirrored from the places the app actually applies them, so the page can show
    // the EFFECTIVE value when a field is blank rather than an empty cell. If any of
    // these change in core, change them here too.
    const DEFAULTS = {
        videoDays: 5,           // libs/cron/worker.js  (daysOldForDeletion)
        eventDays: 10,          // libs/cron/worker.js
        logDays: 10,            // libs/cron/worker.js
        timelapseDays: 60,      // libs/cron/worker.js
        sizeLimitMb: 10000,     // libs/startup.js:145, libs/user.js:172
        videoPercent: 90,       // libs/startup.js:146
        timelapsePercent: 5,    // libs/startup.js:147
        fileBinPercent: 5,      // libs/startup.js:148
        purgeOffset: 0.9,       // libs/config.js  (cron.deleteOverMaxOffset)
    }

    function toNumber(value,fallback){
        const parsed = parseFloat(value)
        return isNaN(parsed) ? fallback : parsed
    }

    function round(value,places){
        if(value === null || value === undefined || isNaN(value))return null;
        const factor = Math.pow(10,places || 0)
        return Math.round(value * factor) / factor
    }

    /**
     * Filesystem facts about a storage path.
     *
     * `isMountPoint` compares the directory's device id with its parent's — the
     * standard mount-point test. It is what distinguishes "recording to the NAS"
     * from "recording to a local directory that was silently created because the
     * NAS was not mounted". `onSameVolumeAsRoot` catches the same failure from the
     * other side: any recording target sharing a device with `/` is filling the OS
     * disk.
     */
    async function getPathReport(targetPath,label){
        const report = {
            label: label,
            path: targetPath || null,
            exists: false,
            isMountPoint: null,
            onSameVolumeAsRoot: null,
            totalMb: null,
            freeMb: null,
            usedMb: null,
            usedPercent: null,
            error: null,
        }
        if(!targetPath){
            report.error = 'No path configured'
            return report
        }
        try{
            const stat = await fs.promises.stat(targetPath)
            report.exists = true
            try{
                const parentStat = await fs.promises.stat(path.dirname(targetPath))
                report.isMountPoint = stat.dev !== parentStat.dev
            }catch(err){
                report.isMountPoint = null
            }
            try{
                const rootStat = await fs.promises.stat('/')
                report.onSameVolumeAsRoot = stat.dev === rootStat.dev
            }catch(err){
                report.onSameVolumeAsRoot = null
            }
            const fsStat = await fs.promises.statfs(targetPath)
            const blockSize = fsStat.bsize
            report.totalMb = round((fsStat.blocks * blockSize) / MB,0)
            report.freeMb = round((fsStat.bavail * blockSize) / MB,0)
            report.usedMb = round(((fsStat.blocks - fsStat.bfree) * blockSize) / MB,0)
            // Match `df`: percentage is of the space actually usable by this account
            // (used + available), which excludes filesystem-reserved blocks. Using the
            // raw total instead would report a lower figure than the admin sees in df.
            const usableMb = report.usedMb + report.freeMb
            report.usedPercent = usableMb > 0 ? round((report.usedMb / usableMb) * 100,1) : null
        }catch(err){
            report.error = err.code || `${err}`
        }
        return report
    }

    /**
     * How much footage is actually on disk right now, and how fast it is growing.
     * Uses the index on `time` (oldest/newest by orderBy+limit) rather than an
     * aggregate, so it stays cheap on a table with millions of rows.
     */
    async function getRecordingSpan(groupKey){
        const span = {
            oldest: null,
            newest: null,
            spanDays: null,
            videoCount: null,
            mbPerDay: null,
            projectedRetentionDays: null,
        }
        const baseWhere = [
            ['ke','=',groupKey],
            ['status','!=',0],
        ]
        const oldest = await s.knexQueryPromise({
            action: 'select',
            columns: 'time',
            table: 'Videos',
            where: baseWhere,
            orderBy: ['time','asc'],
            limit: 1,
        })
        const newest = await s.knexQueryPromise({
            action: 'select',
            columns: 'time',
            table: 'Videos',
            where: baseWhere,
            orderBy: ['time','desc'],
            limit: 1,
        })
        const counted = await s.knexQueryPromise({
            action: 'count',
            columns: 'mid',
            table: 'Videos',
            where: baseWhere,
        })
        if(oldest.ok && oldest.rows && oldest.rows[0])span.oldest = oldest.rows[0].time;
        if(newest.ok && newest.rows && newest.rows[0])span.newest = newest.rows[0].time;
        if(counted.ok && counted.rows && counted.rows[0]){
            const row = counted.rows[0]
            span.videoCount = toNumber(row[Object.keys(row)[0]],null)
        }
        if(span.oldest && span.newest){
            const ms = new Date(span.newest).getTime() - new Date(span.oldest).getTime()
            span.spanDays = round(ms / 86400000,2)
        }
        return span
    }

    function buildRetention(groupDetails){
        return {
            videoDays: {
                value: toNumber(groupDetails.days,null),
                effective: toNumber(groupDetails.days,DEFAULTS.videoDays),
                isDefault: toNumber(groupDetails.days,null) === null,
                default: DEFAULTS.videoDays,
                label: 'Recordings',
                setIn: 'Account Settings → Number of Days to keep Videos',
            },
            eventDays: {
                value: toNumber(groupDetails.event_days,null),
                effective: toNumber(groupDetails.event_days,DEFAULTS.eventDays),
                isDefault: toNumber(groupDetails.event_days,null) === null,
                default: DEFAULTS.eventDays,
                label: 'Events',
                setIn: 'Account Settings → Number of Days to keep Events',
            },
            timelapseDays: {
                value: toNumber(groupDetails.timelapseFrames_days,null),
                effective: toNumber(groupDetails.timelapseFrames_days,DEFAULTS.timelapseDays),
                isDefault: toNumber(groupDetails.timelapseFrames_days,null) === null,
                default: DEFAULTS.timelapseDays,
                label: 'Timelapse frames',
                setIn: 'Account Settings → Number of Days to keep Timelapse',
            },
            logDays: {
                value: toNumber(groupDetails.log_days,null),
                effective: toNumber(groupDetails.log_days,DEFAULTS.logDays),
                isDefault: toNumber(groupDetails.log_days,null) === null,
                default: DEFAULTS.logDays,
                label: 'Logs',
                setIn: 'Account Settings → Number of Days to keep Logs',
            },
        }
    }

    /**
     * The warning engine. This is the point of the page: not just showing values,
     * but naming the combinations that lose footage. Every check states what is
     * wrong, why it matters, and where to fix it.
     */
    /**
     * Rough space a fleet needs to honour a retention period, used only to detect a
     * quota that cannot possibly deliver the configured retention. Assumes ~4 Mbps
     * per camera, the usual 2 MP H.264 figure also used in the sizing document.
     * Deliberately conservative — this exists to catch order-of-magnitude mistakes
     * (a 1 GB quota with 90-day retention), not to size storage precisely.
     */
    const ASSUMED_MBPS_PER_CAMERA = 4
    function estimateRequiredMb(recordingCameras,days){
        if(!recordingCameras || !days)return null;
        const mbPerCameraPerDay = (ASSUMED_MBPS_PER_CAMERA / 8) * 86400
        return round(recordingCameras * mbPerCameraPerDay * days,0)
    }

    function buildChecks({ quota, retention, storage, cron, usage, monitors, recordings }){
        const checks = []
        const add = (level,title,detail,fix) => checks.push({ level, title, detail, fix })

        // --- Retention -----------------------------------------------------
        if(retention.videoDays.isDefault){
            add('critical',
                'Recording retention is at the 5-day default',
                'No retention value is set on this account, so the hourly cleanup deletes every recording older than 5 days — no matter how large the storage volume is.',
                'Account Settings → "Number of Days to keep Videos". Set it to your contracted retention.')
        }else if(retention.videoDays.effective <= 7){
            add('warning',
                `Recording retention is only ${retention.videoDays.effective} days`,
                'Footage older than this is deleted automatically by the hourly cleanup.',
                'Confirm this matches the retention agreed with the client.')
        }

        // --- Quota ---------------------------------------------------------
        if(quota.isDefault){
            add('critical',
                'Storage quota is at the 10 GB default',
                'No "Max Storage Amount" is set, so purging keeps total usage under 10 GB. Across a large camera fleet that reduces retention to minutes.',
                'Account Settings → "Max Storage Amount". Set it to the usable volume size minus roughly 15% headroom.')
        }

        const primary = storage.find((entry) => entry.isPrimary)
        if(primary && primary.totalMb && quota.sizeLimitMb >= primary.totalMb){
            add('critical',
                'Storage quota is larger than the volume it writes to',
                `The quota is ${round(quota.sizeLimitMb/1024,1)} GB but the volume holds only ${round(primary.totalMb/1024,1)} GB. Purging is driven by the quota, so the disk reaches 100% before purging ever triggers — at which point recording stops.`,
                'Lower the quota in Account Settings to below the volume size, leaving headroom.')
        }else if(primary && primary.totalMb && quota.sizeLimitMb > primary.totalMb * 0.9){
            add('warning',
                'Storage quota leaves very little headroom',
                `The quota is ${round((quota.sizeLimitMb / primary.totalMb) * 100,1)}% of the volume. Leave room for filesystem overhead and any non-VMS files.`,
                'Aim for roughly 85% of the volume size or lower.')
        }

        // --- Do the two limits agree? ---------------------------------------
        // Retention days and the storage quota are independent. Whichever runs out
        // first is the retention you actually get. A quota far too small for the
        // configured days is the quiet way a "90 day" system delivers two days.
        const requiredMb = estimateRequiredMb(monitors.recording,retention.videoDays.effective)
        if(requiredMb && quota.shares.videoLimitMb && requiredMb > quota.shares.videoLimitMb * 1.5){
            add('critical',
                'The storage quota cannot deliver the configured retention',
                `Keeping ${retention.videoDays.effective} days of footage from ${monitors.recording} recording camera(s) needs roughly ${round(requiredMb/1024/1024,2)} TB, but the quota allows recordings only ${round(quota.shares.videoLimitMb/1024,1)} GB. Purging will delete footage long before it reaches ${retention.videoDays.effective} days old, so the real retention is far shorter than the setting suggests.`,
                'Either raise the Max Storage Amount to match the retention, or lower the retention days so the setting reflects reality.')
        }
        if(recordings.projectedRetentionDays !== null && recordings.projectedRetentionDays !== undefined &&
           recordings.projectedRetentionDays < retention.videoDays.effective * 0.8){
            add('warning',
                'Measured growth says retention will be shorter than configured',
                `At the current measured rate the quota holds about ${recordings.projectedRetentionDays} days of footage, against a configured retention of ${retention.videoDays.effective} days.`,
                'Raise the quota, add storage, reduce camera bitrate, or lower the retention setting to match.')
        }

        // --- Where footage is actually written ------------------------------
        storage.forEach((entry) => {
            if(entry.error){
                add('critical',
                    `Storage path unreadable: ${entry.label}`,
                    `${entry.path} could not be read (${entry.error}).`,
                    'Check the path exists and the VMS process can read it.')
                return
            }
            if(entry.onSameVolumeAsRoot){
                add(entry.isPrimary ? 'critical' : 'warning',
                    `${entry.label} is on the operating-system disk`,
                    `${entry.path} shares a volume with /. Recordings written here fill the OS disk, which will eventually stop the whole server — not just recording.`,
                    entry.isPrimary
                        ? 'Confirm the NAS is mounted. An unmounted NAS is silently recreated as a local directory.'
                        : 'Remove this storage target in conf.json, or repoint it at a separate volume.')
            }else if(entry.isPrimary && entry.isMountPoint === false){
                add('warning',
                    'Primary recording path is not a mount point',
                    `${entry.path} is a plain directory, not a mounted volume. If it is meant to be network storage, that storage is not currently mounted.`,
                    'Verify the mount, and add a mount-health check so recording refuses to start when it is missing.')
            }
            if(entry.usedPercent !== null && entry.usedPercent >= 95){
                add('critical',
                    `${entry.label} volume is ${entry.usedPercent}% full`,
                    'The volume itself is nearly full, independently of the VMS quota.',
                    'Free space or extend the volume immediately.')
            }else if(entry.usedPercent !== null && entry.usedPercent >= 85){
                add('warning',
                    `${entry.label} volume is ${entry.usedPercent}% full`,
                    'Approaching full.',
                    'Review retention and quota settings.')
            }
        })

        // --- Purging -------------------------------------------------------
        if(cron.deleteOverMax === false){
            add('critical',
                'Size-based purging is disabled',
                'cron.deleteOverMax is false, so nothing enforces the storage quota. The volume will fill to 100% and recording will stop.',
                'Remove the override in conf.json, or set cron.deleteOverMax to true.')
        }
        if(cron.enabled === false){
            add('critical',
                'Scheduled cleanup is disabled',
                'cron.enabled is false, so age-based retention never runs. Footage accumulates until the disk is full.',
                'Set cron.enabled to true in conf.json.')
        }
        if(usage.usedPercentOfQuota !== null && usage.usedPercentOfQuota >= 100){
            add('warning',
                'Usage is at or above the quota',
                'Purging should be actively deleting the oldest footage. Effective retention is now governed by the quota, not by the retention days.',
                'If retention is shorter than expected, raise the quota or add storage.')
        }

        if(!checks.length){
            add('ok',
                'No storage or retention problems detected',
                'Retention and quota are explicitly set, the recording path is a mounted volume separate from the OS disk, and purging is enabled.',
                null)
        }
        return checks
    }

    /**
     * API : Storage & Retention Status
     * Read-only. Account-owner only — it exposes filesystem layout and volume sizes.
     */
    app.get(config.webPaths.apiPrefix+':auth/storageStatus/:ke', function (req,res){
        s.auth(req.params, async function(user){
            try{
                const groupKey = req.params.ke
                if(user.details && user.details.sub){
                    return s.closeJsonResponse(res,{
                        ok: false,
                        msg: 'Storage & Retention status is available to the account owner only.',
                    })
                }
                const theGroup = s.group[groupKey]
                if(!theGroup){
                    return s.closeJsonResponse(res,{
                        ok: false,
                        msg: 'Group not loaded.',
                    })
                }
                const groupDetails = theGroup.init || {}

                // --- Quota ---------------------------------------------------
                const rawSizeLimit = toNumber(groupDetails.size,null)
                const sizeLimitMb = toNumber(theGroup.sizeLimit,DEFAULTS.sizeLimitMb)
                const purgeOffset = toNumber(config.cron && config.cron.deleteOverMaxOffset,DEFAULTS.purgeOffset)
                const videoPercent = toNumber(theGroup.sizeLimitVideoPercent,DEFAULTS.videoPercent)
                const timelapsePercent = toNumber(theGroup.sizeLimitTimelapseFramesPercent,DEFAULTS.timelapsePercent)
                const fileBinPercent = toNumber(theGroup.sizeLimitFileBinPercent,DEFAULTS.fileBinPercent)
                const quota = {
                    sizeLimitMb: sizeLimitMb,
                    sizeLimitGb: round(sizeLimitMb / 1024,2),
                    isDefault: rawSizeLimit === null || sizeLimitMb === DEFAULTS.sizeLimitMb,
                    default: DEFAULTS.sizeLimitMb,
                    setIn: 'Account Settings → Max Storage Amount',
                    purgeOffset: purgeOffset,
                    purgeStartsAtMb: round(sizeLimitMb * purgeOffset,0),
                    shares: {
                        videoPercent: videoPercent,
                        timelapsePercent: timelapsePercent,
                        fileBinPercent: fileBinPercent,
                        videoLimitMb: round(sizeLimitMb * (videoPercent / 100),0),
                        timelapseLimitMb: round(sizeLimitMb * (timelapsePercent / 100),0),
                        fileBinLimitMb: round(sizeLimitMb * (fileBinPercent / 100),0),
                    },
                }

                // --- Current usage -------------------------------------------
                const usedSpace = toNumber(theGroup.usedSpace,0)
                const usage = {
                    usedMb: round(usedSpace,1),
                    usedGb: round(usedSpace / 1024,2),
                    videosMb: round(toNumber(theGroup.usedSpaceVideos,0),1),
                    timelapseMb: round(toNumber(theGroup.usedSpaceTimelapseFrames,0),1),
                    fileBinMb: round(toNumber(theGroup.usedSpaceFilebin,0),1),
                    usedPercentOfQuota: sizeLimitMb > 0 ? round((usedSpace / sizeLimitMb) * 100,1) : null,
                    isPurging: theGroup.sizePurging === true,
                }

                // --- Storage locations ----------------------------------------
                const storage = []
                const primaryReport = await getPathReport(s.dir.videos,'Primary recording storage')
                primaryReport.isPrimary = true
                primaryReport.quotaMb = sizeLimitMb
                primaryReport.usedByVmsMb = usage.videosMb
                storage.push(primaryReport)

                const addStorage = Array.isArray(s.dir.addStorage) ? s.dir.addStorage : []
                for(const entry of addStorage){
                    const report = await getPathReport(entry.path,`Additional storage: ${entry.name || entry.path}`)
                    report.isPrimary = false
                    const tracked = theGroup.addStorageUse ? theGroup.addStorageUse[entry.path] : null
                    report.quotaMb = tracked ? toNumber(tracked.sizeLimit,null) : null
                    report.usedByVmsMb = tracked ? round(toNumber(tracked.usedSpace,0),1) : null
                    storage.push(report)
                }
                const streamReport = await getPathReport(s.dir.streams,'Live-stream working directory')
                streamReport.isPrimary = false
                streamReport.isStreamDir = true
                storage.push(streamReport)

                // --- Cleanup schedule ------------------------------------------
                const cronConfig = config.cron || {}
                const cron = {
                    enabled: cronConfig.enabled !== false,
                    intervalHours: toNumber(cronConfig.interval,1),
                    deleteOld: cronConfig.deleteOld !== false,
                    deleteOverMax: cronConfig.deleteOverMax !== false,
                    deleteEvents: cronConfig.deleteEvents !== false,
                    deleteLogs: cronConfig.deleteLogs !== false,
                    deleteFileBins: cronConfig.deleteFileBins !== false,
                    deleteOverMaxOffset: purgeOffset,
                }

                const retention = buildRetention(groupDetails)
                const span = await getRecordingSpan(groupKey)

                // Growth rate, derived from what is actually on disk. Only meaningful
                // once there is more than a few hours of footage to measure.
                if(span.spanDays && span.spanDays > 0.25 && usage.videosMb){
                    span.mbPerDay = round(usage.videosMb / span.spanDays,1)
                    span.gbPerDay = round((usage.videosMb / span.spanDays) / 1024,2)
                    if(span.mbPerDay > 0){
                        span.projectedRetentionDays = round(quota.shares.videoLimitMb / span.mbPerDay,1)
                    }
                }

                const monitorConfigs = theGroup.rawMonitorConfigurations || {}
                const monitorIds = Object.keys(monitorConfigs)
                const recordingCount = monitorIds.filter((mid) => monitorConfigs[mid].mode === 'record').length
                const monitors = {
                    total: monitorIds.length,
                    recording: recordingCount,
                    cameraCountCeiling: s.cameraCount === undefined ? null : s.cameraCount,
                }

                const checks = buildChecks({ quota, retention, storage, cron, usage, monitors, recordings: span })

                s.closeJsonResponse(res,{
                    ok: true,
                    generatedAt: new Date(),
                    quota: quota,
                    usage: usage,
                    retention: retention,
                    storage: storage,
                    cron: cron,
                    recordings: span,
                    monitors: monitors,
                    checks: checks,
                })
            }catch(err){
                s.debugLog(err)
                s.closeJsonResponse(res,{
                    ok: false,
                    msg: 'Failed to read storage status.',
                    err: `${err && err.message ? err.message : err}`,
                })
            }
        },res,req)
    })
}
