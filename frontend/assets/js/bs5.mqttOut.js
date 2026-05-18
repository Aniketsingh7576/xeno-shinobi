$(document).ready(function(){
    var theBlock = $('#tab-accountSettings')
    var mqttList = $('#mqttout_list')
    function drawMqttLsitRow(row){
        row = row ? row : {
            host: '',
            pubKey: '',
            msgFor: [],
            monitors: [],
        }
        var selecteEventsHtml = ''
        $.each([
            {
                value: 'onMonitorSave',
                label: lang['Monitor Edit'],
            },
            {
                value: 'onMonitorStart',
                label: lang['Monitor Start'],
            },
            {
                value: 'onMonitorStop',
                label: lang['Monitor Stop'],
            },
            {
                value: 'onMonitorDied',
                label: lang['Monitor Died'],
            },
            {
                value: 'onEventTrigger',
                label: lang['Detection Event'],
            },
            {
                value: 'insertCompletedVideoExtender',
                label: lang['Recording Complete'],
            },
            {
                value: 'onEventBasedRecordingComplete',
                label: lang['Event-Based Recording'],
            },
            {
                value: 'onDetectorNoTriggerTimeout',
                label: lang['No Trigger'],
            },
            {
                value: 'onAccountSave',
                label: lang['Account Save'],
            },
            {
                value: 'onUserLog',
                label: lang['User Log'],
            },
            {
                value: 'onTwoFactorAuthCodeNotification',
                label: lang['2-Factor Authentication'],
            },
        ],function(n,option){
            selecteEventsHtml += createOptionHtml({
                value: option.value,
                label: option.label,
                selected: row.msgFor.indexOf(option.value) > -1,
            })
        })
        var html = `<div class="d-flex flex-row mqtt-out-list-row vertical-center">
            <div class="px-1 py-2 flex-grow-1">
                <input placeholder="${lang.Example} : mqtt.server.host" class="form-control form-control-sm mb-2" mqtt-param="host" value="${row.host || ''}">
                <input placeholder="${lang.Example} : your/events" class="form-control form-control-sm" mqtt-param="pubKey" value="${row.pubKey || ''}">
            </div>
            <div class="px-1 py-2">
                <input placeholder="${lang.Username}" class="form-control form-control-sm mb-2" mqtt-param="username" value="${row.username || ''}">
                <input placeholder="${lang.Password}" class="form-control form-control-sm" mqtt-param="password" value="${row.password || ''}">
                <input placeholder="${lang['Client ID']}" class="form-control form-control-sm" mqtt-param="clientId" value="${row.clientId || ''}">
            </div>
            <div class="px-1 py-2">
                <select multiple class="form-control form-control-sm" mqtt-param="msgFor">
                    ${selecteEventsHtml}
                </select>
            </div>
            <div class="px-1 py-2">
                    <select multiple class="form-control form-control-sm" mqtt-param="monitors">
                    <option value="$all">${lang['All Monitors']}</option>
                    <optgroup label="${lang.Monitors}">${buildMonitorsListSelectFieldHtml(row.monitors || [])}</optgroup>
                </select>
            </div>
            <div class="px-1 py-2">
                <button type="button" class="btn btn-sm btn-danger mqtt-out-delete-row"><i class="fa fa-times"></i></button>
            </div>
        </div>`
        return html
    }
    theBlock.find('.mqtt-out-add-row').click(function(){
        mqttList.append(drawMqttLsitRow())
    });
    mqttList.on('click','.mqtt-out-delete-row',function(){
        $(this).parents('.mqtt-out-list-row').remove()
    });
    accountSettings.onLoadFields(function(theForm){
        var mqttClientList = $user.details.mqttout_list ? $user.details.mqttout_list : []
        mqttList.html(`<div class="flex-grow-1 text-center"><i class="fa fa-spinner fa-pulse"></i></div>`)
        setTimeout(function(){
            var html = ''
            $.each(mqttClientList,function(n,row){
                html += `${drawMqttLsitRow(row,n)}`
            })
            mqttList.html(html)
        },3000)
    })
    accountSettings.onSaveFields(function(theForm){
        var mqttClientList = []
        mqttList.find('.mqtt-out-list-row').each(function(n,v){
            var el = $(v)
            var rowFields = {}
            el.find('[mqtt-param]').each(function(nn,param){
                var paramEl = $(param)
                var theKey = paramEl.attr('mqtt-param')
                var value = paramEl.val()
                rowFields[theKey] = value
            })
            mqttClientList.push(rowFields)
        })
        theForm.details.mqttout_list = mqttClientList
    })
})
