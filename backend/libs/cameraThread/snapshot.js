const fs = require('fs')
const spawn = require('child_process').spawn
const isWindows = process.platform === "win32";
const {
  parentPort, workerData
} = require('worker_threads');
var writeToStderr = function(text){
  // fs.appendFileSync(rawMonitorConfig.sdir + 'errors.log',text + '\n','utf8')
  // process.stderr.write(Buffer.from(`${text}`, 'utf8' ))
  parentPort.postMessage(text)
}
// if(!process.argv[2] || !process.argv[3]){
//     return writeToStderr('Missing FFMPEG Command String or no command operator')
// }
process.send = process.send || function () {};
process.on('uncaughtException', function (err) {
    writeToStderr('Uncaught Exception occured!');
    writeToStderr(err.stack);
});
// [CTRL] + [C] = exit
const exitAction = function(){
    if(isWindows){
        spawn("taskkill", ["/pid", snapProcess.pid, '/f', '/t'])
    }else{
        try{
            process.kill(-snapProcess.pid)
        }catch(err){

        }
    }
}
process.on('SIGTERM', exitAction);
process.on('SIGINT', exitAction);
process.on('exit', exitAction);

// var jsonData = JSON.parse(fs.readFileSync(process.argv[3],'utf8'))
// const ffmpegAbsolutePath = process.argv[2].trim()
const jsonData = workerData.jsonData
const ffmpegAbsolutePath = workerData.ffmpegAbsolutePath
const ffmpegCommandString = jsonData.cmd
const temporaryImageFile = jsonData.temporaryImageFile
const iconImageFile = jsonData.iconImageFile
const useIcon = jsonData.useIcon
const rawMonitorConfig = jsonData.rawMonitorConfig
// var writeToStderr = function(text){
//   process.stderr.write(Buffer.from(text))
// }
var timeout = setTimeout(() => {
    exitAction()
},10000)
var snapProcess = spawn(ffmpegAbsolutePath,ffmpegCommandString,{detached: true})
snapProcess.stderr.on('data',(data)=>{
  writeToStderr(data.toString())
})
snapProcess.stdout.on('data',(data)=>{
  writeToStderr(data.toString())
})
snapProcess.on('close',function(data){
    clearTimeout(timeout)
  if(useIcon){
    var iconStream = fs.createWriteStream(iconImageFile);
    var fileCopy = fs.createReadStream(temporaryImageFile).pipe(iconStream)
    var closeTimeout = setTimeout(() => {iconStream.end()}, 2000);
    function endProcess(){
        clearTimeout(closeTimeout)
        process.exit();
    }
    fileCopy
        .on('close', endProcess)
        .on('error', endProcess);
  }else{
    process.exit();
  }
});
