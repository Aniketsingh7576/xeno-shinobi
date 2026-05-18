$(document).ready(function() {
    var selectedController = 0;
    var keyLegend = {
        "0": "b",
        "1": "a",
        "2": "y",
        "3": "x",
        "4": "l",
        "5": "r",
        "6": "zl",
        "7": "zr",
        "8": "minus",
        "9": "plus",
        "10": "l_stick",
        "11": "r_stick",
        "12": "up",
        "13": "down",
        "14": "left",
        "15": "right",
    }
    var lastState = {
        sticks: {
            left: {},
            right: {},
        }
    }
    var lastPtzDirection = {}
    var buttonsPressed = {}
    var hasGP = false;
    var repGP;
    var reportInterval = 200
    var stickBase = 2048
    var stickMax = 4096
    var deadZoneThreshold = 0.35
    var outerDeadZone = 1.01
    var selectedMonitor = null;
    var monitorKeys = {};
    var sequenceButtonPressList = []
    var sequenceButtonPressTimeout = null
    var buttonPressAction = null;

    function runPtzCommand(monitorId,switchChosen){
        switch(switchChosen){
            case'setHome':
                $.getJSON(getApiPrefix(`control`) + '/' + monitorId + '/setHome',function(data){
                    console.log(data)
                })
            break;
            default:
                mainSocket.f({
                    f: 'control',
                    direction: switchChosen,
                    id: monitorId,
                    ke: $user.ke
                })
            break;
        }
    }

    function runPtzMove(monitorId,switchChosen,doMove){
        mainSocket.f({
            f: doMove ? 'startMove' : 'stopMove',
            direction: switchChosen,
            id: monitorId,
            ke: $user.ke
        })
    }

    window.setGamepadMonitorSelection = (monitorId) => {
        selectedMonitor = `${monitorId}`;
    }

    function canGame() {
       return "getGamepads" in navigator;
    }

    function convertStickAxisTo2048(value){
       var newVal = parseInt((stickMax - stickBase) * value + stickBase)
       return newVal
    }

    function getAnalogStickValues(gp, i, callback){
        var label = i === 0 ? 'left' : 'right'
        var horizontal = gp.axes[i] * outerDeadZone
        var vertical = gp.axes[i + 1] * outerDeadZone
        var newH = convertStickAxisTo2048(horizontal > deadZoneThreshold || horizontal < -deadZoneThreshold ? horizontal : 0)
        var newV = convertStickAxisTo2048((vertical > deadZoneThreshold || vertical < -deadZoneThreshold ? vertical : 0) * -1)
        if(
            newH !== lastState.sticks[label].h ||
            newV !== lastState.sticks[label].v
        ){
            callback(label, newH, newV)
        }
        lastState.sticks[label].h = newH
        lastState.sticks[label].v = newV
    }

    function getStickValue(gp, i, callback){
        var label = `axis${axis}`;
        var axis = gp.axes[i] * outerDeadZone
        var newH = convertStickAxisTo2048(axis > deadZoneThreshold || axis < -deadZoneThreshold ? axis : 0)
        if(newH !== lastState[label]){
            callback(newH)
        }
        lastState[label] = newH
    }

    function getButtonsPressed(gp, callback, offCallback = () => {}){
        $.each(keyLegend,function(code,key){
            if(gp.buttons[code] && gp.buttons[code].pressed){
                if(!lastState[key]){
                    buttonsPressed[code] = true;
                    callback(code)
                }
                lastState[key] = true
            }else{
                if(lastState[key]){
                    buttonsPressed[code] = false;
                    offCallback(code)
                }
                lastState[key] = false
            }
        })
    }

    function fullScreenInit(target){
        if (target.requestFullscreen) {
          target.requestFullscreen();
        } else if (target.mozRequestFullScreen) {
          target.mozRequestFullScreen();
        } else if (target.webkitRequestFullscreen) {
          target.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    }

    function sendPtzCommand(direction, doMove){
        runPtzMove(selectedMonitor, direction, doMove)
    }

    function sentPtzToHome(){
        runPtzCommand(selectedMonitor, 'center')
    }

    function startPatrol(){
        return onvifStartPatrol(selectedMonitor)
    }

    function stopPatrol(){
        return onvifStopPatrol(selectedMonitor)
    }

    function translatePointTiltStick(x, y){
        if(x > stickBase && !lastPtzDirection['right']){
            lastPtzDirection['right'] = true
            lastPtzDirection['left'] = false
            // sendPtzCommand('left', false)
            sendPtzCommand('right', true)
        }else if(x < stickBase && !lastPtzDirection['left']){
            lastPtzDirection['left'] = true
            lastPtzDirection['right'] = false
            // sendPtzCommand('right', false)
            sendPtzCommand('left', true)
        }else if(x === stickBase){
            if(lastPtzDirection['right'])sendPtzCommand('right', false)
            if(lastPtzDirection['left'])sendPtzCommand('left', false)
            lastPtzDirection['right'] = false
            lastPtzDirection['left'] = false
        }
        if(y > stickBase && !lastPtzDirection['up']){
            lastPtzDirection['up'] = true
            lastPtzDirection['down'] = false
            // sendPtzCommand('down', false)
            sendPtzCommand('up', true)
        }else if(y < stickBase && !lastPtzDirection['down']){
            lastPtzDirection['down'] = true
            lastPtzDirection['up'] = false
            // sendPtzCommand('up', false)
            sendPtzCommand('down', true)
        }else if(y === stickBase){
            if(lastPtzDirection['up'])sendPtzCommand('up', false)
            if(lastPtzDirection['down'])sendPtzCommand('down', false)
            lastPtzDirection['down'] = false
            lastPtzDirection['up'] = false
        }
    }

    function translateZoomAxis(value){
        if(value > stickBase && !lastPtzDirection['zoom_in']){
            lastPtzDirection['zoom_in'] = true
            lastPtzDirection['zoom_out'] = false
            // sendPtzCommand('zoom_out', false)
            sendPtzCommand('zoom_in', true)
        }else if(value < stickBase && !lastPtzDirection['zoom_out']){
            lastPtzDirection['zoom_out'] = true
            lastPtzDirection['zoom_in'] = false
            // sendPtzCommand('zoom_in', false)
            sendPtzCommand('zoom_out', true)
        }else if(value === stickBase){
            if(lastPtzDirection['zoom_in'])sendPtzCommand('zoom_in', false)
            if(lastPtzDirection['zoom_out'])sendPtzCommand('zoom_out', false)
            lastPtzDirection['zoom_in'] = false
            lastPtzDirection['zoom_out'] = false
        }
    }

    function reportOnXboxGamepad() {
        try{
            var gp = navigator.getGamepads()[0];
            getButtonsPressed(gp, function(buttonCode){
                if(buttonCode == 6){
                    sendPtzCommand('zoom_out', true)
                }else if(buttonCode == 7){
                    sendPtzCommand('zoom_in', true)
                }else if(buttonCode == 8){
                    // closeSnapshot()
                    // openSnapshot()
                }else if(buttonCode == 9){
                    sentPtzToHome()
                }else if(buttonCode == 11){
                    if (!document.fullscreenElement) {
                        fullScreenLiveGridStreamById(selectedMonitor)
                    }else{
                        document.exitFullscreen()
                    }
                }
            }, function(buttonCode){
                if(buttonCode == 6){
                    sendPtzCommand('zoom_out', false)
                }else if(buttonCode == 7){
                    sendPtzCommand('zoom_in', false)
                }
            })
            getAnalogStickValues(gp, 0, function(stick, x, y){
                translatePointTiltStick(x, y)
            })
            getAnalogStickValues(gp, 2, function(stick, x, y){
                translateZoomAxis(y)
            })
        }catch(err){
            console.log(err)
            // stopReporting()
        }
    }

    function reportOnGenericGamepad() {
        try{
            const gp = navigator.getGamepads()[0];
            getButtonsPressed(gp, function(buttonCode){
                if(buttonCode == 10){
                    startPatrol()
                }else if(buttonCode == 11){
                    stopPatrol()
                }else{
                    buttonPressAction(buttonCode)
                }
            },function(buttonCode){

            })
            getAnalogStickValues(gp, 0, function(stick, x, y){
                translatePointTiltStick(x, y)
            })
            getStickValue(gp, 2,function(value){
                translateZoomAxis(value)
            })
        }catch(err){
            console.log(err)
            // stopReporting()
        }
    }

    function startReporting(){
        if(!selectedMonitor)return console.log('No PTZ Monitor')
        if(hasGP){
            console.log('Reading Gamepad')
            window.clearInterval(repGP)
            repGP = window.setInterval(reportOnGamepad, reportInterval);
            delete(repGP)
        }
    }

    function stopReporting(){
        if(repGP){
            console.log('Stopping Gamepad')
            window.clearInterval(repGP)
        }
    }

    function setControllerType(gamepadId){
        switch(true){
            case gamepadId.includes('Xbox'):
                reportInterval = 200;
                reportOnGamepad = reportOnXboxGamepad
                console.log('Xbox Controller found!')
            break;
            default:
                reportInterval = 50;
                reportOnGamepad = reportOnGenericGamepad
            break;
        }
    }
    var reportOnGamepad = reportOnXboxGamepad;

    if(canGame()) {
        $(window).on("gamepadconnected", function(e) {
            console.error('Gamepad Connected!')
            hasGP = true;
            startReporting()
            const gamepadName = e.originalEvent.gamepad.id;
            setControllerType(gamepadName)
        })
        .on("gamepaddisconnected", function() {
            if(!navigator.getGamepads()[0]){
                hasGP = false;
                console.log('Gamepad Disconnected!')
            }
        })
    }else{
        console.error('No Gamepad detected!')
    }
    addActionToExtender('windowFocus', function () {
        startReporting()
    })
    addActionToExtender('windowBlur', function () {
        stopReporting()
    })
});
