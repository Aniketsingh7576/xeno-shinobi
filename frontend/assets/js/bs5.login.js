var loginForm = $('#login-form')
var cachedLoginInfo = localStorage.getItem('XenocipherLogin_'+location.host)
var cachedMachineId = localStorage.getItem('XenocipherAuth_'+location.host)
function generateId(x){
    if(!x){x=10};var t = "";var p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0; i < x; i++ )
        t += p.charAt(Math.floor(Math.random() * p.length));
    return t;
}
function onSelectorChange(el){
    try{
        var theParam = el.attr('selector')
        var theValue = el.val()
        var theSelected = el.find('option:selected').text()
        loginForm.find(`.${theParam}_input`).hide()
        loginForm.find(`.${theParam}_${theValue}`).show()
        loginForm.find(`.${theParam}_text`).text(theSelected)
    }catch(err){
        console.log(err)
    }
}
if(!cachedMachineId){
    cachedMachineId = generateId(20)
    localStorage.setItem('XenocipherAuth_'+location.host,cachedMachineId)
}
$(document).ready(function(){
    $('#machineID').val(cachedMachineId)
    $('[selector]').change(function(){
        var el = $(this)
        onSelectorChange(el)
    }).change();
})
loginForm.submit(function(e){
    $('#login-message').remove()
    var formValues = loginForm.serializeObject()
    if(formValues.remember){
        localStorage.setItem('XenocipherLogin_'+location.host,JSON.stringify({
            mail: formValues.mail,
            pass: formValues.pass,
            function: formValues.function
        }))
    }else{
        localStorage.removeItem('XenocipherLogin_'+location.host)
    }
    if(googleSignIn)googleSignOut();
})
if(cachedLoginInfo){
    cachedLoginInfo = JSON.parse(cachedLoginInfo)
    $.each(cachedLoginInfo,function(n,v){
        var el = loginForm.find('[name="'+n+'"]')
        if(el.attr('type') === 'checkbox'){
            el.prop('checked',true)
        }else{
            el.val(v)
        }
    })
    loginForm.find('[name="remember"]').prop('checked',true)
    loginForm.submit()
}
$('[name="function"]').change(function(){
    var removeClass='btn-danger btn-primary btn-success btn-warning'
    var addClass='btn-success'
    switch($(this).val()){
        case'streamer':
            addClass='btn-warning'
        break;
        case'admin':
            addClass='btn-primary'
        break;
        case'super':
            addClass='btn-danger'
        break;
    }
    $('#login-submit').removeClass(removeClass).addClass(addClass)
})
