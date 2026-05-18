$(document).ready(function(){
    var theEnclosure = $('#centralManagement')
    var theList = $('#centralManagement-list')
    var theForm = theEnclosure.find('form')
    function getServers(){
        return new Promise((resolve) => {
            $.get(superApiPrefix + $user.sessionKey + '/mgmt/list',function(data){
                console.log('mgmtServers',data)
                resolve(data.mgmtServers)
            })
        })
    }
    function addServer({ managementServer, peerConnectKey }){
        return new Promise((resolve) => {
            $.post(superApiPrefix + $user.sessionKey + '/mgmt/save',{
                managementServer,
                peerConnectKey,
            },function(data){
                resolve(data)
            })
        })
    }
    function removeServer({ managementServer, peerConnectKey }){
        return new Promise((resolve) => {
            $.post(superApiPrefix + $user.sessionKey + '/mgmt/disconnect',{
                managementServer,
                peerConnectKey,
            },function(data){
                resolve(data)
            })
        })
    }
    function drawServerRow({ managementServer, peerConnectKey }){
        var notExist = $(`[data-server="${managementServer}"][data-peerconnectkey="${peerConnectKey}"]`).length === 0
        if(notExist)theList.append(`<tr class="server-row" data-server="${managementServer}" data-peerconnectkey="${peerConnectKey}">
            <td>${managementServer}</td>
            <td>${peerConnectKey}</td>
            <td><a class="btn btn-sm btn-danger delete"><i class="fa fa-trash-o"></i></a></td>
        </tr>`)
    }
    async function drawServers(){
        const list = await getServers()
        for(managementServer in list){
            var peerConnectKey = list[managementServer];
            drawServerRow({ managementServer, peerConnectKey })
        }
    }
    theEnclosure.find('.submit').click(function(){
        theForm.submit()
    })
    theEnclosure.on('click', '.delete', function(){
        var el = $(this).parents('.server-row')
        var managementServer = el.attr('data-server')
        var peerConnectKey = el.attr('data-peerconnectkey')
        $.confirm.create({
            title: lang["Delete"],
            body: `${lang.DeleteThisMsg}`,
            clickOptions: {
                title: '<i class="fa fa-trash-o"></i> ' + lang.Delete,
                class: 'btn-danger btn-sm'
            },
            clickCallback: async function(){
                const response = await removeServer({ managementServer, peerConnectKey })
                if(response.ok){
                    el.remove();
                }
            }
        });
    })
    theForm.submit(async function(e){
        e.preventDefault()
        var formValues = $(this).serializeObject()
        var response = await addServer(formValues)
        if(response.ok){
            new PNotify({
                type: 'success',
                title: lang['Settings Changed'],
                text: lang.centralManagementSaved,
            })
            drawServerRow(formValues)
        }
        return false
    })
    onInitSuccess(function(){
        drawServers()
    })
})
