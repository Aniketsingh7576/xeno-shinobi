const fs = require('fs');
const spawn = require('child_process').spawn;
const execSync = require('child_process').execSync;
module.exports = async (s,config,lang,onFinish) => {
    const {
        sanitizedFfmpegCommand,
        createPipeArray,
        splitForFFMPEG,
        checkForWindows,
        checkForUnix,
        checkStaticBuilds,
        checkVersion,
        checkHwAccelMethods,
    } = require('./ffmpeg/utils.js')(s,config,lang)
    const {
        buildMainInput,
        buildMainStream,
        buildJpegApiOutput,
        buildMainRecording,
        buildAudioDetector,
        buildMainDetector,
        buildEventRecordingOutput,
        buildTimelapseOutput,
    } = require('./ffmpeg/builders.js')(s,config,lang)
    if(config.ffmpegBinary)config.ffmpegDir = config.ffmpegBinary

    s.ffmpeg = function(e){
        try{
            const activeMonitor = s.group[e.ke].activeMonitors[e.mid];
            const dataPortToken = s.gid(10);
            s.dataPortTokens[dataPortToken] = {
                type: 'cameraThread',
                ke: e.ke,
                mid: e.mid,
            }
            const ffmpegCommand = [`-progress pipe:5`];
            const allOutputs = [
                buildMainStream(e),
                buildJpegApiOutput(e),
                buildMainRecording(e),
                buildAudioDetector(e),
                buildMainDetector(e),
                buildEventRecordingOutput(e),
                buildTimelapseOutput(e),
            ];
            if(allOutputs.filter(output => !!output).length > 0){
                return new Promise((resolve) => {
                    var hasResolved = false
                    function completeResolve(data){
                        if(!hasResolved){
                            hasResolved = true
                            resolve(data)
                        }
                    }
                    try{
                        ([
                            buildMainInput(e),
                        ]).concat(allOutputs).forEach(function(commandStringPart){
                            ffmpegCommand.push(commandStringPart)
                        })
                        s.onFfmpegCameraStringCreationExtensions.forEach(function(extender){
                            extender(e,ffmpegCommand)
                        })
                        const stdioPipes = createPipeArray(e)
                        const ffmpegCommandString = ffmpegCommand.join(' ')
                        //hold ffmpeg command for log stream
                        activeMonitor.ffmpeg = sanitizedFfmpegCommand(e,ffmpegCommandString)
                        //clean the string of spatial impurities and split for spawn()
                        const ffmpegCommandParsed = splitForFFMPEG(ffmpegCommandString)
                        const cmdFilePath = e.sdir + `cmd_${dataPortToken}.txt`
                        fs.writeFileSync(cmdFilePath,JSON.stringify({
                            dataPortToken: dataPortToken,
                            cmd: ffmpegCommandParsed,
                            pipes: stdioPipes.length,
                            rawMonitorConfig: s.group[e.ke].rawMonitorConfigurations[e.id],
                            globalInfo: {
                                config: config,
                                isAtleatOneDetectorPluginConnected: s.isAtleatOneDetectorPluginConnected
                            }
                        },null,3),'utf8')
                        var cameraCommandParams = [
                          config.monitorDaemonPath ? config.monitorDaemonPath : __dirname + '/cameraThread/singleCamera.js',
                          config.ffmpegDir,
                          cmdFilePath
                        ]
                        const cameraProcess = spawn('node',cameraCommandParams,{detached: true,stdio: stdioPipes})
                        cameraProcess.stderr.on('close',(data) => {
                            delete(s.dataPortTokens[dataPortToken])
                            try{ fs.rmSync(cmdFilePath) }catch(e){}
                        })
                        if(config.debugLog === true && config.debugLogMonitors === true){
                            if(!config.debugLogMonitorsVerbose){
                                const checkLog = function(string,x){return string.indexOf(x)>-1}
                                cameraProcess.stderr.on('data',(data) => {
                                    const string = data.toString()
                                    switch(true){
                                        case string.startsWith('DTS'):
                                        case checkLog(string,'Queue input is backward'):
                                        case checkLog(string,'pkt->duration = 0'):
                                        case checkLog(string,'bad cseq'):
                                        case checkLog(string,'[hls @'):
                                        case checkLog(string,'Past duration'):
                                        case checkLog(string,'Last message repeated'):
                                        case checkLog(string,'Non-monotonous DTS'):
                                        case checkLog(string,'Non-monotonic DTS'):
                                        case checkLog(string,'invalid dropping'):
                                        case checkLog(string,'NULL @'):
                                        case checkLog(string,'RTP: missed'):
                                        case checkLog(string,'Application provided'):
                                        case checkLog(string,'deprecated pixel format used'):
                                                return;
                                        break;
                                    }
                                    console.log(`${e.ke} ${e.name} (${e.mid})`)
                                    console.log(data.toString())
                                })
                            }
                        }
                        completeResolve(cameraProcess)
                    }catch(err){
                        completeResolve(null)
                        s.systemLog(err)
                        return null
                    }
                })
            }else{
                return null
            }
        }catch(err){
            s.systemLog(err)
            return null
        }
    }
    if(!config.ffmpegDir){
        if(s.isWin){
            const windowsCheck = checkForWindows()
            if(!windowsCheck.ok){
                const staticBuildCheck = await checkStaticBuilds()
                if(!staticBuildCheck.ok){
                    console.log(staticBuildCheck.msg)
                    console.log('No FFmpeg found.')
                }
            }
        }else{
            const staticBuildCheck = await checkStaticBuilds()
            if(!staticBuildCheck.ok){
                const unixCheck = checkForUnix()
                if(!unixCheck.ok){
                    console.log(staticBuildCheck.msg.join('\n'))
                    console.log(unixCheck.msg)
                    console.log('No FFmpeg found.')
                }
            }else if(staticBuildCheck.msg.length > 0){
                console.log(staticBuildCheck.msg.join('\n'))
            }
        }
    }
    checkVersion()
    checkHwAccelMethods()
    s.onFFmpegLoadedExtensions.forEach(function(extender){
        extender()
    })
    onFinish()
}
