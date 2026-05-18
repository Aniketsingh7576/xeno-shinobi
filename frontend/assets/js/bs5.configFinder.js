$(document).ready(function(){
    var loadedConfigs = {}
    var shinobiHubWindow = $('#tab-configFinder')
    var shinobiHubWindowTableBody = $('#shinobihub-results')
    var shinobiHubWindowSearch = $('#shinobihub-search')
    var shinobiHubWindowSortBy = $('#shinobihub-sort-by')
    var shinobiHubWindowExplore = $('#shinobihub-explore')
    var shinobiHubWindowSortDirection = $('#shinobihub-sort-direction')
    var shinobiHubWindowPages = $('#shinobihub-pages')
    var sideMenuList = $(`#side-menu-link-configFinder  ul`)
    var pageLimit = 15
    function drawFoundConfigsSubMenu(){
        var allFound = []
        Object.keys(loadedConfigs).forEach(function(configId){
            var item = loadedConfigs[configId]
            allFound.push({
                attributes: `href="#monitor-settings-found-${configId}" scrollToParent="#tab-configFinder"`,
                class: `scrollTo`,
                color: 'blue',
                label: item.brand + ' ' + item.name,
            })
        })
        var html = buildSubMenuItems(allFound)
        sideMenuList.html(html)
    }
    var getConfigurationsFromHub = function(rowLimit,skipOver,explore,searchQuery,sortBy,sortDirection,callback){
        // $.get(,callback)
        $.getJSON(`https://hub.shinobi.video/searchConfiguration?skipOver=${skipOver}&rowLimit=${rowLimit}&sortBy=${sortBy}&sortDirection=${sortDirection}${searchQuery ? `&text=${searchQuery}` : ''}`,function(data){
            callback(data)
            // $.get(getApiPrefix() + `/getXenocipherHubConfigurations/${$user.ke}/cam?rowLimit=${rowLimit}&skipOver=${skipOver}&explore=${explore ? explore : "0"}&search=${searchQuery}&sortDirection=${sortDirection}&sortBy=${sortBy}`,function(privateData){
            //     callback(data.concat(privateData || []))
            // })
        })
    }
    var buildConfigRow = function(row){
        return `<div class="col-md-4 mb-3 text-start" id="monitor-settings-found-${row.id}" drawn-id="${row.id}">
                    <div style="display:block" class="card shadow btn-default">
                        <div class="card-header d-flex flex-row">
                            <div class="flex-grow-1">
                                <span class="badge badge-sm badge-primary">${row.brand}</span> ${row.name}
                            </div>
                            <div>
                                <i class="fa fa-${row.private == 1 ? 'check text-success' : 'cross text-danger'}"></i>
                            </div>
                        </div>
                        <div class="card-body">
                            <div>${row.description}</div>
                            <small class="d-block text-muted">${lang['Date Added']} : ${moment(row.dateAdded).format('DD-MM-YYYY hh:mm:ss A')}</small>
                            <small class="d-block text-muted">${lang['Date Updated']} : ${moment(row.dateUpdated).format('DD-MM-YYYY hh:mm:ss A')}</small>
                        </div>
                        <div class="card-footer">
                            <a href="javascript:console.log('${row.id} Import')" class="copy btn btn-block btn-sm btn-primary"><i class="fa fa-download"></i> ${lang.Import}</a>
                        </div>
                    </div>
                </div>`
    }
    var loadRows = function(skipOver,rowLimit,explore){
        shinobiHubWindowTableBody.empty()
        if(!skipOver)skipOver = 0
        if(!rowLimit)rowLimit = pageLimit
        loadedConfigs = {}
        var searchQuery = shinobiHubWindowSearch.val()
        var sortBy = shinobiHubWindowSortBy.val()
        var sortDirection = shinobiHubWindowSortDirection.val()
        var explore = shinobiHubWindowExplore.val() || '0'
        getConfigurationsFromHub(rowLimit,skipOver,explore,searchQuery,sortBy,sortDirection,function(data){
            var html = ''
            $.each(data.configs,function(n,row){
                loadedConfigs[row.id] = row
                try{
                    html += buildConfigRow(row)
                }catch(err){
                    console.log(err,row)
                }
            })
            shinobiHubWindowTableBody.html(html)
            html = ''
            if(data.pages > 10){
                for (i = 1; i < 3 + 1; i++) {
                    html += `<button type="button" class="page-select btn btn-default btn-sm ${i === data.currentPage ? 'active' : ''}" page="${i}">${i}</button>`
                }
                html += `<input class="page-number-input form-control form-control-sm mr-2 text-center" type=number min=3 max=${data.pages - 4} value="${data.currentPage}" style="width:55px;display:inline-block">`
                for (i = data.pages - 2; i < data.pages + 1; i++) {
                    html += `<button type="button" class="page-select btn btn-default btn-sm ${i === data.currentPage ? 'active' : ''}" page="${i}">${i}</button>`
                }
            }else{
                for (i = 1; i < data.pages + 1; i++) {
                    html += `<button type="button" class="page-select btn btn-default btn-sm ${i === data.currentPage ? 'active' : ''}" page="${i}">${i}</button>`
                }
            }
            shinobiHubWindowPages.html(html)
            drawFoundConfigsSubMenu()
        })
    }
    addOnTabOpen('configFinder', function () {
        loadRows()
    })
    addOnTabReopen('configFinder', function () {
        // loadRows()
    })
    shinobiHubWindow.on('click','.copy',function(){
        openMonitorEditorPage()
        var configId = $(this).parents(`[drawn-id]`).attr('drawn-id')
        var json = loadedConfigs[configId].json
        writeToMonitorSettingsWindow(json)
    })
    shinobiHubWindowPages.on('click','.page-select',function(){
        var pageSelect = parseInt($(this).attr('page')) - 1
        loadRows(pageSelect * pageLimit, pageLimit,'0')
    })
    shinobiHubWindow.on('change','.page-number-input',function(){
        var pageSelect = parseInt($(this).val()) - 1
        loadRows(pageSelect * pageLimit, pageLimit,'0')
    })
    shinobiHubWindowSearch.change(function(){
        loadRows(0, pageLimit, '0')
    })
    shinobiHubWindowSortBy.change(function(){
        var descText
        var ascText
        switch($(this).val()){
            case'dateUpdated':
            case'dateAdded':
                descText = 'Newest'
                ascText = 'Oldest'
            break;
            case'heading':
            case'opening':
                descText = 'Z - #'
                ascText = '# - Z'
            break;
        }
        shinobiHubWindowSortDirection.find('[value="DESC"]').html(descText)
        shinobiHubWindowSortDirection.find('[value="ASC"]').html(ascText)
        loadRows(0, pageLimit, '0')
    })
    shinobiHubWindowSortDirection.change(function(){
        loadRows(0, pageLimit, '0')
    })
    shinobiHubWindowExplore.change(function(){
        loadRows(0, pageLimit, '0')
    })
})
