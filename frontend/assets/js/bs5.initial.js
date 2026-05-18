onWebSocketEvent(function (d){
    switch(d.f){
        case'monitor_status':
        case'monitor_edit':
            setInterfaceCounts()
        break;
    }
});
$(document).ready(function(){
    createWebsocket();
});
