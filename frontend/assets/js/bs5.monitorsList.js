$(document).ready(function(){
    var selectedApiKey = null;
    var theBlock = $('#tab-monitorsList')
    var theTable = $('#monitorsListTable')
    var theList = $('#monitorsListRows')
    var theHeader = $('#monitorsListHeader')
    var scrollContainer = $('#monitorsListScrollContainer')
    var apiKeySelector = $('#multi_mon_api_key_selector')
    var multiMonitorSelect = $('#multimon_select_all')
    var iconsLoaded = $('.image.unloaded-icon', theList)
    var advancedSearchModal = $('#monitorsList_advancedSearch')
    var monitorsListCountEl = $('#monitorsList-count')
    var renewListTimeout = null;
    var monitorListScrollTimeout = null
    function resizeTheListHeight(){
        var excludeHeight = theHeader.height()
        var viewPortHeight = window.innerHeight
        scrollContainer.css('max-height', `calc(${viewPortHeight - excludeHeight}px - 5.5rem)`)
    }
    function drawRowToList(row){
        const monitorId = row.mid;
        const iconPath = getMonitorIconPath(monitorId);
        const existingElement = theList.find(`[data-mid="${row.mid}"][data-ke="${row.ke}"]`)
        const tags = (row.tags || '').split(',').map(item => `<span class="badge badge-success">${item}</span>`).join(' ');
        if(existingElement.length > 0){
            existingElement.find('.image').attr('src',iconPath)
            existingElement.find('.name').text(row.name)
            existingElement.find('.host').text(row.host)
            existingElement.find('.mode').text(row.mode)
            existingElement.find('.auto_host').text(row.details.auto_host)
            existingElement.find('.stream_type').text(row.details.stream_type)
            existingElement.find('.tags').html(tags)
        }else{
            theList.append(`
                <tr data-mid="${row.mid}" data-ke="${row.ke}" class="search-row">
                    <td><input class="monitor-list-select form-check-input no-abs m-0" type="checkbox" value="${row.mid}" name="${row.ke}__${row.mid}"></td>
                    <td><div class="video-thumbnail cursor-pointer launch-live-grid-monitor"><img class="image unloaded-icon" data-mid="${row.mid}" data-ke="${row.ke}" data-src="${iconPath}"></div></td>
                    <td>
                        <div class="name">${row.name}</div>
                        <div><small>${row.mid}</small></div>
                    </td>
                    <td>
                        <div class="host">${row.host}</div>
                    </td>
                    <td style="display:none">
                        <div class="mode">${row.mode}</div>
                        <div class="auto_host">${row.details.auto_host}</div>
                        <div class="stream_type">${row.details.stream_type}</div>
                    </td>
                    <td>
                        <span class="monitor_status_icon" style="color:${monitorStatusCodes[`c${row.code}`]}"><i class="fa fa-${monitorStatusCodes[`i${row.code}`]}"></i></span>
                        <span class="monitor_status">${getMonitorStatus(row)}</span>
                    </td>
                    <td class="tags">
                        ${tags}
                    </td>
                    <td class="text-end">
                        <a class="btn btn-sm btn-primary open-monitor-settings" title="${lang['Edit']}"><i class="fa fa-wrench"></i></a>
                        <a class="btn btn-sm btn-primary copy-stream-url" title="${lang['Copy Stream URL']}"><i class="fa fa-copy"></i></a>
                        <a class="btn btn-sm btn-info export" title="${lang.Export}"><i class="fa fa-download"></i></a>
                        <a class="btn btn-sm btn-danger delete" title="${lang.Delete}"><i class="fa fa-trash-o"></i></a>
                    </td>
                </tr>
            `);
        }
    }
    function loadIconsForVisibleCards(){
        var container = scrollContainer[0];
        var containerRect = container.getBoundingClientRect();
        var hasUpdatedIcons = false;

        iconsLoaded.each(function() {
            var iconRect = this.getBoundingClientRect();
            var isVisible = (
                iconRect.bottom >= containerRect.top &&
                iconRect.top <= containerRect.bottom &&
                iconRect.right >= containerRect.left &&
                iconRect.left <= containerRect.right
            );
            if(isVisible){
                var $icon = $(this);
                var monitorId = $icon.data('mid');
                const monitorIconUrl = $icon.data('src');
                $icon.attr('src', monitorIconUrl);
                $icon.removeClass('unloaded-icon');
                hasUpdatedIcons = true
            }
        });
        if(hasUpdatedIcons){
            iconsLoaded = $('.image.unloaded-icon', theList)
        }
    }
    function onMonitorListScroll(){
        clearTimeout(monitorListScrollTimeout)
        monitorListScrollTimeout = setTimeout(function(){
            loadIconsForVisibleCards()
        },500)
    }
    function toggleScrollAction(toggleOn){
        scrollContainer[toggleOn ? 'on' : 'off']('scroll', onMonitorListScroll);
        $(window)[toggleOn ? 'on' : 'off']('resize', resizeTheListHeight);
        if(toggleOn)onMonitorListScroll()
        if(toggleOn)resizeTheListHeight()
    }
    function loadMonitorsFromMemory(){
        var monitorsListCount = 0
        $.each(getLoadedMonitorsAlphabetically(),function(n,row){
            drawRowToList(row)
            ++monitorsListCount
        });
        iconsLoaded = $('.image.unloaded-icon', theList)
        monitorsListCountEl.text(monitorsListCount)
    }
    function getSelectedMonitors(rawMonitors){
        var monitorsSelected = [];
        theList.find('.monitor-list-select').each(function(n,v){
            var el = $(v)
            if(el.is(':checked')){
                const [ groupKey, monitorId ] = el.attr('name').split('__')
                const monitor = loadedMonitors[monitorId]
                monitorsSelected.push(rawMonitors ? monitor : getDbColumnsForMonitor(monitor))
            }
        })
        return monitorsSelected;
    }
    function toggleMonitorListSelectAll(isChecked){
        var nameField = theList.find('input[type=checkbox][name]:visible')
        if(isChecked === true){
            nameField.prop('checked',true)
        }else{
            nameField.prop('checked',false)
        }
    }
    async function drawMonitorsListApiKeyList(){
        const serverKeys = await getApiKeys()
        var html = createOptionHtml({
            selected: true,
            value: $user.auth_token,
            label: lang['Session Key'],
        })
        $.each(serverKeys || [],function(n, key){
            html += createOptionHtml({
                value: key.code,
                label: key.code,
            })
        })
        apiKeySelector.html(html)
    }
    function correctDropdownPosition(dropdownElement){
        var p = dropdownElement.offset();
        if (p.top < 0){
            dropdownElement[0].style = `transform:translate(0px, ${-p.top + 20}px)!important;`
        }
    }
    function launchModeChangeMonitorWindow(){
        var monitorsToChange = getSelectedMonitors(true);
        var possibleModes = definitions['Monitor Settings'].blocks.Identity.info[0].possible
        var html = `${lang.ChangeMonitorConfigurationText}
        <div style="margin-top: 15px;">
            <div class="form-group">
                <select class="form-control form-control-sm mode-change-value">
                    ${possibleModes.map(item => createOptionHtml(item))}
                </select>
            </div>
            <div>
                <ul>
                    ${monitorsToChange.map((monitor) => {
                        return `<li>${monitor.name}</li>`
                    }).join('\n')}
                </ul>
            </div>
        </div>`
        $.confirm.create({
            title: lang['Edit Mode'],
            body: html,
            clickOptions: [
                {
                    title: lang['Save'],
                    class: 'btn-success',
                    callback: async function(){
                        var targetMode = $.confirm.e.find('.mode-change-value').val();
                        for(monitor of monitorsToChange){
                            await setMode(monitor.mid, targetMode)
                        }
                    }
                },
            ],
        });
    }
    function launchTagEditMonitorWindow(){
        var monitorsToChange = getSelectedMonitors(true);
        var listOftags = getListOfTagsFromMonitors(null, true)
        var html = `${lang.ChangeMonitorConfigurationText}
        <div style="margin-top: 15px;">
            <div class="form-group">
                <select multiple class="form-control form-control-sm tag-change-value">
                    ${listOftags.map(item => createOptionHtml({ value: item, label: item })).join(',')}
                </select>
            </div>
            <div class="form-group">
                <select class="form-control form-control-sm tag-change-target">
                    <option selected value="1">${lang.Add}</option>
                    <option value="0">${lang.Remove}</option>
                </select>
            </div>
            <div>
                <ul>
                    ${monitorsToChange.map((monitor) => {
                        return `<li>${monitor.name}</li>`
                    }).join('\n')}
                </ul>
            </div>
        </div>`
        $.confirm.create({
            title: lang['Edit Tags'],
            body: html,
            clickOptions: [
                {
                    title: lang['Save'],
                    class: 'btn-success',
                    callback: async function(){
                        var selectedTags = $.confirm.e.find('.tag-change-value').val();
                        var toAdd = $.confirm.e.find('.tag-change-target').val() === '1';
                        for(monitor of monitorsToChange){
                            var monitorConfig = loadedMonitors[monitor.mid];
                            var theTags = (monitorConfig.tags || '').split(',')
                            for(aTag of selectedTags){
                                if(toAdd){
                                    if(!theTags.includes(aTag))theTags.push(aTag)
                                }else{
                                    if(theTags.includes(aTag)){
                                        var indexToRemove = theTags.indexOf(aTag)
                                        theTags.splice(indexToRemove, 1);
                                    }
                                }
                            }
                            theTags = theTags.filter(item => !!item)
                            const modifiedConfig = Object.assign({},monitorConfig,{ tags: theTags.join(',') })
                            await configureMonitor(modifiedConfig)
                        }
                    }
                },
            ],
        });
    }
    function openAdvancedSearch(){
        advancedSearchModal.modal('show')
    }
    function resetAdvancedSearchOptions(){
        const nameField = advancedSearchModal.find('[name="name"]')
        const hostField = advancedSearchModal.find('[name="host"]')
        const tagsField = advancedSearchModal.find('[name="tags"]')
        const statusField = advancedSearchModal.find('[name="status"]')
        // tags field
        const tagsHtml = getListOfTagsFromMonitors(null, true).map(tag => createOptionHtml({
            value: tag,
            label: tag
        }))
        tagsField.find('optgroup').html(tagsHtml)
        //
        nameField.val("")
        hostField.val("")
        tagsField.val("")
        statusField.val("")
    }
    function applyAdvancedSearchFilters({ server, name, host, tags, status }, monitors = getLoadedMonitors()){
        var matchedMonitors = {}
        var useName = !!name;
        var useHost = !!host;
        var useTags = !!tags;
        var useStatus = !!status;
        $.each(monitors,function(monitorLiveId, monitor){
            try{
                var matchedName = true
                var matchedHost = true
                var matchedTags = true
                var matchedStatus = true
                if(useName){
                    matchedName = monitor.name.includes(name)
                }
                if(useHost){
                    matchedHost = monitor.host.includes(host)
                }
                if(useTags){
                    matchedTags = monitor.tags.includes(tags)
                }
                if(useStatus){
                    matchedStatus = monitor.code == status
                }
                if(matchedName && matchedHost && matchedTags && matchedStatus){
                    matchedMonitors[monitorLiveId] = monitor
                }
            }catch(err){
                console.log(`Failed to search`, monitorLiveId, monitor)
                console.log(err)
            }
        })
        return matchedMonitors
    }
    function displayAdvancedSearchFilters(filteredMonitors){
        const monitorsListCount = Object.keys(filteredMonitors).length
        monitorsListCountEl.text(monitorsListCount)
        theList.find('.search-row').each(function(n,v){
            var el = $(v)
            var monitorId = el.attr('data-mid')
            if(filteredMonitors[`${monitorId}`]){
                el.show();
            }else{
                el.hide();
            }
        })
    }
    function doAdvancedSearch(form = advancedSearchModal.serializeObject()){
        const filteredMonitors = applyAdvancedSearchFilters(form)
        displayAdvancedSearchFilters(filteredMonitors)
    }

    function checkAdvancedSearchQueue(){
        if(window.queuedAdvancedFilterOnMonitorsList){
            doAdvancedSearch(window.queuedAdvancedFilterOnMonitorsList)
            delete(window.queuedAdvancedFilterOnMonitorsList)
        }
    }

    advancedSearchModal.submit(function(e){
        e.preventDefault()
        doAdvancedSearch()
        advancedSearchModal.modal('hide')
        return false;
    })

    var monitorListMenuDropdownOpen = null
    var monitorListScrollTimeout = null
    theBlock.on('mouseup','[data-bs-toggle="dropdown"]',function(){
        var dropdownElement = $(this).next()
        monitorListMenuDropdownOpen = dropdownElement
        setTimeout(function(){
            correctDropdownPosition(dropdownElement)
        },500)
    })
    $('body')
    .on('click','.advanced-filter-monitors-list',function(){
        var form = {}
        var el = $(this)
        $.each([
            'server',
            'name',
            'host',
            'tags',
            'status'
        ],function(n,key){
            form[key] = el.attr(`filter-${key}`)
        });
        window.queuedAdvancedFilterOnMonitorsList = form
        if(tabTree.name === 'monitorsList'){
            checkAdvancedSearchQueue()
        }else{
            openTab(`monitorsList`,{},null)
        }
    })
    .on('click','[set-mode]',function(){
        var thisEl = $(this)
        var el = thisEl.parents('[data-mid]')
        var monitorId = el.attr('data-mid')
        var mode = thisEl.attr('set-mode')
        setMode(monitorId, mode);
    });
    theBlock
    .find('.export-selected-monitor-settings').click(function(){
        var monitorsSelected = getSelectedMonitors()
        if(monitorsSelected.length === 0){
            new PNotify({
                title: lang['No Monitors Selected'],
                type: 'error'
            });
            return
        }
        downloadMonitorConfigurationsToDisk(monitorsSelected)
    });
    theBlock
    .find('.delete-selected-monitor-settings').click(function(){
        var monitorsSelected = getSelectedMonitors(true)
        if(monitorsSelected.length === 0){
            new PNotify({
                title: lang['No Monitors Selected'],
                text: lang['Select atleast one monitor to delete'],
                type: 'error'
            });
            return
        }
        deleteSelectedMonitors(monitorsSelected)
    });
    theList
    .on('click','.copy-stream-url',function(e){
        e.preventDefault()
        const monitorId = getRowsMonitorId(this)
        const href = buildStreamUrl(monitorId);
        copyToClipboard(href);
        new PNotify({
            title: lang['Copied'],
            text: lang['Copied to Clipboard'],
            type: 'success'
        });
        return false
    })
    .on('click','.export',function(){
        const monitorId = getRowsMonitorId(this)
        const monitor = loadedMonitors[monitorId];
        downloadMonitorConfigurationsToDisk([
            monitor
        ]);
    })
    .on('click','.delete',function(){
        var el = $(this).parents('[data-mid]')
        const monitorId = getRowsMonitorId(this)
        deleteMonitorWithConfirm(monitorId, () => {
            el.remove();
        })
    });
    multiMonitorSelect.change(function(){
        var el = $(this);
        var isChecked = el.prop('checked')
        toggleMonitorListSelectAll(isChecked)
    })
    apiKeySelector.change(function(){
        var value = $(this).val()
        selectedApiKey = `${value}`
        loadMonitorsFromMemory()
        multiMonitorSelect.prop('checked',false)
    })
    theBlock.find('.import-monitor-settings').click(function(){
        launchImportMonitorWindow()
    });
    theBlock.find('.changeMode-monitor-settings').click(function(){
        launchModeChangeMonitorWindow()
    })
    theBlock.find('.changeTags-monitor-settings').click(function(){
        launchTagEditMonitorWindow()
    })
    addOnTabOpen('monitorsList', function () {
        loadMonitorsFromMemory()
        drawMonitorsListApiKeyList()
        toggleScrollAction(true)
        resetAdvancedSearchOptions()
        checkAdvancedSearchQueue()
    })
    addOnTabReopen('monitorsList', function () {
        loadMonitorsFromMemory()
        drawMonitorsListApiKeyList()
        toggleScrollAction(true)
        resetAdvancedSearchOptions()
        checkAdvancedSearchQueue()
    })
    addOnTabAway('monitorsList', function () {
        toggleScrollAction(true)
        executeEventHandlers('monitorsListOnTabAway')
    })
    onWebSocketEvent((data) => {
        switch(data.f){
            case'monitor_edit':
                if(tabTree.name === 'monitorsList'){
                    clearTimeout(renewListTimeout)
                    renewListTimeout = setTimeout(() => {
                        loadMonitorsFromMemory()
                    },5000)
                }
            break;
        }
    })
    createEventHandler('monitorsListOnTabAway')
})
