var detectionDrawDelays = {};
$(document).ready(function(e){
    var loadedLiveGrids = {}
    var monitorPops = {}
    var liveGridElements = {}
    var runningJpegStreams = {}
    var liveGridTab = $('#tab-liveGrid')
    var liveGrid = $('#monitors_live')
    var liveGridData = null
    var liveGridSideMenu = $('#side-menu-link-liveGrid')
    var liveGridOpenCountElements = $('.liveGridOpenCount')
    var autoPlaceMonitorOptions = liveGridSideMenu.find('.auto-place-monitors')
    var liveGridOpenCount = 0
    var liveGridPauseScrollTimeout = null;
    var liveGridWindowResizeTimeout = null;
    var liveGridPlayingNow = {};
    var currentPtzPresetPosition = {};
    var toStayClosed = {}
    var lastWindowWidth = liveGrid.width()
    var lastWindowHeight = liveGrid.height()
    var windowInFocus = true;
    var fullscreenInUse = false;
    var maintainGrid = true
    var watchToggleCallback = {}
    var currentOpenState = dashboardOptions().watch_on || {}
    var legend = {
        "1": 12,
        "2": 6,
        "3": 4,
        // "4": 3,
        // "6": 2,
    }
    var isSmallMobile = isMobile || window.innerWidth <= 812;
    //
    var onLiveStreamInitiateExtensions = []
    function onLiveStreamInitiate(callback){
        onLiveStreamInitiateExtensions.push(callback)
    }
    var onLiveStreamCloseExtensions = []
    function onLiveStreamClose(callback){
        onLiveStreamCloseExtensions.push(callback)
    }
    var onSignalCheckLiveStreamExtensions = []
    function onSignalCheckLiveStream(callback){
        onSignalCheckLiveStreamExtensions.push(callback)
    }
    var onBuildStreamElementExtensions = []
    function onBuildStreamElement(callback){
        onBuildStreamElementExtensions.push(callback)
    }
    //
    function setLiveGridOpenCount(addOrRemove){
        liveGridOpenCount += addOrRemove
        liveGridOpenCountElements.text(liveGridOpenCount)
    }
    function getLiveGridData(){
        return liveGridData
    }
    function saveLiveGridBlockPositions() {
        console.log('saveLiveGridBlockPositions')
        var monitors = {}
        liveGrid.find(".grid-stack-item").each(function(n,v){
            var el = $(v)
            var monitorItem = el.find('.monitor_item')
            var item = {}
            item.ke = monitorItem.attr('data-ke')
            item.mid = monitorItem.attr('data-mid')
            item.x = el.attr('gs-x')
            item.y = el.attr('gs-y')
            item.height = el.attr('gs-h')
            item.width = el.attr('gs-w')
            monitors[item.ke+''+item.mid] = item
        })
        $user.details.monitorOrder = monitors;
        mainSocket.f({f:'monitorOrder',monitorOrder:monitors})
    }
    function buildStreamElementHtml(streamType){
        var html = ''
        if(window.jpegModeOn === true){
            html = '<img class="stream-element">';
        }else{
            switch(streamType){
                case'hls':case'flv':case'mp4':
                    html = `<video class="stream-element" playsinline autoplay muted></video>`;
                break;
                case'mjpeg':
                    html = '<iframe class="stream-element"></iframe>';
                break;
                case'jpeg':
                    html = '<img class="stream-element">';
                break;
                default://base64//h265
                    html = '<canvas class="stream-element"></canvas>';
                break;
            }
            $.each(onBuildStreamElementExtensions,function(n,extender){
                var newHtml = extender(streamType)
                html = newHtml ? newHtml : html
            })
        }
        return html
    }
    function attachVideoElementErrorHandler(monitorId){
        try{
            var monitor = loadedMonitors[monitorId]
            var monitorDetails = safeJsonParse(monitor.details)
            var subStreamChannel = monitor.subStreamChannel
            var streamType = subStreamChannel ? monitorDetails.substream ? monitorDetails.substream.output.stream_type : 'hls' : monitorDetails.stream_type
            if(
                streamType === 'flv' ||
                streamType === 'hls'
            ){
                var streamBlock = liveGridElements[monitorId].streamElement
                streamBlock[0].onerror = function(){
                    // setTimeout(function(){
                    //     mainSocket.f({f:'monitor',ff:'watch_on',id:monitorId})
                    // },2000)
                }
            }
        }catch(err){
            console.error(`Failed to Set Error Handler for Video Element`,err)
        }
    }
    function resetMonitorCanvas(monitorId,initiateAfter,subStreamChannel){
        var monitor = loadedMonitors[monitorId]
        var details = monitor.details
        var streamType = subStreamChannel ? details.substream ? details.substream.output.stream_type : 'hls' : details.stream_type
        if(!liveGridElements[monitorId])return;
        var streamBlock = liveGridElements[monitorId].monitorItem.find('.stream-block')
        closeLiveGridPlayer(monitorId,false)
        streamBlock.find('.stream-element').remove()
        streamBlock.append(buildStreamElementHtml(streamType))
        attachVideoElementErrorHandler(monitorId)
        if(initiateAfter)initiateLiveGridPlayer(monitor,subStreamChannel)
        resetLiveGridDimensionsInMemory(monitorId)
    }
    function replaceMonitorInfoInHtml(htmlString,monitor){
        var monitorMutes = dashboardOptions().monitorMutes || {}
        return htmlString
            .replaceAll('$GROUP_KEY',monitor.ke)
            .replaceAll('$MONITOR_ID',monitor.mid)
            .replaceAll('$MONITOR_MODE',monitor.mode)
            .replaceAll('$MONITOR_NAME',monitor.name)
            .replaceAll('$MONITOR_MUTE_ICON',(monitorMutes[monitor.mid] !== 1 ? 'volume-up' : 'volume-off'));
    }
    function buildLiveGridBlock(monitor){
        if(monitor.mode === 'stop'){
            new PNotify({
                title: lang.sorryNo,
                text: lang[`Cannot watch a monitor that isn't running.`],
                type: 'danger'
            })
            return
        }
        var monitorId = monitor.mid
        var monitorDetails = safeJsonParse(monitor.details)
        var monitorLiveId = `monitor_live_${monitor.mid}`
        var subStreamChannel = monitor.subStreamChannel
        var streamType = subStreamChannel ? monitorDetails.substream ? monitorDetails.substream.output.stream_type : 'hls' : monitorDetails.stream_type
        var streamElement = buildStreamElementHtml(streamType)
        var streamBlockInfo = definitions['Monitor Stream Window']
        var wasLiveGridLogStreamOpenBefore = isLiveGridLogStreamOpenBefore(monitorId)
        if(!loadedLiveGrids[monitor.mid])loadedLiveGrids[monitor.mid] = {}
        var detectionDrawDelay = detectionDrawDelays[monitorId];
        var quickLinkHtml = ''
        $.each(streamBlockInfo.quickLinks,function(n,button){
            if(button.eval && !eval(button.eval))return;
            quickLinkHtml += `<a title="${button.label}" class="btn btn-sm mr-1 badge btn-${button.class}"><i class="fa fa-${button.icon}"></i></a>`
        })
        var baseHtml = `<div
            id="${monitorLiveId}"
            data-ke="${monitor.ke}"
            data-mid="${monitor.mid}"
            data-mode="${monitor.mode}"
            class="monitor_item ${wasLiveGridLogStreamOpenBefore ? 'show_data' : ''} glM${monitor.mid} ${streamBlockInfo.gridBlockClass || ''}"
        >
            <div style="height:100%" class="d-flex">
                <div class="stream-block no-padding mdl-card__media mdl-color-text--grey-50 ${wasLiveGridLogStreamOpenBefore ? 'col-md-6' : 'col-md-12'}">
                    ${streamBlockInfo.streamBlockPreHtml || ''}
                    <div class="stream-objects"></div>
                    <div class="stream-hud">
                        ${streamBlockInfo.streamBlockHudHtml || ''}
                        <div class="controls">
                            ${streamBlockInfo.streamBlockHudControlsHtml || ''}
                            <div class="text-start">
                                <div class="slider-container">
                                    <input type="range" class="slider detection-delay" step="0.1" min="0" max="10" title="${lang['Detection Draw Delay']} : ${detectionDrawDelay}" value="${detectionDrawDelay || 0}">
                                </div>
                            </div>
                        </div>
                    </div>
                    ${streamElement}
                </div>
                <div class="mdl-data_window ${wasLiveGridLogStreamOpenBefore ? 'col-md-6' : 'col-md-12'}">
                    <div class="d-flex flex-row" style="height: 100%;">
                        <div class="data-menu col-md-6 p-2 videos-mini scrollable"></div>
                        <div class="data-menu col-md-6 p-2 logs scrollable"></div>
                    </div>
                </div>
            </div>
            ${(streamBlockInfo.gridBlockAfterContentHtml || '').replace(`$QUICKLINKS`,quickLinkHtml)}
            <div class="mdl-overlay-menu-backdrop hidden">
                <ul class="mdl-overlay-menu list-group">`
                var buttons = streamBlockInfo.links
                $.each(buttons,function(n,button){
                    if(button.eval && !eval(button.eval))return;
                    baseHtml += `<li class="list-item cursor-pointer ${button.class}" title="${button.label}" ${button.attr}><i class="fa fa-${button.icon}"></i> ${button.label}</li>`
                })
                baseHtml += `</ul>
            </div>
        </div>`
        return replaceMonitorInfoInHtml(baseHtml,monitor)
    }
    async function drawPtzControlsOnLiveGridBlock(monitorId){
        var monitorItem = $('#monitor_live_' + monitorId)
        var ptzControls = monitorItem.find('.PTZ_controls');
        var loadedMonitor = loadedMonitors[monitorId]
        var stopCommandOnRelease = loadedMonitor.details.control_stop === '2'
        var isOnvif = loadedMonitor.details.is_onvif === '1';
        if(ptzControls.length>0){
            ptzControls.remove()
        }else{
            if(isOnvif){
                var onvifPresets = await runPtzCommand(monitorId, 'getPresets')
            }
            var html = `<div class="PTZ_controls text-center">
                <div class="p-2">
                    <div class="pad d-inline-block">
                        <div class="control top run-live-grid-monitor-ptz${stopCommandOnRelease ? `-move` : '' }" data-ptz-control="up"></div>
                        <div class="control left run-live-grid-monitor-ptz${stopCommandOnRelease ? `-move` : '' }" data-ptz-control="left"></div>
                        <div class="control right run-live-grid-monitor-ptz${stopCommandOnRelease ? `-move` : '' }" data-ptz-control="right"></div>
                        <div class="control bottom run-live-grid-monitor-ptz${stopCommandOnRelease ? `-move` : '' }" data-ptz-control="down"></div>
                        <div class="control middle run-live-grid-monitor-ptz" data-ptz-control="center"></div>
                    </div>
                    <div class="btn-group btn-group-sm btn-group-justified">
                        <a title="${lang['Zoom In']}" class="zoom_in btn btn-default run-live-grid-monitor-ptz" data-ptz-control="zoom_in"><i class="fa fa-search-plus"></i></a>
                        <a title="${lang['Zoom Out']}" class="zoom_out btn btn-default run-live-grid-monitor-ptz" data-ptz-control="zoom_out"><i class="fa fa-search-minus"></i></a>
                    </div>
                    <div class="btn-group btn-group-sm btn-group-justified">
                        <a title="${lang['Enable Nightvision']}" class="nv_enable btn btn-default run-live-grid-monitor-ptz" data-ptz-control="enable_nv"><i class="fa fa-moon-o"></i></a>
                        <a title="${lang['Disable Nightvision']}" class="nv_disable btn btn-default run-live-grid-monitor-ptz" data-ptz-control="disable_nv"><i class="fa fa-sun-o"></i></a>
                    </div>
                    ${isOnvif ? `
                    <div class="btn-group btn-group-sm btn-group-justified">
                        <a title="${lang['Start Patrol']}" class="btn btn-success run-live-grid-monitor-onvif-startPatrol"><i class="fa fa-retweet"></i></a>
                        <a title="${lang['Stop Patrol']}" class="btn btn-danger run-live-grid-monitor-onvif-stopPatrol"><i class="fa fa-times"></i></a>
                    </div>
                    <div class="dropdown btn-group btn-group-sm btn-group-justified">
                        <button class="btn btn-sm btn-primary dropdown-toggle" type="button" id="goToPtzPreset_${monitorId}" data-bs-toggle="dropdown" aria-expanded="false">
                            ${lang['PTZ Presets']}
                        </button>
                        <ul class="dropdown-menu shadow-lg dropdown-menu-dark bg-dark text-white" aria-labelledby="goToPtzPreset_${monitorId}" style="overflow:auto;max-height:350px;">
                            <li><a class="dropdown-item cursor-pointer run-live-grid-monitor-ptz" data-ptz-control="center"><i class="fa fa-h-square"></i> ${lang['Home']}</a></li>
                            <li><hr class="dropdown-divider"></li>
                            ${onvifPresets.map(item => `<li><a class="dropdown-item cursor-pointer run-live-grid-monitor-onvif-goToPreset" data-preset="${item.token}">${item.name}</a></li>`).join('')}
                        </ul>
                    </div>
                    <div class="dropdown btn-group btn-group-sm btn-group-justified">
                        <button class="btn btn-sm btn-primary dropdown-toggle" type="button" id="savePtzPreset_${monitorId}" data-bs-toggle="dropdown" aria-expanded="false">
                            ${lang['Save PTZ Preset']}
                        </button>
                        <ul class="dropdown-menu shadow-lg dropdown-menu-dark bg-dark text-white" aria-labelledby="savePtzPreset_${monitorId}" style="overflow:auto;max-height:350px;">
                            <li><a class="dropdown-item cursor-pointer run-live-grid-monitor-ptz" data-ptz-control="setHome"><i class="fa fa-h-square"></i> ${lang['Set Home']}</a></li>
                            <li><a class="dropdown-item cursor-pointer run-live-grid-monitor-onvif-addPreset"><i class="fa fa-h-plus"></i> ${lang['Add Preset']}</a></li>
                            <li><hr class="dropdown-divider"></li>
                            ${onvifPresets.map(item => `<li>
                                <div class="d-flex dropdown-item">
                                    <div class="flex-grow-1">
                                        <a class="cursor-pointer text-white run-live-grid-monitor-onvif-setPreset" data-preset="${item.token}">${item.name}</a>
                                    </div>
                                    <div>
                                        <span class="btn btn-sm btn-danger run-live-grid-monitor-onvif-removePreset" data-preset="${item.token}"><i class="fa fa-trash-o"></i></span>
                                    </div>
                                </div>
                            </li>`).join('')}
                        </ul>
                    </div>` : ''}
                </div>
            </div>`
            monitorItem.append(html)
        }
    }
    function drawVideoCardToMiniList(monitorId,video,skipLimitCheck){
        var theVideoList = liveGridElements[monitorId].miniVideoList
        if(!skipLimitCheck){
            var rowsDrawn = theVideoList.find('.video-row')
            if(rowsDrawn.length > 10)rowsDrawn.last().remove()
        }
        theVideoList.prepend(createVideoRow(video,`col-12 mb-2`))
    }
    function loadVideoMiniList(monitorId){
        getVideos({
            monitorId: monitorId,
            limit: 10,
        },function(data){
            var videos = data.videos
            $.each(videos.reverse(),function(n,video){
                drawVideoCardToMiniList(monitorId,video,true)
            })
        })
    }
    function updateLiveGridElementHeightWidth(monitorId){
        var liveGridElement = liveGridElements[monitorId]
        liveGridElement.streamElement = liveGridElement.monitorItem.find('.stream-element')
        var streamElement = liveGridElement.streamElement
        liveGridElement.width = streamElement.width()
        liveGridElement.height = streamElement.height()
        console.log('update drawArea',monitorId,liveGridElement.width,liveGridElement.height)
    }
    function updateAllLiveGridElementsHeightWidth(){
        $.each(liveGridElements,function(monitorId){
            updateLiveGridElementHeightWidth(monitorId)
        })
    }
    function setLiveGridLogStreamOpenStatus(monitorId,toggleOn){
        var liveGridLogStreams = dashboardOptions().liveGridLogStreams || {}
        liveGridLogStreams[monitorId] = toggleOn ? true : false
        dashboardOptions('liveGridLogStreams',liveGridLogStreams)
    }
    function isLiveGridLogStreamOpenBefore(monitorId){
        var liveGridLogStreams = dashboardOptions().liveGridLogStreams || {}
        return liveGridLogStreams[monitorId]
    }
    function drawLiveGridBlock(monitorConfig,subStreamChannel,monitorHeight){
        var monitorId = monitorConfig.mid
        if($('#monitor_live_' + monitorId).length === 0){
            executeEventHandlers('onLiveGridPreBlockOpen',[monitorId])
            var x = null;
            var y = null;
            var monitorsPerRow = dashboardOptions().liveGridAutoPlaceSize || 3
            var dimensionsConverted = legend[`${monitorsPerRow}`] || legend["2"];
            var width = dimensionsConverted;
            var height = width;
            var html = buildLiveGridBlock(monitorConfig)
            var monitorOrderEngaged = dashboardOptions().switches.monitorOrder === 1;
            var wasLiveGridLogStreamOpenBefore = isLiveGridLogStreamOpenBefore(monitorId)
            if(monitorOrderEngaged && $user.details.monitorOrder && $user.details.monitorOrder[monitorConfig.ke+''+monitorId]){
                var saved = $user.details.monitorOrder[monitorConfig.ke+''+monitorId];
                x = saved.x;
                y = saved.y;
                width = saved.width;
                height = saved.height;
            }
            liveGridData.addWidget({
                x,
                y,
                h: isSmallMobile ? 1 :  height,
                w: isSmallMobile ? 4 :  width,
                content: html
            });
            if(isMobile)liveGridData.disable();
            var theBlock = $('#monitor_live_' + monitorId);
            var streamElement = theBlock.find('.stream-element')
            liveGridElements[monitorId] = {
                monitorItem: theBlock,
                streamElement: streamElement,
                eventObjects: theBlock.find('.stream-objects'),
                motionMeter: theBlock.find('.indifference .progress-bar'),
                motionMeterText: theBlock.find('.indifference .progress-bar span'),
                width: streamElement.width(),
                height: streamElement.height(),
                miniVideoList: theBlock.find('.videos-mini'),
            }
            try{
                if(safeJsonParse(monitorConfig.details).control === "1"){
                    theBlock.find('[monitor="control_toggle"]').show()
                }else{
                    theBlock.find('.pad').remove();
                    theBlock.find('[monitor="control_toggle"]').hide()
                }
            }catch(re){
                debugLog(re)
            }
            setCosmeticMonitorInfo(loadedMonitors[monitorId],subStreamChannel)
            setLiveGridOpenCount(1)
        }
        initiateLiveGridPlayer(loadedMonitors[monitorId],subStreamChannel)
        attachVideoElementErrorHandler(monitorId)
        if(wasLiveGridLogStreamOpenBefore){
            loadVideoMiniList(monitorId)
        }
        executeEventHandlers('onLiveGridBlockOpen',[monitorId])
    }
    function initiateLiveGridPlayer(monitor,subStreamChannel){
        var monitorId = monitor.mid
        var details = monitor.details
        var groupKey = monitor.ke
        var monitorId = monitor.mid
        var livePlayerBlocks = liveGridElements[monitorId]
        var monitorItem = livePlayerBlocks.monitorItem
        var loadedMonitor = loadedMonitors[monitorId]
        var loadedPlayer = loadedLiveGrids[monitorId]
        var websocketPath = checkCorrectPathEnding(location.pathname) + 'socket.io'
        var containerElement = $(`#monitor_live_${monitor.mid}`)
        var streamType = subStreamChannel ? details.substream ? details.substream.output.stream_type : 'hls' : details.stream_type
        var isInView = isScrolledIntoView(monitorItem[0])
        if(!isInView){
            return;
        }
        liveGridPlayingNow[monitorId] = true
        switch(streamType){
                case'jpeg':
                    startJpegStream(monitorId)
                break;
                case'b64':
                    if(loadedPlayer.Base64 && loadedPlayer.Base64.connected){
                        loadedPlayer.Base64.disconnect()
                    }
                    loadedPlayer.Base64 = io(location.origin,{ path: websocketPath, query: websocketQuery, transports: ['websocket'], forceNew: false})
                    var ws = loadedPlayer.Base64
                    var buffer
                    ws.on('diconnect',function(){
                        console.log('Base64 Stream Disconnected')
                    })
                    ws.on('connect',function(){
                        ws.emit('Base64',{
                            auth: $user.auth_token,
                            uid: $user.uid,
                            ke: monitor.ke,
                            id: monitor.mid,
                            channel: subStreamChannel
                        })
                        if(!loadedPlayer.ctx || loadedPlayer.ctx.length === 0){
                            loadedPlayer.ctx = containerElement.find('canvas');
                        }
                        var ctx = loadedPlayer.ctx[0]
                        var ctx2d = ctx.getContext("2d")
                        loadedPlayer.image = new Image()
                        var image = loadedPlayer.image
                        image.onload = function() {
                            loadedPlayer.imageLoading = false
                            var x = 0
                            var y = 0
                            ctx.getContext("2d").drawImage(image,x,y,ctx.width,ctx.height)
                            URL.revokeObjectURL(loadedPlayer.imageUrl)
                        }
                        ws.on('data',function(imageData){
                            try{
                                if(loadedPlayer.imageLoading === true)return console.log('drop');
                                loadedPlayer.imageLoading = true
                                var arrayBufferView = new Uint8Array(imageData);
                                var blob = new Blob( [ arrayBufferView ], { type: "image/jpeg" } );
                                loadedPlayer.imageUrl = URL.createObjectURL( blob );
                                loadedPlayer.image.src = loadedPlayer.imageUrl
                                loadedPlayer.last_frame = 'data:image/jpeg;base64,'+base64ArrayBuffer(imageData)
                            }catch(er){
                                debugLog('base64 frame')
                            }
                            // $.ccio.init('signal',d);
                        })
                    })
                break;
                case'mp4':
                    var stream = containerElement.find('.stream-element');
                    var onPoseidonError = function(){
                        // setTimeout(function(){
                        //     mainSocket.f({f:'monitor',ff:'watch_on',id:monitorId})
                        // },2000)
                    }
                    if(!loadedPlayer.PoseidonErrorCount)loadedPlayer.PoseidonErrorCount = 0
                    if(loadedPlayer.PoseidonErrorCount >= 5)return
                    if(subStreamChannel ? details.substream.output.stream_flv_type === 'ws' : monitor.details.stream_flv_type === 'ws'){
                        if(loadedPlayer.Poseidon){
                            loadedPlayer.Poseidon.stop()
                            revokeVideoPlayerUrl(monitorId)
                        }
                        try{
                            loadedPlayer.Poseidon = new Poseidon({
                                video: stream[0],
                                auth_token: $user.auth_token,
                                ke: monitor.ke,
                                uid: $user.uid,
                                id: monitor.mid,
                                url: location.origin,
                                path: websocketPath,
                                query: websocketQuery,
                                onError : onPoseidonError,
                                channel : subStreamChannel
                            })
                            loadedPlayer.Poseidon.start();
                        }catch(err){
                            // onPoseidonError()
                            console.log('onTryPoseidonError',err)
                        }
                    }else{
                        stream.attr('src',getApiPrefix(`mp4`)+'/'+monitor.mid + (subStreamChannel ? `/${subStreamChannel}` : '')+'/s.mp4?time=' + (new Date()).getTime())
                        stream[0].onerror = function(err){
                            console.error(err)
                        }
                    }
                break;
                case'flv':
                    if (flvjs.isSupported()) {
                        if(loadedPlayer.flv){
                            loadedPlayer.flv.destroy()
                            revokeVideoPlayerUrl(monitorId)
                        }
                        var options = {};
                        if(monitor.details.stream_flv_type==='ws'){
                            if(monitor.details.stream_flv_maxLatency&&monitor.details.stream_flv_maxLatency!==''){
                                monitor.details.stream_flv_maxLatency = parseInt(monitor.details.stream_flv_maxLatency)
                            }else{
                                monitor.details.stream_flv_maxLatency = 20000;
                            }
                            options = {
                                type: 'flv',
                                isLive: true,
                                auth_token: $user.auth_token,
                                ke: monitor.ke,
                                uid: $user.uid,
                                id: monitor.mid,
                                maxLatency: monitor.details.stream_flv_maxLatency,
                                hasAudio:false,
                                url: location.origin,
                                path: websocketPath,
                                channel : subStreamChannel,
                                query: websocketQuery
                            }
                        }else{
                            options = {
                                type: 'flv',
                                isLive: true,
                                url: getApiPrefix(`flv`)+'/'+monitor.mid + (subStreamChannel ? `/${subStreamChannel}` : '')+'/s.flv'
                            }
                        }
                        loadedPlayer.flv = flvjs.createPlayer(options);
                        loadedPlayer.flv.attachMediaElement(containerElement.find('.stream-element')[0]);
                        loadedPlayer.flv.on('error',function(err){
                            console.log(err)
                        });
                        loadedPlayer.flv.load();
                        loadedPlayer.flv.play();
                    }else{
                        new PNotify({title:'Stream cannot be started',text:'FLV.js is not supported on this browser. Try another stream type.',type:'error'});
                    }
                break;
                case'hls':
                    function createSteamNow(){
                        clearTimeout(loadedPlayer.m3uCheck)
                        var url = getApiPrefix(`hls`) + '/' + monitor.mid + (subStreamChannel ? `/${subStreamChannel}` : '') + '/s.m3u8'
                        $.get(url,function(m3u){
                            if(m3u == 'File Not Found'){
                                loadedPlayer.m3uCheck = setTimeout(function(){
                                    createSteamNow()
                                },2000)
                            }else{
                                var video = containerElement.find('.stream-element')[0]
                                if (isAppleDevice) {
                                    video.src = url;
                                    video.addEventListener('loadedmetadata', function() {
                                      setTimeout(function(){
                                        video.play();
                                      },3000)
                                    }, false);
                                }else{
                                    var hlsOptions = safeJsonParse(dashboardOptions().hlsOptions) || {}
                                    if(hlsOptions instanceof String){
                                        hlsOptions = {}
                                        new PNotify({
                                            title: lang['Invalid JSON'],
                                            text: lang.hlsOptionsInvalid,
                                            type: `warning`,
                                        })
                                    }
                                    if(loadedPlayer.hls){
                                        loadedPlayer.hls.destroy()
                                        revokeVideoPlayerUrl(monitorId)
                                    }
                                    loadedPlayer.hls = new Hls(hlsOptions)
                                    loadedPlayer.hls.loadSource(url)
                                    loadedPlayer.hls.attachMedia(video)
                                    loadedPlayer.hls.on(Hls.Events.MANIFEST_PARSED,function() {
                                        if (video.paused) {
                                            video.play();
                                        }
                                    });
                                }
                            }
                        })
                    }
                    createSteamNow()
                break;
                case'mjpeg':
                    var liveStreamElement = containerElement.find('.stream-element')
                    var setSource = function(){
                        liveStreamElement.attr('src',getApiPrefix(`mjpeg`)+'/'+monitorId + (subStreamChannel ? `/${subStreamChannel}` : ''))
                        liveStreamElement.unbind('ready')
                        liveStreamElement.ready(function(){
                            setTimeout(function(){
                                liveStreamElement.contents().find("body").append('<style>img{width:100%;height:100%}</style>')
                            },1000)
                        })
                    }
                    setSource()
                    liveStreamElement.on('error',function(err){
                        setTimeout(function(){
                            setSource()
                        },4000)
                    })
                break;
            }
        $.each(onLiveStreamInitiateExtensions,function(n,extender){
            extender(streamType,monitor,loadedPlayer,subStreamChannel)
        })
        var monitorMutes = dashboardOptions().monitorMutes || {}
        if(dashboardOptions().switches.monitorMuteAudio === 1){
            containerElement.find('video').each(function(n,el){
                el.muted = "muted"
            })
        }else{
            var hasFocus = windowFocus && window.hadFocus
            $.each(loadedMonitors,function(frontId,monitor){
                setTimeout(() => {
                    var monitorId = monitor.mid
                    var muted = monitorMutes[monitorId]
                    try{
                        var vidEl = $('.monitor_item[mid="' + monitorId + '"] video')[0]
                        if(vidEl.length === 0)return;
                        if(muted === 1){
                            vidEl.muted = true
                        }else{
                            if(hasFocus){
                                vidEl.muted = false
                            }else{
                                console.error('User must have window active to unmute.')
                            }
                        }
                    }catch(err){
                        // console.log(err)
                    }
                },2000)
            })
        }
        //initiate signal check
        if(streamType !== 'useSubstream'){
            var signalCheckInterval = (isNaN(loadedMonitor.details.signal_check) ? 10 : parseFloat(loadedMonitor.details.signal_check)) * 1000 * 60
            if(signalCheckInterval > 0){
                clearInterval(loadedPlayer.signal)
                loadedPlayer.signal = setInterval(function(){
                    signalCheckLiveStream({
                        mid: monitorId,
                        checkSpeed: 3000,
                    })
                },signalCheckInterval);
            }
        }
    }
    function revokeVideoPlayerUrl(monitorId){
        try{
            URL.revokeObjectURL(liveGridElements[monitorId].streamElement[0].src)
        }catch(err){
            debugLog(err)
        }
    }
    function closeLiveGridPlayer(monitorId,killElement){
        try{
            var loadedPlayer = loadedLiveGrids[monitorId]
            if(loadedPlayer){
                if(loadedPlayer.hls){loadedPlayer.hls.destroy()}
                clearTimeout(loadedPlayer.m3uCheck)
                if(loadedPlayer.Poseidon){loadedPlayer.Poseidon.stop()}
                if(loadedPlayer.Base64){loadedPlayer.Base64.disconnect()}
                if(loadedPlayer.dash){loadedPlayer.dash.reset()}
                if(loadedPlayer.jpegInterval){
                    stopJpegStream(monitorId)
                }
                $.each(onLiveStreamCloseExtensions,function(n,extender){
                    extender(loadedPlayer)
                })
                clearInterval(loadedPlayer.signal)
            }
            if(liveGridElements[monitorId]){
                revokeVideoPlayerUrl(monitorId)
                if(killElement){
                    var livePlayerElement = liveGridElements[monitorId]
                    var theElement = livePlayerElement.monitorItem.parents('.grid-stack-item')[0]
                    getLiveGridData().removeWidget(theElement, true)
                    setLiveGridOpenCount(-1)
                    delete(loadedLiveGrids[monitorId])
                    delete(liveGridElements[monitorId])
                    saveLiveGridBlockOpenState(monitorId,$user.ke,0)
                }
            }
        }catch(err){
            console.log(err)
        }
    }
    function closeLiveGridPlayers(monitors, killElement){
        $.each(monitors,function(n,v){
            monitorWatchOnLiveGrid(v.mid, killElement)
        })
    }
    function monitorWatchOnLiveGrid(monitorId, watchOff){
        return new Promise(function(resolve){
            if(watchToggleCallback[monitorId])watchToggleCallback[monitorId]()
            watchToggleCallback[monitorId] = function(){
                delete(watchToggleCallback[monitorId])
                resolve()
            }
            mainSocket.f({f:'monitor',ff:watchOff ? 'watch_off' : 'watch_on',id: monitorId})
        })
    }
    function monitorsWatchOnLiveGrid(monitorIds, watchOff){
        monitorIds.forEach((monitorId) => {
            monitorWatchOnLiveGrid(monitorId, watchOff)
        })
    }
    function callMonitorToLiveGrid(v, justTry){
        var watchedOn = currentOpenState
        const monitorId = v.mid
        if(justTry || watchedOn[v.ke] && watchedOn[v.ke][monitorId] === 1 && loadedMonitors[monitorId] && loadedMonitors[monitorId].mode !== 'stop'){
            return new Promise(function(resolve){
                if(watchToggleCallback[monitorId])watchToggleCallback[monitorId]()
                let clearCallback = setTimeout(function(){
                    watchToggleCallback[monitorId]()
                },2000)
                watchToggleCallback[monitorId] = function(){
                    clearTimeout(clearCallback)
                    delete(watchToggleCallback[monitorId])
                    resolve()
                }
                mainSocket.f({f:'monitor',ff:'watch_on',id:monitorId})
                if(tabTree.name !== 'monitorSettings' && tabTree.name !== 'liveGrid')openLiveGrid()
            })
        }
    }
    function callMonitorsToLiveGrid(monitors, justTry){
        $.each(monitors,function(n,v){
            console.log('loading',v.name)
            callMonitorToLiveGrid(v, justTry)
        })
    }
    async function loadPreviouslyOpenedLiveGridBlocks(){
        for(monitorId in loadedMonitors){
            const monitor = loadedMonitors[monitorId]
            await callMonitorToLiveGrid(monitor)
        }
        setTimeout(function(){
            sortListMonitors()
        },1000)
        drawMonitorGroupList()
        const gridNumber = dashboardOptions().liveGridAutoPlaceSize || 3
        autoPlaceCurrentMonitorItemsOnLiveGrid(gridNumber)
        saveLiveGridBlockPositions()
        onWindowResize()
    }
    async function closeAllLiveGridPlayers(rememberClose){
        for(monitorId in loadedMonitors){
            const monitor = loadedMonitors[monitorId]
            if(loadedLiveGrids[monitorId]){
                mainSocket.f({
                    f: 'monitor',
                    ff: 'watch_off',
                    id: monitorId
                })
                setTimeout(function(){
                    saveLiveGridBlockOpenState(monitorId,$user.ke,0)
                },1000)
            }
        }
    }
    function saveLiveGridBlockOpenState(monitorId,groupKey,state){
        var openBlocks = currentOpenState
        openBlocks[groupKey] = openBlocks[groupKey] ? openBlocks[groupKey] : {}
        openBlocks[groupKey][monitorId] = state || 0
        dashboardOptions('watch_on',openBlocks)
    }
    function openLiveGrid(){
        if(tabTree.name !== 'liveGrid'){
            openTab('liveGrid',{})
        }
    }
    function popOutMonitor(monitorId){
        var monitorPop = monitorPops[monitorId] || {}
        if(monitorPop.isOpen){
            return
        }
        function finish(img){
            monitorPops[monitorId] = window.open(getApiPrefix() + '/embed/' + $user.ke + '/' + monitorId + '/fullscreen|jquery|relative|gui' + `?host=${location.pathname}`,'pop_' + monitorId + $user.auth_token,'height='+img.height+',width='+img.width);
            monitorPop = monitorPops[monitorId]
            monitorPop.isOpen = true
            monitorPop.onload = function(){
                this.onbeforeunload = function(){
                    monitorPop.isOpen = false
                }
            }
        }
        if(loadedLiveGrids[monitorId]){
            getSnapshot(loadedMonitors[monitorId],function(url){
                $('#temp').html('<img>')
                var img=$('#temp img')[0]
                img.onload = function(){
                    finish(img)
                }
                img.src = url
            })
        }else{
            var img = {
                height: 720,
                width: 1280
            }
            finish(img)
        }
    }
    function createWallViewWindow(windowName){
        var el = $(document)
        var width = el.width()
        var height = el.height()
        window.open(getApiPrefix() + '/wallview/' + $user.ke + `${(windowName ? '?window=' + windowName + '&' : '?')}host=${location.origin + location.pathname}`, 'wallview_'+windowName, 'height='+height+',width='+width)
    }
    function fullScreenLiveGridStream(monitorItem){
        var videoElement = monitorItem.find('.stream-element')
        monitorItem.addClass('fullscreen')
        if(videoElement.is('canvas')){
            var theBody = $('body')
            videoElement.attr('height',theBody.height())
            videoElement.attr('width',theBody.width())
        }
        fullScreenInit(videoElement[0])
    }
    function fullScreenLiveGridStreamById(monitorId){
        const monitorItem = liveGrid.find(`[data-mid="${monitorId}"]`)
        fullScreenLiveGridStream(monitorItem)
    }
    function toggleJpegMode(){
        var sendData = {
            f: 'monitor',
            ff: 'jpeg_on'
        }
        if(window.jpegModeOn === true){
            sendData.ff = 'jpeg_off'
        }
        mainSocket.f(sendData)
    }
    function startJpegStream(monitorId){
        if(loadedLiveGrids[monitorId]){
            var monitor = loadedMonitors[monitorId]
            var loadedBlock = loadedLiveGrids[monitorId]
            var jpegInterval = !isNaN(monitor.details.jpegInterval) ? parseFloat(monitor.details.jpegInterval) : 1
            resetMonitorCanvas(monitorId,false)
            var streamElement = $('#monitor_live_' + monitorId + ' .stream-element');
            // stopJpegStream(monitorId)
            var jpegUrl = getApiPrefix('jpeg') + '/' + monitorId + '/s.jpg?time='
            function drawNewFrame(){
                streamElement.attr('src',jpegUrl + (new Date()).getTime())
            }
            streamElement.on('load',function(){
                loadedBlock.jpegInterval = setTimeout(drawNewFrame,1000/jpegInterval)
            }).on('error',function(){
                loadedBlock.jpegInterval = setTimeout(drawNewFrame,1000/jpegInterval)
            })
            drawNewFrame()
        }
    }
    function stopJpegStream(monitorId){
        var livePlayerElement = loadedLiveGrids[monitorId]
        if(!livePlayerElement)return;
        try{
            liveGridElements[monitorId].streamElement.off('load').off('error')
            clearTimeout(livePlayerElement.jpegInterval)
        }catch(err){
            console.log(err)
            console.log(monitorId)
        }
    }
    function startAllJpegStreams(monitorId){
        $.each(loadedMonitors,function(n,monitor){
            startJpegStream(monitor.mid)
        })
    }
    function stopAllJpegStreams(monitorId){
        $.each(loadedMonitors,function(n,monitor){
            stopJpegStream(monitor.mid)
        })
    }
    function canBackgroundStream(){
        return tabTree && tabTree.name === 'liveGrid' && dashboardOptions().switches.backgroundStream === 1
    }
    function resetLiveGridDimensionsInMemory(monitorId){
        var theRef = liveGridElements[monitorId]
        theRef.width = theRef.streamElement.width()
        theRef.height = theRef.streamElement.height()
    }
    function resetAllLiveGridDimensionsInMemory(monitorId){
        isSmallMobile = isMobile || window.innerWidth <= 812;
        $.each(liveGridElements,function(monitorId,data){
            resetLiveGridDimensionsInMemory(monitorId)
        })
    }
    function signalCheckLiveStream(options){
        try{
            var monitorId = options.mid
            var monitorConfig = loadedMonitors[monitorId]
            var liveGridData = liveGridElements[monitorId]
            var monitorItem = liveGridData.monitorItem
            var monitorDetails = monitorConfig.details
            var checkCount = 0
            var base64Data = null;
            var base64Length = 0;
            var checkSpeed = options.checkSpeed || 1000
            var subStreamChannel = monitorConfig.subStreamChannel
            var streamType = subStreamChannel ? monitorDetails.substream ? monitorDetails.substream.output.stream_type : 'hls' : monitorDetails.stream_type
            function failedStreamCheck(){
                if(monitorConfig.signal_check_log == 1){
                    logWriterDraw(monitorId, {
                        log: {
                            type: 'Stream Check',
                            msg: lang.clientStreamFailedattemptingReconnect
                        }
                    })
                }
                if(!toStayClosed[monitorId])mainSocket.f({f:'monitor',ff:'watch_on',id:monitorId});
            }
            function succeededStreamCheck(){
                if(monitorConfig.signal_check_log == 1){
                    logWriterDraw(monitorId, {
                        log: {
                            type: 'Stream Check',
                            msg : lang.Success
                        }
                    })
                }
            }
            async function executeCheck(){
                try{
                    switch(streamType){
                        case'b64':
                            monitorItem.resize()
                        break;
                        case'hls':case'flv':case'mp4':
                            if(monitorItem.find('video')[0].paused){
                                failedStreamCheck()
                            }else{
                                succeededStreamCheck()
                            }
                        break;
                        default:
                            if(dashboardOptions().jpeg_on === true){return}
                            var firstSnapshot = await getSnapshot({
                                monitor: loadedMonitors[monitorId],
                            });
                            // console.log(firstSnapshot)
                            base64Length = firstSnapshot.fileSize
                            await setPromiseTimeout(checkSpeed)
                            var secondSnapshot = await getSnapshot({
                                monitor: loadedMonitors[monitorId],
                            });
                            // console.log(secondSnapshot)
                            // console.log('----')
                            var secondSnapLength = secondSnapshot.fileSize
                            var hasFailed = firstSnapshot.url === secondSnapshot.url || base64Length === secondSnapLength;
                            if(hasFailed){
                                failedStreamCheck()
                            }else{
                                succeededStreamCheck()
                            }
                        break;
                    }
                    $.each(onSignalCheckLiveStreamExtensions,function(n,extender){
                        extender(streamType,monitorItem)
                    })
                }catch(err){
                    console.log('signal check ERROR', err)
                    failedStreamCheck()
                }
            }
            executeCheck()
        }catch(err){
            console.log(err)
            var errorStack = err.stack;
            function phraseFoundInErrorStack(x){return errorStack.indexOf(x) > -1}
            if(phraseFoundInErrorStack("The HTMLImageElement provided is in the 'broken' state.")){
                mainSocket.f({f:'monitor',ff:'watch_on',id:monitorId});
            }
            clearInterval(liveGridData.signal);
            delete(liveGridData.signal);
        }
    }

    function pauseMonitorItem(monitorId){
        liveGridPlayingNow[monitorId] = false
        closeLiveGridPlayer(monitorId,false)
    }
    function resumeMonitorItem(monitorId){
        // needs to know about substream
        liveGridPlayingNow[monitorId] = true
        var monitor = loadedMonitors[monitorId];
        resetMonitorCanvas(monitorId,true,monitor.subStreamChannel)
    }
    function isScrolledIntoView(elem){
        var el = $(elem)
        var theWindow = $(window)
        var docViewTop = theWindow.scrollTop();
        var docViewBottom = docViewTop + theWindow.height();

        var elemTop = el.offset().top;
        var elemBottom = elemTop + el.height();

        return (
            elemTop >= docViewTop && elemTop <= docViewBottom ||
            elemBottom >= docViewTop && elemBottom <= docViewBottom
        );
    }
    function pauseAllLiveGridPlayers(unpause){
        $('.monitor_item').each(function(n,el){
            var monitorId = $(el).attr('data-mid')
            if(!unpause){
                pauseMonitorItem(monitorId)
            }else{
                resumeMonitorItem(monitorId)
            }
        })
    }
    function setPauseStatusForMonitorItems(forceResume){
        $('.monitor_item').each(function(n,el){
            var monitorId = $(el).attr('data-mid')
            var isVisible = isScrolledIntoView(el)
            if(isVisible){
                if(forceResume || !liveGridPlayingNow[monitorId])resumeMonitorItem(monitorId);
            }else{
                pauseMonitorItem(monitorId)
            }
        })
    }
    function setPauseScrollTimeout(forceResume){
        clearTimeout(liveGridPauseScrollTimeout)
        if(tabTree.name === 'liveGrid' && fullscreenInUse === false){
            liveGridPauseScrollTimeout = setTimeout(function(){
                setPauseStatusForMonitorItems(forceResume)
            },200)
        }
    }
    function onWindowResizeTimeout(forceResume, callback = () => {}){
        clearTimeout(liveGridWindowResizeTimeout)
        liveGridWindowResizeTimeout = setTimeout(function(){
            onWindowResize()
            callback()
        },500)
    }
    function openAllLiveGridPlayers(monitorsList){
        const monitors = monitorsList || getLoadedMonitors(null, true);
        $.each(monitors,function(monitorId,monitor){
            mainSocket.f({
                f: 'monitor',
                ff: 'watch_on',
                id: monitor.mid
            })
            openLiveGrid()
        })
    }
    function addMarkAsEvent(monitorId){
        runTestDetectionTrigger(monitorId,{
            "name":"Marker",
            "reason":"marker",
            "matrices": [
                {
                    x: 0,
                    y: 0,
                    width: 1,
                    height: 1,
                    tag: 'Marked',
                    confidence: 100,
                }
            ]
        });
    }
    function addMarkAsEventToAllOpenMonitors(){
        $.each(loadedMonitors,function(n,monitor){
            var monitorId = monitor.mid
            if(liveGridPlayingNow[monitorId]){
                addMarkAsEvent(monitorId)
            }
        })
    }
    function showHideSubstreamActiveIcon(monitorId, show){
        try{
            var liveBlock = liveGridElements[monitorId].monitorItem
            liveBlock.find('.substream-is-on')[show ? 'show' : 'hide']()
        }catch(err){

        }
    }
    async function openLiveGridPage(monitorId, peerConnectKey){
        if(isMobile){
            closeAllLiveGridPlayers()
        }
        if(!liveGridElements[monitorId]){
            await closeFirstForGridMaintain()
        }
        mainSocket.f({
            f: 'monitor',
            ff: 'watch_on',
            id: monitorId
        })
        openLiveGrid()
    }
    function setDetectionDrawDelay(monitorId, value){
        var theValue = parseFloat(value) || 0
        if(theValue == 0){
            delete(detectionDrawDelays[monitorId])
        }else{
            detectionDrawDelays[monitorId] = theValue
        }
        dashboardOptions('detectionDrawDelays', detectionDrawDelays)
    }
    function autoPlaceCurrentMonitorItemsOnLiveGrid(gridNumber) {
        const grid = liveGridData;
        const items = grid.getGridItems();
        const dimensionsConverted = legend[`${gridNumber}`] || legend["2"];
        const width = dimensionsConverted.w || dimensionsConverted;
        const height = dimensionsConverted.h || dimensionsConverted;

        grid.batchUpdate();

        // First pass - update all items
        items.forEach(itemEl => {
            grid.update(itemEl, {
                w: width,
                h: height,
                x: null,
                y: null,
                autoPosition: true
            });
        });

        // Compact layout
        grid.compact();

        // Second pass to verify sizes (using GridStack 7.0 method)
        items.forEach(itemEl => {
            const node = $(itemEl);
            const w = node.attr('gs-w');
            const h = node.attr('gs-h');
            if (node && (w !== width || h !== height)) {
                grid.update(itemEl, { w: width, h: height });
            }
        });

        grid.batchUpdate(false);
        setPauseScrollTimeout();
    }
    function onWindowResize(){
        if(fullscreenInUse === false){
            const windowHeight = $(window).height();
            liveGridTab.css('height',`${windowHeight}px!important`)
            liveGrid.css('height',`${windowHeight}px!important`)
            const availableHeight = windowHeight;
            const numRows = dashboardOptions().liveGridAutoPlaceSize || 3
            const cellHeight = Math.floor(availableHeight / numRows / legend[numRows]);
            liveGridData.cellHeight(cellHeight);
            setTimeout(function(){
                executeEventHandlers('onLiveGridResize',[])
            },500)
            return cellHeight;
        }
    }
    function setCosmeticDefaultGridSize(){
        const chosenSize = dashboardOptions().liveGridAutoPlaceSize || 3
        autoPlaceMonitorOptions.find('.dot').removeClass('dot-green').addClass('dot-purple')
        liveGridSideMenu.find(`.auto-place-monitors[data-number="${chosenSize}"]`).find('.dot').removeClass('dot-purple').addClass('dot-green')
    }
    function getNumberOfCurrentlyOpen(){
        const currentlyOpen = liveGrid.find('.monitor_item');
        const currentSize = currentlyOpen.length;
        return currentSize
    }
    async function closeExtraMonitors(){
        const savedSize = dashboardOptions().liveGridAutoPlaceSize || 3;
        const chosenSize = savedSize * savedSize;
        const currentlyOpen = liveGrid.find('.monitor_item');
        const currentSize = currentlyOpen.length;
        const numberToOpen = chosenSize - currentSize;
        const zeroOpen = numberToOpen === 0;
        let monitorsToLoad = {}
        if(zeroOpen)return true;
        if(currentSize <= chosenSize)return false;
        const newList = currentlyOpen.slice(chosenSize);
        for(item of newList){
            const el = $(item)
            const monitorId = el.attr('data-mid');
            await monitorWatchOnLiveGrid(monitorId, true)
        };
        return true
    }
    function openNextMonitors(){
        const loadedMonitors = getLoadedMonitors(null, true);
        const savedSize = dashboardOptions().liveGridAutoPlaceSize || 3;
        const chosenSize = savedSize * savedSize;
        const currentlyOpen = liveGrid.find('.monitor_item');
        const currentSize = currentlyOpen.length;
        const numberToOpen = chosenSize - currentSize;
        const zeroOpen = numberToOpen === 0;
        let monitorsToLoad = {}
        if(numberToOpen === chosenSize){
            monitorsToLoad = getMonitorsAfter(null, numberToOpen, loadedMonitors)
        }else{
            const lastItem = currentlyOpen.last();
            const monitorLiveId = `${lastItem.attr('data-mid')}`
            const openAfterMonitorLiveId = getMonitorAfter(monitorLiveId, null, loadedMonitors)
            monitorsToLoad = getMonitorsAfter(zeroOpen ? openAfterMonitorLiveId : null, chosenSize, loadedMonitors)
            closeAllLiveGridPlayers()
        }
        openAllLiveGridPlayers(monitorsToLoad)
    }
    function openPreviousMonitors() {
        const loadedMonitors = getLoadedMonitors(null, true);
        const savedSize = dashboardOptions().liveGridAutoPlaceSize || 3;
        const chosenSize = savedSize * savedSize;
        const currentlyOpen = liveGrid.find('.monitor_item');
        const currentSize = currentlyOpen.length;
        const numberToOpen = chosenSize - currentSize;
        const zeroOpen = numberToOpen === 0;
        let monitorsToLoad = {};

        if (numberToOpen === chosenSize) {
            // If no monitors are open, load the last `chosenSize` monitors
            monitorsToLoad = getMonitorsBefore(null, numberToOpen, loadedMonitors);
        } else {
            const firstItem = currentlyOpen.first(); // Get the first open monitor
            const monitorLiveId = `${firstItem.attr('data-mid')}`;

            // Get the monitor before the first open monitor
            const openBeforeMonitorLiveId = getMonitorBefore(monitorLiveId, null, loadedMonitors);

            // Load the required number of monitors before the current one
            monitorsToLoad = Object.values(getMonitorsBefore(
                zeroOpen ? openBeforeMonitorLiveId : monitorLiveId,
                zeroOpen ? chosenSize : numberToOpen,
                loadedMonitors
            )).reverse();
            closeAllLiveGridPlayers(); // Close all if no new monitors need to be opened
        }

        openAllLiveGridPlayers(monitorsToLoad);
    }
    function openMonitorsInLiveGridByTag(tag){
        var monitorIds = getMonitorsIdsFromTagGroup(tag)
        monitorIds.forEach(({ monitorId }) => {
            mainSocket.f({
                f: 'monitor',
                ff: 'watch_on',
                id: monitorId
            })
        })
    }
    function closeMonitorsInLiveGridByTag(tag){
        var monitorIds = getMonitorsIdsFromTagGroup(tag)
        monitorIds.forEach(({ monitorId }) => {
            mainSocket.f({
                f: 'monitor',
                ff: 'watch_off',
                id: monitorId
            })
        })
    }
    function compactLiveGrid(){
        liveGridData.compact()
    }
    async function closeFirstForGridMaintain(){
        if(maintainGrid){
            const gridSelection = parseInt(dashboardOptions().liveGridAutoPlaceSize) || 3;
            const gridSize = gridSelection * gridSelection
            const theKeys = Object.keys(loadedLiveGrids)
            const numberOf = theKeys.length
            const monitorLiveId = theKeys[0]
            if(numberOf >= gridSize && monitorLiveId && loadedLiveGrids[monitorLiveId]){
                const { mid: monitorId } = loadedLiveGrids[monitorLiveId].monitor
                // closeLiveGridPlayer(peerConnectKey, monitorId, true)
                await monitorWatchOnLiveGrid(monitorId, true)
            }
        }
    }
    // function muteMonitorAudio(peerConnectKey,monitorId,toggleState){
    //     var masterMute = dashboardOptions().switches.monitorMuteAudio
    //     var monitorMutes = dashboardOptions().monitorMutes || {}
    //     var monitorLiveId = monitorId + peerConnectKey
    //     monitorMutes[monitorLiveId] = toggleState === 1 || toggleState === 0 ? toggleState : monitorMutes[monitorLiveId] === 1 ? 0 : 1
    //     dashboardOptions('monitorMutes',monitorMutes)
    //     const parentEl = $(`.monitor_item[data-mid="${monitorId}"][data-peerconnectkey="${peerConnectKey}"]`)
    //     var vidEl = parentEl.find(`video`)
    //     try{
    //         if(monitorMutes[monitorLiveId] === 1){
    //             vidEl.prop('muted', true)
    //         }else{
    //             if(masterMute !== 1){
    //                 if(windowFocus && hadFocus){
    //                     vidEl.prop('muted', false)
    //                 }else{
    //                     console.error('User must have window active to unmute.')
    //                 }
    //             }
    //         }
    //     }catch(err){
    //         console.log(err)
    //     }
    //     var volumeIcon = monitorMutes[monitorLiveId] !== 1 ? 'volume-up' : 'volume-off'
    //     parentEl.find('.toggle-live-grid-monitor-mute i').removeClass('fa-volume-up fa-volume-off').addClass('fa-' + volumeIcon)
    // }
    function onPageInit(){
        dashboardOptions('liveGridAutoPlaceSize',dashboardOptions().liveGridAutoPlaceSize || 3)
        setCosmeticDefaultGridSize()
        if(dashboardOptions().switches){
            maintainGrid = dashboardOptions().switches.liveGridMaintainGrid == 1
        }else{
            maintainGrid = true
        }
    }
    function initLiveGrid(options = {}){
        if(liveGridData)liveGridData.destroy(true)
        liveGridData = GridStack.init(options, '#monitors_live');
        liveGridData
        .on('dragstop', function(event,ui){
            setTimeout(function(){
                saveLiveGridBlockPositions()
            },700)
        })
        .on('resizestop', function(){
            setTimeout(() => {
                resetAllLiveGridDimensionsInMemory()
            },2000)
            saveLiveGridBlockPositions()
            updateAllLiveGridElementsHeightWidth()
        });
    }
    liveGrid
    .on('dblclick','.stream-block',function(){
        var monitorItem = $(this).parents('[data-mid]');
        fullScreenLiveGridStream(monitorItem)
    })
    .on('change','.detection-delay',function(){
        var el = $(this);
        var monitorId = el.parents('[data-mid]').attr('data-mid');
        var value = el.val()
        el.attr('title', `${lang['Detection Draw Delay']} : ${value}`)
        // console.log('setDetectionDrawDelay',monitorId, value)
        setDetectionDrawDelay(monitorId, value)
    })
    $('body')
    .resize(function(){
        resetAllLiveGridDimensionsInMemory()
        updateAllLiveGridElementsHeightWidth()
    })
    .on('click','.launch-live-grid-monitor',function(){
        var monitorId = $(this).parents('[data-mid]').attr('data-mid')
        if(isMobile){
            closeAllLiveGridPlayers()
        }
        mainSocket.f({
            f: 'monitor',
            ff: 'watch_on',
            id: monitorId
        })
        openLiveGrid()
    })
    .on('click','.monitor-live-group-open',function(){
        var monitorIds = $(this).attr('monitor-ids').split(',')
        monitorIds.forEach((monitorId) => {
            mainSocket.f({
                f: 'monitor',
                ff: 'watch_on',
                id: monitorId
            })
        })
        openLiveGrid()
    })
    .on('click','.reconnect-live-grid-monitor',function(){
        var monitorId = $(this).parents('[data-mid]').attr('data-mid')
        mainSocket.f({
            f: 'monitor',
            ff: 'watch_on',
            id: monitorId
        });
        updateLiveGridElementHeightWidth(monitorId)
    })
    .on('click','.close-live-grid-monitor',function(){
        var monitorId = $(this).parents('[data-mid]').attr('data-mid')
        mainSocket.f({
            f: 'monitor',
            ff: 'watch_off',
            id: monitorId
        })
        setTimeout(function(){
            saveLiveGridBlockOpenState(monitorId,$user.ke,0)
        },1000)
    })
    .on('click','.snapshot-live-grid-monitor',function(){
        var monitorId = $(this).parents('[data-mid]').attr('data-mid')
        getSnapshot({
            monitor: loadedMonitors[monitorId],
        },function(url){
            $('#temp').html('<a href="'+url+'" download="'+formattedTimeForFilename()+'_'+monitorId+'.jpg">a</a>').find('a')[0].click();
        })
    })
    .on('click','.toggle-live-grid-monitor-logs',function(){
        var monitorItem = $(this).parents('[data-mid]')
        var monitorId = monitorItem.attr('data-mid')
        monitorItem.toggleClass('show_data')
        var dataBlocks = monitorItem.find('.stream-block,.mdl-data_window')
        var openMonitorLogs = monitorItem.hasClass('show_data')
        if(openMonitorLogs){
            loadVideoMiniList(monitorId)
            dataBlocks.addClass('col-md-6').removeClass('col-md-12')
        }else{
            dataBlocks.addClass('col-md-12').removeClass('col-md-6')
        }
        setLiveGridLogStreamOpenStatus(monitorId,openMonitorLogs)
    })
    .on('click','.toggle-live-grid-monitor-ptz-controls',function(){
        var monitorItem = $(this).parents('[data-mid]').attr('data-mid')
        drawPtzControlsOnLiveGridBlock(monitorItem)
        setGamepadMonitorSelection()
    })
    .on('click','.toggle-live-grid-monitor-menu,.mdl-overlay-menu-backdrop',function(){
        var monitorItem = $(this).parents('[data-mid]')
        var monitorId = monitorItem.attr('data-mid')
        monitorItem.find('.mdl-overlay-menu-backdrop').toggleClass('hidden')
    })
    .on('click','.mdl-overlay-menu',function(e){
        e.stopPropagation()
        return false;
    })
    .on('click','.toggle-live-grid-monitor-fullscreen',function(){
        var monitorItem = $(this).parents('[data-mid]')
        fullScreenLiveGridStream(monitorItem)
        setGamepadMonitorSelection()
    })
    .on('click','.run-live-grid-monitor-pop',function(){
        var monitorId = $(this).parents('[data-mid]').attr('data-mid')
        popOutMonitor(monitorId)
    })
    .on('click','.open-wallview',function(){
        createWallViewWindow()
    })
    .on('click','.toggle-monitor-substream',function(){
        var monitorId = $(this).parents('[data-mid]').attr('data-mid')
        toggleSubStream(monitorId)
    })
    .on('click','.run-live-grid-monitor-ptz',function(){
        var el = $(this)
        var monitorId = el.parents('[data-mid]').attr('data-mid')
        var switchChosen = el.attr('data-ptz-control')
        runPtzCommand(monitorId,switchChosen)
    })
    .on('mousedown','.run-live-grid-monitor-ptz-move',function(){
        var el = $(this)
        var monitorId = el.parents('[data-mid]').attr('data-mid')
        var switchChosen = el.attr('data-ptz-control')
        runPtzMove(monitorId,switchChosen,true)
    })
    .on('mouseup','.run-live-grid-monitor-ptz-move',function(){
        var el = $(this)
        var monitorId = el.parents('[data-mid]').attr('data-mid')
        var switchChosen = el.attr('data-ptz-control')
        runPtzMove(monitorId,switchChosen,false)
    })
    .on('click','.run-live-grid-monitor-onvif-goToPreset',function(){
        var monitorId = $(this).parents('[data-mid]').attr('data-mid')
        var presetToken = $(this).attr('data-preset')
        runPtzCommand(monitorId, 'goToPreset', { presetToken: padToThreeDigits(presetToken) })
    })
    .on('click','.run-live-grid-monitor-onvif-setPreset',function(){
        var monitorId = $(this).parents('[data-mid]').attr('data-mid')
        var presetToken = $(this).attr('data-preset')
        var presetName = $(this).text()
        var monitor = loadedMonitors[monitorId]
        var nonStandardOnvif = monitor.details.onvif_non_standard === '1'
        runPtzCommand(monitorId, 'setPreset', { presetToken: padToThreeDigits(presetToken), presetName: nonStandardOnvif ? undefined : presetName })
    })
    .on('click','.run-live-grid-monitor-onvif-startPatrol',function(){
        var monitorId = $(this).parents('[data-mid]').attr('data-mid')
        var startingPresetToken = currentPtzPresetPosition[monitorId]
        runPtzCommand(monitorId, 'startPatrol', { startingPresetToken })
    })
    .on('click','.run-live-grid-monitor-onvif-stopPatrol',function(){
        var monitorId = $(this).parents('[data-mid]').attr('data-mid')
        var presetToken = currentPtzPresetPosition[monitorId]
        runPtzCommand(monitorId, 'stopPatrol')
    })
    .on('click','.run-live-grid-monitor-onvif-addPreset',function(){
        var monitorId = $(this).parents('[data-mid]').attr('data-mid')
        $.confirm.create({
            title: lang["Save PTZ Preset"],
            body: `<input class="form-control form-control-sm" id="ptz-preset-save-name">`,
            clickOptions: {
                title: '<i class="fa fa-check"></i> ' + lang.Save,
                class: 'btn-success btn-sm'
            },
            clickCallback: async function(){
                var presetName = $('#ptz-preset-save-name').val();
                var onvifPresets = await runPtzCommand(monitorId, 'getPresets');
                var nextToken = incrementString(onvifPresets[onvifPresets.length - 1].token);
                await runPtzCommand(monitorId, 'setPreset', { presetToken: padToThreeDigits(nextToken), presetName });
                await drawPtzControlsOnLiveGridBlock(monitorId)
                await drawPtzControlsOnLiveGridBlock(monitorId)
            }
        });
    })
    .on('click','.run-live-grid-monitor-onvif-removePreset',function(){
        var el = $(this);
        var monitorId = el.parents('[data-mid]').attr('data-mid')
        var presetToken = el.attr('data-preset')
        $.confirm.create({
            title: lang["Delete PTZ Preset"],
            body: lang.DeleteThisMsg,
            clickOptions: {
                title: '<i class="fa fa-trash-o"></i> ' + lang.Delete,
                class: 'btn-danger btn-sm'
            },
            clickCallback: async function(){
                await runPtzCommand(monitorId, 'removePreset', { presetToken });
                await drawPtzControlsOnLiveGridBlock(monitorId)
                await drawPtzControlsOnLiveGridBlock(monitorId)
            }
        });
    })
    .on('click','.run-monitor-detection-trigger-test',function(){
        var el = $(this)
        var monitorId = el.parents('[data-mid]').attr('data-mid')
        runTestDetectionTrigger(monitorId)
    })
    .on('click','.run-monitor-detection-trigger-marker',function(){
        var el = $(this)
        var monitorId = el.parents('[data-mid]').attr('data-mid')
        addMarkAsEvent(monitorId)
    })
    .on('click','.run-monitor-detection-trigger-test-motion',function(){
        var el = $(this)
        var monitorId = el.parents('[data-mid]').attr('data-mid')
        runTestDetectionTrigger(monitorId,{
            "name":"Test Motion",
            "reason":"motion",
            matrices: [
                {
                    x: 5,
                    y: 5,
                    width: 150,
                    height: 150,
                    tag: 'Motion Test',
                    confidence: 100,
                }
            ]
        });
    })
    .on('click','.magnify-glass-live-grid-stream',function(){
        const monitorId = $(this).parents('[data-mid]').attr('data-mid')
        const streamWindow = $('.monitor_item[data-mid="'+monitorId+'"]')
        const monitor = loadedMonitors[monitorId]
        if(monitor.magnifyStreamEnabled){
            monitor.magnifyStreamEnabled = false
            clearTimeout(monitor.magnifyMouseActionTimeout)
            var zoomHoverShade = createMagnifyStreamMask({
                p: streamWindow,
            })
            zoomHoverShade
                .off('mousemove', monitor.magnifyMouseAction)
                .off('touchmove', monitor.magnifyMouseAction);
            streamWindow
                .find('.zoomGlass,.zoomHoverShade').remove()
        }else{
            streamWindow.find('.mdl-overlay-menu-backdrop').addClass('hidden')
            monitor.magnifyStreamEnabled = true
            var zoomHoverShade = createMagnifyStreamMask({
                p: streamWindow,
            })
            monitor.magnifyMouseAction = function(e){
                clearTimeout(monitor.magnifyMouseActionTimeout)
                monitor.magnifyMouseActionTimeout = setTimeout(function(){
                    magnifyStream({
                        p: streamWindow,
                        zoomAmount: 1,
                        auto: false,
                        animate: false,
                        pageX: e.pageX,
                        pageY:  e.pageY,
                        attribute: '.magnify-glass-live-grid-stream'
                    })
                },50)
            }
            zoomHoverShade
                .on('mousemove', monitor.magnifyMouseAction)
                .on('touchmove', monitor.magnifyMouseAction)
        }
    })
    .on('click','.open-timeline-for-monitor',function(){
        const { parentEl, monitorId, peerConnectKey, monitorLiveId, websocket, shinobiServer } = getMonitorInfo(this);
        resetTimelineWithMonitors(peerConnectKey, [monitorId])
    })
    liveGridSideMenu.find('.open-next-monitors').click(function(){
        openNextMonitors()
    })
    liveGridSideMenu.find('.open-previous-monitors').click(function(){
        openPreviousMonitors()
    })
    autoPlaceMonitorOptions.click(async function(){
        var el = $(this);
        var gridNumber = parseInt(el.attr('data-number')) || 3
        autoPlaceCurrentMonitorItemsOnLiveGrid(gridNumber)
        saveLiveGridBlockPositions()
        dashboardOptions('liveGridAutoPlaceSize', gridNumber)
        setCosmeticDefaultGridSize()
        if(! await closeExtraMonitors() || getNumberOfCurrentlyOpen() === 0){
            // openNextMonitors()
        }
        onWindowResize()
        compactLiveGrid()
    });
    $('.open-all-monitors').click(function(){
        openAllLiveGridPlayers()
    })
    $('.close-all-monitors').click(function(){
        closeAllLiveGridPlayers()
    });
    var dontShowDetectionSelectionOnStart = dashboardOptions().dontShowDetection != 1
    initLiveGrid()
    addOnTabOpen('liveGrid', function () {
        loadPreviouslyOpenedLiveGridBlocks()
    })
    addOnTabReopen('liveGrid', function () {
        pauseAllLiveGridPlayers(true)
        updateAllLiveGridElementsHeightWidth()
        onWindowResizeTimeout(null, function(){
            setPauseScrollTimeout(true)
        })
    })
    addOnTabAway('liveGrid', function () {
        pauseAllLiveGridPlayers(false)
    })
    onDashboardReady(function (d){
        if(dashboardOptions().switches.autoOpenOnLoad === 1){
            loadPreviouslyOpenedLiveGridBlocks()
        }
    })
    onToggleSideBarMenuHide(function (isHidden){
        setTimeout(function(){
            updateAllLiveGridElementsHeightWidth()
            onWindowResizeTimeout(null, function(){
                setPauseScrollTimeout(true)
            })
        },2000)
    })
    onWebSocketEvent(async function (d){
        switch(d.f){
            case'control_ptz_preset_changed':
                currentPtzPresetPosition[d.mid] = d.profileToken;
            break;
            case'video_build_success':
                d.status = 1
                d.mid = d.id || d.mid
                var monitorId = d.mid
                var videoTime = d.time
                loadedVideosInMemory[`${monitorId}${videoTime}${d.type}`] = d
                if(liveGridElements[monitorId] && liveGridElements[monitorId].streamElement)drawVideoCardToMiniList(monitorId,createVideoLinks(d),false)
            break;
            case'monitor_watch_off':case'monitor_stopping':
                var monitorId = d.mid || d.id
                closeLiveGridPlayer(monitorId,(d.f === 'monitor_watch_off'))
                if(watchToggleCallback[monitorId])watchToggleCallback[monitorId]()
            break;
            case'monitor_status':
                if(
                    tabTree.name === 'liveGrid' &&
                    (
                        d.code === 2 ||
                        d.code === 3
                    )
                ){
                    var monitorId = d.mid || d.id
                    setTimeout(function(){
                        if(!toStayClosed[monitorId])callMonitorToLiveGrid(loadedMonitors[monitorId])
                    },2000)
                }
            break;
            case'substream_start':
                loadedMonitors[d.mid].subStreamChannel = d.channel
                loadedMonitors[d.mid].subStreamActive = true
                showHideSubstreamActiveIcon(d.mid,true)
                setTimeout(() => {
                    resetMonitorCanvas(d.mid,true,d.channel)
                },3000)
            break;
            case'substream_end':
                loadedMonitors[d.mid].subStreamChannel = null
                loadedMonitors[d.mid].subStreamActive = false
                resetMonitorCanvas(d.mid,true,null)
                showHideSubstreamActiveIcon(d.mid,false)
            break;
            case'monitor_watch_on':
                var monitorId = d.mid || d.id
                var loadedMonitor = loadedMonitors[monitorId]
                var subStreamChannel = d.subStreamChannel
                var monitorHeight = null;
                if(!loadedMonitor.subStreamChannel && loadedMonitor.details.stream_type === 'useSubstream'){
                    toggleSubStream(monitorId,function(){
                        drawLiveGridBlock(loadedMonitors[monitorId],subStreamChannel,monitorHeight)
                        saveLiveGridBlockOpenState(monitorId,$user.ke,1)
                    })
                }else{
                    drawLiveGridBlock(loadedMonitors[monitorId],subStreamChannel,monitorHeight)
                    saveLiveGridBlockOpenState(monitorId,$user.ke,1)
                }
                showHideSubstreamActiveIcon(monitorId,!!subStreamChannel)
                if(watchToggleCallback[monitorId])watchToggleCallback[monitorId]()
            break;
            case'detector_trigger':
                var monitorId = d.id
                var matrices = d.details.matrices
                var playingNow = liveGridPlayingNow[monitorId]
                if(!window.dontShowDetection && playingNow){
                    var liveGridElement = liveGridElements[monitorId]
                    var monitorElement = liveGridElement.monitorItem
                    var livePlayerElement = loadedLiveGrids[monitorId]
                    if(d.doObjectDetection === true){
                        monitorElement.addClass('doObjectDetection')
                        clearTimeout(livePlayerElement.detector_trigger_doObjectDetection_timeout)
                        livePlayerElement.detector_trigger_doObjectDetection_timeout = setTimeout(function(){
                            monitorElement.removeClass('doObjectDetection')
                        },3000)
                    }else{
                        monitorElement.removeClass('doObjectDetection')
                    }
                    if(matrices && matrices.length > 0){
                        await drawMatrices(d,{
                            theContainer: liveGridElement.eventObjects,
                            height: liveGridElement.height,
                            width: liveGridElement.width,
                        }, null, true)
                    }
                    if(d.details.confidence){
                        var eventConfidence = d.details.confidence
                        if(eventConfidence > 100)eventConfidence = 100
                        liveGridElement.motionMeter.css('width',eventConfidence + '%');
                        liveGridElement.motionMeterText[0].innerHtml = d.details.confidence+'% change in <b>'+d.details.name+'</b>'
                    }
                    clearTimeout(livePlayerElement.detector_trigger_timeout);
                    livePlayerElement.detector_trigger_timeout = setTimeout(function(){
                        liveGridElement.eventObjects.find('.stream-detected-object,.stream-detected-point').remove()
                    },800);
                    if(dontShowDetectionSelectionOnStart){
                        monitorElement.addClass('detector_triggered')
                        clearTimeout(livePlayerElement.detector_trigger_ui_indicator_timeout);
                        livePlayerElement.detector_trigger_ui_indicator_timeout = setTimeout(function(){
                            monitorElement.removeClass('detector_triggered');
                        },1000 * 15);
                    }
                    playAudioAlert()
                    var monitorPop = monitorPops[monitorId]
                    if(window.popLiveOnEvent && (!monitorPop || !monitorPop.isOpen)){
                        popOutMonitor(monitorId)
                    }
                    // console.log({
                    //     ke: d.ke,
                    //     mid: monitorId,
                    //     log: {
                    //         type: lang['Event Occurred'],
                    //         msg: d.details,
                    //     }
                    // })
                }
            break;
        }
    })
    $(window).focus(function(){
        if(canBackgroundStream()){
            pauseAllLiveGridPlayers(true)
        }
    }).blur(function(){
        if(canBackgroundStream()){
            pauseAllLiveGridPlayers(false)
        }
    }).resize(async function(){
        onWindowResizeTimeout(null, function(){
            setPauseScrollTimeout(true)
        })
        // saveLiveGridBlockPositions()
    });
    liveGridTab.scroll(function(){
        setPauseScrollTimeout()
    })
    function exitFullscreenHandler(){
        if (!document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement){
            setTimeout(function(){
                fullscreenInUse = false
            },1000)
        }else{
            fullscreenInUse = true
        }
    }
    document.addEventListener('fullscreenchange', exitFullscreenHandler, false);
    document.addEventListener('mozfullscreenchange', exitFullscreenHandler, false);
    document.addEventListener('MSFullscreenChange', exitFullscreenHandler, false);
    document.addEventListener('webkitfullscreenchange', exitFullscreenHandler, false);
    dashboardSwitchCallbacks.monitorOrder = function(toggleState){
        if(toggleState !== 1){
            $('.monitor_item').attr('gs-auto-position','yes')
        }else{
            $('.monitor_item').attr('gs-auto-position','no')
        }
    }
    dashboardSwitchCallbacks.dontMonStretch = function(toggleState){
        var theBody = $('body')
        if(toggleState !== 1){
            theBody.addClass('dont-stretch-monitors')
        }else{
            theBody.removeClass('dont-stretch-monitors')
        }
    }
    dashboardSwitchCallbacks.dontShowDetection = function(toggleState){
        if(toggleState !== 1){
            window.dontShowDetection = false
        }else{
            window.dontShowDetection = true
        }
    }
    dashboardSwitchCallbacks.alertOnEvent = function(toggleState){
        // audio_alert
        if(toggleState !== 1){
            window.audioAlertOnEvent = false
        }else{
            window.audioAlertOnEvent = true
        }
    }
    dashboardSwitchCallbacks.popOnEvent = function(toggleState){
        if($user.details.event_mon_pop === '1'){
            window.popLiveOnEvent = true
        }else if(toggleState !== 1){
            window.popLiveOnEvent = false
        }else{
            window.popLiveOnEvent = true
        }
    }
    dashboardSwitchCallbacks.monitorMuteAudio = function(toggleState){
        var monitorMutes = dashboardOptions().monitorMutes || {}
        $('.monitor_item video').each(function(n,vidEl){
            var el = $(this)
            var monitorId = el.parents('[data-mid]').attr('data-mid')
            if(toggleState === 1){
                vidEl.muted = true
            }else{
                if(monitorMutes[monitorId] !== 1){
                    vidEl.muted = false
                }
            }
        })
    }
    createEventHandler('onLiveGridBlockOpen')
    createEventHandler('onLiveGridPreBlockOpen')
    createEventHandler('onLiveGridResize')
    // onDashboardReady(function(){
        onPageInit()
    // })
    dashboardSwitchCallbacks.jpegMode = toggleJpegMode
    window.openMonitorsInLiveGridByTag = openMonitorsInLiveGridByTag;
    window.closeMonitorsInLiveGridByTag = closeMonitorsInLiveGridByTag;
    window.openNextMonitors = openNextMonitors;
    window.openAllLiveGridPlayers = openAllLiveGridPlayers;
    window.openLiveGridPage = openLiveGridPage;
    window.openLiveGrid = openLiveGrid;
    window.callMonitorToLiveGrid = callMonitorToLiveGrid;
    window.monitorsWatchOnLiveGrid = monitorsWatchOnLiveGrid;
    window.closeAllLiveGridPlayers = closeAllLiveGridPlayers;
    window.closeLiveGridPlayers = closeLiveGridPlayers;
    window.liveGridData = liveGridData;
    window.liveGridOnWindowResize = onWindowResize;
    window.getLiveGridData = getLiveGridData;
    detectionDrawDelays = dashboardOptions().detectionDrawDelays || {}
})
