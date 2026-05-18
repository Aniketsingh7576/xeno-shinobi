$(document).ready(function(){
    var theEnclosure = $('#tab-studio')
    var viewingCanvas = $('#studioViewingCanvas')
    var timelineStrip = $('#studioTimelineStrip')
    var seekTick = $('#studio-seek-tick')
    var completedVideosList = $('#studio-completed-videos')
    var timelineStripTimeTicksContainer = $('#studio-time-ticks')
    var timelineStripSliceSelection = $('#studio-slice-selection')
    var stripWidth = timelineStrip.width()
    var loadedVideoForSlicer = null
    var loadedVideoElement = null
    var timelineStripMousemoveX = 0
    var timelineStripMousemoveY = 0
    var userInvokedPlayState = false
    var slicerQueue = {}
    var changeTimeout
    function setMoveTimeout(){
        clearTimeout(changeTimeout)
        changeTimeout = setTimeout(function(){
            changeTimeout = null
        },500)
    }
    function initStudio(){
        var lastStartTime = 0
        var lastEndTime = 0
        function onChange(){
            setMoveTimeout()
            var data = getSliceSelection()
            var startTime = data.startTimeSeconds
            var endTime = data.endTimeSeconds
            if(lastStartTime === startTime && lastEndTime !== endTime){
                setSeekPosition(endTime)
            }else{
                setSeekPosition(startTime)
            }
            lastStartTime = parseFloat(startTime)
            lastEndTime = parseFloat(endTime)
            setSeekRestraintOnVideo()
        }
        timelineStripSliceSelection.resizable({
            containment: '#studioTimelineStrip',
            handles: "e,w",
        });
        timelineStripSliceSelection.resize(function(){
            setMoveTimeout()
            onChange()
        })
        timelineStripSliceSelection.draggable({
            containment: '#studioTimelineStrip',
            axis: "x",
            start: function(){
                changeTimeout = true
            },
            drag: onChange,
            stop: function(){
                changeTimeout = null
            }
        });
    }
    function validateTimeSlot(timeValue){
        var roundedValue = Math.round(timeValue)
        return `${roundedValue}`.length === 1 ? `0${roundedValue}` :  roundedValue
    }
    function getTimeInfo(timePx){
        var timeDifference = loadedVideoElement.duration
        var timePercent = timePx / stripWidth * 100
        var timeSeconds = (timeDifference * (timePercent / 100))
        // var timeMinutes = parseInt(timeSeconds / 60)
        // var timeLastSeconds = timeSeconds - (timeMinutes * 60)
        // var timestamp = `00:${validateTimeSlot(timeMinutes)}:${validateTimeSlot(timeLastSeconds)}`
        return {
            timePercent,
            timeSeconds,
            // timeMinutes,
            // timeLastSeconds,
            // timestamp,
        }
    }
    function getSliceSelection(){
        var amountOfSecondsBetween = loadedVideoElement.duration
        //
        var startTimePx = timelineStripSliceSelection.position().left
        var startTimeInfo = getTimeInfo(startTimePx)
        //
        var endTimePx = startTimePx + timelineStripSliceSelection.width()
        var endTimeInfo = getTimeInfo(endTimePx)
        return {
            // startTimestamp: startTimeInfo.timestamp,
            // endTimestamp: endTimeInfo.timestamp,
            startTimeSeconds: startTimeInfo.timeSeconds,
            endTimeSeconds: endTimeInfo.timeSeconds
        }
    }
    function sliceVideo(){
        var video = Object.assign({},loadedVideoForSlicer)
        var monitorId = video.mid
        var filename = video.filename
        var groupKey = video.ke
        const sliceInfo = getSliceSelection()
        $.get(`${getApiPrefix('videos')}/${monitorId}/${filename}/slice?startTime=${sliceInfo.startTimeSeconds}&endTime=${sliceInfo.endTimeSeconds}`,function(data){
            console.log('sliceVideo',data)
        })
    }
    function drawTimeTicks(video){
        var amountOfSecondsBetween = loadedVideoElement.duration
        var tickDivisor = amountOfSecondsBetween > 60 * 60 ? 500 : amountOfSecondsBetween > 60 ? 100 : amountOfSecondsBetween > 30 ? 20 : 2
        var numberOfTicks = amountOfSecondsBetween / tickDivisor
        var tickStripWidth = timelineStripTimeTicksContainer.width()
        var tickSpacingWidth = tickStripWidth / numberOfTicks
        var tickSpacingPercent = tickSpacingWidth / tickStripWidth * 100
        var tickHtml = ''
        for (let i = 1; i < numberOfTicks; i++) {
            var tickPercent = tickSpacingPercent * i
            var numberOfSecondsForTick = parseInt(amountOfSecondsBetween / numberOfTicks) * i;

            tickHtml += `<div class="tick" style="left:${tickPercent}%"><span>${numberOfSecondsForTick}s</span></div>`;
        }
        timelineStripTimeTicksContainer.html(tickHtml)
    }
    function createVideoElement(video){
        var html = `<video class="video_video" controls src="${video.href}"></video>`
        viewingCanvas.html(html)
        var videoElement = theEnclosure.find('video')
        loadedVideoElement = videoElement[0]
    }
    function updateSeekTickPosition(){
        const percentMoved = loadedVideoElement.currentTime / loadedVideoElement.duration * 100
        seekTick.css('left',`${percentMoved}%`)
    }
    function setSeekRestraintOnVideo(){
        var data = getSliceSelection()
        var startTime = data.startTimeSeconds
        var endTime = data.endTimeSeconds
        console.log(data)

        loadedVideoElement.ontimeupdate = (event) => {
            updateSeekTickPosition()
            if(loadedVideoElement.currentTime <= startTime){
                loadedVideoElement.currentTime = startTime
            }else if(loadedVideoElement.currentTime >= endTime){
                loadedVideoElement.currentTime = startTime
                // pauseVideo()
            }
        };
        loadedVideoElement.onplay = (event) => {
            userInvokedPlayState = true
            togglePlayPauseIcon()
        }
        loadedVideoElement.onpause = (event) => {
            userInvokedPlayState = false
            togglePlayPauseIcon()
        }
    }
    function pauseVideo(){
        loadedVideoElement.pause()
    }
    function playVideo(){
        loadedVideoElement.play()
    }
    function togglePlayPause(){
        try{
            if(userInvokedPlayState){
                pauseVideo()
            }else{
                playVideo()
            }
        }catch(err){
            console.log(err)
        }
    }
    function togglePlayPauseIcon(){
        var iconEl = theEnclosure.find('.play-preview i')
        if(!userInvokedPlayState){
            iconEl.addClass('fa-play').removeClass('fa-pause')
        }else{
            iconEl.addClass('fa-pause').removeClass('fa-play')
        }
    }
    function setSeekPosition(secondsIn){
        loadedVideoElement.currentTime = parseFloat(secondsIn) || 1
        try{
            loadedVideoElement.play()
        }catch(err){

        }
        pauseVideo()
    }
    function loadVideoIntoSlicer(video){
        loadedVideoForSlicer = Object.assign({},video)
        var startTime = new Date(loadedVideoForSlicer.time)
        var endTime = new Date(loadedVideoForSlicer.end)
        createVideoElement(video)
        drawTimeTicks(video)
        completedVideosList.empty()
        setSeekRestraintOnVideo()
    }
    function drawCompletedVideoRow(file){
        var videoEndpoint = getApiPrefix(`fileBin`) + '/' + file.mid + '/' + file.name
        var html = `<div class="card bg-dark mb-3" data-mid="${file.mid}" data-ke="${file.ke}" data-filename="${file.name}">
            <div class="card-body">
                <div class="d-flex flex-row">
                    <div class="flex-grow-1 text-white">
                        ${file.name}
                    </div>
                    <div>
                        <a class="btn btn-sm btn-primary open-fileBin-video" href="${videoEndpoint}" title="${lang.Play}"><i class="fa fa-play"></i></a>
                        <a class="btn btn-sm btn-success" href="${videoEndpoint}" title="${lang.Download}" download><i class="fa fa-download"></i></a>
                    </div>
                </div>
            </div>
        </div>`
        completedVideosList.append(html)
    }
    function seekByTimelineClick(e){
        if(!changeTimeout){
            var currentlyPlaying = !!userInvokedPlayState
            var leftOffset = e.pageX - timelineStripSliceSelection.offset().left
            var tickPx = timelineStripSliceSelection.position().left + leftOffset
            var timeSeconds = getTimeInfo(tickPx).timeSeconds
            setSeekPosition(timeSeconds)
            if(currentlyPlaying){
                playVideo()
            }
        }
    }
    onWebSocketEvent(function(data){
        switch(data.f){
            case'fileBin_item_added':
                if(data.slicedVideo){
                    drawCompletedVideoRow(data)
                }
            break;
        }
    })
    addOnTabAway('studio', function () {
        loadedVideoElement.pause()
    })
    $(window).resize(function(){
        if(tabTree && tabTree.name === 'studio' && loadedVideoElement){
            drawTimeTicks(loadedVideoForSlicer)
        }
    })
    timelineStrip.resize(function(){
        stripWidth = timelineStrip.width()
    })
    timelineStripSliceSelection.mousedown(seekByTimelineClick)
    $('body')
    .on('click','.open-video-studio',function(e){
        e.preventDefault()
        var el = $(this).parents('[data-mid]')
        var monitorId = el.attr('data-mid')
        var videoTime = el.attr('data-time')
        var video = loadedVideosInMemory[`${monitorId}${videoTime}${undefined}`]
        openTab('studio')
        loadVideoIntoSlicer(video)
        return false;
    });
    theEnclosure
    .on('click','.slice-video',function(){
        sliceVideo()
    })
    .on('click','.play-preview',function(){
        togglePlayPause()
        togglePlayPauseIcon()
    })
    .on('mouseup','.ui-resizable-handle.ui-resizable-e',function(){
        var data = getSliceSelection()
        var startTime = data.startTimeSeconds
        setSeekPosition(startTime)
    });
    initStudio()
})
