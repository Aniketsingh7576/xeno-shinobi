function initHelpNotice(){
    var openMessage = null
    function lessThanOneWeekAgo(date){
        const WEEK = 1000 * 60 * 60 * 24 * 7;
        const aWeekAgo = Date.now() - WEEK;

        return date < aWeekAgo;
    }
    function showHelpNotice(){
        var buttonHtml = ``
        $.each([
            {
                icon: 'share-square-o',
                color: 'default',
                text: 'XenocipherShop Subscriptions',
                href: 'https://licenses.shinobi.video/subscribe',
                class: ''
            },
            {
                icon: 'paypal',
                color: 'success',
                text: 'Donate by PayPal',
                href: '#',
                class: ''
            },
            {
                icon: 'bank',
                color: 'default',
                text: 'University of Zurich (UZH)',
                href: 'https://www.zora.uzh.ch/id/eprint/139275/',
                class: ''
            },
            {
                icon: 'cube',
                color: 'danger',
                text: lang[`Don't Show for 1 Week`],
                href: '#',
                class: 'hide_donate',
            },
        ],function(n,button){
            buttonHtml += `<a style="margin-bottom:4px" ${ button.href ? `href="${button.href}"` : '' } target="_blank" class="d-flex flex-row btn btn-sm btn-block btn-${ button.color } ${ button.class }">
                <div><i class="fa fa-${ button.icon }" aria-hidden="true"></i></div>
                <div class="text-center flex-grow-1">${ button.text }</div>
            </a>`
        })
        openMessage = new PNotify({
            title: `It's a proven fact`,
            text: `
            <div class="mb-3">Generosity makes you a happier person, please consider supporting the development.</div>
            <div class="mb-3">If you are already supporting the development, please contact us or use your provided license key and we can get this popup to go away for you <i class="fa fa-smile-o"></i> Cheers!</div>
            ${buttonHtml}`,
            hide: false,
        })
    }
    function dontShowForOneWeek(){
        if(openMessage){
            openMessage.remove()
        }
        dashboardOptions('subscription_checked',new Date());
    }
    if(
        !userHasSubscribed &&
        (
            !dashboardOptions().subscription_checked ||
            lessThanOneWeekAgo(new Date(dashboardOptions().subscription_checked))
        )
    ){
        setTimeout(function(){
            showHelpNotice()
        },1000 * 60 * 0.2)
    }
    $('body').on('click','.hide_donate',function(e){
        e.preventDefault()
        dontShowForOneWeek()
        return false;
    })
    console.log('Please support the Xenocipher development.')
    console.log('https://licenses.shinobi.video/subscribe')
}
$(document).ready(function(){
    var theEnclosure = $('#tab-helpWindow')
    var helpingHandResults = $('#helpinghand-results')
    var helpingHandSelector = $('#helpinghand-options')
    var monitorList = theEnclosure.find('.monitors_list')
    function loadHelpingHandsOptions(){
        var html = ``
        $.each(helpingHandShows,function(showId,show){
            html += createOptionHtml({
                label: `${show.name}`,
                value: showId
            })
        })
        helpingHandSelector.html(html)
    }
    window.getSelectedHelpingHandMonitorTarget = function(){
        return monitorList.val()
    }
    function loadHelpingHandSelectors(){
        loadHelpingHandsOptions()
        drawMonitorListToSelector(monitorList)
    }
    $('.watch-helping-hand').click(function(){
        var selectedShowId = helpingHandSelector.val()
        playHelpingHandShow(selectedShowId)
    })
    helpingHandSelector.change(function(){
        var selectedShowId = helpingHandSelector.val()
        var theShow = helpingHandShows[selectedShowId]
        var monitorTargetSpecific = theEnclosure.find('.helping-hand-target-monitor')
        if(theShow.targetMonitor){
            monitorTargetSpecific.show()
        }else{
            monitorTargetSpecific.hide()
        }
    })
    initHelpNotice()
    addOnTabOpen('helpWindow', function () {
        loadHelpingHandSelectors()
    })
    addOnTabReopen('helpWindow', function () {
        loadHelpingHandSelectors()
    })
    $('body').on('click','.helping-hand-stop',function(){
        stopHelpingHandShow()
    })
})
