function getApiKeys(callback){
    return new Promise((resolve) => {
        $.getJSON(getApiPrefix('api') + '/list',function(data){
            resolve(data.keys);
            if(callback)callback(data.keys);
        })
    })
}
$(document).ready(function(e){
    //api window
    var theWindow = $('#apis')
    var apiKeyTable = $('#api_list')
    var theWindowForm = theWindow.find('form');
    var codeField = theWindowForm.find('[name="code"]');
    var theWindowTitle = theWindow.find('.title');
    var permissionSelector = $('#apiKey_permissions')
    var monitorsTable = $('#apiKeys_monitors')
    var permissionSetField = theWindowForm.find(`[detail="permissionSet"]`)
    var monitorsRestrictedField = theWindowForm.find('[detail="monitorsRestricted"]')
    var loadedApiKeys = {};
    var permissionTypeNames = [
        { name: 'monitors', label: lang['Can View Monitor'] },
        { name: 'monitor_edit', label: lang['Can Edit Monitor'] },
        { name: 'video_view', label: lang['Can View Videos and Events'] },
        { name: 'video_delete', label: lang['Can Delete Videos and Events'] },
    ];
    function getHumanNamesForRowDetails(rowDetails){
        var newDetails = ``
        $.each(rowDetails,function(key,value){
            var foundOption = permissionSelector.find(`option[value="${key}"]`)
            var isSelected = value === `1`;
            function innerTextWithCheck(label){
                return `<i class="fa fa-${isSelected ? `check` : `times`} text-${value === `1` ? `success` : `danger`}"></i> &nbsp; ${label}`;
            }
            switch(key){
                case'monitorPermissions':
                    return;
                break;
                case'treatAsSub':
                    var label = lang['Treated as Sub-Account']
                    var innerText = innerTextWithCheck(label)
                break;
                case'monitorsRestricted':
                    var label = lang['Restricted Monitors']
                    var innerText = innerTextWithCheck(label)
                break;
                case'permissionSet':
                    var label = lang['Permission Group']
                    var innerText = `<i class="fa fa-key text-primary"></i> &nbsp; ${label} : ${value || lang.Default}`
                break;
                default:
                    var label = foundOption.text()
                    var innerText = innerTextWithCheck(label)
                break;
            }
            newDetails += `<span class="badge btn btn-dark mr-1">${innerText}</span>`
        })
        return newDetails
    }
    function getHumanNameForRowMonitorPermissions(monitorPermissions){
        var html = '';
        $.each(monitorPermissions,function(key,monitorIds){
            html += monitorIds.length > 0 ? `<div>
                <div class="pt-2"><span class="badge btn btn-primary">${permissionTypeNames.find(item => item.name === key).label}</span></div>
                <div>${monitorIds.map(monitorId => `<span class="badge btn btn-dark mr-1">${loadedMonitors[monitorId] ? loadedMonitors[monitorId].name : monitorId}</span>`).join('')}</div>
            </div>` : ''
        })
        return html
    }
    function drawApiKeyRow(row){
        var html = `<div class="card btn-default ${definitions.Theme.isDark ? 'text-white' : ''} mb-3 shadow-sm p-2" api_key="${row.code}">
            <div class="row">
                <div class="col-md-6">
                    <div>
                        ${row.code}<br>
                        <small class="text-muted">${row.ip}</small><br>
                        <small class="text-muted">${moment(Date.parse(row.time) || new Date()).format(`DD-MM-YYYY hh:mm:ss A`)}</small>
                    </div>
                    <div>
                        <a class="edit badge btn btn-primary"><i class="fa fa-wrench"></i> ${lang.Edit}</a>
                        <a class="copy badge btn btn-primary"><i class="fa fa-copy"></i> ${lang.Copy}</a>
                        <a class="delete badge btn btn-danger"><i class="fa fa-trash"></i> ${lang.Delete}</a>
                    </div>
                </div>
                <div class="col-md-6">
                    <div>${getHumanNamesForRowDetails(row.details || {})}</div>
                    <div>${getHumanNameForRowMonitorPermissions(row.details.monitorPermissions)}</div>
                </div>
            </div>
        </div>`;
        apiKeyTable.prepend(html)
    }
    function getFormDetails(){
        var details = {};
        theWindowForm.find('[detail]').each(function(n,v){
            var el = $(v);
            var key = el.attr('detail');
            var value = el.val();
            details[key] = value;
        });
        permissionSelector.find('option').each(function(n,option){
            var el = $(option)
            var permissionValue = el.attr('value')
            if(el.prop('selected')){
                details[permissionValue] = "1"
            }else{
                details[permissionValue] = "0"
            }
        });
        details.monitorPermissions = details.monitorsRestricted === '1' ? getMonitorsSelectedInPermissionForm() : {};
        return details
    }
    function getMonitorsSelectedInPermissionForm(){
        const monitors = {
            'monitors': [],
            'monitor_edit': [],
            'video_view': [],
            'video_delete': [],
        };
        monitorsTable.find('.permission-view input:checked').each(function(n,v){
            var el = $(v)
            var monitorId = el.attr('data-monitor')
            var permissionType = el.val() // permissions selected
            monitors[permissionType].push(monitorId)
        })
        return monitors
    }
    function addApiKey(){
        var formValues = theWindowForm.serializeObject()
        formValues.details = getFormDetails()
        var errors = []
        if(!formValues.ip || formValues.ip.length < 7){
            errors.push(lang['Enter at least one IP'])
        }
        if(errors.length > 0){
            new PNotify({title:lang['API Key Action Failed'],text:errors.join('<br>'),type:'danger'});
            return
        }
        const code = formValues.code;
        $.post(getApiPrefix('api') + '/add',{
            data: JSON.stringify(formValues)
        },function(data){
            if(data.ok){
                new PNotify({title:lang['API Key Added'],text:lang.FiltersUpdatedText,type:'success'});
                apiKeyTable.find(`[api_key="${code}"]`).remove()
                loadedApiKeys[code] = data.api
                drawApiKeyRow(data.api)
            }
        })
    }
    function deleteApiKey(code){
        $.confirm.create({
            title: lang.deleteApiKey,
            body: lang.deleteApiKeyText + '\n' + `<b>${code}</b>`,
            clickOptions: {
                title: lang.Delete,
                class: 'btn-danger'
            },
            clickCallback: function(){
                $.post(getApiPrefix('api') + '/delete',{
                    code: code
                },function(data){
                    if(data.ok){
                        new PNotify({title:lang['API Key Deleted'],text:lang.APIKeyDeletedText,type:'notice'});
                        apiKeyTable.find('[api_key="'+code+'"]').remove()
                        if(codeField.val() === code){
                            resetForm()
                        }
                    }
                })
            }
        })
    }
    async function loadApiKeys(){
        getApiKeys(function(apiKeys){
            apiKeyTable.empty()
            loadedApiKeys = {}
            $.each(apiKeys,function(n,row){
                loadedApiKeys[row.code] = row;
                drawApiKeyRow(row)
            })
        })
    }
    async function loadPermissions(){
        var html = ''
        const list = await listPermissions()
        loadedPermissions = {}
        $.each(list,function(n,item){
            const name = item.name;
            loadedPermissions[name] = item;
            html += createOptionHtml({
                value: name,
                label: name
            })
        })
        permissionSetField.find('optgroup').html(html)
    }
    function drawSelectableForPermissionForm(apiKey = { details: {} }){
        var permission = apiKey.details.monitorPermissions || {}
        console.log(apiKey)
        console.log(permission)
        var html = `
        <thead class="text-center">
            <tr>
                <td></td>
                <td></td>
                ${permissionTypeNames.map(permissionType => `<td><a class="btn btn-sm btn-primary" toggle-checkbox="${permissionType.name}">${permissionType.label}</a></td>`).join('')}
            </tr>
        </thead>
        <tbody class="text-center">`
        $.each(getLoadedMonitorsAlphabetically(),function(n,monitor){
            html += `<tr class="search-row permission-view" style="vertical-align: baseline;">`
                html += `<td class="text-start">${monitor.name} (${monitor.mid})</td>`
                html += `<td>${(monitor.tags || '').split(',').map(item => `<span class="label label-primary">${item}</span>`)}</td>`
                $.each(permissionTypeNames,function(n,permissionType){
                    const isChecked = permission && (permission[permissionType.name] || []).indexOf(monitor.mid) > -1;
                    html += `<td><input class="form-check-input" type="checkbox" data-monitor="${monitor.mid}" value="${permissionType.name}" ${isChecked ? 'checked' : ''}></td>`
                })
            html += `</tr>`
        })
        html += '</tbody>'
        monitorsTable.html(html)
    }
    async function resetForm(){
        await loadPermissions()
        codeField.val('')
        theWindowTitle.text(lang['Add New'])
        permissionSelector.find('option').prop('selected', false)
        theWindowForm.find('[data-default]').each(function(n,v){
            var el = $(v);
            el.val(el.attr('data-default'));
        })
        monitorsRestrictedField.change()
        drawSelectableForPermissionForm()
    }
    function loadApiKeyIntoForm(code){
        theWindowTitle.text(`${lang['Edit']} : ${code}`);
        const apiKey = loadedApiKeys[code]
        $.each(apiKey,function(key, value){
            theWindowForm.find(`[name="${key}"]`).val(value)
        })
        $.each(apiKey.details,function(key, value){
            theWindowForm.find(`[detail="${key}"]`).val(value)
        })
        permissionSelector.find('option').each(function(n, v){
            var el = $(v);
            var key = el.attr('value');
            var isSelected = apiKey.details[key] === '1';
            el.prop('selected', isSelected)
        })
        drawSelectableForPermissionForm(apiKey)
        codeField.val(code);
        monitorsRestrictedField.change()
    }
    monitorsTable.on('click', '[toggle-checkbox]',function(){
        var el = $(this);
        var target = el.attr('toggle-checkbox')
        var checkBoxes = monitorsTable.find(`.permission-view [value="${target}"]:visible`);
        var isChecked = checkBoxes.first().prop('checked')
        checkBoxes.prop('checked', !isChecked)
    })
    theWindow.on('change', '[selector]', function(){
        onSelectorChange(this,theWindow)
    })
    theWindowForm.submit(function(e){
        e.preventDefault()
        addApiKey()
        return false;
    })
    theWindow.on('click','.reset-form', async function(e){
        resetForm()
    })
    theWindow.on('click','.submit', async function(e){
        theWindowForm.submit()
    })
    theWindow.on('click','.edit',function(e){
        var el = $(this).parents('[api_key]')
        var code = el.attr('api_key')
        loadApiKeyIntoForm(code)
    })
    theWindow.on('click','.delete',function(e){
        var el = $(this).parents('[api_key]')
        var code = el.attr('api_key')
        deleteApiKey(code)
    })
    theWindow.on('click','.copy',function(e){
        var el = $(this).parents('[api_key]')
        var code = el.attr('api_key')
        copyToClipboard(code)
        new PNotify({
            title: lang['Copied'],
            text: lang['Copied to Clipboard'],
            type: 'success'
        })
    })
    addOnTabOpen('apiKeys', async function () {
        resetForm()
        loadApiKeys()
    })
    addOnTabReopen('apiKeys', function () {
        loadApiKeys()
    })
})
