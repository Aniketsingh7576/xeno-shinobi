const fs = require('fs')
const URL = require('url')
const monitorBasePath = process.argv[2];
const importFilePath = process.argv[3];
if(!importFilePath){
    console.error('Missing Import File Path.')
    return console.error(`Example Use : node ./createMonitorsJsonFromCsv.js ./MONITOR_BASE.json ./COMPLEX_LIST.csv`)
}
const monitorBase = require(monitorBasePath)
function generateId(x){
    if(!x){x=10};var t = "";var p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0; i < x; i++ )
        t += p.charAt(Math.floor(Math.random() * p.length));
    return t;
}
function getUrlProtocol(urlString){
    let modifiedUrlString = `${urlString}`.split('://')
    const originalProtocol = `${modifiedUrlString[0]}`
    return originalProtocol
}
function modifyUrlProtocol(urlString,newProtocol){
    let modifiedUrlString = `${urlString}`.split('://')
    const originalProtocol = `${modifiedUrlString[0]}`
    modifiedUrlString[0] = newProtocol;
    modifiedUrlString = modifiedUrlString.join('://')
    return modifiedUrlString
}
function getUrlParts(urlString){
    const originalProtocol = getUrlProtocol(urlString)
    const modifiedUrlString = modifyUrlProtocol(urlString,'http')
    const url = URL.parse(modifiedUrlString)
    const data = {}
    Object.keys(url).forEach(function(key){
        const value = url[key];
        if(value && typeof value !== 'function')data[key] = url[key];
    });
    data.href = `${urlString}`
    data.origin = modifyUrlProtocol(data.origin,originalProtocol)
    data.protocol = `${originalProtocol}:`
    return data
}
function makeConfig(
    mode,
    monitorId,//
    name,
    tags,
    daysToKeep,
    lat,
    lon,
    streamUrl,
){
    // streamUrl = 'rtsp://1.1.1.1:554/'
    const copyOfBaseConfig = Object.assign({},monitorBase)
    const urlParts = getUrlParts(streamUrl)
    copyOfBaseConfig.mid = monitorId
    copyOfBaseConfig.mode = mode
    copyOfBaseConfig.name = name
    copyOfBaseConfig.details.geolocation = `${lat},${lon}`
    copyOfBaseConfig.details.max_keep_days = `${parseInt(daysToKeep) || 10}`
    copyOfBaseConfig.tags = tags.split(';').filter(item => !!item).join(',')
    //
    copyOfBaseConfig.protocol = urlParts.protocol.replace(':','')
    copyOfBaseConfig.host = urlParts.hostname
    copyOfBaseConfig.port = 554
    copyOfBaseConfig.path = urlParts.pathname
    copyOfBaseConfig.details.auto_host = streamUrl
    copyOfBaseConfig.details.rtsp_transport = 'tcp'
    copyOfBaseConfig.details.skip_ping = '1'
    //
    return copyOfBaseConfig
}

function run(){
    const importList = fs.readFileSync(importFilePath,'utf8').split('\n')
    importList.shift()
    const newMonitorsList = []
    const fileName = `${importFilePath}.json`
    for(line of importList){
        const trimmedLine = line.trim();
        if(trimmedLine){
            const trimmedParts = trimmedLine.split(',');
            const newConfig = makeConfig(...trimmedParts)
            newConfig.details.auto_host = trimmedParts[trimmedParts.length - 1]
            newMonitorsList.push(JSON.stringify(newConfig))
        }
    }
    console.log(`New JSON written to ${fileName}`)
    fs.promises.writeFile(fileName,`[${newMonitorsList.join(',')}]`);
}
run()
