// ONVIF Bulk Configuration — push video-encoder settings (e.g. sub-stream -> H.264)
// to many cameras at once. Sends { f:'onvif_bulk_config', ... } over the main socket and
// renders per-camera results streamed back as onvif_config_result / _progress / _ended.
$(document).ready(function () {
    var form      = $('#onvifBulkConfigForm')
    var results   = $('#onvifBulkResults')
    var empty     = $('#onvifBulkEmpty')
    var progWrap  = $('#onvifBulkProgressWrap')
    var progBar   = $('#onvifBulkProgressBar')
    var okBadge   = $('#onvifBulkOk')
    var failBadge = $('#onvifBulkFail')
    var applyBtn  = $('#onvifBulkApplyBtn')
    var okCount = 0, failCount = 0

    if (!form.length) return

    function readForm() {
        var f = {}
        form.serializeArray().forEach(function (x) { f[x.name] = x.value })
        return f
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    }

    form.submit(function (e) {
        e.preventDefault()
        var f = readForm()
        if (!f.ip) { return false }
        results.empty(); empty.hide()
        okCount = 0; failCount = 0
        okBadge.text('0 ok'); failBadge.text('0 failed')
        progWrap.show(); progBar.css('width', '0%').text('0%')
        applyBtn.prop('disabled', true)
        mainSocket.f({
            f: 'onvif_bulk_config',
            ip: f.ip, port: f.port, user: f.user, pass: f.pass,
            stream: f.stream, encoding: f.encoding,
            resolution: f.resolution, bitrate: f.bitrate,
            govLength: f.govLength, profile: f.profile
        })
        return false
    })

    function addRow(d) {
        if (d.ok) okCount++; else failCount++
        okBadge.text(okCount + ' ok'); failBadge.text(failCount + ' failed')
        var before = (d.before || []).map(function (b) { return b.encoding + ' ' + b.resolution }).join(', ')
        var body = d.ok
            ? '<span class="text-success"><i class="fa fa-check-circle"></i> Set ' + (d.applied || 1) + ' stream(s) to ' + esc(readForm().encoding) + '</span>'
              + (before ? ' <span class="text-muted">was: ' + esc(before) + '</span>' : '')
            : '<span class="text-danger"><i class="fa fa-times-circle"></i> ' + esc(d.error || 'failed') + '</span>'
        results.append(
            '<div class="d-flex align-items-center border-bottom py-2">'
            + '<div style="width:150px"><b>' + esc(d.ip) + ':' + esc(d.port) + '</b></div>'
            + '<div class="flex-grow-1 small">' + body + '</div>'
            + '</div>'
        )
    }

    onWebSocketEvent(function (d) {
        switch (d.f) {
            case 'onvif_config_result':
                addRow(d)
                break
            case 'onvif_config_progress':
                progBar.css('width', d.percent + '%').text(d.percent + '%')
                break
            case 'onvif_config_ended':
                progBar.css('width', '100%').text('Done')
                applyBtn.prop('disabled', false)
                if ((d.okCount + d.failCount) === 0) empty.show()
                break
        }
    })
})
