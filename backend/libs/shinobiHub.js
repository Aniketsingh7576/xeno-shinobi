const fs = require('fs')
const fetch = require('node-fetch')
module.exports = function(s,config,lang,app,io){
    if(config.shinobiHubEndpoint === undefined){config.shinobiHubEndpoint = `https://hub.shinobi.video/`}else{config.shinobiHubEndpoint = s.checkCorrectPathEnding(config.shinobiHubEndpoint)}
    const {
        fetchWithAuthentication,
    } = require('./basic/utils.js')(process.cwd(),config)
    var stripUsernameAndPassword = function(string,username,password){
        if(username)string = string.split(username).join('_USERNAME_')
        if(password)string = string.split(password).join('_PASSWORD_')
        return string
    }
    var validatePostConfiguration = function(fields){
        var response = {ok: true}
        var fieldsJson
        if(!fields.json)fields.json = '{}'
        try{
            fieldsJson = JSON.parse(fields.json)
        }catch(err){
            response.ok = false
            response.msg = ('Configuration is not JSON format.')
        }
        if(!fields.details)fields.details = '{}'
        try{
            fieldsDetails = JSON.parse(fields.details)
        }catch(err){
            fieldsDetails = {}
        }
        if(
          fields.name === '' ||
          fields.brand === '' ||
          fields.json === ''
        ){
            response.ok = false
            response.msg = ('The form is incomplete.')
        }
        if(!fields.description)fields.description = ''
        if(!fieldsJson.mid){
            response.ok = false
            response.msg = ('The monitor configuration is incomplete.')
        }
        var monitorDetails = s.parseJSON(fieldsJson.details)
        fieldsJson.details = monitorDetails || {}

        fieldsJson.details.auto_host = stripUsernameAndPassword(fieldsJson.details.auto_host,fieldsJson.details.muser,fieldsJson.details.mpass)
        fieldsJson.path = stripUsernameAndPassword(fieldsJson.path,fieldsJson.details.muser,fieldsJson.details.mpass)
        fieldsJson.details.muser = '_USERNAME_'
        fieldsJson.details.mpass = '_PASSWORD_'

        response.json = JSON.stringify(fieldsJson)
        response.details = JSON.stringify(fieldsDetails)
        return response
    }
    const uploadConfiguration = (shinobiHubApiKey,type,monitorConfig,callback) => {
        var validated = validatePostConfiguration({
            json: JSON.stringify(monitorConfig)
        })
        if(validated.ok === true){
            fetchWithAuthentication(
                `${config.shinobiHubEndpoint}api/${shinobiHubApiKey}/postConfiguration`,
                {
                    method: 'POST',
                    postData: {
                        "type": type,
                        "brand": monitorConfig.ke,
                        "name": monitorConfig.name,
                        "description": "Backup at " + (new Date()),
                        "json": validated.json,
                        "details": {
                            // maybe ip address?
                        }
                    }
                }
            ).then(res => res.text())
            .then((data) => {
                callback(null,s.parseJSON(data) || {ok: false})
            })
            .catch((err) => {
                callback(err,{ok: false})
            })
        }else{
            callback(new Error(validated.msg),{ok: false})
        }
    }
    const onMonitorSave = async (monitorConfig,form) => {
        if(config.shinobiHubAutoBackup === true && config.shinobiHubApiKey){
            uploadConfiguration(config.shinobiHubApiKey,'cam',monitorConfig,() => {
                // s.userLog({ke:monitorConfig.ke,mid:'$USER'},{type:lang['Websocket Connected'],msg:{for:lang['Superuser'],id:cn.mail,ip:cn.ip}})
            })
        }
        if(s.group[monitorConfig.ke] && s.group[monitorConfig.ke].init && s.group[monitorConfig.ke].init.shinobihub === '1'){
            uploadConfiguration(s.group[monitorConfig.ke].init.shinobihub_key,'cam',monitorConfig,() => {
                // s.userLog({ke:monitorConfig.ke,mid:'$USER'},{type:lang['Websocket Connected'],msg:{for:lang['Superuser'],id:cn.mail,ip:cn.ip}})
            })
        }
    }
    app.get([
        config.webPaths.apiPrefix + ':auth/getXenocipherHubConfigurations/:ke/:type',
        config.webPaths.apiPrefix + ':auth/getXenocipherHubConfigurations/:ke/:type/:id'
    ],function (req,res){
        s.auth(req.params,function(user){
            //query defaults : rowLimit=5, skipOver=0, explore=0
            res.setHeader('Content-Type', 'application/json');
            var shinobiHubApiKey = s.group[req.params.ke].init.shinobihub_key
            if(shinobiHubApiKey){
                var queryString = []
                if(req.query){
                    Object.keys(req.query).forEach((key) => {
                        var value = req.query[key]
                        queryString.push(key + '=' + value)
                    })
                }
                const configUrl = `${config.shinobiHubEndpoint}api/${shinobiHubApiKey}/getConfiguration/${req.params.type}${req.params.id ? '/' + req.params.id : ''}${queryString.length > 0 ? '?' + queryString.join('&') : ''}`
                fetch(configUrl).then(actual => {
                    actual.headers.forEach((v, n) => res.setHeader(n, v));
                    actual.body.pipe(res);
                })
            }else{
                s.closeJsonResponse(res,{
                    ok: false,
                    msg: lang['No API Key']
                })
            }
        },res,req)
    })
    app.get([
        config.webPaths.apiPrefix + ':auth/backupMonitorsAllToShinobHub/:ke'
    ],function (req,res){
        s.auth(req.params,function(user){
            //query defaults : rowLimit=5, skipOver=0, explore=0
            res.setHeader('Content-Type', 'application/json');
            var shinobiHubApiKey = s.group[req.params.ke].init.shinobihub_key
            if(shinobiHubApiKey){
                if(!s.group[req.params.ke].uploadingAllMonitorsToXenocipherHub){
                    s.group[req.params.ke].uploadingAllMonitorsToXenocipherHub = true
                    var current = 0;
                    var monitorConfigs = s.group[req.params.ke].rawMonitorConfigurations
                    var monitorIds = Object.keys(monitorConfigs)
                    var doOneUpload = () => {
                        if(!monitorIds[current]){
                            s.group[req.params.ke].uploadingAllMonitorsToXenocipherHub = false
                            s.closeJsonResponse(res,{
                                ok: true,
                            })
                            return;
                        };
                        uploadConfiguration(s.group[req.params.ke].init.shinobihub_key,'cam',Object.assign(monitorConfigs[monitorIds[current]],{}),() => {
                            ++current
                            doOneUpload()
                        })
                    }
                    doOneUpload()
                }else{
                    s.closeJsonResponse(res,{
                        ok: false,
                        msg: lang['Already Processing']
                    })
                }
            }else{
                s.closeJsonResponse(res,{
                    ok: false,
                    msg: lang['No API Key']
                })
            }
        },res,req)
    })
    s.onMonitorSave(onMonitorSave)
}
