var fs = require('fs');
var { checkStorageTarget, refuseToStart } = require('./storageCheck.js');
module.exports = function(s,config,lang){
    //directories
    s.group = {}
    const defaultWindowsTempPath = 'C:/Windows/Temp';
    const defaultVideosPath = s.mainDirectory+'/videos/';
    const defaultFileBinPath = s.mainDirectory+'/fileBin/';
    if(!config.windowsTempDir&&s.isWin===true){config.windowsTempDir=defaultWindowsTempPath}
    if(!config.defaultMjpeg){config.defaultMjpeg=s.frontendDirectory+'/libs/img/bg.jpg'}
    //default stream folder check
    if(!config.streamDir){
        if(s.isWin === false){
            config.streamDir = '/dev/shm'
        }else{
            config.streamDir = config.windowsTempDir
        }
        if(!fs.existsSync(config.streamDir)){
            if(fs.existsSync('/dev/shm')){
                config.streamDir = '/dev/shm/streams/'
            }else{
                config.streamDir = s.mainDirectory+'/streams/'
            }
        }else{
            config.streamDir += '/streams/'
        }
    }
    // A path the operator CONFIGURED is never replaced. This used to run videosDir past a
    // regex that rejected UNC paths and then quietly substituted the local default, so a
    // site configured for the NAS recorded to the OS disk with every camera showing
    // "Recording". An ABSENT key still takes the documented default below -- that is a
    // default, not a substitution of something the operator asked for -- and the default is
    // then proven usable like any other path.
    if(!config.videosDir){config.videosDir = defaultVideosPath}
    if(!config.binDir){config.binDir = defaultFileBinPath}
    if(!config.addStorage){config.addStorage = []}
    s.dir={
        videos: s.checkCorrectPathEnding(config.videosDir),
        streams: s.checkCorrectPathEnding(config.streamDir),
        fileBin: s.checkCorrectPathEnding(config.binDir),
        addStorage: config.addStorage,
        languages: s.location.languages+'/'
    };
    //streams dir
    if(!fs.existsSync(s.dir.streams)){
        fs.mkdirSync(s.dir.streams);
    }
    //videos dir
    // Create it before proving it, not after: on a fresh local install this IS the first
    // run and the directory legitimately does not exist yet. On a NAS this is a no-op,
    // because the share already carries the folder -- and if the share is not mounted, the
    // mount-marker check below still refuses to start.
    if(!fs.existsSync(s.dir.videos)){
        try{ fs.mkdirSync(s.dir.videos); }catch(err){ /* reported properly by the check below */ }
    }
    // STORAGE PROOF. An unmounted share leaves a writable, empty directory behind on the
    // local disk, so existsSync() passes in exactly the condition that loses the footage.
    // checkStorageTarget writes, fsyncs, reads back and deletes, and checks the mount
    // marker -- the same function the settings API uses, so what is accepted at
    // configuration time is exactly what is required at boot.
    const videosError = checkStorageTarget(s.dir.videos,{
        requireMount: config.requireStorageMount !== false,
        sentinel: config.storageSentinelFile,
    });
    if(videosError){
        refuseToStart('the recording directory (videosDir = ' + config.videosDir + ') is not usable.', videosError);
    }
    //fileBin dir
    if(!fs.existsSync(s.dir.fileBin)){
        try{ fs.mkdirSync(s.dir.fileBin); }catch(err){ /* reported properly by the check below */ }
    }
    // No mount marker for the file bin: it holds exports and clips, not recordings, and it
    // is normally local. It still has to be writable, and must never be silently moved.
    const binError = checkStorageTarget(s.dir.fileBin,{ requireMount: false });
    if(binError){
        refuseToStart('the file bin directory (binDir = ' + config.binDir + ') is not usable.', binError);
    }
    //additional storage areas
    s.listOfStorage = [{
        name: lang['Default'],
        value: ""
    }]
    s.dir.addStorage.forEach(function(v,n){
        v.path = s.checkCorrectPathEnding(v.path)
        if(!fs.existsSync(v.path)){
            fs.mkdirSync(v.path);
        }
        s.listOfStorage.push({
            name: v.name,
            value: v.path
        })
    })
    //get audio files list
    s.listOfAudioFiles = [
        {
            name:lang['No Sound'],
            value:""
        }
    ]
    fs.readdirSync(s.frontendDirectory + '/libs/audio').forEach(function(file){
        s.listOfAudioFiles.push({
            name: file,
            value: file
        })
    })
    //get themes list
    s.listOfThemes = [
        {
            name:lang['Default'],
            value:""
        }
    ]
    fs.readdirSync(s.frontendDirectory + '/libs/themes').forEach(function(folder){
        s.listOfThemes.push({
            name: folder,
            value: folder
        })
    })
}
