module.exports = function(s,config,lang,app,io){
    const {
        ffprobe,
    } = require('./ffmpeg/utils.js')(s,config,lang)
    const {
        runOnvifScanner,
        runOnvifBulkConfig,
        cancelScan,
        pauseScan,
        resumeScan,
        getScanStatus,
    } = require('./scanners/utils.js')(s,config,lang)
    const onWebSocketConnection = async (cn) => {
        const tx = function(z){
            s.tx(z,`GRP_${cn.ke}`)
        }
        cn.on('f',(d) => {
            // SECURITY: these verbs scan the network and can WRITE encoder settings to
            // cameras. This handler is bound at connection time — BEFORE the login `init`
            // message — so without this gate an UNAUTHENTICATED client that can reach
            // :8080/socket.io could drive ONVIF scans / credential-spray arbitrary IP
            // ranges (internal SSRF) and reconfigure cameras. Require a logged-in socket
            // with monitor-control permission; fail closed.
            if(!cn.ke || !cn.auth) return;
            const user = s.group[cn.ke] && s.group[cn.ke].users && s.group[cn.ke].users[cn.auth];
            if(!user || !user.details) return;
            const permission = s.checkPermission(user);
            if(permission.isRestricted && user.details.control_monitors !== '1'){
                tx({ f: 'onvif_scan_status', active: false, msg: lang['Not Authorized'] });
                return;
            }
            switch(d.f){
                case'onvif':
                    d.scanId = cn.ke
                    runOnvifScanner(d,tx, (percent, processedItems, totalItems) => {
                        tx({ f: 'onvif_scan_progress', percent, processedItems, totalItems })
                    })
                break;
                case'onvif_bulk_config':
                    runOnvifBulkConfig(d, tx, (percent, processedItems, totalItems) => {
                        tx({ f: 'onvif_config_progress', percent, processedItems, totalItems })
                    })
                break;
                case'onvif_scan_cancel':
                    cancelScan(cn.ke, tx)
                break;
                case'onvif_scan_pause':
                    if(pauseScan(cn.ke)){
                        tx({ f: 'onvif_scan_pause' })
                    }
                break;
                case'onvif_scan_resume':
                    if(resumeScan(cn.ke)){
                        tx({ f: 'onvif_scan_resume' })
                    }
                break;
                case'onvif_scan_status':
                    const scanStatus = getScanStatus(cn.ke);
                    if(scanStatus){
                        const {
                            cancelled,
                            paused,
                            found
                        } = scanStatus;
                        tx({ f: 'onvif_scan_status', active: true, cancelled, paused, found })
                    }else{
                        tx({ f: 'onvif_scan_status', active: false })
                    }
                break;
            }
        })
    }
    s.onWebSocketConnection(onWebSocketConnection)
    /**
    * API : FFprobe
     */
    app.get(config.webPaths.apiPrefix+':auth/probe/:ke',function (req,res){
        s.auth(req.params,function(user){
            const {
                isRestricted,
                isRestrictedApiKey,
                apiKeyPermissions,
            } = s.checkPermission(user);
            if(
                isRestrictedApiKey && apiKeyPermissions.control_monitors_disallowed
            ){
                s.closeJsonResponse(res,{
                    ok: false,
                    msg: lang['Not Authorized']
                });
                return
            }
            ffprobe(req.query.url,req.params.auth,(endData) => {
                s.closeJsonResponse(res,endData)
            })
        },res,req);
    })
}
