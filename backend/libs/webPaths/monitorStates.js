module.exports = function(s,config,lang,app){
    /**
    * API : Administrator : Get Monitor State Presets List
    */
    app.all([
        config.webPaths.apiPrefix+':auth/monitorStates/:ke',
        config.webPaths.adminApiPrefix+':auth/monitorStates/:ke'
    ],function (req,res){
        s.auth(req.params,function(user){
            var endData = {
                ok : false
            }
            const groupKey = req.params.ke
            const {
                isRestricted,
                isRestrictedApiKey,
                apiKeyPermissions,
                userPermissions,
            } = s.checkPermission(user)
            if(
                userPermissions.monitor_create_disallowed ||
                isRestrictedApiKey && apiKeyPermissions.edit_monitors_disallowed
            ){
                s.closeJsonResponse(res,{ok: false, msg: lang['Not Authorized']});
                return
            }
            s.knexQuery({
                action: "select",
                columns: "*",
                table: "Presets",
                where: [
                    ['ke','=',req.params.ke],
                    ['type','=','monitorStates'],
                ]
            },function(err,presets) {
                if(presets && presets[0]){
                    endData.ok = true
                    presets.forEach(function(preset){
                        preset.details = JSON.parse(preset.details)
                    })
                }
                endData.presets = presets || []
                s.closeJsonResponse(res,endData)
            })
        })
    })
    /**
    * API : Administrator : Change Group Preset. Currently affects Monitors only.
    */
    app.all([
        config.webPaths.apiPrefix+':auth/monitorStates/:ke/:stateName',
        config.webPaths.apiPrefix+':auth/monitorStates/:ke/:stateName/:action',
        config.webPaths.adminApiPrefix+':auth/monitorStates/:ke/:stateName',
        config.webPaths.adminApiPrefix+':auth/monitorStates/:ke/:stateName/:action',
    ],function (req,res){
        s.auth(req.params,function(user){
            var endData = {
                ok : false
            }
            const groupKey = req.params.ke
            const {
                isRestricted,
                isRestrictedApiKey,
                apiKeyPermissions,
                userPermissions,
            } = s.checkPermission(user)
            if(
                userPermissions.monitor_create_disallowed ||
                isRestrictedApiKey && apiKeyPermissions.edit_monitors_disallowed
            ){
                s.closeJsonResponse(res,{ok: false, msg: lang['Not Authorized']});
                return
            }
            var presetQueryVals = [req.params.ke,'monitorStates',req.params.stateName]
            switch(req.params.action){
                case'insert':case'edit':
                    var form = s.getPostData(req)
                    s.checkDetails(form)
                    if(!form || !form.monitors){
                        endData.msg = lang['Form Data Not Found']
                        s.closeJsonResponse(res,endData)
                        return
                    }
                    s.findPreset(presetQueryVals,function(notFound,preset){
                        if(notFound === true){
                            endData.msg = lang["Inserted State Configuration"]
                            var details = {
                                monitors : form.monitors
                            }
                            var insertData = {
                                ke: req.params.ke,
                                name: req.params.stateName,
                                details: s.s(details),
                                type: 'monitorStates'
                            }
                            s.knexQuery({
                                action: "insert",
                                table: "Presets",
                                insert: insertData
                            })
                            s.tx({
                                f: 'add_group_state',
                                details: details,
                                ke: req.params.ke,
                                name: req.params.stateName
                            },'GRP_'+req.params.ke)
                        }else{
                            endData.msg = lang["Edited State Configuration"]
                            var details = Object.assign(preset.details,{
                                monitors : form.monitors
                            })
                            s.knexQuery({
                                action: "update",
                                table: "Presets",
                                update: {
                                    details: s.s(details)
                                },
                                where: [
                                    ['ke','=',req.params.ke],
                                    ['name','=',req.params.stateName],
                                ]
                            })
                            s.tx({
                                f: 'edit_group_state',
                                details: details,
                                ke: req.params.ke,
                                name: req.params.stateName
                            },'GRP_'+req.params.ke)
                        }
                        endData.ok = true
                        s.closeJsonResponse(res,endData)
                    })
                break;
                case'delete':
                    s.findPreset(presetQueryVals,function(notFound,preset){
                        if(notFound === true){
                            endData.msg = lang['State Configuration Not Found']
                            s.closeJsonResponse(res,endData)
                        }else{
                            s.knexQuery({
                                action: "delete",
                                table: "Presets",
                                where: {
                                    ke: req.params.ke,
                                    name: req.params.stateName,
                                }
                            },(err) => {
                                if(!err){
                                    endData.msg = lang["Deleted State Configuration"]
                                    endData.ok = true
                                }
                                s.closeJsonResponse(res,endData)
                            })
                        }
                    })
                break;
                default://change monitors according to state
                    s.activateMonitorStates(req.params.ke,req.params.stateName,user,function(endData){
                        s.closeJsonResponse(res,endData)
                    })
                break;
            }
        },res,req)
    })
}
