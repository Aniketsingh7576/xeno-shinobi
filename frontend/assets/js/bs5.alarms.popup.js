addExtender('onDashboardReady')
$(document).ready(function(){
    PNotify.prototype.options.styling = "fontawesome";
    var alarmContainer = $('#alarm-container')
    var alarmLiveStream = $('#alarm-live-stream')
    var alarmLiveStreamPtz = $('#alarm-live-stream-ptz')
    var alarmVideoPlayerContainer = $('#alarm-video')
    var alarmTitle = $('#alarm-title')
    var alarmName = $('#alarm-name')
    var alarmNotes = $('#alarm-notes')
    var alarmStatus = $('#alarm-status')
    var alarmVideos = $('#alarm-videos')
    var alarmUpdateForm = $('#alarm-update-form')
    var alarmTime = getQueryString().time;
    var websocketPath = checkCorrectPathEnding(urlPrefix.replace(location.origin, '')) + 'socket.io'
    function getApiPrefix(innerPart){
        return `${urlPrefix}${authKey}${innerPart ? `/${innerPart}/${groupKey}` : ''}`
    }
    function getAlarms(options = {}){
        return new Promise((resolve,reject) => {
            const { start, startOperator } = options;
            $.getJSON(`${getApiPrefix(`alarms`)}/${monitorId}`,options,function({ alarms }){
                if(startOperator === '='){
                    options.end = alarms[0].end;
                    options.limit = '1';
                }else{
                    options.noLimit = '1';
                }
                options.startDate = start
                $.getJSON(`${getApiPrefix(`events`)}/${monitorId}`,options,function(eventData){
                    var theEvents = eventData.events || eventData;
                    alarms = applyDataListToVideos(alarms,theEvents,'events')
                    resolve({ alarms })
                })
            })
        })
    }
    function updateAlarm(form){
        return new Promise((resolve,reject) => {
            form.time = formattedTimeForFilename(convertTZ(alarmTime, serverTimezone),null,'YYYY-MM-DDTHH:mm:ss')
            $.post(`${getApiPrefix(`alarms`)}/${form.mid}`,form,function(response){
                resolve(response)
            })
        })
    }
    function getMonitor(monitorId){
        return new Promise((resolve,reject) => {
            $.getJSON(`${getApiPrefix(`monitor`)}/${monitorId}`,function(monitors){
                resolve(monitors[0])
            })
        })
    }
    async function getAlarm(startTime){
        const time = formattedTimeForFilename(convertTZ(startTime, serverTimezone),null,'YYYY-MM-DDTHH:mm:ss')
        const alarm = (await getAlarms({ start: time, startOperator: '=' })).alarms[0];
        return alarm;
    }
    function drawLiveStream(monitorId, drawEl){
        var embedHost = getQueryString().host || `/`;
        drawEl.html(`<div class="alarm-live-video p-0 m-0" live-stream="${monitorId}"><iframe src="${getApiPrefix('embed')}/${monitorId}/fullscreen%7Cjquery%7Crelative?host=${embedHost}"></iframe></div>`)
    }
    function drawAlarmInfo(alarm){
        const time = formattedTime(alarm.time, true)
        alarmTitle.text(`${alarm.name ? `${alarm.name || ''} : ` : ''}${time}`)
        alarmName.val(alarm.name)
        alarmNotes.val(alarm.notes)
        alarmStatus.val(alarm.status)
    }
    async function drawAlarmVideoLinks(alarm){
        const videos = alarm.videos || {};
        let html = ''
        for(monitorId in videos){
            const gottenMonitor = await getMonitor(monitorId)
            const videoName = videos[monitorId]
            html += `<li><a data-mid="${monitorId}" data-filename="${videoName}" class="btn preview-video">${gottenMonitor.name}</a></li>`
        }
        alarmVideos.html(html)
    }
    function drawVideoPlayer(alarm, triggerVideoMonitorId, videoName){
        const monitorId = alarm.mid;
        const chosenMonitorId = triggerVideoMonitorId || monitorId;
        const triggerVideo = videoName || alarm.videos[chosenMonitorId] || alarm.videos[monitorId];
        if(triggerVideo){
            const href = getApiPrefix('videos') + '/'+monitorId+'/'+triggerVideo;
            alarmVideoPlayerContainer.html(`<a download href="${href}" class="btn btn-success download"><i class="fa fa-download"></i></a><video class="video_video" autoplay controls preload loop muted src="${href}"></video>`)
        }
    }
    async function displayAlarm(startTime){
        const associatedPtzMonitorId = getAssociatedMonitorPtzTargets(true)[0]
        const alarm = await getAlarm(startTime);
        drawAlarmInfo(alarm);
        drawLiveStream(monitorId, alarmLiveStream);
        drawAlarmVideoLinks(alarm);
        if(associatedPtzMonitorId){
            drawLiveStream(associatedPtzMonitorId, alarmLiveStreamPtz)
            setGamepadMonitorSelection(associatedPtzMonitorId)
        }
        if(alarm.videos[associatedPtzMonitorId]){
            drawVideoPlayer(alarm, associatedPtzMonitorId);
        }else{
            drawVideoPlayer(alarm, monitorId);
        }
    }
    function getAssociatedMonitorPtzTargets(monitorIdsOnly){
        const monitorDetails = monitor.details;
        const detectorEventPtz = monitorDetails.detectorEventPtz === '1';
        if(detectorEventPtz){
            const triggerMonitorsPtzTargets = monitorDetails.triggerMonitorsPtzTargets || {}
            return monitorIdsOnly ? Object.keys(triggerMonitorsPtzTargets) : triggerMonitorsPtzTargets;
        }else{
            return monitorIdsOnly ? [] : {}
        }
    }
    async function initPopup(){
        if(alarmTime){
            await displayAlarm(alarmTime);
            executeExtender('onDashboardReady')
        }else{
            alarmTitle.html(lang['No Data'])
        }
    }
    alarmContainer.on('click','.preview-video',function(){
        const el = $(this);
        const monitorId = el.attr('data-mid')
        const videoName = el.attr('data-filename')
        drawVideoPlayer({ mid: monitorId }, monitorId, videoName)
    })
    alarmUpdateForm.find('.submit').click(function(e){
        alarmUpdateForm.submit()
    })
    alarmUpdateForm.submit(function(e){
        e.preventDefault();
        updateAlarm({
            mid: monitorId,
            time: alarmTime,
            name: alarmName.val(),
            notes: alarmNotes.val(),
            status: alarmStatus.val(),
        }).then(response => {
            if(response.ok){
                new PNotify({ title: lang.Saved, type: 'success' })
            }
        })
        return false;
    })
    $(window).focus(function() {
        windowFocus = true
        executeExtender('windowFocus')
    }).blur(function() {
        windowFocus = false
        executeExtender('windowBlur')
    })
    onWebSocketEvent((data) => {
        switch(data.f){
            case'init_success':
            break;
            case'alarm_created':
                console.log('Alarm Created', data)
            break;
            case'alarm_updated':
                const time = data.time
                const thisTime = formattedTimeForFilename(convertTZ(alarmTime, serverTimezone),null,'YYYY-MM-DDTHH-mm-ss')
                if(data.videos && thisTime === time){
                    const associatedPtzMonitorId = getAssociatedMonitorPtzTargets(true)[0]
                    drawVideoPlayer(data, associatedPtzMonitorId)
                    drawAlarmVideoLinks(data)
                }
            break;
            case'alarm_deleted':
                console.log('Alarm Deleted', data)
            break;
        }
    })
    createWebsocket(location.origin,{
        path: websocketPath
    });
    initPopup()
});
