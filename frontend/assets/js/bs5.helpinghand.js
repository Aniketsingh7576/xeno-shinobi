var helpingHand = null
var isWatching = false
var helpingHandAnnotationBox = null
function drawHelpingHand(){
    if(!helpingHand){
        var html = `
            <div id="helping-hand"><i class="fa fa-3x fa-hand-pointer-o"></i></div>
            <div id="helping-hand-player">
                <div class="d-flex flex-row vertical-center">
                    <div style="flex:7" id="helping-hand-annotation"></div>
                    <div style="flex:3">
                        <a class="btn btn-sm btn-danger helping-hand-stop" title="${lang.Stop}"><i class="fa fa-square"></i> ${lang.Stop}</a>
                    </div>
                </div>
            </div>
        `
        $('body').append(html)
        helpingHand = $('#helping-hand')
        helpingHandAnnotationBox = $('#helping-hand-annotation')
    }
}
function removeHelpingHand(){
    if(helpingHand){
        helpingHand.fadeOut(2000)
        helpingHand.remove()
        $('#helping-hand-player').remove()
        helpingHand = null
    }
}
async function typeWriteInField(txt,fieldTarget){
    var speed = 100;
    var element = $(fieldTarget).focus().val('')[0]
    for (let i = 0; i < txt.length; i++) {
        element.value += txt.charAt(i);
        await setPromiseTimeout(speed);
    }
}
async function stopHelpingHandShow(showId){
    isWatching = false
}
async function playHelpingHandShow(showId){
    drawHelpingHand()
    isWatching = true
    var selectedShow = helpingHandShows[showId]
    var playlist = selectedShow.playlist
    for (let i = 0; i < playlist.length; i++) {
        if(isWatching){
            var movement = playlist[i];
            var waitTime = movement.time * 1000
            await setPromiseTimeout(waitTime);
            var cmd = movement.cmd
            var text = movement.text
            var handPos = movement.handPos
            var handPosCss = handPos
            if(handPos.el){
                var handElOffset = $(handPos.el).offset()
                handElOffset.top += 30
                handPosCss = handElOffset
            }
            helpingHand.css(handPosCss)
            if(text)helpingHandAnnotationBox[0].innerHTML = text
            if(cmd){
                await setPromiseTimeout(1500);
                try{
                    if(isWatching)await cmd();
                }catch(err){
                    console.error(err)
                }
            }
        }
    }
    if(isWatching)await setPromiseTimeout(3000);
    removeHelpingHand()
    isWatching = false
}
