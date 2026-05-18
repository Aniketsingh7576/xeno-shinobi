module.exports = function(s,config,lang,io){
    const { getMonitors } = require('./utils.js')(s,config,lang)
    s.onOtherWebSocketMessages(async (d,cn,tx) => {
        const authKey = cn.auth
        const groupKey = cn.ke
        const user = s.group[groupKey] && s.group[groupKey].users && s.group[groupKey].users[authKey];
        const monitorId = d.mid || d.id;
        const callbackId = d.callbackId;
        const response = { f: 'callback', callbackId, args: [true] }
        switch(d.f){
            case'getMonitors':
                response.ff = 'getMonitors'
                if(!user || !user.details){
                    response.msg = lang['Not Authorized'];
                    tx(response);
                    break;
                }
                var {
                    monitorPermissions,
                    monitorRestrictions,
                } = s.getMonitorsPermitted(user.details,monitorId)
                var {
                    isRestricted,
                    userPermissions,
                    isRestrictedApiKey,
                    apiKeyPermissions,
                } = s.checkPermission(user)
                if(
                    isRestrictedApiKey && apiKeyPermissions.get_monitors_disallowed ||
                    isRestricted && (
                        monitorId && !monitorPermissions[`${monitorId}_monitors`] ||
                        monitorRestrictions.length === 0
                    )
                ){
                    //not authorized
                }else{
                    const cannotSeeImportantSettings = (isRestrictedApiKey && apiKeyPermissions.edit_monitors_disallowed) || userPermissions.monitor_create_disallowed;
                    const monitors = await getMonitors(groupKey, monitorId, authKey, isRestricted, monitorPermissions, monitorRestrictions, cannotSeeImportantSettings, d.search)
                    response.args = [monitors]
                }
                tx(response);
            break;
            case'addOrEditMonitor':
                response.ff = 'addOrEditMonitor'
                if(!user || !user.details){
                    response.msg = lang['Not Authorized'];
                    tx(response);
                    break;
                }
                var {
                    monitorPermissions,
                    monitorRestrictions,
                } = s.getMonitorsPermitted(user.details,monitorId)
                var {
                    isRestricted,
                    isRestrictedApiKey,
                    apiKeyPermissions,
                    userPermissions,
                } = s.checkPermission(user);
                if(
                    userPermissions.monitor_create_disallowed ||
                    isRestrictedApiKey && apiKeyPermissions.edit_monitors_disallowed ||
                    isRestricted && !monitorPermissions[`${monitorId}_monitor_edit`]
                ){
                    response.msg = lang['Not Authorized'];
                }else{
                    var form = d.form;
                    if(!form){
                       response.msg = lang.monitorEditText1;
                   }else{
                       form.mid = `${monitorId || form.mid}`.replace(/[^\w\s]/gi,'').replace(/ /g,'')
                       if(form && form.name){
                           s.checkDetails(form)
                           form.ke = groupKey
                           const editResponse = await s.addOrEditMonitor(form,null,user);
                           response.args = [!editResponse.ok, editResponse];
                       }else{
                           response.args = [lang.monitorEditText1];
                       }
                   }
                }
                tx(response);
            break;
        }
    })
}
