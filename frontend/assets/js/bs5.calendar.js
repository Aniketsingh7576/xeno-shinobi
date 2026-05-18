$(document).ready(function(e){
    //Timelapse JPEG Window
    var theEnclosure = $('#tab-calendarView')
    var monitorsList = theEnclosure.find('.monitors_list')
    var dateSelector = theEnclosure.find('.date_selector')
    var calendarDrawArea = $('#calendar_draw_area')
    var loadedVideosInMemory = {};
    loadDateRangePicker(dateSelector,{
        onChange: function(start, end, label) {
            drawCalendarViewElements()
        }
    })
    monitorsList.change(function(){
        drawCalendarViewElements()
    })
    function drawCalendarViewElements(selectedMonitor,startDate,endDate){
        var dateRange = getSelectedTime(dateSelector)
        if(!startDate)startDate = dateRange.startDate
        if(!endDate)endDate = dateRange.endDate
        if(!selectedMonitor)selectedMonitor = monitorsList.val()
        var queryString = ['start=' + startDate,'end=' + endDate,'limit=0']
        var frameIconsHtml = ''
        var apiURL = getApiPrefix('videos') + '/' + selectedMonitor;
        var calendarData = []
        loadedVideosInMemory = {}
        $.getJSON(apiURL + '?' + queryString.join('&'),function(data){
            $.each(data.videos,function(n,v){
                if(v.status !== 0){
                    loadedVideosInMemory[`${v.mid}${v.time}${v.type}`] = Object.assign({},v)
                    var loadedMonitor = loadedMonitors[v.mid]
                    if(loadedMonitor){
                        v.title = loadedMonitor.name+' - '+(parseInt(v.size)/1048576).toFixed(2)+'mb';
                    }
                    v.start = moment.utc(v.time).local()
                    v.end = moment.utc(v.end).local()
                    calendarData.push(v)
                }
            })
            try{
                calendarDrawArea.fullCalendar('destroy')
            }catch(er){

            }
            calendarDrawArea.fullCalendar({
                header: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'month,agendaWeek,agendaDay,listWeek'
                },
                defaultDate: dateRange.startDateMoment.format('YYYY-MM-DD'),
                locale: ($user.details.lang || '').substring(0, 2) || undefined,
                navLinks: true,
                eventLimit: true,
                events: calendarData,
                eventClick: function(v){
                    var video = loadedVideosInMemory[`${v.mid}${v.time}${v.type}`]
                    var href = video.href
                    createVideoPlayerTab(Object.assign({},video,{href: href}))
                    $(this).css('border-color', 'red');
                }
            });

        })
    }

    $('body').on('click','.open-timelapse-viewer',function(){
        var el = $(this).parents('[data-mid]')
        var monitorId = el.attr('data-mid')
        openTab(`calendarView`,{},null)
        monitorsList.val(monitorId).change()
    })
    theEnclosure
    .on('click','.refresh-data',function(e){
        e.preventDefault()
        drawCalendarViewElements()
        return false;
    })
    addOnTabOpen('calendarView', function () {
        drawMonitorListToSelector(monitorsList)
        drawCalendarViewElements()
    })
    addOnTabReopen('calendarView', function () {
        var theSelected = `${monitorsList.val()}`
        drawMonitorListToSelector(monitorsList)
        monitorsList.val(theSelected)
        drawCalendarViewElements()
    })
})
