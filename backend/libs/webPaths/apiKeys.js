module.exports = function(s,config,lang,app){
    const { getApiKey, getApiKeys, createApiKey, editApiKey, deleteApiKey } = require('../user/apiKeys.js')(s,config,lang)
    /**
    * API : Add/Edit API Key, binded to the user who created it
    */
    app.post([
        config.webPaths.adminApiPrefix+':auth/api/:ke/add',
        config.webPaths.apiPrefix+':auth/api/:ke/add',
    ],function (req,res){
        var endData = {ok:false}
        s.auth(req.params,async function(user){
            const {
                isSubAccount,
                isRestrictedApiKey,
                apiKeyPermissions,
            } = s.checkPermission(user)
            const endData = {
                ok : false
            }
            if(isRestrictedApiKey && apiKeyPermissions.create_api_keys_disallowed){
                endData.msg = lang['Not Authorized']
            }else{
                const groupKey = req.params.ke;
                var form = s.getPostData(req) || {}
                try{
                    const targetUID = form.uid || req.body.uid;
                    const code = form.code;
                    const editResponse = await editApiKey({
                        code,
                        ke : groupKey,
                        uid : !isSubAccount && targetUID ? targetUID : user.uid,
                        ip : typeof form.ip === 'string' ? form.ip.trim() : '',
                        details : form.details ? s.stringJSON(form.details) : undefined
                    });
                    if(editResponse.ok){
                        s.tx({
                            f: 'api_key_added',
                            uid: user.uid,
                            form: editResponse.api
                        },'GRP_' + groupKey)
                    }
                    endData.ok = editResponse.ok
                    endData.api = editResponse.api
                }catch(err){
                    console.error(err)
                }
            }
            s.closeJsonResponse(res,endData)
        },res,req)
    })
    /**
    * API : Delete API Key
    */
    app.post([
        config.webPaths.adminApiPrefix+':auth/api/:ke/delete',
        config.webPaths.apiPrefix+':auth/api/:ke/delete',
    ],function (req,res){
        var endData = {ok:false}
        s.auth(req.params, async function(user){
            const {
                isSubAccount,
                isRestrictedApiKey,
                apiKeyPermissions,
            } = s.checkPermission(user)
            const endData = {
                ok : false
            }
            if(isRestrictedApiKey && apiKeyPermissions.create_api_keys_disallowed){
                endData.msg = lang['Not Authorized']
            }else{
                var form = s.getPostData(req) || {}
                const code = form.code || s.getPostData(req,'code',false)
                if(!code){
                    endData.msg = lang.postDataBroken
                }else{
                    const groupKey = req.params.ke;
                    const targetUID = req.query.uid;
                    endData.uid = !isSubAccount && targetUID ? targetUID : user.uid;
                    const { ok } = await deleteApiKey({ ke: groupKey, code, uid: endData.uid })
                    if(ok){
                        s.tx({
                            f: 'api_key_deleted',
                            uid: user.uid,
                            form: {
                                code: code
                            }
                        },'GRP_' + groupKey)
                        endData.ok = ok
                        delete(s.api[code])
                    }
                }
            }
            s.closeJsonResponse(res,endData)
        },res,req)
    })
    /**
    * API : List API Keys for Authenticated user
    */
    app.get([
        config.webPaths.adminApiPrefix+':auth/api/:ke/list',
        config.webPaths.apiPrefix+':auth/api/:ke/list',
    ],function (req,res){
        var endData = {ok:false}
        s.auth(req.params, async function(user){
            const {
                isSubAccount,
                isRestrictedApiKey,
                apiKeyPermissions,
            } = s.checkPermission(user)
            const endData = {
                ok : false,
                keys: []
            }
            if(isRestrictedApiKey && apiKeyPermissions.create_api_keys_disallowed){
                endData.msg = lang['Not Authorized']
            }else{
                const groupKey = req.params.ke;
                const targetUID = req.query.uid;
                endData.uid = !isSubAccount && targetUID ? targetUID : user.uid;
                const rows = await getApiKeys({ ke: groupKey, uid: endData.uid })
                endData.ok = true
                endData.keys = rows
                endData.ke = user.ke
            }
            s.closeJsonResponse(res,endData)
        },res,req)
    })
    /**
    * API : Get API Key for Authenticated user
    */
    app.get([
        config.webPaths.adminApiPrefix+':auth/api/:ke/get/:code',
        config.webPaths.apiPrefix+':auth/api/:ke/get/:code',
    ],function (req,res){
        var endData = {ok:false}
        s.auth(req.params, async function(user){
            const {
                isSubAccount,
                isRestrictedApiKey,
                apiKeyPermissions,
            } = s.checkPermission(user)
            const endData = {
                ok : false,
                keys: []
            }
            if(isRestrictedApiKey && apiKeyPermissions.create_api_keys_disallowed){
                endData.msg = lang['Not Authorized']
            }else{
                const groupKey = req.params.ke;
                const targetUID = req.query.uid;
                const code = req.params.code;
                const uid = !isSubAccount && targetUID ? targetUID : user.uid;
                const row = await getApiKey({ ke: groupKey, uid, code })
                endData.ok = true
                endData.key = row
            }
            s.closeJsonResponse(res,endData)
        },res,req)
    })
}
