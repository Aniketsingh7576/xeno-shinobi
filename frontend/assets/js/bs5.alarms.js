$(document).ready(function(e){
    var theEnclosure = $('#tab-alarms')
    var monitorsList = theEnclosure.find('.monitors_list')
    var dateSelector = theEnclosure.find('.date_selector')
    var alarmsDrawArea = $('#alarms_draw_area')
    var alarmsPreviewArea = $('#alarms_preview_area')
    var loadedAlarms = {};
    var eventOpensAlarm = false;
    const statusLegend = {
        '0': { label: lang.Attention,    color: 'danger' },
        '1': { label: lang.Acknowledged, color: 'info'   },
        '2': { label: lang.InProgress,   color: 'warning'},
        '3': { label: lang.Resolved,     color: 'success'},
        '4': { label: lang.Cleared,      color: 'light'  },
        '5': { label: lang.Dismissed,    color: 'secondary' },
        '6': { label: lang.Verified,     color: 'primary' },
        '7': { label: lang.Escalated,    color: 'danger' },
        '8': { label: lang.FalseAlarm,   color: 'dark'   }
    };
    function getAlarms(options = {}){
        return new Promise((resolve,reject) => {
            const { monitorId, start, startOperator } = options;
            $.getJSON(`${getApiPrefix(`alarms`)}/${monitorId ? monitorId : ''}`,options,function({ alarms }){
                options.noLimit = '1';
                // $.getJSON(`${getApiPrefix(`events`)}${monitorId ? monitorId : ''}`,options,function(eventData){
                //     var theEvents = eventData.events || eventData;
                //     alarms = applyDataListToVideos(videos,theEvents,'events')
                    resolve({ alarms })
                // })
            })
        })
    }
    async function drawAlarmsTable(usePreloadedData) {
        loadedAlarms = {}
        var dateRange = getSelectedTime(dateSelector);
        var start = dateRange.startDate;
        var end = dateRange.endDate;
        var monitorId = monitorsList.val();
        var { alarms } = await getAlarms({
            monitorId,
            start,
            end,
        });
        for(alarm of alarms){
            loadedAlarms[`${alarm.mid}${alarm.time}`] = alarm
        }
        alarmsDrawArea.bootstrapTable({
            pagination: true,
            search: true,
            pageList: [10, 25, 50, 100, 1000, 2000],
            totalRows: alarms.length,
            columns: [
                {
                    field: 'mid',
                    title: '',
                    checkbox: true,
                    formatter: () => {
                        return {
                            checked: false
                        };
                    },
                },
                {
                    field: 'Monitor',
                    title: '',
                },
                {
                    field: 'name',
                    title: lang['Name'],
                },
                {
                    field: 'time',
                    title: lang['Time'],
                },
                {
                    field: 'notes',
                    title: lang['Notes'],
                },
                {
                    field: 'editedBy',
                    title: lang['Edited By'],
                },
                {
                    field: 'status',
                    title: lang['Status'],
                },
                {
                    field: 'buttons',
                    title: ''
                }
            ],
            data: alarms.map((file) => {
                var loadedMonitor = loadedMonitors[file.mid];
                var status = statusLegend[file.status];
                return {
                    Monitor: loadedMonitor && loadedMonitor.name ? loadedMonitor.name : file.mid,
                    mid: file.mid,
                    name: file.name,
                    time: `
                           <div>${timeAgo(file.time)}</div>
                           <div><small><b>${lang.Start} :</b> ${formattedTime(file.time, 'DD-MM-YYYY hh:mm:ss AA')}</small></div>
                           <div><small><b>${lang.End} :</b> ${formattedTime(file.end, 'DD-MM-YYYY hh:mm:ss AA')}</small></div>`,
                    notes: file.notes,
                    editedBy: `${file.editedBy ? `<span class="badge badge-primary">${file.editedBy}</span>` : ''}`,
                    status: `<span class="badge badge-${status.color}">${status.label}</span>`,
                    buttons: `
                    <div class="row-info btn-group" data-mid="${file.mid}" data-ke="${file.ke}" data-time="${file.time}">
                        <a class="btn btn-sm btn-default btn-monitor-status-color preview-video" title="${lang.Play}"><i class="fa fa-play"></i></a>
                        <a class="btn btn-sm btn-default btn-monitor-status-color open-alarm-window" title="${lang.Alarm}"><i class="fa fa-pencil-square-o"></i></a>
                    </div>
                    `,
                }
            })
        })
    }
    function drawPreviewVideo(alarm, triggerVideoMonitorId){
        const monitorId = alarm.mid;
        const triggerVideo = alarm.videos[triggerVideoMonitorId || monitorId];
        if(triggerVideo){
            const href = getApiPrefix('videos') + '/'+monitorId+'/'+triggerVideo;
            alarmsPreviewArea.html(`<video class="video_video" style="width:100%" autoplay controls preload loop src="${href}"></video>`)
        }else{
            alarmsPreviewArea.text(lang['No Snippet Found'])
        }
    }
    function getSelectedRows(){
        var rowsSelected = []
        alarmsDrawArea.find('[name="btSelectItem"]:checked').each(function(n,checkbox){
            var rowInfo = $(checkbox).parents('tr').find('.row-info')
            var monitorId = rowInfo.attr('data-mid')
            var groupKey = rowInfo.attr('data-ke')
            var time = rowInfo.attr('data-time')
            rowsSelected.push({
                mid: monitorId,
                ke: groupKey,
                time: time,
            })
        })
        return rowsSelected
    }
    function createAlarmWindow(monitorId,time){
        var el = $(document)
        var width = el.width()
        var height = el.height()
        window.open(`${getApiPrefix('alarm')}/${monitorId}?time=${time}`, 'alarm_'+monitorId, 'height=800,width=1280')
    }
    loadDateRangePicker(dateSelector,{
        onChange: function(start, end, label) {
            alarmsDrawArea.bootstrapTable('destroy');
            drawAlarmsTable()
        }
    });
    monitorsList.change(function(){
        alarmsDrawArea.bootstrapTable('destroy');
        drawAlarmsTable();
    });
    $('body')
    theEnclosure
    .on('click','.preview-video',function(e){
        e.preventDefault()
        var el = $(this)
        var rowEl = $(this).parents('[data-mid]')
        var monitorId = rowEl.attr('data-mid')
        var alarmTime = rowEl.attr('data-time')
        var alarm = loadedAlarms[`${monitorId}${alarmTime}`]
        setPreviewedVideoHighlight(el,alarmsDrawArea)
        drawPreviewVideo(alarm)
        return false;
    })
    .on('click','.open-alarm-window',function(e){
        e.preventDefault()
        var el = $(this)
        var rowEl = $(this).parents('[data-mid]')
        var monitorId = rowEl.attr('data-mid')
        var alarmTime = rowEl.attr('data-time')
        createAlarmWindow(monitorId,alarmTime)
        return false;
    })
    .on('click','.refresh-data',function(e){
        e.preventDefault()
        alarmsDrawArea.bootstrapTable('destroy');
        drawAlarmsTable()
        return false;
    })
    .on('click','.delete-selected-videos',function(e){
        e.preventDefault()
        var videos = getSelectedRows()
        if(videos.length === 0)return;
        $.confirm.create({
            title: lang["Delete Alarms"],
            body: `${lang.DeleteTheseMsg}`,
            clickOptions: {
                title: '<i class="fa fa-trash-o"></i> ' + lang.Delete,
                class: 'btn-danger btn-sm'
            },
            clickCallback: function(){
                alert(`Delete Alarms!`)
            }
        });
        return false;
    })
    onWebSocketEvent((data) => {
        switch(data.f){
            case'detector_trigger':
                if(eventOpensAlarm)createAlarmWindow(data.id,data.time)
            break;
            case'alarm_created':
                console.log('Alarm Created', data)
            break;
            case'alarm_updated':
                console.log('Alarm Updated', data)
            break;
            case'alarm_deleted':
                console.log('Alarm Deleted', data)
            break;
        }
    })
    addOnTabOpen('alarms', function () {
        drawMonitorListToSelector(monitorsList,null,null,true)
        drawAlarmsTable()
    })
    addOnTabReopen('alarms', function () {
        var theSelected = `${monitorsList.val()}`
        drawMonitorListToSelector(monitorsList,null,null,true)
        monitorsList.val(theSelected)
    })
    addOnTabAway('alarms', function () {
        try{
            alarmsPreviewArea.find('video')[0].pause()
        }catch(err){

        }
    })
    dashboardSwitchCallbacks.alarmOpenedByEvent = function(toggleState){
        eventOpensAlarm = toggleState == 1;
    }
})
