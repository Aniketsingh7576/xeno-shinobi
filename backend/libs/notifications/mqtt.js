var fs = require("fs")
module.exports = function(s,config,lang,getSnapshot){
    const {
        parseMessageOptions,
    } = require('./utils.js')(s,config,lang)
    if(config.mqttClient === true){
        const allowedSend = {}
        const registeredEndpoints = {}
        console.log('Loading MQTT Outbound Connectivity...')
        const mqtt = require('mqtt')
        const {
            getEventBasedRecordingUponCompletion,
        } = require('../events/utils.js')(s,config,lang)
        try{
            function createMqttSubscription(options){
                let mqttEndpoint = options.host
                const username = options.username || ''
                const password = options.password || ''
                const clientId = options.clientId || `shinobi_${Math.random().toString(16).substr(2, 8)}`
                const subKey = options.subKey
                const pubKey = options.pubKey
                const groupKey = options.ke
                const onData = options.onData || function(){}
                function mqttUserLog(type,data){
                    s.userLog({
                        ke: groupKey,
                        mid: '$USER'
                    },{
                        type: type,
                        msg: data
                    })
                }
                if(mqttEndpoint.indexOf('://') === -1){
                    mqttEndpoint = `mqtt://${mqttEndpoint}`
                }
                mqttUserLog('Connecting... ' + mqttEndpoint)
                const client  = mqtt.connect(mqttEndpoint,{
                    clean: true,
                    username: username,
                    password: password,
                    clientId: clientId,
                    reconnectPeriod: 10000, // 10 seconds
                });
                client.on('reconnect', (e) => mqttUserLog(`MQTT Reconnected`))
                client.on('disconnect', (e) => mqttUserLog(`MQTT Disconnected`))
                client.on('offline', (e) => mqttUserLog(`MQTT Offline`))
                client.on('error', (e) => mqttUserLog(`MQTT Error`,e))
                client.on('connect', function () {
                    mqttUserLog('Connected! ' + mqttEndpoint)
                    client.subscribe(pubKey, function (err) {
                        if (err) {
                            s.debugLog(err)
                            s.userLog({
                                ke: groupKey,
                                mid: '$USER'
                            },{
                                type: lang['MQTT Error'],
                                msg: err
                            })
                        }else{
                            client.on('message', function (topic, message) {
                                const data = s.parseJSON(message.toString())
                                onData(data)
                            })
                        }
                    })
                })
                return client
            }
            function sendToMqttConnections(groupKey,eventName,addedArgs,checkMonitors){
                try{
                    (s.group[groupKey].mqttOutbounderKeys || []).forEach(function(key){
                        const outBounder = s.group[groupKey].mqttOutbounders[key]
                        const theAction = outBounder.eventHandlers[eventName]
                        if(!theAction)return;
                            if(checkMonitors){
                                const monitorsToRead = outBounder.monitorsToRead
                                const firstArg = addedArgs[0]
                                const monitorId = firstArg.mid || firstArg.id
                                if(monitorsToRead.indexOf(monitorId) > -1 || monitorsToRead.indexOf('$all') > -1)theAction(...addedArgs);
                            }else{
                                theAction(...addedArgs)
                            }
                    })
                }catch(err){
                    s.debugLog(err)
                }
            }
            const sendMessage = async function(options,data){
                const sendBody = s.stringJSON(data)
                const groupKey = options.ke
                const subId = options.subId
                const publishTo = options.to
                try{
                    s.group[groupKey].mqttOutbounders[subId].client.publish(publishTo,sendBody)
                }catch(err){
                    s.debugLog('MQTT Error',err)
                    s.userLog({ke:groupKey,mid:'$USER'},{type:lang['MQTT Error'],msg:err})
                }
            }
            const onEventTriggerBeforeFilter = function(d,filter){
                filter.mqttout = false
            }
            const onDetectorNoTriggerTimeout = function(e){
                if(e.details.detector_notrigger_mqttout === '1'){
                    const groupKey = e.ke
                    sendToMqttConnections(groupKey,'onDetectorNoTriggerTimeout',[e],true)
                }
            }
            const onEventTrigger = async (d,filter) => {
                const monitorConfig = s.group[d.ke].rawMonitorConfigurations[d.id]
                if((filter.mqttout || monitorConfig.details.notify_mqttout === '1') && !s.group[d.ke].activeMonitors[d.id].detector_mqttout){
                    var detector_mqttout_timeout
                    if(!monitorConfig.details.detector_mqttout_timeout||monitorConfig.details.detector_mqttout_timeout===''){
                        detector_mqttout_timeout = 1000 * 60 * 10;
                    }else{
                        detector_mqttout_timeout = parseFloat(monitorConfig.details.detector_mqttout_timeout) * 1000 * 60;
                    }
                    s.group[d.ke].activeMonitors[d.id].detector_mqttout = setTimeout(function(){
                        clearTimeout(s.group[d.ke].activeMonitors[d.id].detector_mqttout);
                        s.group[d.ke].activeMonitors[d.id].detector_mqttout = null
                    },detector_mqttout_timeout)
                    //
                    const groupKey = d.ke
                    await getSnapshot(d,monitorConfig)
                    if(d.screenshotBuffer){
                        sendToMqttConnections(groupKey,'onEventTrigger',[Object.assign({},d,{
                            screenshotBuffer: d.screenshotBuffer.toString('base64')
                        }),filter],true)
                    }
                }
            }
            const onMonitorSave = (monitorConfig) => {
                const groupKey = monitorConfig.ke
                sendToMqttConnections(groupKey,'onMonitorSave',[monitorConfig],true)
            }
            const onMonitorStart = (monitorConfig) => {
                const groupKey = monitorConfig.ke
                sendToMqttConnections(groupKey,'onMonitorStart',[monitorConfig],true)
            }
            const onMonitorStop = (monitorConfig) => {
                const groupKey = monitorConfig.ke
                sendToMqttConnections(groupKey,'onMonitorStop',[monitorConfig],true)
            }
            const onMonitorDied = (monitorConfig) => {
                const groupKey = monitorConfig.ke
                sendToMqttConnections(groupKey,'onMonitorDied',[monitorConfig],true)
            }
            const onEventBasedRecordingComplete = (response,monitorConfig) => {
                const groupKey = monitorConfig.ke
                sendToMqttConnections(groupKey,'onEventBasedRecordingComplete',[response,monitorConfig],true)
            }
            const insertCompletedVideoExtender = (activeMonitor,temp,insertQuery,response) => {
                const groupKey = insertQuery.ke
                const monitorId = insertQuery.mid
                const monitorConfig = s.group[groupKey].rawMonitorConfigurations[monitorId]
                sendToMqttConnections(groupKey,'insertCompletedVideoExtender',[monitorConfig],true)
            }
            const onAccountSave = (activeGroup,userDetails,user) => {
                const groupKey = user.ke
                sendToMqttConnections(groupKey,'onAccountSave',[activeGroup,userDetails,user])
            }
            const onUserLog = (logEvent) => {
                const groupKey = logEvent.ke
                if(groupKey.indexOf('$') === -1){
                    sendToMqttConnections(groupKey,'onUserLog',[logEvent])
                }else{
                    s.debugLog(`Failed sendToMqttConnections onUserLog : ${groupKey}`)
                }
            }
            const onTwoFactorAuthCodeNotification = function(user){
                const groupKey = user.ke
                if(user.details.factor_mqttout === '1'){
                    sendToMqttConnections(groupKey,'onTwoFactorAuthCodeNotification',[user],true)
                }
            }
            const loadMqttListBotForUser = function(user){
                const groupKey = user.ke
                const userDetails = s.parseJSON(user.details);
                if(!s.group[groupKey].mqttOutbounders)s.group[groupKey].mqttOutbounders = {};
                const mqttSubs = s.group[groupKey].mqttOutbounders
                if(userDetails.mqttout === '1' && Object.keys(mqttSubs).length === 0){
                    allowedSend[groupKey] = true
                    registeredEndpoints[groupKey] = []
                    const mqttClientList = userDetails.mqttout_list || []
                    mqttClientList.forEach(function(row,n){
                        try{
                            const mqttSubId = `${row.host} ${row.pubKey}`
                            const message = row.type || []
                            const eventsToAttachTo = row.msgFor || []
                            const monitorsToRead = row.monitors || []
                            mqttSubs[mqttSubId] = {
                                eventHandlers: {}
                            };
                            mqttSubs[mqttSubId].client = createMqttSubscription({
                                username: row.username,
                                password: row.password,
                                clientId: row.clientId,
                                host: row.host,
                                pubKey: row.pubKey,
                                ke: groupKey,
                            });
                            const msgOptions = {
                                ke: groupKey,
                                subId: mqttSubId,
                                to: row.pubKey,
                            }
                            registeredEndpoints[groupKey].push(msgOptions)
                            const titleLegend = {
                                onMonitorSave: lang['Monitor Edit'],
                                onMonitorStart: lang['Monitor Start'],
                                onMonitorStop: lang['Monitor Stop'],
                                onMonitorDied: lang['Monitor Died'],
                                onEventTrigger: lang['Event'],
                                insertCompletedVideoExtender: lang['Recording Complete'],
                                onEventBasedRecordingComplete: lang['Event-Based Recording'],
                                onDetectorNoTriggerTimeout: lang['"No Motion" Detector'],
                                onAccountSave: lang['Account Save'],
                                onUserLog: lang['User Log'],
                                onTwoFactorAuthCodeNotification: lang['2-Factor Authentication'],
                            }
                            eventsToAttachTo.forEach(function(eventName){
                                let theAction = function(){}
                                switch(eventName){
                                    case'insertCompletedVideoExtender':
                                        theAction = function(activeMonitor,temp,insertQuery,response){
                                            sendMessage(msgOptions,{
                                                title: titleLegend[eventName],
                                                name: eventName,
                                                data: insertQuery,
                                                time: new Date(),
                                            })
                                        }
                                    break;
                                    case'onEventBasedRecordingComplete':
                                        theAction = function(response,monitorConfig){
                                            sendMessage(msgOptions,{
                                                title: titleLegend[eventName],
                                                name: eventName,
                                                data: {
                                                    ke: monitorConfig.ke,
                                                    mid: monitorConfig.mid,
                                                    response: response,
                                                },
                                                time: new Date(),
                                            })
                                        }
                                    break;
                                    case'onEventTrigger':
                                        theAction = function(d,filter){
                                            const eventObject = Object.assign({},d)
                                            delete(eventObject.frame);
                                            sendMessage(msgOptions,{
                                                title: titleLegend[eventName],
                                                name: eventName,
                                                data: eventObject,
                                                time: new Date(),
                                            })
                                        }
                                    break;
                                    case'onAccountSave':
                                        theAction = function(activeGroup,userDetails,user){
                                            sendMessage(msgOptions,{
                                                title: titleLegend[eventName],
                                                name: eventName,
                                                data: {
                                                    mail: user.mail,
                                                    ke: user.ke,
                                                },
                                                time: new Date(),
                                            })
                                        }
                                    break;
                                    case'userLog':
                                        theAction = function(logEvent){
                                            sendMessage(msgOptions,{
                                                title: titleLegend[eventName],
                                                name: eventName,
                                                data: logEvent,
                                                time: new Date(),
                                            })
                                        }
                                    break;
                                    case'onTwoFactorAuthCodeNotification':
                                        theAction = function(user){
                                            sendMessage(msgOptions,{
                                                title: titleLegend[eventName],
                                                name: eventName,
                                                data: {
                                                    code: s.factorAuth[user.ke][user.uid].key
                                                },
                                                time: new Date(),
                                            })
                                        }
                                    break;
                                    case'onMonitorSave':
                                    case'onMonitorStart':
                                    case'onMonitorStop':
                                    case'onMonitorDied':
                                    case'onDetectorNoTriggerTimeout':
                                        theAction = function(monitorConfig){
                                            //e = monitor object
                                            sendMessage(msgOptions,{
                                                title: titleLegend[eventName],
                                                name: eventName,
                                                data: {
                                                    name: monitorConfig.name,
                                                    monitorId: monitorConfig.mid || monitorConfig.id,
                                                },
                                                time: new Date(),
                                            })
                                        }
                                    break;
                                }
                                mqttSubs[mqttSubId].eventHandlers[eventName] = theAction
                            })
                            mqttSubs[mqttSubId].monitorsToRead = monitorsToRead;
                        }catch(err){
                            s.debugLog(err)
                            // s.systemLog(err)
                        }
                    })
                    s.group[groupKey].mqttOutbounderKeys = Object.keys(s.group[groupKey].mqttOutbounders)
                }else{
                    s.group[groupKey].mqttOutbounderKeys = []
                    allowedSend[groupKey] = false
                    registeredEndpoints[groupKey] = []
                }
            }
            const unloadMqttListBotForUser = function(user){
                const groupKey = user.ke
                const mqttSubs = s.group[groupKey].mqttOutbounders || {}
                Object.keys(mqttSubs).forEach(function(mqttSubId){
                    try{
                        mqttSubs[mqttSubId].client.end()
                    }catch(err){
                        s.debugLog(err)
                        // s.userLog({
                        //     ke: groupKey,
                        //     mid: '$USER'
                        // },{
                        //     type: lang['MQTT Error'],
                        //     msg: err
                        // })
                    }
                    delete(mqttSubs[mqttSubId])
                })
            }
            const onBeforeAccountSave = function(data){
                data.d.mqttout_list = []
            }
            const generalMessage = (groupKey, data = {}, files = []) => {
                if(allowedSend[groupKey]){
                    const {
                        senderName,
                        title,
                        text,
                        footer,
                        time,
                    } = parseMessageOptions(data);
                    for(let msgOptions of registeredEndpoints[groupKey]){
                        sendMessage(msgOptions,{
                            title: title,
                            name: title,
                            data: {
                                title,
                                text,
                                footer,
                            },
                            time: time,
                        })
                    }
                }
            }
            s.loadGroupAppExtender(loadMqttListBotForUser)
            s.unloadGroupAppExtender(unloadMqttListBotForUser)
            s.beforeAccountSave(onBeforeAccountSave)
            s.onTwoFactorAuthCodeNotification(onTwoFactorAuthCodeNotification)
            s.onEventTrigger(onEventTrigger)
            s.onEventTriggerBeforeFilter(onEventTriggerBeforeFilter)
            s.onDetectorNoTriggerTimeout(onDetectorNoTriggerTimeout)
            s.onMonitorSave(onMonitorSave)
            s.onMonitorStart(onMonitorStart)
            s.onMonitorStop(onMonitorStop)
            s.onMonitorDied(onMonitorDied)
            s.insertCompletedVideoExtender(insertCompletedVideoExtender)
            s.onEventBasedRecordingComplete(onEventBasedRecordingComplete)
            s.onUserLog(onUserLog)
            s.onTriggerNotificationSend(generalMessage)
            s.definitions["Monitor Settings"].blocks["Notifications"].info[0].info.push(
                {
                   "name": "detail=notify_mqttout",
                   "field": lang['MQTT Outbound'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "selector": "h_det_mqttout",
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
            )
            s.definitions["Monitor Settings"].blocks["Notifications"].info.push({
               "evaluation": "$user.details.use_mqttout !== '0'",
               isFormGroupGroup: true,
               "name": lang['MQTT Outbound'],
               "color": "blue",
               "section-class": "h_det_mqttout_input h_det_mqttout_1",
               "info": [
                   {
                      "name": "detail=detector_mqttout_timeout",
                      "field": lang['Allow Next Alert'] + ` (${lang['on Event']})`,
                      "description": "",
                      "default": "10",
                      "example": "",
                      "possible": ""
                   },
               ]
            })
            s.definitions["Account Settings"].blocks["2-Factor Authentication"].info.push({
                "name": "detail=factor_mqttout",
                "field": lang['MQTT Outbound'],
                "default": "1",
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
            })
            s.definitions["Account Settings"].blocks["MQTT Outbound"] = {
               "evaluation": "$user.details.use_mqttout !== '0'",
               "name": lang['MQTT Outbound'],
               "color": "blue",
               "info": [
                   {
                      "name": "detail=mqttout",
                      "selector":"u_mqttout",
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
                      "fieldType": "btn",
                      "class": `btn-success mqtt-out-add-row`,
                      "btnContent": `<i class="fa fa-plus"></i> &nbsp; ${lang['Add']}`,
                   },
                   {
                      "id": "mqttout_list",
                      "fieldType": "div",
                  },
                   {
                      "fieldType": "script",
                      "src": "assets/js/bs5.mqttOut.js",
                   }
               ]
            }
            s.definitions["Event Filters"].blocks["Action for Selected"].info.push({
                 "name": "actions=mqttout",
                 "field": lang['MQTT Outbound'],
                 "fieldType": "select",
                 "form-group-class": "actions-row",
                 "default": "",
                 "example": "1",
                 "possible": [
                    {
                       "name": lang['Original Choice'],
                       "value": "",
                       "selected": true
                    },
                    {
                       "name": lang.Yes,
                       "value": "1",
                    }
                 ]
            })
        }catch(err){
            console.error(err)
            console.log('Could not start MQTT Outbound Handling.')
        }
    }
}
