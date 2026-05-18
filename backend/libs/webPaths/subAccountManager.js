module.exports = function(s,config,lang,app){
    const { addSubAccount, getSubAccounts, deleteSubAccount, updateSubAccount } = require('../user/subAccountManager.js')(s,config,lang)
    /**
    * API : Administrator : Edit Sub-Account (Account to share cameras with)
    */
    app.post(config.webPaths.adminApiPrefix+':auth/accounts/:ke/edit', function (req,res){
        s.auth(req.params, async (user) => {
            const {
                isSubAccount,
                isRestrictedApiKey,
                apiKeyPermissions,
                userPermissions,
            } = s.checkPermission(user)
            let response = { ok: false }
            if(
                isSubAccount ||
                isRestrictedApiKey && apiKeyPermissions.edit_user_disallowed
            ){
                response.msg = lang['Not Authorized']
            }else{
                const groupKey = req.params.ke;
                let { mail, uid, pass, password_again, pass_again, details } = s.getPostData(req);
                if(!uid)uid = s.getPostData(req,'uid',false)
                if(!mail)mail = (s.getPostData(req,'mail',false) || '').trim()
                if(mail && uid && details){
                    response = await updateSubAccount({ ke: groupKey, mail, uid, pass, password_again, pass_again, details })
                }else{
                    response.msg = lang.postDataBroken
                }
            }
            s.closeJsonResponse(res,response)
        },res,req)
    })
    /**
    * API : Administrator : Delete Sub-Account (Account to share cameras with)
    */
    app.post(config.webPaths.adminApiPrefix+':auth/accounts/:ke/delete', function (req,res){
        s.auth(req.params, async function(user){
            const groupKey = req.params.ke;
            const {
                isSubAccount,
                isRestrictedApiKey,
                apiKeyPermissions,
                userPermissions,
            } = s.checkPermission(user)
            let response = { ok: false }
            if(
                isSubAccount ||
                isRestrictedApiKey && apiKeyPermissions.edit_user_disallowed
            ){
                response.msg = lang['Not Authorized']
            }else{
                var form = s.getPostData(req) || {}
                var uid = form.uid || s.getPostData(req,'uid',false)
                response = await deleteSubAccount({ ke: groupKey, uid })
            }
            s.closeJsonResponse(res,response)
        },res,req)
    })
    /**
    * API : Administrator : Get Sub-Account List
    */
    app.get([
        config.webPaths.adminApiPrefix+':auth/accounts/:ke',
        config.webPaths.adminApiPrefix+':auth/accounts/:ke/:uid',
    ], function (req,res){
        s.auth(req.params,async function(user){
            const groupKey = req.params.ke;
            const {
                isSubAccount,
                isRestrictedApiKey,
                apiKeyPermissions,
                userPermissions,
            } = s.checkPermission(user)
            let response = { ok: false }
            if(
                isSubAccount ||
                isRestrictedApiKey && apiKeyPermissions.edit_user_disallowed
            ){
                response.msg = lang['Not Authorized']
            }else{
                response.ok = true
                const uid = req.params.uid;
                response.accounts = await getSubAccounts({ ke: groupKey, uid })
            }
            s.closeJsonResponse(res,response)
        },res,req)
    })
    /**
    * API : Administrator : Add Sub-Account (Account to share cameras with)
    */
    app.post(config.webPaths.adminApiPrefix+':auth/accounts/:ke/register',function (req,res){
        s.auth(req.params, async function(user){
            const {
                isSubAccount,
                isRestrictedApiKey,
                apiKeyPermissions,
                userPermissions,
            } = s.checkPermission(user)
            const endData = {
                ok : false
            }
            if(
                isSubAccount ||
                isRestrictedApiKey && apiKeyPermissions.edit_user_disallowed
            ){
                endData.msg = lang['Not Authorized']
            }else{
                const groupKey = req.params.ke;
                const { mail, pass, password_again, pass_again, details } = s.getPostData(req);
                const alsoCreateApiKey = s.getPostData(req,'createApiKey') === '1';
                response = await addSubAccount({ ke: groupKey, mail, pass, password_again, pass_again, details, alsoCreateApiKey })
            }
            s.closeJsonResponse(res,response)
        },res,req)
    })
}
