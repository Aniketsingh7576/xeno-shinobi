module.exports = function(s,config,lang,app){
    const {
        deleteMonitor,
    } = require('./monitor/utils.js')(s,config,lang);
    require('./webPaths/permissionSets.js')(s,config,lang,app)
    require('./webPaths/customSettings.js')(s,config,lang,app)
    require('./webPaths/apiKeys.js')(s,config,lang,app)
    require('./webPaths/subAccountManager.js')(s,config,lang,app)
    require('./webPaths/monitorStates.js')(s,config,lang,app)

    /**
    * API : Administrator : Monitor : Add, Edit, and Delete
    */
    app.all([
        config.webPaths.apiPrefix+':auth/configureMonitor/:ke/:id',
        config.webPaths.apiPrefix+':auth/configureMonitor/:ke/:id/:f',
        config.webPaths.adminApiPrefix+':auth/configureMonitor/:ke/:id',
        config.webPaths.adminApiPrefix+':auth/configureMonitor/:ke/:id/:f'
    ], function (req,res){
        s.auth(req.params,async function(user){
            let endData = {
                ok: false
            }
            const groupKey = req.params.ke
            const monitorId = req.params.id
            const {
                monitorPermissions,
                monitorRestrictions,
            } = s.getMonitorsPermitted(user.details,monitorId)
            const {
                isRestricted,
                isRestrictedApiKey,
                apiKeyPermissions,
                userPermissions,
            } = s.checkPermission(user)
            if(
                userPermissions.monitor_create_disallowed ||
                isRestrictedApiKey && apiKeyPermissions.edit_monitors_disallowed ||
                isRestricted && !monitorPermissions[`${monitorId}_monitor_edit`]
            ){
                s.closeJsonResponse(res,{ok: false, msg: lang['Not Authorized']});
                return
            }
            switch(req.params.f){
                case'delete':
                    endData = await deleteMonitor({
                        ke: groupKey,
                        mid: monitorId,
                        user: user,
                        deleteFiles: req.query.deleteFiles === 'true',
                    });
                break;
                default:
                    var form = s.getPostData(req)
                    if(!form){
                       endData.msg = lang.monitorEditText1;
                       s.closeJsonResponse(res,endData)
                       return
                    }
                    form.mid = req.params.id.replace(/[^\w\s]/gi,'').replace(/ /g,'')
                    form.ke = req.params.ke.replace(/[^\w\s]/gi,'').replace(/ /g,'')
                    if(form && form.name){
                        s.checkDetails(form)
                        form.ke = req.params.ke
                        endData = await s.addOrEditMonitor(form,null,user)
                    }else{
                        endData.msg = lang.monitorEditText1;
                    }
                break;
            }
            s.closeJsonResponse(res,endData)
        },res,req)
    })

}
