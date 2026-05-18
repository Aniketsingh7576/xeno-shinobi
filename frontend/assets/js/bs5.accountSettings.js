$(document).ready(function(){
    var accountSettingsWereSaved = false;
    var theBlock = $('#tab-accountSettings')
    var theContainer = $('#accountSettingsContainer')
    var theForm = $('#settings')
    var addStorageMaxAmounts = $('#add_storage_max_amounts')
    var addStorageMaxAmountsField = theForm.find('[detail="addStorage"]')
    function drawAddStorageFields(){
        try{
            var addStorageData = safeJsonParse($user.details.addStorage || '{}')
            var html = ''
            $.each(addStorage,function(n,storage){
                var theStorage = addStorageData[storage.path] || {}
                html += `
                <div addStorageFields="${storage.path}">
                    <div class="form-group">
                        <div class="mb-2"><span>${lang['Max Storage Amount']} : ${storage.name}</span></div>
                        <div><input class="form-control" placeholder="10 GB" size-adjust='[addStorageFields="${storage.path}"] [addStorageItem="limit"]'></div>
                        <div><input class="hidden form-control" placeholder="10000" addStorageItem="limit" value="${theStorage.limit || ''}"></div>
                    </div>
                    <div class="form-group">
                        <div class="mb-2"><span>${lang["Video Share"]} : ${storage.name}</span></div>
                        <div><input class="form-control" placeholder="95" addStorageItem="videoPercent" value="${theStorage.videoPercent || ''}"></div>
                    </div>
                    <div class="form-group">
                        <div class="mb-2"><span>${lang["Timelapse Frames Share"]} : ${storage.name}</span></div>
                        <div><input class="form-control" placeholder="5" addStorageItem="timelapsePercent" value="${theStorage.timelapsePercent || ''}"></div>
                    </div>
                </div>`
            })
            addStorageMaxAmounts.html(html)
        }catch(err){
            console.log(err)
        }
    }
    function fillSizeAdjustFields(){
        theForm.find('[size-adjust]').each(function(n,v){
            var el = $(this);
            var targetElTag = el.attr('size-adjust');
            var targetEl = theForm.find(targetElTag);
            var value = targetEl.val() || '10000';
            var translatedVal = mbToHumanReadable(value);
            el.val(translatedVal);
        })
    }
    function fillFormFields(){
        $.each($user,function(n,v){
            theForm.find(`[name="${n}"]`).val(v).change()
        })
        $.each($user.details,function(n,v){
            theForm.find(`[detail="${n}"]`).val(v).change()
        })
        fillSizeAdjustFields()
        accountSettings.onLoadFieldsExtensions.forEach(function(extender){
            extender(theForm)
        })
    }
    function getAddStorageFields(){
        var json = {}
        $.each(addStorage,function(n,storage){
            var storageId = storage.path
            var miniContainer = addStorageMaxAmounts.find(`[addStorageFields="${storageId}"]`)
            var fields = miniContainer.find('[addStorageItem]')
            json[storageId] = {
                name: storage.name,
                path: storage.path,
            }
            $.each(fields,function(n,el){
                var field = $(el)
                var keyName = field.attr('addStorageItem')
                var value = field.val()
                json[storageId][keyName] = value
            })
        })
        return json
    }
    function mbToHumanReadable(mb) {
      const units = ["MB", "GB", "TB", "PB", "EB"];  // Extend if needed
      let unitIndex = 0;
      let value = parseInt(mb);
      while (value >= 1000 && unitIndex < units.length - 1) {
        value /= 1000;
        unitIndex++;
      }
      value = parseFloat(value.toFixed(2));
      return `${value} ${units[unitIndex]}`;
    }
    function humanReadableToMb(str) {
      const cleanedStr = str.toUpperCase().replace(/ /g, '').trim();
      const pattern = /^([\d.]+)(MB|GB|TB|PB|EB)$/i;
      let match = cleanedStr.match(pattern);

      if (!match) {
        const numericMatch = cleanedStr.match(/[\d.]+/);
        if (!numericMatch) {
          return 10000;
        }
        let value = parseFloat(numericMatch[0]);
        if (isNaN(value)) {
          return 10000;
        }
        return value;
      }

      let [ , numericPart, unit ] = match;
      let value = parseFloat(numericPart);
      switch (unit) {
        case "MB":
          break;
        case "GB":
          value *= 1000;
          break;
        case "TB":
          value *= 1000 * 1000;
          break;
        case "PB":
          value *= 1000 * 1000 * 1000;
          break;
        case "EB":
          value *= 1000 * 1000 * 1000 * 1000;
          break;
        default:
          break;
      }

      return value;
    }
    theForm.on('change', '[size-adjust]', function(){
        var el = $(this);
        var targetElTag = el.attr('size-adjust');
        var targetEl = theForm.find(targetElTag);
        var value = el.val();
        var translatedVal = humanReadableToMb(value);
        targetEl.val(translatedVal);
    })
    theForm.find('[detail]').change(onDetailFieldChange)
    theForm.find('[detail]').change(function(){
        onDetailFieldChange(this)
    })
    theForm.find('[selector]').change(function(){
        onSelectorChange(this,theForm)
    })
    theForm.submit(function(e){
        e.preventDefault()
        var formData = theForm.serializeObject()
        var errors = []
        if(formData.pass !== '' && formData.password_again !== formData.pass){
            errors.push(lang[`Passwords don't match`])
        }
        if(errors.length > 0){
            new PNotify({
                title: lang.accountSettingsError,
                text: errors.join('<br>'),
                type: 'danger'
            })
            return
        }
        $.each(formData,function(n,v){
            formData[n] = v.trim()
        })
        var details = getDetailValues(theForm)
        formData.details = details
        formData.details.addStorage = getAddStorageFields()
        accountSettings.onSaveFieldsExtensions.forEach(function(extender){
            extender(formData)
        })
        $.post(getApiPrefix('accounts') + '/edit',{
            data: JSON.stringify(formData)
        },function(data){
            if(data.ok){
                // new PNotify({
                //     title: lang['Settings Changed'],
                //     text: lang.SettingsChangedText,
                //     type: 'success'
                // })
            }
        })
        if(details.googd_save === '1' && details.googd_code && details.googd_code !== '***************'){
            theForm.find('[detail="googd_code"]').val('***************')
        }
        return false
    })
    drawAddStorageFields()
    fillFormFields()
    drawSubMenuItems('accountSettings',definitions['Account Settings'])
    onWebSocketEvent(function (d){
        switch(d.f){
            case'user_settings_change':
                new PNotify({
                    title: lang['Settings Changed'],
                    text: lang.SettingsChangedText,
                    type: 'success'
                })
                // $.ccio.init('id',d.form);
                d.form.details = safeJsonParse(d.form.details)
                $('#custom_css').html(d.form.details.css)
                if(d.form.details){
                    $user.details = d.form.details
                }
                sortListMonitors()
                accountSettingsWereSaved = true;
            break;
        }
    })
    addOnTabReopen('accountSettings', function () {
        if(accountSettingsWereSaved){
            accountSettingsWereSaved = false;
            fillFormFields()
        }
    })
})
