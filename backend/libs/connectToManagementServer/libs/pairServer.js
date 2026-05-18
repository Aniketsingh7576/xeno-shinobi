const http = require('http');
const express = require('express');
const app = express();
var cors = require('cors');
var bodyParser = require('body-parser');
module.exports = (s,config,lang) => {
    try{
        const { modifyConfiguration, getConfiguration } = require('../../system/utils.js')(config)
        const pairPort = config.pairPort || 8091
        const bindIp = config.bindip
        const server = http.createServer(app);
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({extended: true}));
        app.use(cors());

        server.listen(pairPort, bindIp, function(){
            console.log('Management Pair Server Listening on '+pairPort);
        });

        const {
            addManagementServer,
            removeManagementServer,
            connectToManagementServer,
            connectAllManagementServers,
        } = require('../utils.js')(s,config,lang)

        /**
        * API : Superuser : Save Management Server Settings
        */
        app.post('/mgmt/connect', async function (req,res){
            // ws://127.0.0.1:8663
            let response = {ok: true};
            const managementServer = req.body.managementServer;
            if(!config.mgmtServers[managementServer]){
                const peerConnectKey = req.body.peerConnectKey;
                if(peerConnectKey){
                    response = await addManagementServer(managementServer, peerConnectKey)
                    await connectToManagementServer(managementServer, peerConnectKey)
                }else{
                    response.ok = false;
                    response.msg = 'No P2P API Key Provided';
                }
            }else{
                response.ok = false;
                response.msg = 'Already Configured';
            }
            s.closeJsonResponse(res,response)
        })
    }catch(err){
        console.error(err)
    }
}
