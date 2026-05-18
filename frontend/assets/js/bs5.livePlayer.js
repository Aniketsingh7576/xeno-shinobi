var loadedLivePlayers = {}
var runningJpegStreams = {}
function createLivePlayerTab(monitor){
    if(monitor.mode === 'stop'){
        new PNotify({
            title: lang.sorryNo,
            text: lang[`Cannot watch a monitor that isn't running.`],
            type: 'danger'
        })
        return
    }
    var monitorDetails = safeJsonParse(monitor.details)
    var newTabId = `livePlayer-${monitor.mid}`
    var tabLabel = `<b>${lang['Stream']}</b> : ${monitor.name}<br><small>${monitor.mid}</small>`
    var streamElement
    if(!loadedLivePlayers[monitor.mid])loadedLivePlayers[monitor.mid] = {}
    switch(monitorDetails.stream_type){
        case'hls':case'flv':case'mp4':
            streamElement = `<video class="stream-element" playsinline muted autoplay></video>`;
        break;
        case'mjpeg':
            streamElement = '<iframe class="stream-element"></iframe>';
        break;
        case'jpeg':
            streamElement = '<img class="stream-element">';
        break;
        default://base64//h265
            streamElement = '<canvas class="stream-element"></canvas>';
        break;
    }
    var baseHtml = `<main class="container page-tab tab-livePlayer" id="tab-${newTabId}" monitor-id="${monitor.mid}">
        <div class="my-3 bg-dark text-white rounded shadow-sm">
          <div class="p-3">
            <h6 class="monitor-title border-bottom-dotted border-bottom-dark pb-2 mb-0">${tabLabel}</h6>
          </div>
          <div style="position: relative">
              <div class="tab-livePlayer-event-objects" style="position: absolute;width: 100%; height: 100%; z-index: 10"></div>
              ${streamElement}
          </div>
          <div class="p-3">
              <div class="d-block">
                  <b class="flex-grow-1">${lang.Host}</b>
                  <div class="video-time">${monitor.host}</div>
              </div>
              <small class="d-block text-end mt-3">
                <a class="go-back btn badge">${lang['Back']}</a>
              </small>
          </div>
        </div>
    </main>`
    var tabCreateResponse = createNewTab(newTabId,tabLabel,baseHtml,{},null,'livePlayer')
    if(!tabCreateResponse.existAlready){
        initiateLivePlayer(monitor)
    }
}
function initiateLivePlayer(monitor){
    var livePlayerElement = loadedLivePlayers[monitor.mid]
    var details = monitor.details
    var loadedPlayer = loadedLivePlayers[monitor.mid]
    var websocketPath = checkCorrectPathEnding(location.pathname) + 'socket.io'
    var newTabId = `livePlayer-${monitor.mid}`
    var containerElement = $(`#tab-${newTabId}`)
    if(location.search === '?p2p=1'){
        websocketPath = '/socket.io'
        // websocketQuery.machineId = machineId
    }
    switch(details.stream_type){
        case'jpeg':
            console.log('Stream Type : JPEG Mode')
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
//                                channel: channel
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
//                                    var base64Frame = 'data:image/jpeg;base64,'+$.ccio.base64ArrayBuffer(imageData)
                        loadedPlayer.imageLoading = true
//                                    loadedPlayer.image.src = base64Frame
                        var arrayBufferView = new Uint8Array(imageData);
                        var blob = new Blob( [ arrayBufferView ], { type: "image/jpeg" } );
                        loadedPlayer.imageUrl = URL.createObjectURL( blob );
                        loadedPlayer.image.src = loadedPlayer.imageUrl
                        loadedPlayer.last_frame = 'data:image/jpeg;base64,'+$.ccio.base64ArrayBuffer(imageData)
                    }catch(er){
                        console.log(er)
                        $.ccio.log('base64 frame')
                    }
                    $.ccio.init('signal',d);
                })
            })
        break;
        case'mp4':
            setTimeout(function(){
                var stream = containerElement.find('.stream-element');
                var onPoseidonError = function(){
                    // setTimeout(function(){
                        // $.ccio.cx({f:'monitor',ff:'watch_on',id:monitor.mid},user)
                    // },5000)
                }
                if(!loadedPlayer.PoseidonErrorCount)loadedPlayer.PoseidonErrorCount = 0
                if(loadedPlayer.PoseidonErrorCount >= 5)return
                if(monitor.details.stream_flv_type==='ws'){
                    if(loadedPlayer.Poseidon){
                        loadedPlayer.Poseidon.stop()
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
                            onError : onPoseidonError
                        })
                        loadedPlayer.Poseidon.start();
                    }catch(err){
                        // onPoseidonError()
                        console.log('onTryPoseidonError',err)
                    }
                }else{
                    stream.attr('src',getApiPrefix(`mp4`)+'/'+monitor.mid+'/s.mp4')
                    stream[0].onerror = function(err){
                        console.error(err)
                    }
                }
            },1000)
        break;
        case'flv':
            if (flvjs.isSupported()) {
                if(loadedPlayer.flv){
                    loadedPlayer.flv.destroy()
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
                        query: websocketQuery
                    }
                }else{
                    options = {
                        type: 'flv',
                        isLive: true,
                        url: getApiPrefix(`flv`)+'/'+monitor.mid+'/s.flv'
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
                $.ccio.init('note',{title:'Stream cannot be started',text:'FLV.js is not supported on this browser. Try another stream type.',type:'error'});
            }
        break;
        case'hls':
            function createSteamNow(){
                clearTimeout(loadedPlayer.m3uCheck)
                var url = getApiPrefix(`hls`) + '/' + monitor.mid + '/s.m3u8'
                $.getJSON(url,function(m3u){
                    if(m3u == 'File Not Found'){
                        loadedPlayer.m3uCheck = setTimeout(function(){
                            createSteamNow()
                        },2000)
                    }else{
                        var video = containerElement.find('.stream-element')[0]
                        console.log(containerElement)
                        if (isAppleDevice) {
                            video.src = url;
                            video.addEventListener('loadedmetadata', function() {
                              setTimeout(function(){
                                video.play();
                              },3000)
                            }, false);
                        }else{
                            loadedPlayer.hlsGarbageCollector=function(){
                                if(loadedPlayer.hls){
                                    loadedPlayer.hls.destroy()
                                    URL.revokeObjectURL(video.src)
                                }
                                loadedPlayer.hls = new Hls()
                                loadedPlayer.hls.loadSource(url)
                                loadedPlayer.hls.attachMedia(video)
                                loadedPlayer.hls.on(Hls.Events.MANIFEST_PARSED,function() {
                                    if (video.paused) {
                                        video.play();
                                    }
                                });
                            }
                            loadedPlayer.hlsGarbageCollector()
                            loadedPlayer.hlsGarbageCollectorTimer=setInterval(loadedPlayer.hlsGarbageCollector,1000*60*20)
                        }
                    }
                })
            }
            createSteamNow()
        break;
        case'mjpeg':
            var liveStreamElement = containerElement.find('.stream-element')
            var setSource = function(){
                liveStreamElement.attr('src',getApiPrefix(`mjpeg`)+'/'+d.id)
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
        case'h265':
            var player = loadedPlayer.h265Player
            var video = containerElement.find('.stream-element')[0]
            if (player) {
                player.stop()
            }
            loadedPlayer.h265Player = new libde265.RawPlayer(video)
            var player = loadedPlayer.h265Player
            player.set_status_callback(function(msg, fps) {
            })
            player.launch()
            if(loadedPlayer.h265Socket && loadedPlayer.h265Socket.connected){
                loadedPlayer.h265Socket.disconnect()
            }
            if(loadedPlayer.h265HttpStream && loadedPlayer.abort){
                loadedPlayer.h265HttpStream.abort()
            }
            if(monitor.details.stream_flv_type==='ws'){
              loadedPlayer.h265Socket = io(location.origin,{ path: websocketPath, query: websocketQuery, transports: ['websocket'], forceNew: false})
              var ws = loadedPlayer.h265Socket
              ws.on('diconnect',function(){
                  console.log('h265Socket Stream Disconnected')
              })
              ws.on('connect',function(){
                  ws.emit('h265',{
                      auth: $user.auth_token,
                      uid: $user.uid,
                      ke: d.ke,
                      id: d.id,
//                                channel: channel
                  })
                  ws.on('data',function(imageData){
                      player._handle_onChunk(imageData)
                  })
              })
            }else{
              var url = getApiPrefix(`h265`) + '/' + d.id + '/s.hevc';
              loadedPlayer.h265HttpStream = player.createHttpStream(url)
            }
        break;
    }
}
function closeLivePlayer(tabId){
    try{
        var monitorId = tabId.replace('livePlayer-','')
        var livePlayerElement = loadedLivePlayers[monitorId]
        if(livePlayerElement.hls){livePlayerElement.hls.destroy()}
        if(livePlayerElement.Poseidon){livePlayerElement.Poseidon.stop()}
        if(livePlayerElement.Base64){livePlayerElement.Base64.disconnect()}
        if(livePlayerElement.h265Socket){livePlayerElement.h265Socket.disconnect()}
        if(livePlayerElement.h265Player){livePlayerElement.h265Player.stop()}
        if(livePlayerElement.dash){livePlayerElement.dash.reset()}
        if(livePlayerElement.h265HttpStream && livePlayerElement.abort){
            livePlayerElement.h265HttpStream.abort()
        }
    }catch(err){
        console.log(err)
    }
}
function stopJpegStream(monitorId){
    console.log('stopJpegStream')
    // clearTimeout(loadedMonitors[monitorId].jpegInterval)
    // delete(loadedMonitors[monitorId].jpegInterval)
    // $(`#monitor_live_${monitorId} .stream-element`).unbind('load')
}
function startJpegStream(monitorId){
    console.log('startJpegStream')
    // var loadedMonitor = loadedMonitors[monitorId]
    // var monitorDetails = loadedMonitor.details
    // var jpegInterval = parseFloat(monitorDetails.jpegInterval)
    // if(!monitorDetails.jpegInterval||monitorDetails.jpegInterval===''||isNaN(monitorDetails.jpegInterval)){monitorDetails.jpegInterval=1}
    // $.ccio.tm('stream-element',$.ccio.mon[d.ke+d.mid+user.auth_token]);
    // monitorDetails.e=$('#monitor_live_'+d.mid+user.auth_token+' .stream-element');
    // $.ccio.init('jpegModeStop',d,user);
    // monitorDetails.run=function(){
    //     monitorDetails.e.attr('src',$.ccio.init('location',user)+user.auth_token+'/jpeg/'+d.ke+'/'+d.mid+'/s.jpg?time='+(new Date()).getTime())
    // }
    // monitorDetails.e.on('load',function(){
    //     $.ccio.mon[d.ke+d.mid+user.auth_token].jpegInterval=setTimeout(monitorDetails.run,1000/monitorDetails.jpegInterval);
    // }).on('error',function(){
    //     $.ccio.mon[d.ke+d.mid+user.auth_token].jpegInterval=setTimeout(monitorDetails.run,1000/monitorDetails.jpegInterval);
    // })
    // monitorDetails.run()
}

$(document).ready(function(e){
    onWebSocketEvent(function (d){
        switch(d.f){
            case'monitor_watch_off':case'monitor_stopping':
                // // FOR GRID/MONTAGE
                // // destroyLivePlayerBlock
                // if(user===$user){
                //     d.chosen_set='watch_on'
                // }else{
                //     d.chosen_set='watch_on_links'
                // }
                // d.o=dashboardOptions()[d.chosen_set];
                // if(!d.o[d.ke]){d.o[d.ke]={}};d.o[d.ke][d.id]=0;dashboardOptions(d.chosen_set,d.o);
                // $.ccio.destroyStream(d,user,(d.f === 'monitor_watch_off'))
            break;
            case'monitor_watch_on':
                // // FOR GRID/MONTAGE
                // initLivePlayerBlock()
            break;
            case'mode_jpeg_off':
                // // FOR GRID/MONTAGE
                // dashboardOptions('jpeg_on',"0");
                // $.each($.ccio.mon,function(n,v,x){
                //     $.ccio.init('jpegModeStop',v);
                //     if(v.watch===1){
                //         $.ccio.cx({f:'monitor',ff:'watch_on',id:v.mid},user)
                //     }
                // });
                // $('body').removeClass('jpegMode')
            break;
            case'mode_jpeg_on':
                // // FOR GRID/MONTAGE
                // dashboardOptions('jpeg_on',true);
                // $.ccio.init('jpegModeAll');
                // $('body').addClass('jpegMode')
            break;
        }
    })
})
