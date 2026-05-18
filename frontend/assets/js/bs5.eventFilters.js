window.acceptableDetectorFilterOperators = {
    'indexOf': lang['Contains'],
    '!indexOf': lang['Does Not Contain'],
    '===': lang['Equal to'],
    '!==': lang['Not Equal to'],
    '>=': lang['Greater Than or Equal to'],
    '>': lang['Greater Than'],
    '<': lang['Less Than'],
    '<=': lang['Less Than or Equal to'],
    '||': lang['OR'],
    '&&': lang['AND'],
};
$(document).ready(function(e){
    //detector filters window
    var detectorFiltersWindow = $('#tab-eventFilters')
    var detectorFiltersSelector = $('#detector_filters')
    var detectorFiltersConditionRows = $('#detector_filters_where')
    var detectorFiltersMonitorsList = $('#event_filters_monitors')
    var detectorFiltersActions = detectorFiltersWindow.find('.actions')
    var detectorFiltersForm = detectorFiltersWindow.find('form');
    var idField = detectorFiltersForm.find('[name="id"]')
    var nameField = detectorFiltersForm.find('[name="filter_name"]')
    var loadedFilters = {}
    var getSelectedFilter = function(){
        return detectorFiltersSelector.val()
    }
    var getCurrentlySelectedMonitorId = function(){
        return detectorFiltersMonitorsList.val()
    }
    var drawOptions = function(){
        var html = ''
        $.each(loadedFilters,function(n,dFilter){
            html += createOptionHtml({
                value: dFilter.id,
                label: dFilter.filter_name
            })
        })
        detectorFiltersSelector.html(html)
    }
    var getFiltersFromMonitorInEditor = function(){
        var monitorId = getCurrentlySelectedMonitorId()
        var monitorConfig = Object.assign({},loadedMonitors[monitorId])
        var dFilters = safeJsonParse(safeJsonParse(monitorConfig.details).detector_filters)
        try{
            return dFilters
        }catch(err){
            return {}
        }
    }
    var getFormValues = function(){
        var form = detectorFiltersForm.serializeObject()
        $.each(form,function(key,value){
            form[key] = value.trim()
        })
        //create conditions object (where)
        form.where = []
        detectorFiltersForm.find('.where-row').each(function(n,v){
            var where = {}
            $(v).find('[where]').each(function(m,b){
                var el = $(this)
                var value = el.val()
                if(value){
                    where[el.attr('where')] = value.trim()
                }
            })
            if(where.p1 && where.p2 && where.p3)form.where.push(where)
        })
        // create actions object (do)
        form.actions = {}
        detectorFiltersForm.find('.actions-row').each(function(n,v){
            var actions = $(v).find('[actions]')
            form.actions[actions.attr('actions')] = actions.val()
        })
        form.filter_name = form.filter_name || 'New Filter'
        return form
    }
    var closeFiltersToMonitorEditor = function(dFilters){
        var monitorId = getCurrentlySelectedMonitorId()
        var monitorConfig = Object.assign({},loadedMonitors[monitorId])
        monitorConfig.details.detector_filters = loadedFilters
        monitorConfig.details = JSON.stringify(monitorConfig.details)
        setSubmitButton(detectorFiltersForm, lang[`Please Wait...`], `spinner fa-pulse`, true)
        configureMonitor(monitorConfig).then((d) => {
            if(d.ok === false){
                new PNotify({
                    title: lang['Action Failed'],
                    text: d.msg,
                    type: 'danger'
                })
            }
            debugLog(d)
            setSubmitButton(detectorFiltersForm, lang.Save, `check`, false)
        })
    }
    var drawDetectorFilterFieldsRow = function(d){
        if(!d)d = {};
        d.id = detectorFiltersConditionRows.find('.where-row').length;
        if(!d.p1){d.p1='indifference'}
        if(!d.p2){d.p2='==='}
        if(!d.p3){d.p3=''}
        if(!d.p4){d.p4='&&'}
        tmp = `<div class="d-flex flex-row where-row">
            <div class="py-2 pr-1">
                <select class="form-control input-sm" where="openBracket">
                    <option value="0" selected></option>
                    <option value="1">(</option>
                </select>
            </div>
           <div class="py-2 px-1 flex-grow-1">
               <select class="form-control input-sm" where="p1">
                   <option value="indifference" selected>${lang['Indifference']}</option>
                   <option value="name">${lang['Region Name']}</option>
                   <option value="reason">${lang['Reason']}</option>
                   <option value="time">${lang['Time']}</option>
                   <option value="plug">${lang['Detection Engine']}</option>
                   <optgroup label="Matrix">
                      <option value="tag">${lang['Object Tag']}</option>
		  <option value="count">${lang['Object Count']}</option>
                      <option value="confidence">${lang['Confidence']}</option>
                      <option value="x">${lang['X Point']}</option>
                      <option value="y">${lang['Y Point']}</option>
                      <option value="height">${lang['Height']}</option>
                      <option value="width">${lang['Width']}</option>
                   </optgroup>
               </select>
           </div>
           <div class="py-2 px-1 flex-grow-1">
               <select class="form-control input-sm" where="p2">
                   <option value="===" selected>${lang['Equal to']}</option>
                   <option value="!==">${lang['Not Equal to']}</option>
                   <option value="indexOf">${lang['Contains']}</option>
                   <option value="!indexOf">${lang['Does Not Contain']}</option>
                   <optgroup label="For Numbers">
                      <option value=">=">${lang['Greater Than or Equal to']}</option>
                      <option value=">">${lang['Greater Than']}</option>
                      <option value="<">${lang['Less Than']}</option>
                      <option value="<=">${lang['Less Than or Equal to']}</option>
                   </optgroup>
               </select>
           </div>
           <div class="py-2 px-1 flex-grow-1">
               <input class="form-control input-sm" placeholder="Value" title="${lang.Value}" where="p3">
           </div>
           <div class="py-2 px-1">
               <select class="form-control input-sm" where="closeBracket">
                   <option value="0" selected></option>
                   <option value="1">)</option>
               </select>
           </div>
           <div class="py-2 px-1">
               <select class="form-control input-sm" where="p4">
                   <option value="&&" selected>${lang['AND']}</option>
                   <option value="||">${lang['OR']}</option>
               </select>
           </div>
           <div class="py-2 pl-1">
               <a class="btn btn-danger btn-block pull-right delete-condition">&nbsp;<i class="fa fa-trash-o"></i>&nbsp;</a>
           </div>
        </div>`
        detectorFiltersConditionRows.append(tmp);
        detectorFiltersConditionRows.find('.where-row [where="p4"][disabled]').prop('disabled',false)
        var lastRow = detectorFiltersConditionRows.find('.where-row:last')
        lastRow.find('[where="openBracket"]').val(d.openBracket)
        lastRow.find('[where="p1"]').val(d.p1)
        lastRow.find('[where="p2"]').val(d.p2)
        lastRow.find('[where="p3"]').val(d.p3)
        lastRow.find('[where="closeBracket"]').val(d.closeBracket)
        lastRow.find('[where="p4"]').val(d.p4).prop('disabled',true)
    }
    var createNewFilter = function(){
        var newId = generateId(5)
        idField.val(newId)
        detectorFiltersConditionRows.empty()
        drawDetectorFilterFieldsRow()
        nameField.val(newId)
        var form = getFormValues()
        loadedFilters[newId] = form
        console.log(form)
        drawOptions()
        detectorFiltersSelector.val(newId).change()
    }
    var deleteSelectedFilter = function(){
        var newObject = {}
        var deleteId = getSelectedFilter()
        $.each(loadedFilters,function(id,obj){
            if(id === deleteId)return false;
            newObject[id] = obj
        })
        loadedFilters = newObject
        drawOptions()
        selectFirstOption()
    }
    var updateSelectedFilter = function(){
        var newObject = {}
        var modifyId = getSelectedFilter()
        loadedFilters[modifyId] = getFormValues()
        console.log(modifyId,loadedFilters[modifyId])
    }
    var resetForm = function(){
        detectorFiltersConditionRows.empty()
        drawDetectorFilterFieldsRow()
        detectorFiltersActions.find('.form-control').val('')
        detectorFiltersActions.find('[actions="halt"]').val('0')
    }
    var selectFirstOption = function(){
        detectorFiltersSelector.val(detectorFiltersSelector.find('option:first').val()).change()
    }
    detectorFiltersWindow.on('change','[where="p1"]',function(e){
        var el = $(this)
        var p1v = el.val()
        var parent = el.parents('.where-row')
        var p3 = parent.find('[where="p3"]')
        var options = []
        switch(p1v){
            case'time':
                options = [
                    '00:00:00'
                ]
            break;
            case'reason':
                options = [
                    'licensePlate',
                    'object',
                    'motion',
                ]
            break;
            case'plug':
                options = [
                    'Tensorflow',
                    'Yolo',
                    'built-in',
                ]
            break;
            case'tag':
                options = [
                    'car',
                    'tree',
                    'pottedplant',
                ]
            break;
        }
        var msg = 'Value'
        if(options.length > 0){
            msg = 'Example : '+options.join(', ')
        }
        p3.attr('placeholder',msg)
    })
    detectorFiltersMonitorsList.change(function(e){
        loadedFilters = getFiltersFromMonitorInEditor()
        drawOptions()
        selectFirstOption()
    })
    detectorFiltersWindow.on('click','.where .add',function(e){
        var modifyId = getSelectedFilter()
        if(!modifyId){
            createNewFilter()
        }else{
            drawDetectorFilterFieldsRow()
        }
    })
    detectorFiltersWindow.on('click','.where .delete-condition',function(e){
        if(detectorFiltersConditionRows.find('.where-row').length > 1){
            $(this).parents('.where-row').remove()
            detectorFiltersConditionRows.find('.where-row:last [where="p4"]').prop('disabled',true)
            updateSelectedFilter()
        }
    })
    detectorFiltersSelector.change(function(){
        var el = $(this)
        var filterId = el.val()
        detectorFiltersConditionRows.empty()
        if(filterId && filterId !== ''){
            var currentFilter = loadedFilters[filterId]
            if(currentFilter.where.length > 0){
                $.each(currentFilter.where,function(n,v){
                    drawDetectorFilterFieldsRow(v)
                })
            }else{
                drawDetectorFilterFieldsRow()
            }
            $.each(currentFilter.actions,function(action,val){
                detectorFiltersWindow.find('[actions="'+action+'"]').val(val)
            })
            $.each(currentFilter,function(n,v){
                if(n === 'where'){return}
                detectorFiltersForm.find('[name="'+n+'"]').val(v)
            })
        }else{
            createNewFilter()
        }
    })
    detectorFiltersWindow.find('.add-filter').click(function(){
        createNewFilter()
        resetForm()
    })
    detectorFiltersWindow.find('.delete-filter').click(function(e){
        deleteSelectedFilter()
    })
    detectorFiltersForm.on('change','[name="filter_name"], .where-row .form-control, .actions-row .form-control',function(e){
        updateSelectedFilter()
    })
    detectorFiltersForm.submit(function(e){
        e.preventDefault()
        closeFiltersToMonitorEditor()
        return false
    })
    addOnTabOpen('eventFilters', function () {
        if(!detectorFiltersMonitorsList.val()){
            drawMonitorListToSelector(detectorFiltersMonitorsList,true)
        }
    })
    addOnTabReopen('eventFilters', function () {
        var theSelected = `${detectorFiltersMonitorsList.val()}`
        drawMonitorListToSelector(detectorFiltersMonitorsList)
        detectorFiltersMonitorsList.val(theSelected)
    })
    drawSubMenuItems('eventFilters',definitions['Event Filters'])
})
