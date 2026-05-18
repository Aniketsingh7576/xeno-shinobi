module.exports = function(s,config){
    s.cloudDiskUseStartupExtensions = {}
    s.cloudDiskUseOnGetVideoDataExtensions = {}
    function createExtension(nameOfExtension,nameOfExtensionContainer,objective){
        nameOfExtensionContainer = nameOfExtensionContainer || `${nameOfExtension}Extensions`
        if(objective){
            s[nameOfExtensionContainer] = []
            s[nameOfExtension] = function(nameOfCallback,callback){
                s[nameOfExtensionContainer][nameOfCallback] = callback
            }
        }else{
            s[nameOfExtensionContainer] = []
            s[nameOfExtension] = function(callback){
                s[nameOfExtensionContainer].push(callback)
            }
        }
    }
    s.runExtensionsForArray = (nameOfExtension, nameOfExtensionContainer, args) => {
        nameOfExtensionContainer = nameOfExtensionContainer || `${nameOfExtension}Extensions`
        const theExtenders = s[nameOfExtensionContainer];
        for(extender of theExtenders){
            extender(...args)
        }
    }
    s.runExtensionsForArrayAwaited = async (nameOfExtension, nameOfExtensionContainer, args) => {
        nameOfExtensionContainer = nameOfExtensionContainer || `${nameOfExtension}Extensions`
        const theExtenders = s[nameOfExtensionContainer];
        for(extender of theExtenders){
            await extender(...args)
        }
    }
    s.runExtensionsForObject = (nameOfExtension, nameOfExtensionContainer, args) => {
        nameOfExtensionContainer = nameOfExtensionContainer || `${nameOfExtension}Extensions`
        const theExtenders = s[nameOfExtensionContainer];
        for(extender in theExtenders){
            extender(...args)
        }
    }
    s.runExtensionsForObjectAwaited = async (nameOfExtension, nameOfExtensionContainer, args) => {
        nameOfExtensionContainer = nameOfExtensionContainer || `${nameOfExtension}Extensions`
        const theExtenders = s[nameOfExtensionContainer];
        for(extender in theExtenders){
            await extender(...args)
        }
    }
    ////// INFO //////
    // Arguments for callback noted below each Extension.
    // Example use of arguments : s.onSocketAuthentication((userDatabaseRow,socketIoConnection,initiateData,sendDataToClient) => { console.log(userDatabaseRow) })

    ////// USER //////
    createExtension(`onSocketAuthentication`)
    // [0] userDatabaseRow : Object of User database row
    // [1] socketIoConnection : Socket.IO Connection Handler
    // [2] initiateData : Data that was used to initiate the socket authentication
    // [3] sendDataToClient : function to send data to authenticated connection
    createExtension(`onUserLogin`)
    // [0] userDatabaseRow : Object of User database row
    // [1] groupKey : The ID of the group.
    // [2] userId : The ID of the user.
    // [3] clientIp : IP Address of the user logging out.
    createExtension(`onUserLog`)
    // [0] logEvent : the databse row being inserted
    createExtension(`loadGroupExtender`,`loadGroupExtensions`)
    // [0] userDatabaseRow : Object of User database row. This will always be an Admin user.
    createExtension(`loadGroupAppExtender`,`loadGroupAppExtensions`)
    // [0] userDatabaseRow : Object of User database row. This will always be an Admin user.
    createExtension(`unloadGroupAppExtender`,`unloadGroupAppExtensions`)
    // [0] userDatabaseRow : Object of User database row. This will always be an Admin user.
    createExtension(`onAccountSave`)
    // [0] groupLoadedInMemory : Object of group initiated in memory.
    // [1] userDetails : Additional data about the user. If Admin user it will have group data.
    // [2] userDatabaseRow : Object of User database row.
    createExtension(`beforeAccountSave`)
    // [0] infoObject : form (complete post of user data to be update), formDetails (form posted details), userDetails (details in database before save)
    createExtension(`onTwoFactorAuthCodeNotification`)
    // [0] userDatabaseRow : Object of User database row
    createExtension(`onStalePurgeLock`)
    // [0] groupKey : The ID of the group.
    // [1] usedSpace : Currently used space (mb).
    // [2] sizeLimit : Maximum Usable Space (mb).
    createExtension(`onDiskFull`)
    // [0] groupKey : The ID of the group.
    // [1] usedSpace : Currently used space (mb).
    // [2] sizeLimit : Maximum Usable Space (mb).
    createExtension(`onAddStorageDiskFull`)
    // [0] groupKey : The ID of the group.
    // [1] usedSpace : Currently used space (mb).
    // [2] sizeLimit : Maximum Usable Space (mb).
    // [3] storageName : addStorage Name.
    createExtension(`onLogout`)
    // [0] userDatabaseRow : Object of User database row.
    // [1] groupKey : The ID of the group.
    // [2] userId : The ID of the user.
    // [3] clientIp : IP Address of the user logging out.
    ////// EVENTS //////
    createExtension(`onEventTrigger`)
    // [0] eventData : The object that triggered the Event.
    // [1] filter : The current state of the filters being used for this event.
    // [2] eventTime : Current Date and Time of the event.
    createExtension(`onEventTriggerBeforeFilter`)
    // [0] eventData : The object that triggered the Event.
    // [1] filter : The state of the filters being modified for this event.
    createExtension(`onFilterEvent`)
    // unused
    createExtension(`onOnvifEventTrigger`)
    // [0] onvifEventData : The ONVIF Event object that triggered.
    // [1] groupKey : The ID of the group.
    // [2] monitorId : The ID of the Monitor.

    ////// MONITOR //////
    createExtension(`onMonitorInit`)
    // [0] initiateData : Data that was used to initiate the Monitor into memory. Is usually database row of Monitor.
    createExtension(`onMonitorStart`)
    // [0] monitorConfig : Copy of Monitor Configuration loaded into memory.
    // [1] initiateData : Data that was used to initiate the action.
    createExtension(`onMonitorStop`)
    // [0] monitorConfig : Copy of Monitor Configuration loaded into memory.
    // [1] initiateData : Data that was used to initiate the action.
    createExtension(`onMonitorDelete`)
    // [0] monitorConfig : Copy of Monitor Configuration loaded into memory.
    // [1] initiateData : Data that was used to initiate the action.
    createExtension(`onMonitorSave`)
    // [0] monitorConfig : Copy of Monitor Configuration loaded into memory.
    // [1] formData : Data that was used to update the monitor.
    // [2] endData : Response for the update.
    createExtension(`onMonitorUnexpectedExit`)
    // [0] monitorConfig : Copy of Monitor Configuration loaded into memory.
    // [1] initiateData : Data that was used to initiate the monitor.
    createExtension(`onDetectorNoTriggerTimeout`)
    // [0] initiateData : Data that was used to initiate the monitor.
    createExtension(`onFfmpegCameraStringCreation`)
    // [0] initiateData : Data that was used to initiate the monitor.
    // [1] ffmpegCommand : The final FFmpeg command used for the main process of the monitor.
    createExtension(`onFfmpegBuildMainStream`)
    // [0] streamType : The Stream Type that was chosen for the main stream.
    // [1] streamFlags : The complete set of flags used for this output.
    // [2] initiateData : Data that was used to initiate the monitor.
    createExtension(`onFfmpegBuildStreamChannel`)
    // [0] streamType : The Stream Type that was chosen for this output.
    // [1] streamFlags : The complete set of flags used for this output.
    // [2] number : The number of this output.
    // [3] initiateData : Data that was used to initiate the monitor.
    createExtension(`onMonitorPingFailed`)
    // [0] monitorConfig : Copy of Monitor Configuration loaded into memory.
    // [1] initiateData : Data that was used to initiate the monitor.
    createExtension(`onMonitorDied`)
    // [0] monitorConfig : Copy of Monitor Configuration loaded into memory.
    // [1] initiateData : Data that was used to initiate the monitor.
    createExtension(`onMonitorCreateStreamPipe`)
    // This extension should be used wisely. It can be used to add new stream types.
    // [0] streamType : The Stream Type that was chosen for this output.
    // [1] initiateData : Data that was used to initiate the monitor.
    // [2] resetStreamCheck : Function to reset the timer that indicates if the output is stale.

    ///////// SYSTEM ////////
    createExtension(`onProcessReady`)
    // [0] ready : This is always true.
    createExtension(`onProcessExit`)
    // no arguments
    createExtension(`onLoadedUsersAtStartup`)
    // no arguments
    createExtension(`onBeforeDatabaseLoad`)
    // [0] config : The Configuration object used to initiate the Xenocipher core process.
    createExtension(`onFFmpegLoaded`)
    // no arguments
    createExtension(`beforeMonitorsLoadedOnStartup`)
    // no arguments
    createExtension(`onWebSocketConnection`)
    // [0] socketIoConnection : Socket.IO Connection Handler
    // [1] validatedAndBindAuthenticationToSocketConnection : N/A
    // [2] createStreamEmitter : For creating a handler on a stream output
    createExtension(`onWebSocketDisconnection`)
    // [0] socketIoConnection : Socket.IO Connection Handler
    createExtension(`onWebsocketMessageSend`)
    // [0] socketData : The Data being sent over Socket.IO
    // [1] socketId : The identifier of where the Socket.IO data is sent to.
    // [2] originSocket : This is not always set. The socketId that is sending the data to another socketId.
    createExtension(`onOtherWebSocketMessages`)
    // [0] socketData : The Data being sent over Socket.IO to the server from the client.
    // [1] socketIoConnection : Socket.IO Connection Handler of the sender (client)
    // [2] sendDataToClient : function to send data back to the socketIoConnection.
    createExtension(`onGetCpuUsage`)
    // [0] cpuUsagePercent : the percent of CPU Usage.
    createExtension(`onGetRamUsage`)
    // [0] ramUsagePercent : the percent of RAM Usage.
    createExtension(`onSubscriptionCheck`)
    // unused
    createExtension(`onDataPortMessage`)
    // [0] dataPortObject : Data sent back to server on Data Port channel.
    createExtension(`onHttpRequestUpgrade`,null,true)
    // [0] request : Request to http.createServer(app) on Upgrade.
    // [1] socket : Socket of http.createServer(app) on Upgrade.
    // [2] head : Header sent to http.createServer(app) on Upgrade.
    createExtension(`onPluginConnected`)
    // [0] request : Request to http.createServer(app) on Upgrade.
    createExtension(`onPluginDisconnected`)
    // [0] pluginName : The internal name of the plugin.
    // [1] newDetector : Detector information loaded into memory.
    createExtension(`onTriggerNotificationSend`)
    // [0] groupKey : Group Key to send to
    // [1] data : Standardized Data for General Notification
    // [2] files : Detector information loaded into memory.
    createExtension(`onScheduleUpdated`)
    // [0] groupKey : Group Key of Schedule
    // [1] schedule : The new schedule item
    // [2] changeType : Type of update : added or changed
    createExtension(`onScheduleDeleted`)
    // [0] groupKey : Group Key of Schedule
    // [1] schedule : The deleted schedule item

    /////// CRON ////////
    createExtension(`onCronGroupProcessed`)
    // [0] userDatabaseRow : Object of User database row. This will always be an Admin user.
    createExtension(`onCronGroupProcessedAwaited`)
    // [0] userDatabaseRow : Object of User database row. This will always be an Admin user.
    createExtension(`onCronGroupBeforeProcessed`)
    // [0] userDatabaseRow : Object of User database row. This will always be an Admin user.
    createExtension(`onCronGroupBeforeProcessedAwaited`)
    // [0] userDatabaseRow : Object of User database row. This will always be an Admin user.

    /////// VIDEOS ////////
    createExtension(`insertCompletedVideoExtender`,`insertCompletedVideoExtensions`)
    // [0] monitorObject : Active Monitor loaded into memory.
    // [1] rawInfoAboutVideo : Currently processing information about video.
    // [2] insertQuery : The insert query used to save the video into the database.
    createExtension(`onEventBasedRecordingComplete`)
    // [0] endData : Response for the process.
    // [1] monitorConfig : Copy of Monitor Configuration loaded into memory.
    createExtension(`onEventBasedRecordingStart`)
    // [0] monitorConfig : Copy of Monitor Configuration loaded into memory.
    // [1] filename : Filename of video saved.
    createExtension(`onBeforeInsertCompletedVideo`)
    // [0] monitorObject : Active Monitor loaded into memory.
    // [1] rawInfoAboutVideo : Currently processing information about video.
    createExtension(`onVideoAccess`)
    // [0] videoDatabaseRow : Object of Video database row
    // [1] userDatabaseRow : Object of User database row. The one accessing the data.
    // [2] groupKey : The ID of the group.
    // [3] monitorId : The ID of the Monitor.
    // [4] clientIp : IP Address of the user accessing the data.
    createExtension(`onVideoDeleteByUser`)
    // [0] videoDatabaseRow : Object of Video database row
    // [1] userDatabaseRow : Object of User database row. The one accessing the data.
    // [2] groupKey : The ID of the group.
    // [3] monitorId : The ID of the Monitor.
    // [4] clientIp : IP Address of the user deleting the data.
    createExtension(`onCloudVideoDeleteByUser`)
    // [0] videoDatabaseRow : Object of Video database row
    // [1] userDatabaseRow : Object of User database row. The one accessing the data.
    // [2] groupKey : The ID of the group.
    // [3] monitorId : The ID of the Monitor.
    // [4] clientIp : IP Address of the user accessing the data.
    createExtension(`onCloudVideoUploaded`)
    // [0] insertQuery : The insert query used to save the cloud video info into the database.

    /////// TIMELAPSE ////////
    createExtension(`onInsertTimelapseFrame`)
    // [0] initiateData : Data that was used to initiate the monitor.
    // [1] insertQuery : The insert query used to save the Timelapse frame into the database.
    // [2] filePath : The filesystem path of the file that was saved.
}
