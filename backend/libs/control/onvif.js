var os = require('os');
var exec = require('child_process').exec;
const {
    addCredentialsToUrl,
} = require('../common.js')
module.exports = function(s,config,lang,app,io){
    const {
        createSnapshot,
        addCredentialsToStreamLink,
    } = require('../monitor/utils.js')(s,config,lang)
    const {
        getOnvifDevice,
        createOnvifDevice,
        startPatrolPresets,
        stopPatrolPresets,
        removePreset,
        getPresets,
        setPreset,
        goToPreset,
    } = require('../onvifDeviceManager/utils.js')(s,config,lang)
    const replaceDynamicInOptions = (Camera,options) => {
        const newOptions = {}
        Object.keys(options).forEach((key) => {
            const value = options[key]
            if(typeof value === 'string'){
                newOptions[key] = value.replace(/__CURRENT_TOKEN/g,Camera.current_profile ? Camera.current_profile.token : 'NOTOKEN')
            }else if(value !== undefined && value !== null){
                newOptions[key] = value
            }
        })
        return newOptions
    }
    const runOnvifMethod = (onvifOptions,callback) => {
        return new Promise((resolve) => {
            var onvifAuth = onvifOptions.auth
            var response = {ok: false}
            function doCallback(response){
                if(callback)callback(response)
                resolve(response)
            }
            var errorMessage = function(msg,error){
                response.ok = false
                response.msg = msg
                response.error = error
                doCallback(response)
            }
            var actionCallback = function(onvifActionResponse){
                response.ok = true
                if(onvifActionResponse.data){
                    response.responseFromDevice = onvifActionResponse.data
                }else{
                    response.responseFromDevice = onvifActionResponse
                }
                if(onvifActionResponse.soap)response.soap = onvifActionResponse.soap
                doCallback(response)
            }
            var isEmpty = function(obj) {
                for(var key in obj) {
                    if(obj.hasOwnProperty(key))
                        return false;
                }
                return true;
            }
            var doAction = function(Camera){
                var completeAction = function(command){
                    if(command && command.then){
                        command.then(actionCallback).catch(function(error){
                            errorMessage('Device Action responded with an error',error)
                        })
                    }else if(command){
                        response.ok = true
                        response.repsonseFromDevice = command
                        doCallback(response)
                    }else{
                        response.error = 'Big Errors, Please report it to Xenocipher Development'
                        doCallback(response)
                    }
                }
                var action
                if(onvifAuth.service){
                    if(Camera.services[onvifAuth.service] === undefined){
                        return errorMessage('This is not an available service. Please use one of the following : '+Object.keys(Camera.services).join(', '))
                    }
                    if(Camera.services[onvifAuth.service] === null){
                        return errorMessage('This service is not activated. Maybe you are not connected through ONVIF. You can test by attempting to use the "Control" feature with ONVIF in Xenocipher.')
                    }
                    action = Camera.services[onvifAuth.service][onvifAuth.action]
                }else{
                    action = Camera[onvifAuth.action]
                }
                if(!action || typeof action !== 'function'){
                    errorMessage(onvifAuth.action+' is not an available ONVIF function. See https://github.com/futomi/node-onvif for functions.')
                }else{
                    var argNames = s.getFunctionParamNames(action)
                    var options
                    var command
                    if(argNames[0] === 'options' || argNames[0] === 'params'){
                        options = replaceDynamicInOptions(Camera,onvifOptions.options || {})
                        response.options = options
                    }
                    if(onvifAuth.service){
                        command = Camera.services[onvifAuth.service][onvifAuth.action](options)
                    }else{
                        command = Camera[onvifAuth.action](options)
                    }
                    completeAction(command)
                }
            }
            if(!s.group[onvifAuth.ke].activeMonitors[onvifAuth.id].onvifConnection){
                createOnvifDevice(onvifAuth).then((response) => {
                    if(response.ok){
                        doAction(response.device)
                    }else{
                        errorMessage(response.msg,response.error)
                    }
                })
            }else{
                doAction(s.group[onvifAuth.ke].activeMonitors[onvifAuth.id].onvifConnection)
            }
        })
    }
    async function getSnapshotFromOnvif(onvifOptions){
        let theUrl;
        if(onvifOptions.mid && onvifOptions.ke){
            const groupKey = onvifOptions.ke
            const monitorId = onvifOptions.mid
            const theDevice = s.group[groupKey].activeMonitors[monitorId].onvifConnection || (await s.createOnvifDevice({ id: monitorId, ke: groupKey })).device;
            if(theDevice){
                theUrl = addCredentialsToUrl({
                    username: theDevice.user,
                    password: theDevice.pass,
                    url: (await theDevice.services.media.getSnapshotUri({
                        ProfileToken : theDevice.current_profile.token,
                    })).data.GetSnapshotUriResponse.MediaUri.Uri
                });
            }
        }else{
            theUrl = addCredentialsToStreamLink({
                username: onvifOptions.username,
                password: onvifOptions.password,
                url: onvifOptions.uri
            })
        }
        return await createSnapshot({
            output: ['-s 400x400'],
            url: theUrl,
        })
    }
    /**
    * API : ONVIF Method Controller
     */
    app.all([
        config.webPaths.apiPrefix+':auth/onvif/:ke/:id/:action',
        config.webPaths.apiPrefix+':auth/onvif/:ke/:id/:service/:action'
    ],function (req,res){
        s.auth(req.params,function(user){
            const options = s.getPostData(req,'options',true) || s.getPostData(req,'params',true)
            runOnvifMethod({
                auth: {
                    ke: req.params.ke,
                    id: req.params.id,
                    action: req.params.action,
                    service: req.params.service,
                },
                options: options,
            },(endData) => {
                s.closeJsonResponse(res,endData)
            })
        },res,req);
    })
    /**
    * API : ONVIF Get Presets
     */
    app.get(config.webPaths.apiPrefix+':auth/onvifPresets/:ke/:id',function (req,res){
        s.auth(req.params, async function(user){
            const endData = { ok: true }
            try{
                const groupKey = req.params.ke;
                const monitorId = req.params.id;
                const onvifEnabled = s.group[groupKey].rawMonitorConfigurations[monitorId].details.is_onvif === '1';
                if(onvifEnabled){
                    const profileToken = s.getPostData(req,'profileToken') || "__CURRENT_TOKEN";
                    const asObject = s.getPostData(req,'asObject') === '1';
                    const numberOf = parseInt(s.getPostData(req,'numberOf')) || undefined;
                    const onvifDevice = await getOnvifDevice(groupKey, monitorId);
                    endData.presets = await getPresets(onvifDevice, asObject, profileToken, numberOf)
                }else{
                    endData.ok = false;
                    endData.err = lang.ONVIFNotEnabled;
                }
            }catch(err){
                endData.ok = false;
                endData.err = err.toString()
            }
            s.closeJsonResponse(res,endData)
        },res,req);
    })
    /**
    * API : ONVIF Set Presets
     */
    app.post(config.webPaths.apiPrefix+':auth/onvifSetPreset/:ke/:id',function (req,res){
        s.auth(req.params, async function(user){
            const endData = { ok: true }
            try{
                const groupKey = req.params.ke;
                const monitorId = req.params.id;
                const onvifEnabled = s.group[groupKey].rawMonitorConfigurations[monitorId].details.is_onvif === '1';
                if(onvifEnabled){
                    const presetToken = s.getPostData(req,'presetToken') || "2";
                    const presetName = s.getPostData(req,'presetName') || "newPreset";
                    const onvifDevice = await getOnvifDevice(groupKey, monitorId);
                    endData.responseFromDevice = await setPreset(onvifDevice, presetToken, presetName)
                }else{
                    endData.ok = false;
                    endData.err = lang.ONVIFNotEnabled;
                }
            }catch(err){
                endData.ok = false;
                endData.err = err.toString()
            }
            s.closeJsonResponse(res,endData)
        },res,req);
    })
    /**
    * API : ONVIF Go To Preset
     */
    app.post(config.webPaths.apiPrefix+':auth/onvifGoToPreset/:ke/:id',function (req,res){
        s.auth(req.params, async function(user){
            const endData = { ok: true }
            try{
                const groupKey = req.params.ke;
                const monitorId = req.params.id;
                const onvifEnabled = s.group[groupKey].rawMonitorConfigurations[monitorId].details.is_onvif === '1';
                if(onvifEnabled){
                    const presetToken = s.getPostData(req,'presetToken') || "2";
                    const speed = parseFloat(s.getPostData(req,'speed')) || undefined;
                    const onvifDevice = await getOnvifDevice(groupKey, monitorId);
                    endData.responseFromDevice = await goToPreset(onvifDevice, presetToken, speed)
                }else{
                    endData.ok = false;
                    endData.err = lang.ONVIFNotEnabled;
                }
            }catch(err){
                endData.ok = false;
                endData.err = err.toString()
            }
            s.closeJsonResponse(res,endData)
        },res,req);
    })
    /**
    * API : ONVIF Remove Preset
     */
    app.post(config.webPaths.apiPrefix+':auth/onvifRemovePreset/:ke/:id',function (req,res){
        s.auth(req.params, async function(user){
            const endData = { ok: true }
            try{
                const groupKey = req.params.ke;
                const monitorId = req.params.id;
                const onvifEnabled = s.group[groupKey].rawMonitorConfigurations[monitorId].details.is_onvif === '1';
                if(onvifEnabled){
                    const presetToken = s.getPostData(req,'presetToken') || "2";
                    const onvifDevice = await getOnvifDevice(groupKey, monitorId);
                    endData.responseFromDevice = await removePreset(onvifDevice, presetToken)
                }else{
                    endData.ok = false;
                    endData.err = lang.ONVIFNotEnabled;
                }
            }catch(err){
                endData.ok = false;
                endData.err = err.toString()
            }
            s.closeJsonResponse(res,endData)
        },res,req);
    })
    /**
    * API : ONVIF Start Patrol
     */
    app.post(config.webPaths.apiPrefix+':auth/onvifStartPatrol/:ke/:id',function (req,res){
        s.auth(req.params, async function(user){
            const endData = { ok: true }
            try{
                const groupKey = req.params.ke;
                const monitorId = req.params.id;
                const onvifEnabled = s.group[groupKey].rawMonitorConfigurations[monitorId].details.is_onvif === '1';
                if(onvifEnabled){
                    const patrolId = `${groupKey}_${monitorId}`;
                    const onvifDevice = await getOnvifDevice(groupKey, monitorId);
                    if(onvifDevice){
                        const startingPresetToken = s.getPostData(req,'startingPresetToken');
                        const patrolIndexTimeout = s.getPostData(req,'patrolIndexTimeout');
                        const speed = s.getPostData(req,'speed');
                        const activeMonitor = s.group[groupKey].activeMonitors[monitorId];
                        await startPatrolPresets(patrolId, onvifDevice, startingPresetToken, patrolIndexTimeout, speed, (currentToken) => {
                            activeMonitor.lastOnvifPresetFromPatrol = currentToken;
                            s.tx({
                                f: 'control_ptz_preset_changed',
                                mid: monitorId,
                                ke: groupKey,
                                profileToken: currentToken
                            },'GRP_'+groupKey);
                        })
                    }else{
                        endData.ok = false;
                        endData.err = lang.ONVIFNotEnabled;
                    }
                }else{
                    endData.ok = false;
                    endData.err = lang.ONVIFNotEnabled;
                }
            }catch(err){
                endData.ok = false;
                endData.err = err.toString()
                console.log(err)
            }
            s.closeJsonResponse(res,endData)
        },res,req);
    })
    /**
    * API : ONVIF Stop Patrol
     */
    app.get(config.webPaths.apiPrefix+':auth/onvifStopPatrol/:ke/:id',function (req,res){
        s.auth(req.params, async function(user){
            const endData = { ok: true }
            try{
                const groupKey = req.params.ke;
                const monitorId = req.params.id;
                const patrolId = `${groupKey}_${monitorId}`;
                await stopPatrolPresets(patrolId)
            }catch(err){
                endData.ok = false;
                endData.err = err.toString()
                console.log(err)
            }
            s.closeJsonResponse(res,endData)
        },res,req);
    })
    s.getSnapshotFromOnvif = getSnapshotFromOnvif
    s.createOnvifDevice = createOnvifDevice
    s.runOnvifMethod = runOnvifMethod
}
