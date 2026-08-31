var fs = require('fs');
module.exports = function(s,config,lang){
    //directories
    function isValidPath(givenPath){
        return /^(\/?[a-z0-9A-Z\-_. ]+)*\/?$/.test(givenPath)
    }
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
    if(!config.videosDir || !isValidPath(config.videosDir)){config.videosDir = defaultVideosPath}
    if(!config.binDir || !isValidPath(config.binDir)){config.binDir = defaultFileBinPath}
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
    // NAS MOUNT-HEALTH GUARD. When the NAS is unmounted, its mountpoint directory still
    // exists on the root filesystem, so a naive existsSync() passes and ffmpeg silently
    // records to the LOCAL OS disk — orphaned footage that fills the root partition.
    // Require a sentinel file (default `.nas-online`, which lives ON the NAS itself) to be
    // present and readable in the recording directory before we will record there. If it
    // is missing, refuse to start rather than record to the wrong disk. Opt out with
    // "requireStorageMount": false in conf.json for a legitimate local-storage install.
    const storageSentinel = config.storageSentinelFile || '.nas-online';
    if(config.requireStorageMount !== false){
        let sentinelOk = false;
        try{ fs.accessSync(s.dir.videos + storageSentinel, fs.constants.R_OK); sentinelOk = true; }catch(e){ sentinelOk = false; }
        if(!sentinelOk){
            console.error('==================================================================');
            console.error('FATAL: storage sentinel not found: ' + s.dir.videos + storageSentinel);
            console.error('The recording volume (' + s.dir.videos + ') is not mounted / not ready.');
            console.error('Refusing to start so footage is NOT silently recorded to the local OS disk.');
            console.error('Mount the NAS (which carries the "' + storageSentinel + '" marker) and restart.');
            console.error('To run without this guard (legitimate local storage), set "requireStorageMount": false in conf.json.');
            console.error('==================================================================');
            process.exit(1);
        }
    }
    if(!fs.existsSync(s.dir.videos)){
        fs.mkdirSync(s.dir.videos);
    }
    //fileBin dir
    if(!fs.existsSync(s.dir.fileBin)){
        fs.mkdirSync(s.dir.fileBin);
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
