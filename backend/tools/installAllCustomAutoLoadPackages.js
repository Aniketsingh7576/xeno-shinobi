const fsOld = require('fs')
const fs = fsOld.promises
const spawn = require('child_process').spawn
const configLocation = process.argv[2] ? process.argv[2] : `${__dirname}/../conf.json`
const config = require(configLocation)
const customAutoLoadPath = `${__dirname}/../libs/customAutoLoad/`

async function getAllCustomAutoLoadModuleFolders(){
    return (await fs.readdir(customAutoLoadPath)).filter((filename) => {
        return fsOld.lstatSync(`${customAutoLoadPath}${filename}`).isDirectory()
    })
}
function installModule(filename){
    return new Promise((resolve) => {
        console.log(`Installing Module : ${filename}`)
        const folderPath = `${customAutoLoadPath}${filename}`
        const tempSh = `${folderPath}/tempSh.sh`
        fsOld.writeFileSync(tempSh,`cd "${folderPath}" && npm install`)
        const installProcess = spawn('sh',[tempSh])
        installProcess.stdout.on('data',function(data){
            const text = data.toString()
            console.log(text)
        })
        installProcess.stderr.on('data',function(data){
            const text = data.toString()
            console.error(text)
        })
        installProcess.on('close',function(){
            resolve()
            fs.rm(tempSh)
        })
    })
}
async function run(){
    const folderList = await getAllCustomAutoLoadModuleFolders()
    for (let i = 0; i < folderList.length; i++) {
        const folderName = folderList[i]
        await installModule(folderName)
    }
}
run().then(() => {
    console.log('Done!')
})
.catch((err) => {
    console.error('RUN ERROR',err)
})
