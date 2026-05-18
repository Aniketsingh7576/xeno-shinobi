function hasOnvifEventsEnabled(monitorConfig) {
    return monitorConfig.details.is_onvif === '1' && monitorConfig.details.onvif_events === '1';
}

module.exports = function (s, config, lang) {
    const { Cam } = require("onvif");
    const {
        triggerEvent,
    } = require('./utils.js')(s, config, lang)

    function handleEvent(event, monitorConfig, onvifEventLog, callback = () => {}) {
        try{
            const monitorId = monitorConfig.mid;
            const groupKey = monitorConfig.ke;
            s.runExtensionsForArray('onOnvifEventTrigger', null, [event, groupKey, monitorId]);
            const message = event.message && event.message.message ? event.message.message : event.message;
            if(!message){
                console.error(`Missing Message in ONVIF Event from ${monitorConfig.name}`)
                console.error(err)
                console.error(JSON.stringify(event,null,3))
                return
            }
            if(!message.source){
                // ignore event with no source
                return;
            }
            const topicInternalName = event.topic?._;
            const sourceSimpleItem = message.source?.simpleItem;
            const sourceSelected = (sourceSimpleItem instanceof Array ? sourceSimpleItem[sourceSimpleItem.length - 1] : sourceSimpleItem).$;
            const data = message.data?.simpleItem?.$;
            const topicShortName = sourceSelected.Value;
            const eventValue = data.Value;
            if(topicShortName === "Processor_Usage"){
                // ignore camera CPU stats
                return
            }else if (eventValue === false) {
                onvifEventLog(`ONVIF Event Stopped`, `topic ${topicInternalName}`)
                return
            }
            onvifEventLog(`ONVIF Event Detected!`, `topic ${topicInternalName}`)
            callback({
                f: 'trigger',
                id: monitorId,
                ke: groupKey,
                details: {
                    plug: 'onvifEvent',
                    name: 'onvifEvent',
                    reason: topicInternalName,
                    confidence: 100,
                    token: topicShortName,
                    [data.Name]: eventValue
                }
            })
        }catch(err){
            console.error(`Failure to parse ONVIF Event from ${monitorConfig.name}`)
            console.error(err)
            console.error(JSON.stringify(event,null,3))
        }
    }

    function configureOnvif(monitorConfig, onvifEventLog) {
        const controlBaseUrl = monitorConfig.details.control_base_url || s.buildMonitorUrl(monitorConfig, true)
        const controlURLOptions = s.cameraControlOptionsFromUrl(controlBaseUrl, monitorConfig)
        const onvifPort = parseInt(monitorConfig.details.onvif_port) || 8000

        const options = {
            hostname: controlURLOptions.host,
            username: controlURLOptions.username,
            password: controlURLOptions.password,
            port: onvifPort,
        };

        return new Cam(options, function (error) {
            if (error) {
                onvifEventLog(`ONVIF Event Error`,error)
                return
            }
            this.on('event', config.noEventTriggerForOnvifEvent ? function (event) {
                handleEvent(event, monitorConfig, onvifEventLog);
            } : function (event) {
                handleEvent(event, monitorConfig, onvifEventLog, triggerEvent);
            })
            this.on('eventsError', function (e) {
                onvifEventLog(`ONVIF Event Error`,e)
            })

        })
    }

    const cams = {};

    function initializeOnvifEvents(monitorConfig) {
        monitorConfig.key = `${monitorConfig.mid}${monitorConfig.ke}`

        const onvifEventLog = function onvifEventLog(type, data) {
            s.userLog({
                ke: monitorConfig.key,
                mid: monitorConfig.mid
            }, {
                type: type,
                msg: data
            })
        }

        if (!hasOnvifEventsEnabled(monitorConfig)) {
            cams[monitorConfig.key]?.removeAllListeners('event')
            return
        }
        if (cams[monitorConfig.key]) {
            onvifEventLog("ONVIF already listening to events")
            return;
        }

        cams[monitorConfig.key] = configureOnvif(monitorConfig,onvifEventLog);
    }

    s.onMonitorStart((monitorConfig) => {
        initializeOnvifEvents(monitorConfig)
    })

    const connectionInfoArray = s.definitions["Monitor Settings"].blocks["Detector"].info
    connectionInfoArray.splice(2, 0, {
        "name": "detail=onvif_events",
        "field": lang['ONVIF Events'],
        "default": "0",
        "form-group-class": "h_onvif_input h_onvif_1",
        "form-group-class-pre-layer": "h_det_input h_det_1",
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
    });
}
