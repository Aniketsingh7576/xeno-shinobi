$(document).ready(function(){
    var theBlock = $('#recentVideos')
    var theList = $('#recentVideosList')
    var videoRangeEl = $('#recentVideosRange')
    var monitorList = theBlock.find('.monitors_list')
    function drawRowToList(row,toBegin,returnLastChild){
        theList[toBegin ? 'prepend' : 'append'](createVideoRow(row))
        if(returnLastChild){
            var theChildren = theList.children()
            return toBegin ? theChildren.first() : theChildren.last()
        }
    }
    function drawDaysToList(videos,toBegin,frames){
        var listOfDays = getAllDays(videos,frames)
        var videosSortedByDays = Object.assign({},listOfDays,sortVideosByDays(videos))
        var framesSortedByDays = Object.assign({},listOfDays,sortFramesByDays(frames))
        $.each(listOfDays,function(monitorId,days){
            $.each(days,function(dayKey){
                var copyOfVideos = ([]).concat(videosSortedByDays[monitorId][dayKey] || []).reverse()
                var copyOfFrames = ([]).concat(framesSortedByDays[monitorId][dayKey] || []).reverse()
                theList.append(createDayCard(copyOfVideos,copyOfFrames,dayKey,monitorId))
                var theChildren = theList.children()
                var createdCardCarrier = toBegin ? theChildren.first() : theChildren.last()
                bindFrameFindingByMouseMoveForDay(createdCardCarrier,dayKey,copyOfVideos,copyOfFrames)
                // preloadAllTimelapseFramesToMemoryFromVideoList(copyOfFrames)
            })
        })
    }
    function drawListFiller(filler){
        theList.html(`<div class="text-center ${definitions.Theme.isDark ? 'text-white' : ''} pt-4"><h3>${filler}</h3></div>`);
    }
    function loadVideos(options,callback){
        drawListFiller(`<i class="fa fa-spinner fa-pulse"></i>`)
        var currentDate = new Date()
        var videoRange = parseInt(videoRangeEl.val()) || 1
        options.videoRange = videoRange
        options.startDate = convertTZ(moment(currentDate).subtract(videoRange, 'hours')._d, serverTimezone);
        options.endDate = convertTZ(moment(currentDate)._d, serverTimezone);
        function drawVideoData(data){
            var html = ``
            var videos = data.videos || []
            var frames = data.frames || []
            // $.each(videos,function(n,row){
            //     var createdCardCarrier = drawRowToList(row,false,true)
            //     bindFrameFindingByMouseMove(createdCardCarrier,row)
            // })
            drawDaysToList(videos,false,frames)
            getCountOfEvents(options)
            callback(data)
        }
        getVideos(options,function(data){
            theList.empty()
            if(data.videos.length === 0 && data.frames.length === 0){
                drawListFiller(lang['No Data'])
            }else{
                drawVideoData(data)
            }
        })
    }
    function getCountOfEvents(options){
        var monitorId = options.monitorId
        var loadedMonitor = loadedMonitors[monitorId]
        options.onlyCount = '1';
        if(!options.startDate)options.startDate = moment().subtract(24, 'hour').utc()._d
        if(!options.endDate)options.endDate = moment().add(1, 'hour').utc()._d
        getEvents(options,function(data){
            var eventDesignationText = `${lang['All Monitors']}`
            if(monitorId){
                eventDesignationText = `${loadedMonitor ? loadedMonitor.name : monitorId}`
            }
            $('.events_from_last_24_which_monitor').text(eventDesignationText)
            $('.events_from_last_24').text(data.count)
        })
    }
    function isAllMonitorsSelected(totalBefore){
        var theSelected = monitorList.val()
        if(!theSelected || theSelected === ''){
            const monitorKeys = Object.keys(loadedMonitors)
            const numberOf = monitorKeys.length
            return numberOf >= totalBefore;
        }else{
            return false
        }
    }
    function refreshRecentVideos(){
        var theSelected = `${monitorList.val()}`
        loadVideos({
            limit: 0,
            monitorId: theSelected || undefined,
        },function(){
            liveStamp()
        })
    }
    function refreshRecentVideosOnAgree(){
        var askToLoad = isAllMonitorsSelected(50)
        if(!window.skipRecentVideosAgree && askToLoad){
            $.confirm.create({
                title: lang['Recent Videos'],
                body: `${lang.tooManyMonitorsSelected}. ${lang.performanceMayBeAffected}`,
                clickOptions: {
                    title: lang.getVideos,
                    class: 'btn-success'
                },
                clickCallback: function(){
                    refreshRecentVideos()
                },
                onCancel: function(){
                }
            })
        }else{
            refreshRecentVideos()
        }
        window.skipRecentVideosAgree = false;
    }
    monitorList.change(refreshRecentVideosOnAgree);
    videoRangeEl.change(refreshRecentVideosOnAgree);
    theBlock.find('.recent-videos-refresh').click(function(){
        var theSelected = `${monitorList.val()}`
        drawMonitorListToSelector(monitorList.find('optgroup'))
        monitorList.val(theSelected)
        refreshRecentVideosOnAgree()
    });
    var loadedOnce = false;
    addOnTabReopen('initial', function () {
        if(loadedOnce)return;
        loadedOnce = true;
        drawMonitorListToSelector(monitorList.find('optgroup'))
        refreshRecentVideosOnAgree()
    })
    onDashboardReady(function(){
        openTab('initial');
        setTimeout(function(){
            if(tabTree.name === 'initial'){
                if(loadedOnce)return;
                loadedOnce = true;
                drawMonitorListToSelector(monitorList.find('optgroup'))
                refreshRecentVideosOnAgree()
            }
        },1000)
    })
})
