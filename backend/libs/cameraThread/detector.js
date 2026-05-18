module.exports = function(jsonData,pamDiffResponder){
    const {
        completeMonitorConfig,
        groupKey,
        monitorId,
        monitorName,
        monitorDetails,
    } = require('./libs/monitorUtils.js')(jsonData)
    const {
        convertRegionsToTiles,
    } = require('./libs/tileCutter.js')
    const loadDetectorUtils = require('./libs/detectorUtils.js')
    let detectorUtils
    let onMotionData = null
    if(monitorDetails.detector_motion_tile_mode === '1'){
        const {
            originalCords,
            newRegionsBySquares,
        } = convertRegionsToTiles(monitorDetails)
        jsonData.rawMonitorConfig.details.cords = newRegionsBySquares;
        detectorUtils = loadDetectorUtils(jsonData,pamDiffResponder)
        detectorUtils.originalCords = originalCords;
        onMotionData = detectorUtils.getTileMotionEvent()
    }else{
        detectorUtils = loadDetectorUtils(jsonData,pamDiffResponder)
    }
    const {
        pamDetectorIsEnabled,
        attachPamPipeDrivers,
    } = detectorUtils;
    return function(cameraProcess){
        if(pamDetectorIsEnabled){
            attachPamPipeDrivers(cameraProcess,onMotionData)
        }
    }
}
