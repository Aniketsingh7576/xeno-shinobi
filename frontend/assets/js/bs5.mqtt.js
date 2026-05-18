$(document).ready(function(){
    var theBlock = $('#tab-accountSettings')
    var mqttList = $('#mqttclient_list')
    function drawMqttLsitRow(row){
        row = row ? row : {
            host: '',
            subKey: '',
            type: [],
            monitors: [],
        }
        var html = `<div class="d-flex flex-row mqtt-list-row vertical-center">
            <div class="px-1 py-2 flex-grow-1">
                <input placeholder="${lang.Example} : mqtt.server.host" class="form-control form-control-sm mb-2" mqtt-param="host" value="${row.host || ''}">
                <input placeholder="${lang.Example} : your/events" class="form-control form-control-sm" mqtt-param="subKey" value="${row.subKey || ''}">
            </div>
            <div class="px-1 py-2">
                <select multiple class="form-control form-control-sm" mqtt-param="type">
                    ${createOptionHtml({
                        value: 'plain',
                        label: lang['Plain'],
                        selected: row.type.indexOf('plain') > -1,
                    })}
                    ${createOptionHtml({
                        value: 'frigate',
                        label: lang['Frigate'],
                        selected: row.type.indexOf('frigate') > -1,
                    })}
                </select>
            </div>
            <div class="px-1 py-2">
                    <select multiple class="form-control form-control-sm" mqtt-param="monitors">
                    <option value="$all">${lang['All Monitors']}</option>
                    <optgroup label="${lang.Monitors}">${buildMonitorsListSelectFieldHtml(row.monitors || [])}</optgroup>
                </select>
            </div>
            <div class="px-1 py-2">
                <button type="button" class="btn btn-sm btn-danger mqtt-delete-row"><i class="fa fa-times"></i></button>
            </div>
        </div>`
        return html
    }
    theBlock.find('.mqtt-add-row').click(function(){
        mqttList.append(drawMqttLsitRow())
    });
    mqttList.on('click','.mqtt-delete-row',function(){
        $(this).parents('.mqtt-list-row').remove()
    });
    accountSettings.onLoadFields(function(theForm){
        var mqttClientList = $user.details.mqttclient_list ? $user.details.mqttclient_list : []
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
        mqttList.find('.mqtt-list-row').each(function(n,v){
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
        theForm.details.mqttclient_list = mqttClientList
    })
})
