function listPermissions(){
    return new Promise((resolve) => {
        $.getJSON(getApiPrefix('permissions'),function(data){
            resolve(data.permissions)
        })
    })
}
$(document).ready(function(e){
    var theWindow = $('#tab-permissionSets')
    var theDropdown = $('#userPermissionsSelector')
    var monitorsTable = $('#permissionSets_monitors')
    var theForm = theWindow.find('form');
    var deleteButton = theWindow.find('.delete');
    var loadedPermissions = {}
    var permissionTypeNames = [
        { name: 'monitors', label: lang['Can View Monitor'] },
        { name: 'monitor_edit', label: lang['Can Edit Monitor'] },
        { name: 'video_view', label: lang['Can View Videos and Events'] },
        { name: 'video_delete', label: lang['Can Delete Videos and Events'] },
    ];
    function getPermissionSet(name){
        return new Promise((resolve) => {
            $.getJSON(`${getApiPrefix('permissions')}/${name}`,function(data){
                resolve(data.permissions[0])
            })
        })
    }
    function getPermissionForm(){
        const formValues = theForm.serializeObject();
        formValues.details = {
            'monitors': [],
            'monitor_edit': [],
            'video_view': [],
            'video_delete': [],
        };
        theForm.find(`[detail]`).each(function(n,v){
            var el = $(this);
            var key = el.attr('detail');
            var value = el.val();
            formValues.details[key] = value;
        });
        monitorsTable.find('.permission-view input:checked').each(function(n,v){
            var el = $(v)
            var monitorId = el.attr('data-monitor')
            var permissionType = el.val() // permissions selected
            formValues.details[permissionType].push(monitorId)
        })
        return formValues
    }
    function createPermissionSet(){
        const formValues = getPermissionForm();
        return new Promise((resolve) => {
            if(!formValues.name)return resolve({ ok: false, error: lang['Failed Action'] });
            $.post(`${getApiPrefix('permissions')}`,{
                data: JSON.stringify(formValues)
            },function(data){
                const notify = {
                    type: 'success',
                    title: lang['Saved Permissions'],
                }
                if(!data.ok){
                    notify.type = 'danger'
                    notify.title = lang['Failed Action']
                    notify.text = data.error
                }else{
                    loadPermissions()
                }
                new PNotify(notify)
                resolve(data)
            })
        })
    }
    function deletePermissionSet(name){
        return new Promise((resolve) => {
            $.get(`${getApiPrefix('permissions')}/${name}/delete`,function(response){
                resolve(response)
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
        theDropdown.find('optgroup').html(html)
    }
    function loadPermissionToForm(name){
        if(!name){
            deleteButton.hide();
            clearPermissionForm()
        }else{
            const permission = loadedPermissions[name]
            $.each(permission,function(key, value){
                theForm.find(`[name="${key}"]`).val(value)
            })
            $.each(permission.details,function(key, value){
                theForm.find(`[detail="${key}"]`).val(value)
            })
            drawSelectableForPermissionForm(permission)
            deleteButton.show();
        }
    }
    function drawSelectableForPermissionForm(permission){
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
                    const isChecked = permission && (permission.details[permissionType.name] || []).indexOf(monitor.mid) > -1;
                    html += `<td><input class="form-check-input" type="checkbox" data-monitor="${monitor.mid}" value="${permissionType.name}" ${isChecked ? 'checked' : ''}></td>`
                })
            html += `</tr>`
        })
        html += '</tbody>'
        monitorsTable.html(html)
    }
    function clearPermissionForm(permission){
        theDropdown.val('')
        theForm.find('[name="name"]').val('')
        theForm.find('[data-default]').each(function(n,v){
            var el = $(v);
            el.val(el.attr('data-default'));
        })
        drawSelectableForPermissionForm()
    }
    monitorsTable.on('click', '[toggle-checkbox]',function(){
        var el = $(this);
        var target = el.attr('toggle-checkbox')
        var checkBoxes = monitorsTable.find(`.permission-view [value="${target}"]:visible`);
        var isChecked = checkBoxes.first().prop('checked')
        checkBoxes.prop('checked', !isChecked)
    })
    theForm.submit(function(e){
        e.preventDefault()
        createPermissionSet()
        return false;
    })
    deleteButton.click(function(e){
        var name = theDropdown.val()
        if(loadedPermissions[name]){
            $.confirm.create({
                title: lang["Delete Permission"],
                body: `${lang.DeleteThisMsg}`,
                clickOptions: {
                    title: '<i class="fa fa-trash-o"></i> ' + lang.Delete,
                    class: 'btn-danger btn-sm'
                },
                clickCallback: async function(){
                    const response = await deletePermissionSet(name)
                    if(response.ok){
                        loadPermissions()
                        clearPermissionForm()
                    }else{
                        new PNotify({
                            type: 'danger',
                            title: lang['Failed Action'],
                            text: data.error,
                        })
                    }
                }
            });
        }
    })
    theDropdown.change(function(){
        var name = $(this).val();
        loadPermissionToForm(name)
    })
    addOnTabOpen('permissionSets', function () {
        loadPermissions()
        clearPermissionForm()
    })
    addOnTabReopen('permissionSets', function () {
        var theSelected = theDropdown.val()
        loadPermissions()
        theDropdown.val(theSelected)
    })
})
