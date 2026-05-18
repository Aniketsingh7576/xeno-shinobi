module.exports = function(s,config,lang,getSnapshot){
    const {
        getEventBasedRecordingUponCompletion,
    } = require('../events/utils.js')(s,config,lang)
    const onEventTrigger = async (d,filter) => {
        console.log('CUSTOM COMMAND ON EVENT eventBasedRecording')
        const monitorConfig = s.group[d.ke].rawMonitorConfigurations[d.id]
        let videoPath = null
        let videoName = null
        console.log('await eventBasedRecording')
        const eventBasedRecording = await getEventBasedRecordingUponCompletion({
            ke: d.ke,
            mid: d.mid
        })
        console.log('complete eventBasedRecording')
        console.log(eventBasedRecording)
        if(eventBasedRecording.filePath){
            videoPath = eventBasedRecording.filePath
            videoName = eventBasedRecording.filename
        }else{
            const siftedVideoFileFromRam = await s.mergeDetectorBufferChunks(d)
            console.log('siftedVideoFileFromRam')
            console.log(siftedVideoFileFromRam)
            videoPath = siftedVideoFileFromRam.filePath
            videoName = siftedVideoFileFromRam.filename
        }
    }
    s.onEventTrigger(onEventTrigger)
}
