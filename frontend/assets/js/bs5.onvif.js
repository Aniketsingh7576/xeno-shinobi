function onvifStartPatrol(monitorId, startingPresetToken = '1', patrolIndexTimeout = 5000, speed = 1){
    return new Promise((resolve) => {
        $.post(getApiPrefix('onvifStartPatrol') + '/' + monitorId, {
            startingPresetToken,
            patrolIndexTimeout,
            speed,
        },function(response){
            resolve(response)
        })
    })
}
function onvifStopPatrol(monitorId){
    return new Promise((resolve) => {
        $.get(getApiPrefix('onvifStopPatrol') + '/' + monitorId,function(response){
            resolve(response)
        })
    })
}
