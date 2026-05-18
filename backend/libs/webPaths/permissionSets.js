module.exports = function(s,config,lang,app){
    const {
        getPermissionSets,
        insertPermissionSet,
        updatePermissionSet,
        deletePermissionSet,
        editPermissionSet,
        applyPermissionsToUser,
    } = require('../user/permissionSets.js')(s,config,lang)
    /**
    * API : Permission Set : Get
    */
    app.get([
        config.webPaths.apiPrefix+':auth/permissions/:ke',
        config.webPaths.apiPrefix+':auth/permissions/:ke/:name',
    ], function (req,res){
        s.auth(req.params, async function(user){
            const response = { ok: false }
            const {
                isSubAccount,
                userPermissions,
                apiKeyPermissions,
                isRestrictedApiKey,
            } = s.checkPermission(user)
            const canEditPermissions = !isSubAccount || userPermissions.edit_permissions || isRestrictedApiKey && (apiKeyPermissions.edit_permissions || apiKeyPermissions.create_api_keys);
            if(!canEditPermissions){
                s.closeJsonResponse(res,{ok: false, msg: lang['Not an Administrator Account']});
            }else{
                const groupKey = req.params.ke;
                const name = req.params.name;
                const rows = await getPermissionSets(groupKey,name)
                response.permissions = rows;
                s.closeJsonResponse(res,response)
            }
        },res,req)
    })
    /**
    * API : Permission Set : Edit
    */
    app.post(config.webPaths.apiPrefix+':auth/permissions/:ke', function (req,res){
        s.auth(req.params, async function(user){
            let response = { ok: false }
            const {
                isSubAccount,
                userPermissions,
                apiKeyPermissions,
                isRestrictedApiKey,
            } = s.checkPermission(user)
            const canEditPermissions = !isSubAccount || userPermissions.edit_permissions || isRestrictedApiKey && apiKeyPermissions.edit_permissions;
            if(!canEditPermissions){
                response.msg = lang['Not Authorized'];
            }else{
                const groupKey = req.params.ke;
                const form = s.getPostData(req) || {};
                if(form.name && form.details){
                    response = await editPermissionSet(groupKey,form)
                }else{
                    response.msg = lang['Invalid Data'];
                }
            }
            s.closeJsonResponse(res,response)
        },res,req)
    })
    /**
    * API : Permission Set : Delete
    */
    app.get(config.webPaths.apiPrefix+':auth/permissions/:ke/:name/delete', function (req,res){
        s.auth(req.params, async function(user){
            const response = { ok: false }
            const {
                isSubAccount,
                userPermissions,
                apiKeyPermissions,
                isRestrictedApiKey,
            } = s.checkPermission(user)
            const canEditPermissions = !isSubAccount || userPermissions.edit_permissions || isRestrictedApiKey && apiKeyPermissions.edit_permissions;
            if(!canEditPermissions){
                response.msg = lang['Not Authorized'];
            }else{
                const groupKey = req.params.ke;
                const name = req.params.name;
                response.ok = true;
                response.deleteResponse = await deletePermissionSet(groupKey,name)
            }
            s.closeJsonResponse(res,response)
        },res,req)
    })
}
