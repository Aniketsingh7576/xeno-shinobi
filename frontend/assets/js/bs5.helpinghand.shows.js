var helpingHandShows = {
    "motion-preset-pair": {
        name: 'Add a Motion Detection On/Off Preset Pair',
        targetMonitor: true,
        playlist: [
            {
                text: 'Select the <b>Monitor States</b> tab in the Main Menu.',
                time: 0,
                handPos: {
                    el: `[page-open="monitorStates"]`
                },
                cmd: () => {
                    var sideMenu = $('#menu-side')
                    var theButton = sideMenu.find('[page-open="monitorStates"]')
                    sideMenu.animate({scrollTop: sideMenu.position().top},1000);
                }
            },
            {
                time: 1,
                handPos: {
                    el: `[page-open="monitorStates"]`
                },
                cmd: () => {
                    openTab('monitorStates',{})
                }
            },
            {
                text: 'Select <b>Add New</b> under Monitor States.',
                time: 1,
                handPos: {
                    el: `#monitorStatesSelector`
                },
                cmd: () => {
                    $('#monitorStatesSelector option').prop('selected',false);
                    $('#monitorStatesSelector').val('').change();
                }
            },
            {
                text: `Set the name for the new Preset.`,
                time: 1,
                handPos: {
                    el: `#tab-monitorStates [name="name"]`
                },
                cmd: async () => {
                    await typeWriteInField('Motion Detection On','#tab-monitorStates [name="name"]');
                }
            },
            {
                text: `Add a Monitor to this new Preset.`,
                time: 1,
                handPos: {
                    el: `#tab-monitorStates .add-monitor`
                },
                cmd: () => {
                    $('#tab-monitorStates .add-monitor').click();
                }
            },
            {
                text: `Select the target Monitor.`,
                time: 1,
                handPos: {
                    el: `#tab-monitorStates .state-monitor-row .state-monitor-row-select`
                },
                cmd: () => {
                    var monitorId = getSelectedHelpingHandMonitorTarget();
                    $(`#tab-monitorStates .state-monitor-row .state-monitor-row-select`).val(monitorId)
                }
            },
            {
                text: `Select the options to activate for when this Preset becomes active.`,
                time: 0.2,
                handPos: {
                    el: `#tab-monitorStates .state-monitor-row-fields-container`
                },
                cmd: () => {
                    var optionsSelected = $('#tab-monitorStates .state-monitor-row-fields-container')
                    var scrollBodyHeight = optionsSelected.height()
                    var detectorOption = optionsSelected.find('[data-name="detail=detector"]');
                    optionsSelected.animate({scrollTop: detectorOption.position().top - scrollBodyHeight},1000);
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-monitorStates .state-monitor-row-fields-container [data-name="detail=detector"]`
                },
                cmd: () => {
                    var optionsSelected = $('#tab-monitorStates .state-monitor-row-fields-container')
                    var detectorOption = optionsSelected.find('[data-name="detail=detector"]').click();
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-monitorStates .state-monitor-row-fields-container [data-name="detail=detector"] select`
                },
                cmd: () => {
                    $('#tab-monitorStates .state-monitor-row-fields-container [data-name="detail=detector"] select').val('1');
                }
            },
            {
                text: `Save the Preset.`,
                time: 1,
                handPos: {
                    el: `#tab-monitorStates .sticky-bar [type="submit"]`
                },
                cmd: () => {
                    $('#tab-monitorStates form').submit();
                }
            },
            /// Motion Off
            {
                text: `For this tutorial we're going to add another one for <b>Motion Detection Off</b>.`,
                time: 1,
                handPos: {
                    el: `#monitorStatesSelector`
                },
                cmd: () => {
                    $('#monitorStatesSelector option').prop('selected',false);
                    $('#monitorStatesSelector').val('').change();
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-monitorStates [name="name"]`
                },
                cmd: async () => {
                    await typeWriteInField('Motion Detection Off','#tab-monitorStates [name="name"]');
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-monitorStates .add-monitor`
                },
                cmd: () => {
                    $('#tab-monitorStates .add-monitor').click();
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-monitorStates .state-monitor-row .state-monitor-row-select`
                },
                cmd: () => {
                    var monitorId = getSelectedHelpingHandMonitorTarget();
                    $(`#tab-monitorStates .state-monitor-row .state-monitor-row-select`).val(monitorId)
                }
            },
            {
                time: 0.2,
                handPos: {
                    el: `#tab-monitorStates .state-monitor-row-fields-container`
                },
                cmd: () => {
                    var optionsSelected = $('#tab-monitorStates .state-monitor-row-fields-container')
                    var scrollBodyHeight = optionsSelected.height()
                    var detectorOption = optionsSelected.find('[data-name="detail=detector"]');
                    optionsSelected.animate({scrollTop: detectorOption.position().top - scrollBodyHeight},1000);
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-monitorStates .state-monitor-row-fields-container [data-name="detail=detector"]`
                },
                cmd: () => {
                    var optionsSelected = $('#tab-monitorStates .state-monitor-row-fields-container')
                    var detectorOption = optionsSelected.find('[data-name="detail=detector"]').click();
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-monitorStates .state-monitor-row-fields-container [data-name="detail=detector"] select`
                },
                cmd: () => {
                    $('#tab-monitorStates .state-monitor-row-fields-container [data-name="detail=detector"] select').val('0');
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-monitorStates .sticky-bar [type="submit"]`
                },
                cmd: () => {
                    $('#tab-monitorStates form').submit();
                }
            },
            /// set schedule, motion ON
            {
                text: 'Now we set them to activate automatically based on a time frame.',
                time: 1,
                handPos: {
                    el: `[page-open="schedules"]`
                },
                cmd: () => {
                    openTab('schedules',{})
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#schedulesSelector`
                },
                cmd: () => {
                    $('#schedulesSelector option').prop('selected',false);
                    $('#schedulesSelector').val('').change();
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-schedules [name="name"]`
                },
                cmd: async () => {
                    await typeWriteInField('Motion Detection On','#tab-schedules [name="name"]');
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-schedules [name="enabled"]`
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-schedules [name="start"]`
                },
                cmd: async () => {
                    await typeWriteInField('00:00','#tab-schedules [name="start"]');
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-schedules [name="end"]`
                },
                cmd: async () => {
                    await typeWriteInField('23:00','#tab-schedules [name="end"]');
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-schedules [name="days"]`
                },
                cmd: async () => {
                    var daysSelector = $('#tab-schedules [name="days"]');
                    daysSelector.find('option').prop('selected',false)
                    daysSelector.find('[value="0"],[value="2"],[value="4"],[value="6"]').prop('selected',true)
                }
            },
            {
                time: 2,
                handPos: {
                    el: `#tab-schedules [name="monitorStates"]`
                },
                cmd: async () => {
                    var presetSelector = $('#tab-schedules [name="monitorStates"]');
                    presetSelector.find('option').prop('selected',false)
                    presetSelector.find('[value="Motion Detection On"]').prop('selected',true)
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-schedules .sticky-bar [type="submit"]`
                },
                cmd: () => {
                    $('#tab-schedules form').submit();
                }
            },
            /// set schedule, motion OFF
            {
                time: 3,
                handPos: {
                    el: `#schedulesSelector`
                },
                cmd: () => {
                    $('#schedulesSelector option').prop('selected',false);
                    $('#schedulesSelector').val('').change();
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-schedules [name="name"]`
                },
                cmd: async () => {
                    await typeWriteInField('Motion Detection Off','#tab-schedules [name="name"]');
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-schedules [name="enabled"]`
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-schedules [name="start"]`
                },
                cmd: async () => {
                    await typeWriteInField('00:00','#tab-schedules [name="start"]');
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-schedules [name="end"]`
                },
                cmd: async () => {
                    await typeWriteInField('23:00','#tab-schedules [name="end"]');
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-schedules [name="days"]`
                },
                cmd: async () => {
                    var daysSelector = $('#tab-schedules [name="days"]');
                    daysSelector.find('option').prop('selected',false)
                    daysSelector.find('[value="1"],[value="3"],[value="5"]').prop('selected',true)
                }
            },
            {
                time: 2,
                handPos: {
                    el: `#tab-schedules [name="monitorStates"]`
                },
                cmd: async () => {
                    var presetSelector = $('#tab-schedules [name="monitorStates"]');
                    presetSelector.find('option').prop('selected',false)
                    presetSelector.find('[value="Motion Detection Off"]').prop('selected',true)
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-schedules .sticky-bar [type="submit"]`
                },
                cmd: () => {
                    $('#tab-schedules form').submit();
                }
            },
        ]
    },
    "create-api-key": {
        name: 'Create API Key',
        targetMonitor: false,
        playlist: [
            {
                text: 'Select the <b>API Keys</b> tab in the Main Menu.',
                time: 0,
                handPos: {
                    el: `[page-open="apiKeys"]`
                },
                cmd: () => {
                    var sideMenu = $('#menu-side')
                    var theButton = sideMenu.find('[page-open="apiKeys"]')
                    sideMenu.animate({scrollTop: sideMenu.position().top},1000);
                }
            },
            {
                time: 1,
                handPos: {
                    el: `[page-open="apiKeys"]`
                },
                cmd: () => {
                    openTab('apiKeys',{})
                }
            },
            {
                text: `Set the name for the new Preset.`,
                time: 1,
                handPos: {
                    el: `#tab-apiKeys [name="ip"]`
                },
                cmd: async () => {
                    await typeWriteInField('0.0.0.0','#tab-apiKeys [name="ip"]');
                }
            },
            {
                time: 1,
                handPos: {
                    el: `#tab-apiKeys [detail="permissions"]`
                },
                cmd: async () => {
                    var theSelector = $('#tab-apiKeys [detail="permissions"]');
                    theSelector.find('option').prop('selected',true)
                }
            },
            {
                text: `Generate the Key.`,
                time: 1,
                handPos: {
                    el: `#apiKeySectionAddNew [type="submit"]`
                },
                cmd: () => {
                    $('#apiKeySectionAddNew').submit();
                }
            },
            {
                text: `Generate the Key.`,
                time: 1,
                handPos: {
                    el: `#api_list [api_key]:nth-child(1) .copy`
                },
            },
        ]
    }
}
