const zWaveAPI = require('shinobi-zwave')
module.exports = async (s,config,lang,app,io) => {
    const addCredentialsToHostLink = (url,username,password) => {
        if(url.indexOf('@') > -1){
            return url
        }else if(username){
            const urlParts = url.split('://')
            return [urlParts[0],'://',`${username}:${password || ''}@`,urlParts[1]].join('')
        }else{
            return url
        }
    }
    function loadApplicationForGroup(user){
        const userDetails = s.parseJSON(user.details);
        s.debugLog('Z-Wave','Loading API',user.ke)
        if(
            !s.group[user.ke].zwave &&
            userDetails.zwave === '1' &&
            userDetails.zwave_host
        ){
            const zWaveHost = addCredentialsToHostLink(
                userDetails.zwave_host || config.zWaveHost,
                userDetails.zwave_user,
                userDetails.zwave_pass
            ).replace(/\/$/, '');
            s.group[user.ke].zwave = zWaveAPI(zWaveHost,config.debugLogZwave || false)
            s.debugLog('Z-Wave','Loaded API',zWaveHost)
        }
    }
    function unloadApplicationForGroup(user){
        s.group[user.ke].zwave = null
    }
    /**
    * API : Z-Wave HTTP Handler
     */
     function httpApiHandler(req,res){
         s.auth(req.params,async (user) => {
             const endData = {ok: true}
             const actionFunction = req.params.action
             const arguments = s.getPostData(req) || []
             try{
                 const groupKey = req.params.ke
                 endData.response = await s.group[groupKey].zwave[actionFunction](...arguments)
             }catch(err){
                 endData.ok = false
                 endData.err = err
                 s.debugLog(err)
             }
             s.closeJsonResponse(res,endData)
         },res,req);
    }
    app.get(config.webPaths.apiPrefix+':auth/zwave/:ke/:action',httpApiHandler)
    app.post(config.webPaths.apiPrefix+':auth/zwave/:ke/:action',httpApiHandler)
    app.get(config.webPaths.apiPrefix+':auth/zwaveRaw/:ke',(req,res) => {
        s.auth(req.params,async (user) => {
            const groupKey = req.params.ke
            const pathString = s.getPostData(req,'path')
            if(!pathString){
                res.end(lang['Not Found'])
                return
            }
            s.group[groupKey].zwave.httpRequest(pathString).pipe(res)
        },res,req);
   })
    s.definitions["Account Settings"].blocks["Z-Wave"] = {
       "evaluation": "$user.details.use_zwave !== '0'",
       "name": lang['Z-Wave'],
       "id":"accSectionZwave",
       "isSection": true,
       "color": "blue",
       "info": [
           {
              "name": "detail=zwave",
              "selector":"u_zwave_bot",
              "field": lang.Enabled,
              "default": "0",
              "example": "",
              "fieldType": "select",
              "possible": [
                  {
                     "name": lang.No,
                     "value": "0"
                  },
                  {
                     "name": lang.Yes,
                     "value": "1"
                  }
              ]
           },
           {
               hidden: true,
              "name": "detail=zwave_host",
              "placeholder": "https://localhost:8083",
              "field": lang.Host,
              "form-group-class":"u_zwave_bot_input u_zwave_bot_1",
           },
           {
               hidden: true,
              "name": "detail=zwave_user",
              "placeholder": lang["Username"],
              "field": lang["Username"],
              "form-group-class":"u_zwave_bot_input u_zwave_bot_1",
          },
           {
               hidden: true,
              "name": "detail=zwave_pass",
              "placeholder": lang["Password"],
              "fieldType": "password",
              "field": lang["Password"],
              "form-group-class":"u_zwave_bot_input u_zwave_bot_1",
           }
       ]
    }
    s.definitions["Z-Wave Manager"] = {
        "name": lang["Z-Wave Manager"],
        blocks: {
            "Container1": {
                "evaluation": "$user.details.use_zwave !== '0'",
                noHeader: true,
                noDefaultSectionClasses: true,
               "color": "green",
               "section-pre-class": "col-md-8 search-parent",
               "info": [
                   {
                      "id": "zwaveDevices",
                      "fieldType": "div",
                   },
               ]
            }
        }
    }
    s.loadGroupAppExtender(loadApplicationForGroup)
    s.unloadGroupAppExtender(unloadApplicationForGroup)
}
