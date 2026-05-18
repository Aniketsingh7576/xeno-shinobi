module.exports = (s,config,lang,app) => {
    if(!config.enableMgmtConnect){
        return;
    }
    const { modifyConfiguration, getConfiguration } = require('../system/utils.js')(config)
    require('./libs/pairServer.js')(s,config,lang)
    const {
        getManagementServers,
        addManagementServer,
        removeManagementServer,
        connectToManagementServer,
        disconnectFromManagmentServer,
        connectAllManagementServers,
        migrateOldConfiguration,
        sendMessageToAllConnectedServers,
    } = require('./utils.js')(s,config,lang)
    s.onLoadedUsersAtStartup(() => {
        connectAllManagementServers()
        if(config.managementServer && config.peerConnectKey){
            console.log(`Migrating Old Central Configuration`)
            migrateOldConfiguration()
        }
    })
    s.onTriggerNotificationSend((groupKey, data, files) => {
        sendMessageToAllConnectedServers({ f: 'onTriggerNotificationSend', groupKey, data, files })
    })
    /**
    * API : Superuser : Get Management Server Settings
    */
    app.get(config.webPaths.superApiPrefix+':auth/mgmt/list', function (req,res){
        s.superAuth(req.params,(resp) => {
            const response = getManagementServers()
            s.closeJsonResponse(res,response)
        },res,req)
    })

    /**
    * API : Superuser : Save Management Server Settings
    */
    app.post(config.webPaths.superApiPrefix+':auth/mgmt/save', function (req,res){
        s.superAuth(req.params,async (resp) => {
            const managementServer = req.body.managementServer;
            const peerConnectKey = req.body.peerConnectKey;
            const response = await addManagementServer(managementServer, peerConnectKey)
            await connectToManagementServer(managementServer, peerConnectKey)
            s.closeJsonResponse(res,response)
        },res,req)
    })

    /**
    * API : Delete Management Server Settings
    */
    app.post(config.webPaths.superApiPrefix+':auth/mgmt/disconnect', async function (req,res){
        s.superAuth(req.params,async (resp) => {
            const managementServer = req.body.managementServer;
            const peerConnectKey = req.body.peerConnectKey;
            const response = await removeManagementServer(managementServer, peerConnectKey)
            await disconnectFromManagmentServer(managementServer, peerConnectKey)
            s.closeJsonResponse(res,response)
        },res,req)
    })
}
