module.exports = function(s,config,lang){
    const {
        setNoEventsDetector,
    } = require('../monitor/utils.js')(s,config,lang);

    s.onEventTrigger((d,filter) => {
        const groupKey = d.ke
        const monitorId = d.mid || d.id
        const monitorConfig = s.group[groupKey].rawMonitorConfigurations[monitorId]
        const monitorDetails = monitorConfig.details
        if(monitorDetails.detector === '1' && monitorDetails.detector_notrigger === '1'){
            setNoEventsDetector(monitorConfig)
        }
    })
}
