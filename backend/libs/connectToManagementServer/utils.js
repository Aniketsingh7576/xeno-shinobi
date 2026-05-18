const { Worker } = require('worker_threads')
module.exports = (s,config,lang) => {
    const { getConnectionDetails } = require('./libs/connectDetails.js')(s,config,lang)
    const { modifyConfiguration, getConfiguration } = require('../system/utils.js')(config)
    const sshDisabled = config.noCentralSsh === true;
    const queuedSshRestart = {}
    if(!s.connectedMgmtServers)s.connectedMgmtServers = {}
    function parseNewConnectionAddress(serverIp){
        let parsedIp = `${serverIp}`
        if(parsedIp.indexOf('://') === -1)parsedIp = `ws://${parsedIp}`
        if(parsedIp.split(':').length === 2)parsedIp = `ws://${parsedIp}:8663`
        return parsedIp;
    }
    function getManagementServers(){
        const response = { ok: true }
        response.mgmtServers = config.mgmtServers || {};
        return response
    }
    async function setManagementServers(mgmtServers){
        const response = { ok: true }
        config = Object.assign(config,{ mgmtServers })
        const currentConfig = await getConfiguration()
        currentConfig.mgmtServer = mgmtServers;
        const configError = await modifyConfiguration(currentConfig)
        if(configError){
            response.ok = false;
            response.err = configError
            s.systemLog(configError)
        }
        return response
    }
    async function addManagementServer(serverIp, p2pKey){
        const response = { ok: true }
        const parsedIp = parseNewConnectionAddress(serverIp)
        const currentConfig = await getConfiguration();
        if(!currentConfig.mgmtServers)currentConfig.mgmtServers = {};
        currentConfig.mgmtServers[serverIp] = p2pKey;
        config = Object.assign(config, { mgmtServers: currentConfig.mgmtServers })
        const configError = await modifyConfiguration(currentConfig)
        if(configError){
            response.ok = false;
            response.err = configError
            s.systemLog(configError)
        }
        return response
    }
    async function removeManagementServer(serverIp, p2pKey){
        const response = { ok: true }
        let foundMatching = false;
        const currentConfig = await getConfiguration();
        if(!currentConfig.mgmtServers)currentConfig.mgmtServers = {};
        const currentPeerConnectKey = currentConfig.mgmtServers[serverIp];
        if(currentPeerConnectKey === p2pKey){
            foundMatching = true
            delete(currentConfig.mgmtServers[serverIp])
            config = Object.assign(config, { mgmtServers: currentConfig.mgmtServers })
            const configError = await modifyConfiguration(currentConfig)
            if(configError){
                response.ok = false;
                response.err = configError
                s.systemLog(configError)
            }
        }else{
            response.ok = false;
            response.msg = 'Peer Connect Key not matching! Cannot disconnect.';
        }
        return response
    }
    function terminateSshToManagement(serverIp){
        if(s.connectedMgmtServers[serverIp]){
            s.connectedMgmtServers[serverIp].sshWorker.terminate()
            delete(s.connectedMgmtServers[serverIp].sshWorker)
        }
    }
    async function queueToggleSshToManagement(serverIp, p2pKey, onlyClose){
        if(sshDisabled)return;
        clearTimeout(queuedSshRestart[serverIp])
        queuedSshRestart[serverIp] = setTimeout(() => {
            delete(queuedSshRestart[serverIp])
            if(onlyClose){
                terminateSshToManagement(serverIp)
            }else{
                provideSshToManagement(serverIp, p2pKey)
            }
        },1000 * 60)
    }
    async function provideSshToManagement(serverIp, p2pKey){
        if(sshDisabled)return;
        if(queuedSshRestart[serverIp]){
            clearTimeout(queuedSshRestart[serverIp]);
            return s.connectedMgmtServers[serverIp].sshWorker
        }
        const configFromFile = await getConfiguration()
        const wsServerParts = serverIp.split(':')
        wsServerParts[serverIp.includes('://') ? 2 : 1] = configFromFile.sshSocketPort || 9021
        const wsServer = wsServerParts.join(':')
        console.log('Central SSH Connector Starting...', wsServer)
        const worker = new Worker(`${__dirname}/libs/centralConnect/ssh.js`, {
            workerData: {
                config: configFromFile,
                wsServer: wsServer,
                peerConnectKey: p2pKey,
            }
        });
        worker.on('message', async (data) => {
            switch(data.f){
                case'restart':
                    s.systemLog('Restarting SSH Connection...', serverIp)
                    worker.terminate()
                break;
            }
        });
        worker.on('error', (err) => {
            console.error('cameraPeer SSH Error', serverIp, err)
        });
        worker.on('exit', (code) => {
            if(!s.connectedMgmtServers[serverIp].wantTerminate){
                console.log('cameraPeer SSH Exited, Restarting...', serverIp, code)
                s.connectedMgmtServers[serverIp].sshWorker = provideSshToManagement(serverIp, p2pKey)
            }else{
                console.log('cameraPeer SSH Exited, NOT Restarting...', serverIp, code)
            }
        });
        return worker
    }
    async function connectToManagementServer(serverIp, p2pKey){
        if(!config.userHasSubscribed){
            return console.log(lang.centralManagementNotEnabled)
        }
        if(s.connectedMgmtServers[serverIp]){
            disconnectFromManagmentServer(serverIp)
        }
        s.connectedMgmtServers[serverIp] = {}
        const configFromFile = await getConfiguration()
        configFromFile.timezone = config.timezone;
        console.log('Central Worker Starting...', serverIp)
        const worker = new Worker(`${__dirname}/libs/centralConnect/index.js`, {
            workerData: {
                config: configFromFile,
                serverIp,
                p2pKey,
            }
        });
        worker.on('message', async (data) => {
            switch(data.f){
                case'authenticated':
                    const sshWorker = await provideSshToManagement(serverIp, p2pKey)
                    s.connectedMgmtServers[serverIp].sshWorker = sshWorker;
                break;
                case'connectDetailsRequest':
                    getConnectionDetails().then((connectDetails) => {
                        worker.postMessage({ f: 'connectDetails', connectDetails })
                    }).catch((error) => {
                        console.error('FAILED TO GET connectDetails', serverIp, error)
                        worker.postMessage({ f: 'connectDetails', connectDetails: {} })
                    })
                break;
                case'modifyConfiguration':
                    console.log('Editing Configuration...', serverIp, data.data.form)
                    const configFromFile = await getConfiguration()
                    const mgmtServers = JSON.stringify(configFromFile.mgmtServers)
                    const newConfig = data.data.form;
                    const mgmtServersFromNewConfig = JSON.stringify(configFromFile.mgmtServers)
                    if(mgmtServers !== mgmtServersFromNewConfig){
                        resetAllManagementServers()
                    }
                    modifyConfiguration(newConfig)
                break;
                case'restart':
                    s.systemLog('Restarting Central Connection...', serverIp)
                    worker.terminate()
                break;
            }
        });
        worker.on('error', (err) => {
            console.error('cameraPeer Error', serverIp, err)
        });
        worker.on('exit', (code) => {
            console.log('cameraPeer Exited, Restarting...', serverIp, code)
            if(!s.connectedMgmtServers[serverIp].wantTerminate)connectToManagementServer(serverIp, p2pKey)
        });
        s.connectedMgmtServers[serverIp].worker = worker;
        s.connectedMgmtServers[serverIp].wantTerminate = false;
    }
    function disconnectFromManagmentServer(serverIp){
        const mgmtConnection = s.connectedMgmtServers[serverIp];
        try{
            if(!mgmtConnection)return;
            mgmtConnection.wantTerminate = true;
            mgmtConnection.worker.terminate();
        }catch(err){
            s.debugLog('disconnectFromManagmentServer ERR',err)
        }
        try{
            terminateSshToManagement(serverIp);
        }catch(err){
            s.debugLog('disconnectFromManagmentSshServer ERR',err)
        }
    }
    function resetConnectionToManagementServer(serverIp){
        const mgmtConnection = s.connectedMgmtServers[serverIp];
        if(!mgmtConnection)return;
        mgmtConnection.wantTerminate = false;
        mgmtConnection.worker.terminate();
        try{
            terminateSshToManagement(serverIp);
        }catch(err){
            s.debugLog('resetConnectionToManagementSshServer ERR',err)
        }
    }
    function resetAllManagementServers(){
        for(serverIp in s.connectedMgmtServers){
            disconnectFromManagmentServer(serverIp)
        }
        connectAllManagementServers()
    }
    async function connectAllManagementServers(){
        const configFromFile = await getConfiguration()
        const mgmtServers = configFromFile.mgmtServers
        if(mgmtServers){
            for(serverIp in mgmtServers){
                var p2pKey = mgmtServers[serverIp]
                await connectToManagementServer(serverIp, p2pKey)
            }
        }else{
            console.log(`Management Server Connection Not Configured!`)
        }
    }
    async function migrateOldConfiguration(){
        await addManagementServer(config.managementServer, config.peerConnectKey)
        await connectToManagementServer(config.managementServer, config.peerConnectKey)
        const configFromFile = await getConfiguration()
        delete(configFromFile.managementServer)
        delete(configFromFile.peerConnectKey)
        modifyConfiguration(configFromFile)
    }
    async function sendMessageToAllConnectedServers(data){
        for(let serverIp in s.connectedMgmtServers){
            try{
                s.connectedMgmtServers[serverIp].worker.postMessage(data)
            }catch(err){
                s.debugLog(err.toString())
            }
        }
    }
    if(config.autoRestartManagementConnectionInterval){
        setInterval(() => {
            resetAllManagementServers()
        }, 1000 * 60 * 15)
    }
    return {
        getManagementServers,
        addManagementServer,
        removeManagementServer,
        connectToManagementServer,
        disconnectFromManagmentServer,
        resetConnectionToManagementServer,
        resetAllManagementServers,
        connectAllManagementServers,
        migrateOldConfiguration,
        sendMessageToAllConnectedServers,
    }
}
