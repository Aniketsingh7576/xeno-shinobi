$(document).ready(function(){
    var theWindow = $('#tab-eventListWithPics')
    var monitorSelector = $('#eventListWithPics-monitors-list')
    var rowContainer = $('#eventListWithPics-rows')
    var dateSelector = $('#eventListWithPics-daterange')
    var theForm = theWindow.find('form')
    var loadedEventsInMemory = {}
    loadDateRangePicker(dateSelector,{
        startDate: moment().subtract(moment.duration("5:00:00")),
        endDate: moment().add(moment.duration("24:00:00")),
        timePicker: true,
        timePicker24Hour: true,
        timePickerSeconds: true,
        timePickerIncrement: 30,
        onChange: function(start, end, label) {
            drawDataRows()
        }
    })
    function drawDataRows(){
        var selectedMonitorType = monitorSelector.val()
        selectedMonitorType = selectedMonitorType === 'all' ? '' : selectedMonitorType
        var dateRange = getSelectedTime(dateSelector)
        getEvents({
            monitorId: selectedMonitorType,
            limit: 50,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
        },function(response){
            drawEventRowsToList(rowContainer,response.events)
        })
    }
    function applyVideosToEventsList(videos,events){
        var updatedVideos = videos.concat([])
        var currentEvents = events.concat([])
        currentEvents.forEach(function(theEvent,index){
            updatedVideos.forEach(function(video,videoIndex){
                var startTime = new Date(video.time)
                var endTime = new Date(video.end)
                var eventTime = new Date(theEvent.time)
                if(eventTime >= startTime && eventTime <= endTime){
                    currentEvents[index].videoAssociated = video
                }
            })
        })
        return currentEvents
    }
    function createEventRow(row,theVideoList){
        var matrices = row.details.matrices
        var hasRows = matrices && matrices.length > 0
        var video = row.videoAssociated
        var imagePath = `${formattedTimeForFilename(row.time,false,'YYYY-MM-DD')}/${formattedTimeForFilename(row.time,false,'YYYY-MM-DDTHH-mm-ss')}.jpg`
        if(hasRows){false
            var eventMatrixHtml = ``
            var objectsFound = {}
            eventMatrixHtml += `<table class="table table-striped mb-0">`
                $.each(matrices,function(n,matrix){
                    if(!objectsFound[matrix.tag])objectsFound[matrix.tag] = 1
                    ++objectsFound[matrix.tag]
                })
                $.each(objectsFound,function(tag,count){
                    eventMatrixHtml += `<tr>
                        <td class="text-white" style="text-transform:capitalize">${tag}</td>
                        <td class="text-end"><span class="badge bg-light text-dark rounded-pill">${count}</span></td>
                    </tr>`
                })
                eventMatrixHtml += `</table>`
        }
        var html = `
        <div class="col-md-12 mb-3 col-lg-6 search-row" data-mid="${row.mid}" data-time="${row.time}">
            <div class="card shadow-lg px-0 btn-default">
                <div class="card-header d-flex flex-row">
                    <div class="flex-grow-1 text-white">
                        ${loadedMonitors[row.mid] ? loadedMonitors[row.mid].name : row.mid}
                    </div>
                        ${video ? `
                            <div data-mid="${video.mid}" data-time="${video.time}">
                                <a class="badge btn btn-primary open-video mr-1" title="${lang['Watch']}"><i class="fa fa-play-circle"></i></a>
                                <a class="badge btn btn-success" download href="${getApiPrefix('videos') + '/' + video.mid + '/' + video.filename}" title="${lang['Download']}"><i class="fa fa-download"></i></a>
                            </div>
                        ` : ``}
                </div>
                <div class="card-image" style="position:relative">
                    <img style="max-width:100%;display:none" src="${getApiPrefix('timelapse')}/${row.mid}/${imagePath}">
                    <div class="stream-objects"></div>
                </div>
                <div class="card-body">
                    <div title="${row.time}" class="d-flex flex-row">
                        <div class="flex-grow-1">
                            ${moment(row.time).fromNow()}
                        </div>
                    </div>
                    <div title="${row.time}" class="d-flex flex-row border-bottom-dotted border-bottom-dark">
                        <div>
                            <small title="${row.time}">${formattedTime(row.time,true)}</small>
                        </div>
                        <div class="flex-grow-1 text-center">
                        </div>
                    </div>
                </div>
                ${hasRows ? `<div class="card-footer p-0">${eventMatrixHtml}</div>` : ``}
            </div>
        </div>`
        theVideoList.append(html)
        var theCard = theVideoList.find(`[data-mid="${row.mid}"][data-time="${row.time}"]`)
        var theImage = theCard.find(`img`)
        theImage.on('load',function(){
            theImage.show()
            var cardObjectContainer = theCard.find(`.stream-objects`)
            var videoHeight = cardObjectContainer.height()
            var videoWidth = cardObjectContainer.width()
            drawMatrices(row,{
                theContainer: cardObjectContainer,
                height: videoHeight,
                width: videoWidth,
            })
        }).on('error',function(){
            theImage.remove()
        })
    }
    function drawEventRowsToList(targetElement,rows){
        var theVideoList = $(targetElement)
        theVideoList.empty()
        $.each(rows,function(n,row){
            createEventRow(row,theVideoList)
        })
        liveStamp()
    }
    function getEvents(options,callback){
        loadedEventsInMemory = {}
        options = options ? options : {}
        var requestQueries = []
        var monitorId = options.monitorId
        var limit = options.limit || 5000
        var eventStartTime
        var eventEndTime
        // var startDate = options.startDate
        // var endDate = options.endDate
        if(options.startDate){
            eventStartTime = formattedTimeForFilename(options.startDate,false)
            requestQueries.push(`start=${eventStartTime}`)
        }
        if(options.endDate){
            eventEndTime = formattedTimeForFilename(options.endDate,false)
            requestQueries.push(`end=${eventEndTime}`)
        }
        $.getJSON(`${getApiPrefix(`videos`)}${monitorId ? `/${monitorId}` : ''}?${requestQueries.concat([`limit=${limit}`]).join('&')}`,function(data){
            var videos = data.videos
            $.getJSON(`${getApiPrefix(`events`)}${monitorId ? `/${monitorId}` : ''}?${requestQueries.join('&')}`,function(eventData){
                var newEventList = applyVideosToEventsList(videos,eventData)
                $.each(newEventList,function(n,event){
                    loadedEventsInMemory[`${event.mid}${event.time}`] = event
                })
                callback({events: newEventList})
            })
        })
    }
    addOnTabOpen('eventListWithPics',function(){
        monitorSelector.find('optgroup option').remove()
        var html = ''
        $.each(loadedMonitors,function(n,v){
            html += createOptionHtml({
                value: v.mid,
                label: v.name,
            })
        })
        monitorSelector.find('optgroup').html(html)
        drawDataRows()
    })
    theForm.submit(function(e){
        e.preventDefault()
        drawDataRows()
        return false
    })
})
