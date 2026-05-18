$(document).ready(function(){
    var streamCarouselBlock = $('#stream-carousel')
    var streamCarouselBlockInner = streamCarouselBlock.find('.stream-carousel-inner')
    var streamCarouselBlockLabel = streamCarouselBlock.find('.stream-carousel-label')
    var loadedCarouselBlocks = []
    var changeTimer = null;
    var currentCarouselMonitorId = null;
    function canBackgroundCarousel(){
        return tabTree && tabTree.name === 'initial' && dashboardOptions().switches.backgroundCarousel === 1
    }
    function drawCarouselSet(){
        var html = ``
        loadedCarouselBlocks = []
        $.each(loadedMonitors,function(id,monitor){
            if(monitor.mode === 'start' || monitor.mode === 'record'){
                loadedCarouselBlocks.push(monitor.mid)
                html += `<div data-mid="${monitor.mid}" class="carousel-block"><iframe></iframe></div>`
            }
        })
        streamCarouselBlockInner.html(html)
    }
    function clearCarouselFrames(){
        $.each(loadedCarouselBlocks,function(n,monitorId){
            deloadMonitorInCarousel(monitorId)
        })
    }
    function loadMonitorInCarousel(monitorId){
        currentCarouselMonitorId = `${monitorId}`
        var loadedMonitor = loadedMonitors[monitorId]
        var monitorName = loadedMonitor.name
        var monitorStatus = loadedMonitor.status
        streamCarouselBlockLabel.html(`${monitorName} : ${monitorStatus}`)
        streamCarouselBlockInner
            .find(`.carousel-block[data-mid="${monitorId}"]`)
            .addClass('active-block')
            .find('iframe')
            .attr('src',`${getApiPrefix(`embed`)}/${monitorId}/fullscreen|jquery|relative`)
    }
    function deloadMonitorInCarousel(monitorId){
        streamCarouselBlockInner
            .find(`.carousel-block[data-mid="${monitorId}"]`)
            .removeClass('active-block')
            .find('iframe')
            .attr('src',`about:blank`)
    }
    function goNextCarouselBlock(amountToMove,lateDeload){
        var numberOfBlocks = loadedCarouselBlocks.length - 1;
        var oldId = `${currentCarouselMonitorId}`
        var indexToMoveTo = loadedCarouselBlocks.indexOf(currentCarouselMonitorId) + amountToMove
        var nextId = loadedCarouselBlocks[indexToMoveTo]
        if(indexToMoveTo > numberOfBlocks){
            console.log('above',loadedCarouselBlocks[0],indexToMoveTo,numberOfBlocks)
            nextId = loadedCarouselBlocks[0]
            console.log('above',nextId)
        }else if(indexToMoveTo < 0){
            console.log('below',loadedCarouselBlocks[numberOfBlocks],indexToMoveTo,numberOfBlocks)
            nextId = loadedCarouselBlocks[numberOfBlocks]
            console.log('below',nextId)
        }
        if(oldId === nextId){
            clearInterval(changeTimer)
        }else{
            loadMonitorInCarousel(nextId)
            if(lateDeload){
                setTimeout(function(){
                    deloadMonitorInCarousel(oldId)
                },2000)
            }
        }
    }
    function setAutoChangerInterval(){
        stopAutoChangerInterval()
        changeTimer = setInterval(function(){
            goNextCarouselBlock(1,true)
        },20000)
    }
    function stopAutoChangerInterval(){
        clearTimeout(changeTimer)
    }
    function initCarousel(){
        drawCarouselSet()
        if(loadedCarouselBlocks[0]){
            loadMonitorInCarousel(currentCarouselMonitorId || loadedCarouselBlocks[0])
            setAutoChangerInterval()
        }
    }
    addOnTabReopen('initial', function () {
        initCarousel()
    })
    addOnTabAway('initial', function () {
        clearCarouselFrames()
        stopAutoChangerInterval()
    })
    onDashboardReady(function(){
        initCarousel()
    })
    onWebSocketEvent(function(d){
        switch(d.f){
            case'detector_trigger':
                var monitorId = d.id
                if(tabTree.name === 'initial' && currentCarouselMonitorId !== monitorId){
                    loadMonitorInCarousel(monitorId)
                    setAutoChangerInterval()
                }
            break;
        }
    })
    streamCarouselBlock.find('[stream-carousel-go]').click(function(){
        var el = $(this)
        var direction = parseInt(el.attr('stream-carousel-go'))
        console.log(direction)
        deloadMonitorInCarousel(currentCarouselMonitorId)
        goNextCarouselBlock(direction)
        setAutoChangerInterval()
    })
    $(window).focus(function(){
        if(canBackgroundCarousel()){
            initCarousel()
        }
    }).blur(function(){
        if(canBackgroundCarousel()){
            clearCarouselFrames()
            stopAutoChangerInterval()
        }
    })
})
