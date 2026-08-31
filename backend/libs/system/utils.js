const fs = require('fs');
const spawn = require('child_process').spawn;
const {
    mergeDeep,
    mbToHumanReadable,
} = require('../common.js')
module.exports = (config) => {
    var currentlyUpdating = false
    const isValidStreamName = (streamName) => {
        const pathTraversalPatterns = [/\.\.\//g, /\/\/+/g, /^\/.*/g];
        let cleanName = streamName;
        pathTraversalPatterns.forEach(pattern => {
            cleanName = cleanName.replace(pattern, '');
        });
        return cleanName === streamName;
    };
    return {
        isValidStreamName,
        getSystemInfo: (s) => {
            const response = {
                "Time Started": s.timeStarted,
                "Time Ready": s.timeReady,
                "Maximum Cameras": s.cameraCount,
                Versions: {
                    "LIMCO": s.currentVersion,
                    "Node.js": process.version,
                    "FFmpeg": s.ffmpegVersion,
                    "isActivated": config.userHasSubscribed,
                    "previousLIMCO": s.versionsUsed,
                },
                Machine: {
                    "CPU Core Count": s.coreCount,
                    "Total RAM": mbToHumanReadable(s.totalmem / (1024 * 1024)),
                    "Operating System Platform": s.platform,
                },

            }
            if(s.expiryDate)response.Versions["License Expires On"] = s.expiryDate
            return response
        },
        getConfiguration: () => {
            return new Promise((resolve,reject) => {
                const configPath = s.location.config;
                fs.readFile(configPath, 'utf8', (err, data) => {
                    resolve(JSON.parse(data))
                });
            });
        },
        modifyConfiguration: (postBody, useBase) => {
            return new Promise((resolve, reject) => {
                console.log(config)
                const configPath = config.thisIsDocker ? "/config/conf.json" : s.location.config;
                let configToPost = postBody;
                if(useBase){
                    try{
                        const configBase = s.parseJSON(fs.readFileSync(configPath),{});
                        configToPost = mergeDeep(configBase, postBody)
                    }catch(err){
                        console.error('modifyConfiguration : Failed to use Config base!')
                    }
                }
                const configData = JSON.stringify(configToPost, null, 3);
                // Never persist config that won't parse on next boot, and never leave a
                // half-written file: validate, back up the current file to .bak, write to
                // a temp file, then atomically rename it into place.
                try{ JSON.parse(configData) }catch(e){ return reject(new Error('Refusing to write invalid config JSON')); }
                const tmpPath = configPath + '.tmp';
                const bakPath = configPath + '.bak';
                try{ if(fs.existsSync(configPath)){ fs.copyFileSync(configPath, bakPath); } }catch(e){ /* best-effort backup */ }
                fs.writeFile(tmpPath, configData, (err) => {
                    if(err){ return reject(err); }
                    try{ fs.renameSync(tmpPath, configPath); }catch(e){ return reject(e); }
                    resolve(true);
                });
            });
        },
        updateSystem: () => {
            return new Promise((resolve,reject) => {
                if(!config.thisIsDocker){
                    if(currentlyUpdating){
                        resolve(true)
                        return
                    };
                    currentlyUpdating = true
                    const updateProcess = spawn('sh',[s.mainDirectory + '/UPDATE.sh'])
                    updateProcess.stderr.on('data',(data) => {
                        s.systemLog('UPDATE.sh',data.toString())
                    })
                    updateProcess.stdout.on('data',(data) => {
                        s.systemLog('UPDATE.sh',data.toString())
                    })
                    updateProcess.on('exit',(data) => {
                        resolve(true)
                        currentlyUpdating = false
                    })
                }else{
                    resolve(false)
                }
            })
        }
    }
}
