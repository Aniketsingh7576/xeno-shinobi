const fs = require('fs').promises;
const { createReadStream } = require('fs');
const path = require('path');
const spawn = require('child_process').spawn;
const {
    writeReadStream,
    checkDiskPathExists,
} = require('node-fstab');
module.exports = function(s,config,lang){
    if(s.isWin){
        return {}
    }
    function constructFilePath(groupKey, filePath){
        return path.join(s.group[groupKey].init.mnt_path, filePath)
    }
    function constructSaveLocation(groupKey, monitorId, filename){
        var saveLocation = path.join(s.group[groupKey].init.mnt_dir, groupKey, monitorId)
        if(filename)saveLocation = path.join(saveLocation, filename)
        return constructFilePath(groupKey, saveLocation)
    }
    async function insertVideoIntoDatabase({
        groupKey,
        monitorId,
        ext = 'mp4',
        type = 'mnt',
        status = 1,
        time,
        size,
        end,
        filename,
        details,
        href = '',
    }){
        const saveLocation = constructSaveLocation(groupKey, monitorId, filename)
        if(!details)details = s.s({
            location : saveLocation
        });
        await s.knexQueryPromise({
            action: "insert",
            table: "Cloud Videos",
            insert: {
                mid: monitorId,
                ke: groupKey,
                ext,
                time,
                status,
                type,
                details,
                size,
                end,
                href
            }
        })

        s.setCloudDiskUsedForGroup(groupKey,{
            amount: parseFloat((size / 1048576).toFixed(2)),
            storageType: 'mnt'
        })
        s.purgeCloudDiskForGroup({ ke: groupKey },'mnt')
    }
    const deleteObject = async (groupKey, filePath) => {
        const response = { ok: true }
        try{
            await fs.rm(filePath)
        }catch(err){
            response.ok = false;
            response.err = err.toString();
        }
        return response
    };
    const uploadObject = async (groupKey, { filePath, readStream }) => {
        const fullPath = constructFilePath(groupKey, filePath)
        return await writeReadStream(readStream, fullPath);
    };
    const getObject = async (groupKey, filePath) => {
        const fullPath = constructFilePath(groupKey, filePath)
        return createReadStream(fullPath)
    };
    function beforeAccountSave(d){
        //d = save event
        d.formDetails.mnt_use_global = d.d.mnt_use_global
        d.formDetails.use_mnt = d.d.use_mnt
    }
    function cloudDiskUseStartup(group,userDetails){
        group.cloudDiskUse['mnt'].name = 'Mounted Drive'
        group.cloudDiskUse['mnt'].maxDays = parseInt(userDetails.mnt_max_days);
        group.cloudDiskUse['mnt'].sizeLimitCheck = (userDetails.use_mnt_size_limit === '1')
        if(!userDetails.mnt_size_limit || userDetails.mnt_size_limit === ''){
            group.cloudDiskUse['mnt'].sizeLimit = 10000
        }else{
            group.cloudDiskUse['mnt'].sizeLimit = parseFloat(userDetails.mnt_size_limit)
        }
    }
    function loadGroupApp(e){
        // e = user
        var userDetails = JSON.parse(e.details)
        if(userDetails.mnt_use_global === '1' && config.cloudUploaders && config.cloudUploaders.WasabiHotCloudStorage){
            userDetails = Object.assign(userDetails,config.cloudUploaders.mountedDrive)
        }
        //Mounted Drive Storage
        if(
           !s.group[e.ke].mnt &&
           userDetails.mnt !== '0' &&
           userDetails.mnt_path
        ){
            checkDiskPathExists(userDetails.mnt_path).then((response) => {
                if(response.exists){
                    s.group[e.ke].mnt = userDetails.mnt_path;
                }
            })
        }
    }
    function unloadGroupApp(user){
        s.group[user.ke].mnt = null
    }
    function deleteVideo(e,video,callback){
        // e = user
        try{
            var videoDetails = JSON.parse(video.details)
        }catch(err){
            var videoDetails = video.details
        }
        if(video.type !== 'mnt'){
            callback()
            return
        }
        deleteObject(video.ke, videoDetails.location).then((response) => {
            if (response.err){
                console.error('Mounted Drive Storage DELETE Error')
                console.error(response.err);
            }
            callback()
        });
    }
    function onMonitorStart(monitorConfig){
        const groupKey = monitorConfig.ke;
        const monitorId = monitorConfig.mid;
        if(s.group[groupKey].mnt){
            const saveLocation = constructFilePath(groupKey, path.join(s.group[groupKey].init.mnt_dir, groupKey, monitorId));
            fs.mkdir(saveLocation, { recursive: true }).then(function(){
                // scanForOrphanedVideos({ groupKey, monitorId }, { forceCheck: true, checkMax: 2 })
            }).catch((err) => {
                console.error('Making Directory fail', err)
            });
        }
    }
    async function uploadVideo(e,k,insertQuery){
        //e = video object
        //k = temporary values
        if(!k)k={};
        //cloud saver - Mounted Drive
        const groupKey = insertQuery.ke
        if(s.group[groupKey].mnt && s.group[groupKey].init.use_mnt !== '0' && s.group[groupKey].init.mnt_save === '1'){
            const monitorId = insertQuery.mid
            const filename = `${s.formattedTime(insertQuery.time)}.${insertQuery.ext}`
            var fileStream = createReadStream(k.dir + filename);
            var saveLocation = path.join(s.group[groupKey].init.mnt_dir,groupKey,monitorId,filename)
            const response = await uploadObject(groupKey, {
                filePath: saveLocation,
                readStream: fileStream,
            });
            if(response.err){
                s.userLog(e,{type:lang['Mounted Drive Storage Upload Error'],msg:response.err})
            }
            if(s.group[groupKey].init.mnt_log === '1' && response.ok){
                await s.knexQueryPromise({
                    action: "insert",
                    table: "Cloud Videos",
                    insert: {
                        mid: monitorId,
                        ke: groupKey,
                        ext: insertQuery.ext,
                        time: insertQuery.time,
                        status: 1,
                        type : 'mnt',
                        details: s.s({
                            location : saveLocation
                        }),
                        size: k.filesize,
                        end: k.endTime,
                        href: ''
                    }
                })
                s.setCloudDiskUsedForGroup(groupKey,{
                    amount: k.filesizeMB,
                    storageType: 'mnt'
                })
                s.purgeCloudDiskForGroup(e,'mnt')
                // await scanForOrphanedVideos({ groupKey, monitorId }, { forceCheck: true, checkMax: 2 })
            }
        }
    }
    function onInsertTimelapseFrame(monitorObject,queryInfo,filePath){
        var e = monitorObject
        if(s.group[e.ke].mnt && s.group[e.ke].init.use_mnt !== '0' && s.group[e.ke].init.mnt_save === '1'){
            var fileStream = createReadStream(filePath)
            fileStream.on('error', function (err) {
                console.error(err)
            })
            var saveLocation = path.join(s.group[e.ke].init.mnt_dir,e.ke,e.mid + '_timelapse',queryInfo.filename)
            uploadObject(e.ke, {
                filePath: saveLocation,
                readStream: fileStream,
            }).then((response) => {
                if(response.err){
                    s.userLog(e,{type:lang['Wasabi Hot Cloud Storage Upload Error'],msg:response.err})
                }
                if(s.group[e.ke].init.mnt_log === '1' && response.ok){
                    s.knexQuery({
                        action: "insert",
                        table: "Cloud Timelapse Frames",
                        insert: {
                            mid: queryInfo.mid,
                            ke: queryInfo.ke,
                            time: queryInfo.time,
                            filename: queryInfo.filename,
                            type : 'mnt',
                            details: s.s({
                                location : saveLocation
                            }),
                            size: queryInfo.size,
                            href: ''
                        }
                    })
                    s.setCloudDiskUsedForGroup(e.ke,{
                        amount : s.kilobyteToMegabyte(queryInfo.size),
                        storageType : 'mnt'
                    },'timelapseFrames')
                    s.purgeCloudDiskForGroup(e,'mnt','timelapseFrames')
                }
            })
        }
    }
    function onDeleteTimelapseFrameFromCloud(e,frame,callback){
        // e = user
        try{
            var frameDetails = JSON.parse(frame.details)
        }catch(err){
            var frameDetails = frame.details
        }
        if(video.type !== 'mnt'){
            callback()
            return
        }
        if(!frameDetails.location){
            frameDetails.location = frame.href.split(locationUrl)[1]
        }
        deleteObject(e.ke, frameDetails.location).then((response) => {
            if (response.err){
                console.error('Mounted Drive Storage DELETE Error')
                console.error(response.err);
            }
            callback()
        });
    }
    async function onGetVideoData(video){
        const videoDetails = s.parseJSON(video.details)
        const saveLocation = videoDetails.location
        var fileStream = await getObject(video.ke, saveLocation);
        return fileStream
    }
    async function checkIfVideoIsOrphaned(groupKey, monitorId, videosDirectory, filename, preloadedRows){
        const response = { ok: true }
        const filePath = path.join(videosDirectory,filename)
        try{
            const { size, mtime: end } = await fs.stat(filePath)
            if(size > 10){
                const time = s.nameToTime(filename);
                const ext = filename.split('.')[1]
                let foundRow = null
                if(preloadedRows){
                    const timeToRemove = new Date(time).toString();
                    const index = preloadedRows.findIndex((item) => `${item.time}` === timeToRemove);
                    if (index !== -1) {
                        foundRow = preloadedRows[index];
                        preloadedRows.splice(index, 1);
                    }
                }else{
                    const { err, rows } = await s.knexQueryPromise({
                        action: "select",
                        columns: "*",
                        table: "Cloud Videos",
                        where: [
                            ['ke','=',groupKey],
                            ['mid','=',monitorId],
                            ['type','=','mnt'],
                            ['time','=',time],
                        ],
                        limit: 1
                    });
                    if(!err && rows)foundRow = rows[0];
                }
                if(!foundRow){
                    await insertVideoIntoDatabase({
                        groupKey,
                        monitorId,
                        ext,
                        type: 'mnt',
                        status: 1,
                        time,
                        size,
                        end,
                        filename,
                    });
                    response.status = 2
                }else{
                    response.status = 1
                }
            }else{
                response.status = 0
            }
        }catch(err){
            response.status = 0
        }
        return response
    }
    function scanForOrphanedVideos({ groupKey, monitorId }, options){
        options = options || {}
        return new Promise(async (resolve,reject) => {
            const response = {ok: false}
            if(options.forceCheck === true || config.insertOrphans === true){
                if(!options.checkMax){
                    options.checkMax = config.orphanedMountedVideoCheckMax || 2
                }
                let finished = false
                let orphanedFilesCount = 0;
                let filePathLines = []
                const isUnlimited = options.checkMax === 'unlimited';
                const videosDirectory = constructSaveLocation(groupKey, monitorId)
                const tempDirectory = s.getStreamsDirectory({ ke: groupKey, mid: monitorId })
                const executeScriptPath = tempDirectory + 'orphanCheckOnMount.sh'
                try{
                    await fs.writeFile(
                        executeScriptPath,
                        `find "${s.checkCorrectPathEnding(videosDirectory,true)}" -maxdepth 1 -type f -exec stat -c "%n" {} + | sort -r${isUnlimited ? `` : ` | head -n ${options.checkMax}`}`
                    );
                } catch(err) {
                    console.log('Failed scanForOrphanedVideos on MOUNT', groupKey, monitorId, err)
                    response.err = err.toString()
                    return resolve(response)
                }
                let listing = spawn('sh',[executeScriptPath])
                const onError = options.onError ? options.onError : s.systemLog
                const onExit = async () => {
                    try {
                        listing.kill('SIGTERM')
                        await fs.rm(executeScriptPath)
                    } catch(err) {
                        s.debugLog(err)
                    }
                    delete(listing)
                }
                const onFinish = async () => {
                    if(!finished){
                        for (let i = 0; i < filePathLines.length; i++) {
                            await processLine(filePathLines[i], i, filePathLines.length)
                        }
                        finished = true
                        response.ok = true
                        response.orphanedFilesCount = orphanedFilesCount
                        resolve(response)
                        onExit()
                    }
                }
                const processLine = async (filePath, i, foundNumber) => {
                    let filename = filePath.split('/').pop().trim()
                    if(filename && filename.indexOf('-') > -1 && filename.indexOf('.') > -1){
                        const { status } = await checkIfVideoIsOrphaned(groupKey, monitorId, videosDirectory, filename, options.rows)
                        if(status === 2){
                            ++orphanedFilesCount
                        }
                    }
                }
                let checkInactivityTimeout = null
                const checkInactivity = () => {
                    clearTimeout(checkInactivityTimeout)
                    checkInactivityTimeout = setTimeout(() => {
                        if(finished) return
                        onFinish()
                    }, 2000)
                }
                checkInactivity()
                listing.stdout.on('data', async (d) => {
                    filePathLines.push(...d.toString().split('\n').filter(item => !!item))
                    checkInactivity()
                })
                listing.stderr.on('data', d => onError(d.toString()))
            } else {
                resolve(response)
            }
        })
    }
    function onLoadedUsersAtStartup(){
        return new Promise(async (resolve) => {
            let groupsDone = 0
            let monitorsDoneCount = 0
            let numberOfGroups = Object.keys(s.group).length
            for(groupKey in s.group){
                if(s.group[groupKey].mnt){
                    const { err, rows: monitors } = await s.knexQueryPromise({
                        action: "select",
                        columns: "mid,ke,name",
                        table: "Monitors",
                        where: [
                            ['ke','=',groupKey],
                        ]
                    });
                    for(monitor of monitors){
                        const monitorId = monitor.mid
                        const { err, rows } = await s.knexQueryPromise({
                            action: "select",
                            columns: "*",
                            table: "Cloud Videos",
                            where: [
                                ['ke','=',groupKey],
                                ['mid','=',monitorId],
                                ['type','=','mnt'],
                            ]
                        });
                        scanForOrphanedVideos({ groupKey, monitorId }, { forceCheck: true, checkMax: 'unlimited', rows }).then(function(){
                            ++monitorsDoneCount;
                            if(monitors.length === monitorsDoneCount){
                                s.purgeCloudDiskForGroup({ ke: groupKey },'mnt')
                                ++groupsDone
                                if(numberOfGroups === groupsDone)resolve()
                            }
                        })
                    }
                }else{
                    ++groupsDone;
                    if(numberOfGroups === groupsDone){
                        resolve()
                    }
                }
            }
        })
    }
    //Mounted Drive Storage
    s.addCloudUploader({
        name: 'mnt',
        loadGroupAppExtender: loadGroupApp,
        unloadGroupAppExtender: unloadGroupApp,
        insertCompletedVideoExtender: uploadVideo,
        deleteVideoFromCloudExtensions: deleteVideo,
        cloudDiskUseStartupExtensions: cloudDiskUseStartup,
        beforeAccountSave: beforeAccountSave,
        onAccountSave: cloudDiskUseStartup,
        onInsertTimelapseFrame: onInsertTimelapseFrame,
        onDeleteTimelapseFrameFromCloud: onDeleteTimelapseFrameFromCloud,
        onGetVideoData,
        onLoadedUsersAtStartup,
    });
    s.onMonitorStart(onMonitorStart);
    //return fields that will appear in settings
    return {
       "evaluation": "details.use_mnt !== '0'",
       "name": lang["Mounted Drive Storage"],
       "color": "forestgreen",
       "uploaderId": 'mnt',
       "info": [
           {
              "name": "detail=mnt_save",
              "selector":"autosave_mnt",
              "field": lang.Autosave,
              "description": "",
              "default": lang.No,
              "example": "",
              "fieldType": "select",
              "possible": [
                  {
                     "name": lang.No,
                     "value": "0"
                  },
                  {
                     "name": lang.Yes,
                     "value": "1"
                  }
              ]
           },
           {
               "hidden": true,
               "field": lang['Mount Point'],
               "name": "detail=mnt_path",
               "placeholder": "/mnt/yourdrive",
               "form-group-class": "autosave_mnt_input autosave_mnt_1",
           },
          {
              "hidden": true,
             "name": "detail=mnt_log",
             "field": lang['Save Links to Database'],
             "fieldType": "select",
             "selector": "h_mntsld",
             "form-group-class":"autosave_mnt_input autosave_mnt_1",
             "description": "",
             "default": "",
             "example": "",
             "possible": [
                 {
                    "name": lang.No,
                    "value": "0"
                 },
                 {
                    "name": lang.Yes,
                    "value": "1"
                 }
             ]
         },
         {
             "hidden": true,
            "name": "detail=use_mnt_size_limit",
            "field": lang['Use Max Storage Amount'],
            "fieldType": "select",
            "selector": "h_mntzl",
            "form-group-class":"autosave_mnt_input autosave_mnt_1",
            "form-group-class-pre-layer":"h_mntsld_input h_mntsld_1",
            "description": "",
            "default": "",
            "example": "",
            "possible":  [
                {
                   "name": lang.No,
                   "value": "0"
                },
                {
                   "name": lang.Yes,
                   "value": "1"
                }
            ]
         },
         {
             "hidden": true,
            "attribute": `size-adjust='[detail=mnt_size_limit]'`,
            "form-group-class":"autosave_mnt_input autosave_mnt_1",
            "form-group-class-pre-layer":"h_mntsld_input h_mntsld_1",
            "field": lang["Max Storage Amount"],
            "default": "10 GB",
         },
         {
             "hidden": true,
            "name": "detail=mnt_size_limit",
            "field": lang['Max Storage Amount'],
            "default": "10000",
         },
         {
             "hidden": true,
            "name": "detail=mnt_max_days",
            "field": lang['Number of Days to keep'],
            "form-group-class":"autosave_mnt_input autosave_mnt_1",
            "form-group-class-pre-layer":"h_mntsld_input h_mntsld_1",
            "example": "30",
         },
         {
             "hidden": true,
            "name": "detail=mnt_dir",
            "field": lang['Save Directory'],
            "form-group-class":"autosave_mnt_input autosave_mnt_1",
            "description": "",
            "default": "/",
            "example": "",
            "possible": ""
         },
       ]
    }
}
