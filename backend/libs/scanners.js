module.exports = function(s,config,lang,app,io){
    const {
        ffprobe,
    } = require('./ffmpeg/utils.js')(s,config,lang)
    const {
        runOnvifScanner,
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
            switch(d.f){
                case'onvif':
                    d.scanId = cn.ke
                    runOnvifScanner(d,tx, (percent, processedItems, totalItems) => {
                        tx({ f: 'onvif_scan_progress', percent, processedItems, totalItems })
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
