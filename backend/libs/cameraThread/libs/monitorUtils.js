module.exports = (jsonData) => {
    const completeMonitorConfig = jsonData.rawMonitorConfig
    const groupKey = completeMonitorConfig.ke
    const monitorId = completeMonitorConfig.mid
    const monitorName = completeMonitorConfig.name
    const monitorDetails = completeMonitorConfig.details
    return {
        completeMonitorConfig,
        groupKey,
        monitorId,
        monitorName,
        monitorDetails,
    }
}
