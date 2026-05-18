$(document).ready(function(){
    var changeSuperPreferencesTab = $('#changeSuperPreferences')
    var tokenContainer = $('#super-tokens')
    var changeSuperPreferencesForm = changeSuperPreferencesTab.find('form')
    function generateId(x){
        if(!x){x=10};var t = "";var p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for( var i=0; i < x; i++ )
            t += p.charAt(Math.floor(Math.random() * p.length));
        return t;
    }
    function drawTokenRow(tokenValue){
        var html = `<div class="d-flex flex-row token-row mt-3">
            <div class="flex-grow-1">
                <input class="form-control form-control-sm token-row-input" value="${tokenValue || generateId(30)}">
            </div>
            <div>
                <a class="delete-token btn btn-danger btn-sm my-0 ml-3"><i class="fa fa-trash"></i></a>
            </div>
        </div>`
        tokenContainer.append(html)
    }
    function getTokenRows(){
        var rowsFound = []
        changeSuperPreferencesTab.find('.token-row-input').each(function(n,v){
            var el = $(v)
            var tokenValue = el.val().trim()
            if(tokenValue)rowsFound.push(tokenValue);
        })
        return rowsFound
    }
    function loadPreferences(){
        var tokens = $user.tokens
        changeSuperPreferencesTab.find('[name=mail]').val($user.mail)
        if(tokens instanceof Array){
            tokens.forEach(function(token){
                drawTokenRow(token)
            })
        }
    }
    changeSuperPreferencesTab.find('.new-token').click(function(){
        drawTokenRow()
    })
    changeSuperPreferencesTab.on('click','.delete-token',function(){
        $(this).parents('.token-row').remove()
    })
    changeSuperPreferencesTab.find('.submit').click(function(){
        changeSuperPreferencesForm.submit()
    })
    changeSuperPreferencesForm.submit(function(e){
        e.preventDefault()
        var formValues = $(this).serializeObject()
        formValues.tokens = getTokenRows()
        // $.ccio.cx({f:'accounts',ff:'saveSuper',form:formValues})
        $.post(superApiPrefix + $user.sessionKey + '/accounts/saveSettings',{
            data: JSON.stringify(formValues)
        },function(data){
            console.log(data)
        })
        return false
    })
    loadPreferences()
})
