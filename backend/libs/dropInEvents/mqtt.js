module.exports = (s,config,lang,app,io) => {
    if(config.mqttClient === true){
        console.log('Loading MQTT Inbound Connectivity...')
        const mqtt = require('mqtt')
        const {
            triggerEvent,
        } = require('../events/utils.js')(s,config,lang)
        function sendPlainEvent(options){
            const groupKey = options.ke
            const monitorId = options.mid || options.id
            const subKey = options.subKey
            const endpoint = options.host
            triggerEvent({
                id: monitorId,
                ke: groupKey,
                details: {
                    confidence: 100,
                    name: 'mqtt',
                    plug: endpoint,
                    reason: subKey
                },
            },config.mqttEventForceSaveEvent)
        }
        function sendFrigateEvent(data,options){
            const groupKey = options.ke
            const monitorId = options.mid || options.id
            const subKey = options.subKey
            const endpoint = options.host
            const frigateMatrix = data.after || data.before
            const confidenceScore = frigateMatrix.top_score * 100
            const activeZones = frigateMatrix.entered_zones.join(', ')
            const shinobiMatrix = {
                x: frigateMatrix.box[0],
                y: frigateMatrix.box[1],
                width: frigateMatrix.box[2],
                height: frigateMatrix.box[3],
                tag: frigateMatrix.label,
                confidence: confidenceScore,
            }
            triggerEvent({
                id: monitorId,
                ke: groupKey,
                details: {
                    confidence: confidenceScore,
                    name: 'mqtt-'+endpoint,
                    plug: subKey,
                    reason: activeZones,
                    matrices: [shinobiMatrix]
                },
            },config.mqttEventForceSaveEvent)
        }
        function createMqttSubscription(options){
            const mqttEndpoint = options.host
            const subKey = options.subKey
            const groupKey = options.ke
            const onData = options.onData || function(){}
            s.debugLog('Connecting.... mqtt://' + mqttEndpoint)
            const client  = mqtt.connect('mqtt://' + mqttEndpoint)
            client.on('connect', function () {
                s.debugLog('Connected! mqtt://' + mqttEndpoint)
                client.subscribe(subKey, function (err) {
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
        // const onEventTrigger = async () => {}
        // const onMonitorUnexpectedExit = (monitorConfig) => {}
        const loadMqttListBotForUser = function(user){
            const groupKey = user.ke
            const userDetails = s.parseJSON(user.details);
            if(userDetails.mqttclient === '1'){
                const mqttClientList = userDetails.mqttclient_list || []
                if(!s.group[groupKey].mqttSubscriptions)s.group[groupKey].mqttSubscriptions = {};
                const mqttSubs = s.group[groupKey].mqttSubscriptions
                mqttClientList.forEach(function(row,n){
                    try{
                        const mqttSubId = `${row.host} ${row.subKey}`
                        const messageConversionTypes = row.type || []
                        const monitorsToTrigger = row.monitors || []
                        const triggerAllMonitors = monitorsToTrigger.indexOf('$all') > -1
                        const doActions = []
                        const onData = (data) => {
                            doActions.forEach(function(theAction){
                                theAction(data)
                            })
                            s.debugLog('MQTT Data',row,data)
                        }
                        if(mqttSubs[mqttSubId]){
                            mqttSubs[mqttSubId].end()
                            delete(mqttSubs[mqttSubId])
                        }
                        messageConversionTypes.forEach(function(type){
                            switch(type){
                                case'plain':
                                    doActions.push(function(data){
                                         // data is unused for plain event.
                                         let listOfMonitors = monitorsToTrigger
                                         if(triggerAllMonitors){
                                             const activeMonitors = Object.keys(s.group[groupKey].activeMonitors)
                                             listOfMonitors = activeMonitors
                                         }
                                         listOfMonitors.forEach(function(monitorId){
                                             sendPlainEvent({
                                                 host: row.host,
                                                 subKey: row.subKey,
                                                 ke: groupKey,
                                                 mid: monitorId
                                             })
                                         })
                                    })
                                break;
                                case'frigate':
                                    // https://docs.frigate.video/integrations/mqtt/#frigateevents
                                    doActions.push(function(data){
                                         // this handler requires using frigate/events
                                         // only "new" events will be captured.
                                         if(data.type === 'new'){
                                             let listOfMonitors = monitorsToTrigger
                                             if(triggerAllMonitors){
                                                 const activeMonitors = Object.keys(s.group[groupKey].activeMonitors)
                                                 listOfMonitors = activeMonitors
                                             }
                                             listOfMonitors.forEach(function(monitorId){
                                                 sendFrigateEvent(data,{
                                                     host: row.host,
                                                     subKey: row.subKey,
                                                     ke: groupKey,
                                                     mid: monitorId
                                                 })
                                             })
                                         }
                                    })
                                break;
                            }
                        })
                        mqttSubs[mqttSubId] = createMqttSubscription({
                            host: row.host,
                            subKey: row.subKey,
                            ke: groupKey,
                            onData: onData,
                        })
                    }catch(err){
                        s.debugLog(err)
                        // s.systemLog(err)
                    }
                })
            }
        }
        const unloadMqttListBotForUser = function(user){
            const groupKey = user.ke
            const mqttSubs = s.group[groupKey].mqttSubscriptions || {}
            Object.keys(mqttSubs).forEach(function(mqttSubId){
                try{
                    mqttSubs[mqttSubId].end()
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
            data.d.mqttclient_list = []
        }
        s.loadGroupAppExtender(loadMqttListBotForUser)
        s.unloadGroupAppExtender(unloadMqttListBotForUser)
        s.beforeAccountSave(onBeforeAccountSave)
        // s.onEventTrigger(onEventTrigger)
        // s.onMonitorUnexpectedExit(onMonitorUnexpectedExit)
        s.definitions["Account Settings"].blocks["MQTT Inbound"] = {
           "evaluation": "$user.details.use_mqttclient !== '0'",
           "name": lang['MQTT Inbound'],
           "color": "green",
           "info": [
               {
                  "name": "detail=mqttclient",
                  "selector":"u_mqttclient",
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
                  "class": `btn-success mqtt-add-row`,
                  "btnContent": `<i class="fa fa-plus"></i> &nbsp; ${lang['Add']}`,
               },
               {
                  "id": "mqttclient_list",
                  "fieldType": "div",
               },
               {
                  "fieldType": "script",
                  "src": "assets/js/bs5.mqtt.js",
               }
           ]
        }
    }
}
