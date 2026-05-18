module.exports = function(s,config,lang,app){
    if(config.alarmManagement){
        const {
            getAlarm,
            createAlarm,
            updateAlarm,
            deleteAlarm,
            sanitizeOperator,
        } = require('./events/alarms.js')(s,config,lang);
        const {
            getAssociatedMonitorPtzTargets,
            getEventBasedRecordingsUponCompletion,
        } = require('./events/utils.js')(s,config,lang)
        const {
            addMenuItem,
        } = require('../definitions/fieldValues.js')(s,config,lang);
        if(config.renderPaths.alarmPopup === undefined){config.renderPaths.alarmPopup='pages/alarmPopup'};
        const onGoingAlarms = {};
        const onGoingAlarmTimeouts = {};

        function sendWebsocketMessage(type, data){
            const sendData = Object.assign({ f: type }, data)
            s.tx(sendData,`GRP_${data.ke}`);
        }

        s.onEventTrigger(function(d,filter,eventTime){
            const groupKey = d.ke
            const monitorId = d.id || d.mid;
            const alarmTarget = `${groupKey}${monitorId}`
            if(!onGoingAlarms[alarmTarget]){
                const startTime = s.formattedTime(eventTime);
                onGoingAlarms[alarmTarget] = { startTime };
                const createData = {
                    ke: groupKey,
                    mid: monitorId,
                    time: startTime,
                    details: d.details
                };
                const associatedMonitors = [monitorId, ...Object.keys(getAssociatedMonitorPtzTargets(groupKey, monitorId))]
                createAlarm(createData)
                sendWebsocketMessage('alarm_updated',createData)
                getEventBasedRecordingsUponCompletion(groupKey, associatedMonitors, false, true, true).then((recordedFiles) => {
                    const updateData = {
                        ke: groupKey,
                        mid: monitorId,
                        time: startTime,
                        videos: recordedFiles,
                    }
                    updateAlarm(updateData);
                    sendWebsocketMessage('alarm_updated',updateData)
                })
            }
            clearTimeout(onGoingAlarmTimeouts[alarmTarget])
            onGoingAlarmTimeouts[alarmTarget] = setTimeout(() => {
                const { startTime } = onGoingAlarms[alarmTarget];
                const endTime = new Date();
                const updateData = {
                    ke: groupKey,
                    mid: monitorId,
                    time: startTime,
                    end: s.formattedTime(endTime)
                }
                updateAlarm(updateData).then(() => {
                    sendWebsocketMessage('alarm_updated',updateData)
                    delete(onGoingAlarms[alarmTarget]);
                    delete(onGoingAlarmTimeouts[alarmTarget]);
                })
            },10000)
        })

        /**
        * API : Get Alarm(s)
         */
        app.get([
    		config.webPaths.apiPrefix+':auth/alarms/:ke',
    		config.webPaths.apiPrefix+':auth/alarms/:ke/:id',
    	], function (req,res){
            res.setHeader('Content-Type', 'application/json');
            s.auth(req.params, async function(user){
                const monitorId = req.params.id
                const groupKey = req.params.ke
                const {
                    monitorPermissions,
                    monitorRestrictions,
                } = s.getMonitorsPermitted(user.details,monitorId)
                const {
                    isRestricted,
                    isRestrictedApiKey,
                    apiKeyPermissions,
                } = s.checkPermission(user)
                if(
                    isRestrictedApiKey && apiKeyPermissions.get_alarms_disallowed ||
                    isRestricted && (
                        monitorId && !monitorPermissions[`${monitorId}_get_alarms`] ||
                        monitorRestrictions.length === 0
                    )
                ){
                    s.closeJsonResponse(res,{ok: false, msg: lang['Not Authorized'], alarms: []});
                    return
                }
                const { name, start, startOperator, end, endOperator, limit } = req.query;
                const response = { ok: true }
                const rows = await getAlarm({
                    ke: groupKey,
                    mid: monitorId,
                    name,
                    start,
                    end,
                    startOperator: sanitizeOperator(startOperator),
                    endOperator: sanitizeOperator(endOperator),
                    limit,
                });
                response.alarms = rows;
                s.closeJsonResponse(res,response)
            })
        })
        /**
        * API : Update Alarm
         */
        app.post(config.webPaths.apiPrefix+':auth/alarms/:ke/:id', function (req,res){
            res.setHeader('Content-Type', 'application/json');
            s.auth(req.params, async function(user){
                const monitorId = req.params.id
                const groupKey = req.params.ke
                const {
                    monitorPermissions,
                    monitorRestrictions,
                } = s.getMonitorsPermitted(user.details,monitorId)
                const {
                    isRestricted,
                    isRestrictedApiKey,
                    apiKeyPermissions,
                } = s.checkPermission(user)
                if(
                    isRestrictedApiKey && apiKeyPermissions.edit_alarms_disallowed ||
                    isRestricted && (
                        monitorId && !monitorPermissions[`${monitorId}_edit_alarms`] ||
                        monitorRestrictions.length === 0
                    )
                ){
                    s.closeJsonResponse(res,{ok: false, msg: lang['Not Authorized'], alarms: []});
                    return
                }
                const { name, videos, videoTime, notes, status, editedBy, details, time, start, end } = req.body;
                const response = await updateAlarm({
                    ke: groupKey,
                    mid: monitorId,
                    name,
                    videos: s.parseJSON(videos),
                    videoTime,
                    notes,
                    status,
                    editedBy: user.uid,
                    details,
                    time,
                    start,
                    end,
                });
                s.closeJsonResponse(res,response)
            })
        })
        /**
        * Page : Get Alarm Popup Window
         */
        app.get([config.webPaths.apiPrefix+':auth/alarm/:ke/:id',config.webPaths.apiPrefix+':auth/alarm/:ke/:id/:addon'], function (req,res){
            s.auth(req.params,function(user){
                const { auth: authKey, ke: groupKey, id: monitorId } = req.params;
                var $user = {
                    auth_token: authKey,
                    ke: groupKey,
                    uid: user.uid,
                    mail: user.mail,
                    details: {},
                };
                s.renderPage(req,res,config.renderPaths.alarmPopup,{
                    forceUrlPrefix: req.query.host || '',
                    protocol: req.protocol,
                    baseUrl: req.protocol+'://'+req.hostname,
                    config: s.getConfigWithBranding(req.hostname),
                    define: s.getDefinitonFile(user.details ? user.details.lang : config.lang),
                    lang,
                    $user,
                    groupKey,
                    monitorId,
                    monitor: Object.assign({},s.group[groupKey].rawMonitorConfigurations[monitorId]),
                    originalURL: s.getOriginalUrl(req)
                });
            },res,req);
        });
        //
        addMenuItem({
            icon: 'pencil-square-o',
            label: `${lang['Alarms']}`,
            pageOpen: 'alarms',
            addUl: true,
            ulItems: [
                {
                    label: lang['Event Opens Alarm'],
                    class: 'cursor-pointer',
                    attributes: 'shinobi-switch="alarmOpenedByEvent" ui-change-target=".dot" on-class="dot-green" off-class="dot-grey"',
                    color: 'grey',
                },
            ]
        },'videosTableView');
        config.webBlocksPreloaded.push('home/alarms');
    }
}
