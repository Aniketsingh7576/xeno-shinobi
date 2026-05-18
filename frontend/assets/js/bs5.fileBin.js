var loadedFilesInMemory = {}
function getFileBinHref(file){
    var href = getApiPrefix('fileBin') + '/' + file.mid + '/' + file.name
    return href
}
function loadFileData(video){
    delete(video.f)
    loadedFilesInMemory[`${video.mid}${video.name}`] = Object.assign({},video,{
        href: getFileBinHref(video),
        filename: video.name,
    })
}
function getFileBinFiles(monitorId,startDate,endDate){
    return new Promise((resolve) => {
        var apiURL = `${getApiPrefix('fileBin')}${monitorId ? `/${monitorId}` : ''}`;
        var queryString = ['start=' + startDate,'end=' + endDate,'limit=0']
        $.getJSON(apiURL + '?' + queryString.join('&'),function(data){
            loadedFilesInMemory = {}
            $.each(data.files,function(n,file){
                loadFileData(file)
            });
            resolve(data)
        })
    })
}
function fileBinTableHeaderMap(headerColumns,headerConcat){
    return headerColumns && headerConcat ? headerColumns : [
          {
              field: 'mid',
              title: '',
              checkbox: true,
              formatter: () => {
                  return {
                      checked: false
                  }
              }
          },
          {
            field: 'monitorName',
            title: lang['Monitor']
          },
          {
            field: 'name',
            title: lang['Filename']
          },
          {
            field: 'time',
            title: lang['Time Created']
          },
          {
            field: 'size',
            title: ''
          },
          {
            field: 'buttons',
            title: ''
          }
    ].concat(headerColumns || []);
}
function fileBinTableMap(files,writeOptions){
    return files.map((file) => {
        var href = getApiPrefix('fileBin') + '/' + file.mid + '/' + file.name
        var isVideo = file.name.includes('.mp4') || file.name.includes('.webm')
        return Object.assign({
            monitorName: `<b>${loadedMonitors[file.mid]?.name || file.mid}</b>`,
            mid: file.mid,
            name: file.name,
            time: `
                <div><b>${lang.Created}</b> ${formattedTime(file.time, 'DD-MM-YYYY hh:mm:ss AA')}</div>
                ${file.details.start ? `<div><b>${lang.Started}</b> ${formattedTime(file.details.start, 'DD-MM-YYYY hh:mm:ss AA')}</div>` : ''}
                ${file.details.end ? `<div><b>${lang.Ended}</b> ${formattedTime(file.details.end, 'DD-MM-YYYY hh:mm:ss AA')}</div>` : ''}
            `,
            size: convertKbToHumanSize(file.size),
            buttons: `
                <div class="row-info" data-mid="${file.mid}" data-ke="${file.ke}" data-time="${file.time}" data-name="${file.name}">
                    <a class="btn btn-sm btn-primary" href="${href}" download title="${lang.Download}"><i class="fa fa-download"></i></a>
                    ${isVideo ? `<a class="btn btn-sm btn-primary preview-video" href="${href}" title="${lang.Play}"><i class="fa fa-play"></i></a>` : ``}
                    ${permissionCheck('video_delete',file.mid) ? `<a class="btn btn-sm btn-${file.archive === 1 ? `success status-archived` : `default`} archive-file" title="${lang.Archive}"><i class="fa fa-${file.archive === 1 ? `lock` : `unlock-alt`}"></i></a>` : ''}
                    ${permissionCheck('video_delete',file.mid) ? `<a class="btn btn-sm btn-danger delete-file" title="${lang.Delete}"><i class="fa fa-trash-o"></i></a>` : ''}
                </div>
            `,
        },writeOptions ? writeOptions(file) : {})
    });
}
$(document).ready(function(e){
    var theEnclosure = $('#tab-fileBinView')
    var monitorsList = theEnclosure.find('.monitors_list')
    var dateSelector = theEnclosure.find('.date_selector')
    var fileBinDrawArea = $('#fileBin_draw_area')
    var fileBinPreviewArea = $('#fileBin_preview_area')
    loadDateRangePicker(dateSelector,{
        onChange: function(start, end, label) {
            drawFileBinViewElements()
        }
    })
    monitorsList.change(function(){
        drawFileBinViewElements()
    })
    function drawFileBinViewElements(selectedMonitor,startDate,endDate){
        var dateRange = getSelectedTime(dateSelector)
        if(!startDate)startDate = dateRange.startDate
        if(!endDate)endDate = dateRange.endDate
        if(!selectedMonitor)selectedMonitor = monitorsList.val()
        getFileBinFiles(selectedMonitor,startDate,endDate).then((data) => {
            fileBinDrawArea.bootstrapTable('destroy')
            fileBinDrawArea.bootstrapTable({
                pagination: true,
                search: true,
                columns: fileBinTableHeaderMap(),
                data: fileBinTableMap(data.files)
            })
        })
    }
    function drawPreviewVideo(href){
        fileBinPreviewArea.html(`<video class="video_video" style="width:100%" autoplay controls preload loop src="${href}"></video>`)
    }
    function archiveFile(video,unarchive){
        return archiveVideo(video,unarchive,true)
    }
    async function archiveFiles(videos){
        for (let i = 0; i < videos.length; i++) {
            var video = videos[i];
            await archiveFile(video,false)
        }
    }
    function unarchiveFile(video){
        return archiveFile(video,true)
    }
    async function unarchiveFiles(videos){
        for (let i = 0; i < videos.length; i++) {
            var video = videos[i];
            await unarchiveFile(video)
        }
    }
    function deleteFile(video,callback){
        return new Promise((resolve,reject) => {
            var videoEndpoint = getApiPrefix(`fileBin`) + '/' + video.mid + '/' + video.name
            $.getJSON(videoEndpoint + '/delete',function(data){
                notifyIfActionFailed(data)
                if(callback)callback(data)
                resolve(data)
            })
        })
    }
    async function deleteFiles(videos){
        try{
            for (let i = 0; i < videos.length; i++) {
                var video = videos[i];
                await deleteFile(video)
            }
            return {ok: true}
        }catch(err){
            console.err(err)
            return {ok: false}
        }
    }
    function downloadFileBin(video){
        var videoEndpoint = getApiPrefix(`fileBin`) + '/' + video.mid + '/' + video.name
        downloadFile(videoEndpoint,video.name)
    }
    async function downloadFileBins(videos){
        for (let i = 0; i < videos.length; i++) {
            var video = videos[i];
            await downloadFileBin(video)
        }
    }
    function getSelectedRows(){
        var rowsSelected = []
        fileBinDrawArea.find('[name="btSelectItem"]:checked').each(function(n,checkbox){
            var rowInfo = $(checkbox).parents('tr').find('.row-info')
            var monitorId = rowInfo.attr('data-mid')
            var groupKey = rowInfo.attr('data-ke')
            var filename = rowInfo.attr('data-name')
            var file = loadedFilesInMemory[`${monitorId}${filename}`]
            if(file)rowsSelected.push(file)
        })
        return rowsSelected
    }
    $('body')
    .on('click','.open-fileBin-video',function(e){
        e.preventDefault()
        var href = $(this).attr('href')
        openTab(`fileBinView`,{},null)
        drawPreviewVideo(href)
        return false;
    });
    theEnclosure
    .on('click','.refresh-data',function(e){
        e.preventDefault()
        drawFileBinViewElements()
        return false;
    })
    .on('click','.preview-video',function(e){
        e.preventDefault()
        var el = $(this)
        var href = el.attr('href')
        setPreviewedVideoHighlight(el,fileBinDrawArea)
        drawPreviewVideo(href)
        return false;
    })
    .on('click','.archive-file',function(e){
        e.preventDefault()
        var el = $(this).parents('[data-mid]')
        var monitorId = el.attr('data-mid')
        var filename = el.attr('data-name')
        var unarchive = $(this).hasClass('status-archived')
        var file = loadedFilesInMemory[`${monitorId}${filename}`]
        if(!file)return console.log(`No File`,monitorId,filename,unarchive,file);
        if(unarchive){
            unarchiveFile(file)
        }else{
            archiveFile(file)
        }
        return false;
    })
    .on('click','.delete-file',function(e){
        e.preventDefault()
        var el = $(this).parents('[data-mid]')
        var monitorId = el.attr('data-mid')
        var filename = el.attr('data-name')
        var file = loadedFilesInMemory[`${monitorId}${filename}`]
        if(!file)return console.log(`No File`,monitorId,filename,unarchive,file);
        $.confirm.create({
            title: lang["Delete"] + ' : ' + file.name,
            body: `${lang.DeleteThisMsg}`,
            clickOptions: {
                title: '<i class="fa fa-trash-o"></i> ' + lang.Delete,
                class: 'btn-danger btn-sm'
            },
            clickCallback: function(){
                deleteFile(file).then(function(data){
                    if(data.ok){
                        drawFileBinViewElements()
                    }
                })
            }
        });
        return false;
    })
    .on('click','.zip-selected-videos',function(e){
        e.preventDefault()
        var videos = getSelectedRows(true)
        zipVideosAndDownloadWithConfirm(videos)
        return false;
    })
    .on('click','.delete-selected-videos',function(e){
        e.preventDefault()
        var videosSelected = getSelectedRows()
        if(videosSelected.length === 0){
            new PNotify({
                title: lang['Nothing Selected'],
                text: lang.makeASelection,
                type: 'error'
            });
            return
        }
        $.confirm.create({
            title: lang["Delete Files"],
            body: `${lang.DeleteTheseMsg}`,
            clickOptions: {
                title: '<i class="fa fa-trash-o"></i> ' + lang.Delete,
                class: 'btn-danger btn-sm'
            },
            clickCallback: function(){
                deleteFiles(videosSelected).then(function(data){
                    if(data.ok){
                        drawFileBinViewElements()
                    }
                })
            }
        });
        return false;
    })
    .on('click','.download-selected-videos',function(e){
        e.preventDefault()
        var videos = getSelectedRows()
        if(videos.length === 0)return;
        $.confirm.create({
            title: lang["Batch Download"],
            body: `${lang.batchDownloadText}`,
            clickOptions: {
                title: '<i class="fa fa-check"></i> ' + lang.Yes,
                class: 'btn-success btn-sm'
            },
            clickCallback: function(){
                downloadFileBins(videos)
            }
        });
        return false;
    });
    addOnTabOpen('fileBinView', function () {
        drawMonitorListToSelector(monitorsList,null,null,true)
        drawFileBinViewElements()
    })
    addOnTabReopen('fileBinView', function () {
        var theSelected = `${monitorsList.val()}`
        drawMonitorListToSelector(monitorsList,null,null,true)
        monitorsList.val(theSelected)
    })
    addOnTabAway('fileBinView', function () {
        fileBinPreviewArea.find('video')[0].pause()
    })
})
