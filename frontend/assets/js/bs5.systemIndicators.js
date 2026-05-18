$(document).ready(async function(){
    var indicatorBarsContainer = $('.disk-indicator-bars')
    var cpuIndicator = $('#indicator-cpu')
    var cpuIndicatorBar = cpuIndicator.find('.progress-bar')
    var cpuIndicatorPercentText = cpuIndicator.find('.indicator-percent')
    var ramIndicator = $('#indicator-ram')
    var ramIndicatorBar = ramIndicator.find('.progress-bar')
    var ramIndicatorUsed = ramIndicator.find('.used')
    var ramIndicatorPercentText = ramIndicator.find('.indicator-percent')
    var diskIndicator = $('#indicator-disk')
    var diskIndicatorBar = diskIndicator.find('.progress-bar')
    var diskIndicatorBarUsed = diskIndicator.find('.value')
    var diskIndicatorPercentText = diskIndicator.find('.indicator-percent')
    var loadedIndicators = {}
    var uploaders = await shinobiUtils.getUploaders()
    function drawIndicatorBar(item){
        var html = `<div class="box-wrapper " style>
            <div id="${item.id ? item.id : `indicator-${item.name}`}" class="mb-2">
                <div class="d-flex flex-row text-white mb-1">
                    <div class="pr-2">
                        <i class="fa fa-${item.icon}"></i>
                    </div>
                    <div class="flex-grow-1">
                        <small>${item.label}</small>
                    </div>
                    <div>
                        <small class="indicator-percent">0%</small>
                    </div>
                </div>
                <div>
                    ${!item.multiple ? `<div class="progress">
                        <div class="progress-bar progress-bar-info" role="progressbar" style="width: 0%;"></div>
                    </div>` : `<div class="progress">
                        <div class="progress-bar progress-bar-${item.color0 || 'info'}" title="${item.title0 || ''}" role="progressbar" style="width: 0%;"></div>
                        <div class="progress-bar progress-bar-${item.color1 || 'danger'}" title="${item.title1 || ''}" role="progressbar" style="width: 0%;"></div>
                        <div class="progress-bar progress-bar-${item.color2 || 'warning'}" title="${item.title2 || ''}" role="progressbar" style="width: 0%;"></div>
                    </div>`}
                </div>
            </div>
        </div>`
        $('.disk-indicator-bars').append(html)
    }
    function drawAddStorageIndicators(peerConnectKey){
        $.each(addStorage,function(n,storage){
            drawIndicatorBar({
                multiple: true,
                icon: 'hdd-o',
                name: storage.name,
                label: `<span style="text-transform:capitalize">${storage.name}</span> : <span class="value"></span>`,
            })
        })
    }
    function drawCloudStorageIndicators(peerConnectKey){
        $.each(uploaders,function(uploaderId,{ humanName, enabled }){
            if(enabled){
                drawIndicatorBar({
                    id: `indicator-${uploaderId}`,
                    multiple: true,
                    icon: 'cloud',
                    name: humanName,
                    label: `<span style="text-transform:capitalize">${humanName}</span> : <span class="value"></span>`,
                })
            }
        })
    }
    function drawIndicatorBars(){
        drawAddStorageIndicators()
        cacheAddStorageIndicators()
        drawCloudStorageIndicators()
        cacheUploaderIndicators()
    }
    function cacheAddStorageIndicators(){
        $.each(addStorage,function(n,storage){
            var el = $(`#indicator-${storage.name}`)
            loadedIndicators[storage.name] = {
                value: el.find('.value'),
                percent: el.find('.indicator-percent'),
                progressBar: el.find('.progress-bar'),
            }
        })
    }
    function cacheUploaderIndicators(){
        $.each(uploaders,function(uploaderId,storage){
            var el = $(`#indicator-${uploaderId}`)
            loadedIndicators[uploaderId] = {
                value: el.find('.value'),
                percent: el.find('.indicator-percent'),
                progressBar: el.find('.progress-bar'),
            }
        })
    }
    function setDiskUsed({
        diskLimit,
        diskUsed,
        usedSpaceVideos,
        usedSpaceTimelapseFrames,
        usedSpaceFilebin
    }){
        var percent = parseDiskUsePercent(diskUsed,diskLimit);
        var videosPercent = parseDiskUsePercent(usedSpaceVideos,diskLimit);
        var timelapsePercent = parseDiskUsePercent(usedSpaceTimelapseFrames,diskLimit);
        var fileBinPercent = parseDiskUsePercent(usedSpaceFilebin,diskLimit);
        var humanText = parseFloat(diskUsed)
        if(humanText > 1000){
            humanText = (humanText / 1000).toFixed(2) + ' GB'
        }else{
            humanText = humanText.toFixed(2) + ' MB'
        }
        diskIndicatorBarUsed.html(humanText)
        diskIndicatorPercentText.html(percent)
        diskIndicatorBar[0].style.width = videosPercent
        diskIndicatorBar[0].title = `${lang['Video Share']} : ${videosPercent}`
        diskIndicatorBar[1].style.width = timelapsePercent
        diskIndicatorBar[1].title = `${lang['Timelapse Frames Share']} : ${timelapsePercent}`
        diskIndicatorBar[2].style.width = fileBinPercent
        diskIndicatorBar[2].title = `${lang['FileBin Share']} : ${fileBinPercent}`
    }
    function setOtherDiskUsed({
         name, sizeLimit, usedSpace, usedSpaceVideos, usedSpaceTimelapseFrames = 0,
         diskIndicator, diskIndicatorBars
    }){
        usedSpaceVideos = usedSpaceVideos || usedSpace;
        var percent = parseDiskUsePercent(usedSpace,sizeLimit);
        var videosPercent = parseDiskUsePercent(usedSpaceVideos,sizeLimit);
        var timelapsePercent = parseDiskUsePercent(usedSpaceTimelapseFrames,sizeLimit);
        //
        var humanValue = parseFloat(usedSpace)
        if(humanValue > 1000){
            humanValue = (humanValue/1000).toFixed(2)+' GB'
        }else{
            humanValue = humanValue.toFixed(2)+' MB'
        }
        diskIndicator.value.html(humanValue)
        diskIndicator.percent.html(percent)
        diskIndicatorBars[0].style.width = videosPercent
        diskIndicatorBars[0].title = `${lang['Video Share']} : ${videosPercent}`
        diskIndicatorBars[1].style.width = timelapsePercent
        diskIndicatorBars[1].title = `${lang['Timelapse Frames Share']} : ${timelapsePercent}`
    }
    function parseDiskUsePercent(diskUsed,diskLimit){
        return parseFloat((diskUsed/diskLimit)*100).toFixed(1)+'%'
    }
    onWebSocketEvent(function (d){
        switch(d.f){
            case'init_success':
                var coreCount = d.os.cpuCount
                var operatingSystem = d.os.platform
                var totalRAM = d.os.totalmem
                cpuIndicator.find('.os_cpuCount').text(coreCount)
                cpuIndicator.find('.os_platform').text(operatingSystem)
                ramIndicatorUsed.attr('title',`Total : ${(totalRAM/1048576).toFixed(2)}`)
                if(d.os.cpuCount > 1){
                    cpuIndicator.find('.os_cpuCount_trailer').html('s')
                }
            break;
            case'os':
                var cpuPercent = parseFloat(d.cpu).toFixed(1) + '%'
                cpuIndicatorBar.css('width',cpuPercent)
                cpuIndicatorPercentText.html(cpuPercent)
                //ram
                var ramPercent = parseFloat(d.ram.percent).toFixed(1) + '%'
                ramIndicatorBar.css('width',ramPercent)
                ramIndicatorPercentText.html(ramPercent)
                ramIndicatorUsed.html(d.ram.used.toFixed(2))
            break;
            case'cloudDiskUsed':
                $.each(uploaders,function(uploaderId, { humanName }){
                    try{
                        const { name, sizeLimit, usedSpace } = d.cloudDisks[uploaderId]
                        var diskIndicator = loadedIndicators[uploaderId]
                        var diskIndicatorBars = diskIndicator.progressBar
                        setOtherDiskUsed({
                             name, sizeLimit, usedSpace,
                             diskIndicator, diskIndicatorBars
                        })
                    }catch(err){
                        // console.log(uploaderId)
                        // console.log(err)
                    }
                })
            break;
            case'diskUsed':
                var diskLimit = d.limit || 10000
                var diskUsed = d.size
                var { usedSpaceVideos, usedSpaceTimelapseFrames, usedSpaceFilebin } = d;
                setDiskUsed({
                    diskLimit,
                    diskUsed,
                    usedSpaceVideos,
                    usedSpaceTimelapseFrames,
                    usedSpaceFilebin
                })
                if(d.addStorage){
                    $.each(d.addStorage,function(n, { name, sizeLimit, usedSpace, usedSpaceVideos, usedSpaceTimelapseFrames }){
                        var diskIndicator = loadedIndicators[name]
                        var diskIndicatorBars = diskIndicator.progressBar
                        setOtherDiskUsed({
                             name, sizeLimit, usedSpace, usedSpaceVideos, usedSpaceTimelapseFrames,
                             diskIndicator, diskIndicatorBars
                        })
                    })
                }
            break;
        }
    })
    drawIndicatorBars()
})
