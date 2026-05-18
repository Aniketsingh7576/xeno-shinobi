$(document).ready(function(){
    const lineCounterCanvas = $('#monitorSettings-lineCounter-canvas-container')
    const monitorEditorWindow = $('#tab-monitorSettings')
    const lineCounterSpacingField = $('#detector-line-counter-spacing')
    const lineCounterUpName = $('#detector-line-counter-name-up')
    const lineCounterDownName = $('#detector-line-counter-name-down')
    const lineCounterResetDailyField = $('#detector-line-counter-reset-daily')
    const lineCounterToggle = monitorEditorWindow.find('[detail=detectorLineCounter]')
    const scaleXObject = monitorEditorWindow.find('[detail=detector_scale_x_object]')
    const scaleYObject = monitorEditorWindow.find('[detail=detector_scale_y_object]')
    let currentLineCounterCanvas = null;
    let lastEmbedUrl = '';
    function loadLineCounterForMonitorSettings(monitor){
        drawLineCounterCanvas(monitor)
    }
    function clearLineCounterCanvas(){
        if(currentLineCounterCanvas){
            currentLineCounterCanvas.destroy()
            currentLineCounterCanvas = null;
            lineCounterCanvas.empty()
            lastEmbedUrl = null;
        }
    }
    function getLineCounterSettings(monitor){
        const lineCounterSettings = monitor.details.detectorLineCounterSettings || {};
        const imageWidth = parseInt(monitor.details.detector_scale_x_object) || 1280
        const imageHeight = parseInt(monitor.details.detector_scale_y_object) || 720
        const {
            lineSpacing = 40,
            refreshRate = 10,
            lines,
        } = lineCounterSettings;
        return {
            lineSpacing,
            refreshRate,
            lines,
            imageWidth,
            imageHeight,
        }
    }
    function drawLineCounterCanvas(monitor){
        clearLineCounterCanvas()
        const {
            lineSpacing,
            refreshRate,
            lines,
            imageWidth,
            imageHeight,
        } = getLineCounterSettings(monitor)
        const containerWidth = lineCounterCanvas.width()
        const ratio = containerWidth / imageWidth / 2
        const newWidth = imageWidth * ratio
        const newHeight = imageHeight * ratio
        lineCounterCanvas.html(`<div style="position:relative;display:inline-block;height:${newHeight}px;width:${newWidth}px;text-align: initial;">
            <iframe style="position:absolute" width="${newWidth}" height="${newHeight}"></iframe>
            <canvas id="monitorSettings-lineCounter-canvas" width="${newWidth}" height="${newHeight}" style="position:absolute"></canvas>
        </div>`)
        currentLineCounterCanvas = new ParallelLineDrawer('monitorSettings-lineCounter-canvas', {
            lineSpacing,
            refreshRate,
            originalWidth: imageWidth,
            originalHeight: imageHeight,
        });
        currentLineCounterCanvas.scaleCanvas(ratio);
        if(monitor){
            currentLineCounterCanvas.loadState({
                lines
            });
        }
        loadLineCounterTagsField(monitor)
        loadLineCounterLiveStream(monitor)
        lineCounterSpacingField.val(lineSpacing)
    }
    function getLineCounterState(){
        const {
            lineSpacing,
            refreshRate,
            lines,
        } = currentLineCounterCanvas ? currentLineCounterCanvas.getState() : {};
        const upName = lineCounterUpName.val().trim()
        const downName = lineCounterDownName.val().trim()
        const resetDaily = lineCounterResetDailyField.val() === '1'
        return {
            lineSpacing,
            refreshRate,
            lines,
            upName,
            downName,
            resetDaily,
        }
    }
    function resetLineCounterState(){
        if(currentLineCounterCanvas){
            currentLineCounterCanvas.reset();
        }
    }
    function loadLineCounterTagsField(monitorConfig){
        const monitorEditorWindow = $('#tab-monitorSettings')
        const lineCounterTagsInput = monitorEditorWindow.find('[detail=detectorLineCounterTags]')
        const monitorTags = monitorConfig && monitorConfig.details.detectorLineCounterTags ? monitorConfig.details.detectorLineCounterTags.split(',') : []
        lineCounterTagsInput.tagsinput('removeAll');
        monitorTags.forEach((tag) => {
            lineCounterTagsInput.tagsinput('add',tag);
        });
    }
    function loadLineCounterLiveStream(monitor){
        const monitorId = monitor.mid
        const liveElement = lineCounterCanvas.find('iframe')
        const imageWidth = parseInt(monitor.details.detector_scale_x_object) || 1280
        const imageHeight = parseInt(monitor.details.detector_scale_y_object) || 720
        if(monitor.mode === 'stop'){
            var apiUrl = placeholder.getData(placeholder.plcimg({
                bgcolor: '#000',
                text: lang[`Cannot watch a monitor that isn't running.`],
                size: imageWidth+'x'+imageHeight
            }))
            liveElement.attr('src',apiUrl)
        }else{
            var apiUrl = `${getApiPrefix('embed')}/${monitorId}/fullscreen|jquery|gui|relative?host=${location.origin + location.pathname}`
            liveElement.attr('src',apiUrl)
            lastEmbedUrl = apiUrl
        }
    }
    function setIframeSource(embedUrl){
        lineCounterCanvas.find('iframe').attr('src', embedUrl || 'about:blank')
    }
    function isLineCounterEnabled(){
        lineCounterToggle.val() === '1'
    }
    lineCounterToggle.change(function(e){
        if($(this).val() === '1'){
            drawLineCounterCanvas(monitorEditorSelectedMonitor)
        }else{
            clearLineCounterCanvas()
        }
    });
    scaleXObject.change(function(e){
        if(lineCounterToggle.val() === '1'){
            drawLineCounterCanvas(monitorEditorSelectedMonitor)
        }
    });
    scaleYObject.change(function(e){
        if(lineCounterToggle.val() === '1'){
            drawLineCounterCanvas(monitorEditorSelectedMonitor)
        }
    });
    lineCounterSpacingField.change(function(e){
        var value = parseInt($(this).val()) || 40;
        currentLineCounterCanvas.setLineSpacing(value)
    });
    addOnTabAway('monitorSettings', function(){
        setIframeSource()
    })
    addOnTabOpen('monitorSettings', function(){

    })
    addOnTabReopen('monitorSettings', function(){
        if(lastEmbedUrl)setIframeSource(lastEmbedUrl)
    })
    window.drawLineCounterCanvas = drawLineCounterCanvas
    window.clearLineCounterCanvas = clearLineCounterCanvas
    window.getLineCounterState = getLineCounterState
    window.isLineCounterEnabled = isLineCounterEnabled
})
