// Storage & Retention — read-only operational view of every value that decides how
// long footage is kept and where it is written.
//
// The values it shows are spread across Account Settings, conf.json and the server's
// disk mounts, and several of them default to settings that silently discard footage
// (retention 5 days, quota 10 GB, an unmounted NAS recreated as a local directory).
// This page surfaces the effective values and names the dangerous combinations.
$(document).ready(function () {
    var win = $('#tab-storageStatus')
    if (!win.length) return

    var loadingEl = $('#ssLoading')
    var errorEl   = $('#ssError')
    var bodyEl    = $('#ssBody')
    var updatedEl = $('#ssUpdated')

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }

    // Storage sizes are handled in MB throughout the backend. Show them in whichever
    // unit reads naturally so operators are not counting zeros.
    function fmtMb(mb) {
        if (mb === null || mb === undefined || isNaN(mb)) return '—'
        var n = Number(mb)
        if (n >= 1048576) return (n / 1048576).toFixed(2) + ' TB'
        if (n >= 1024)    return (n / 1024).toFixed(1) + ' GB'
        return n.toFixed(0) + ' MB'
    }
    function fmtDays(days) {
        if (days === null || days === undefined || isNaN(days)) return '—'
        var n = Number(days)
        if (n >= 365) return (n / 365).toFixed(1) + ' years'
        if (n >= 60)  return (n / 30).toFixed(1) + ' months'
        return n + (n === 1 ? ' day' : ' days')
    }
    function fmtDate(value) {
        if (!value) return '—'
        try { return moment(value).format('YYYY-MM-DD HH:mm') } catch (e) { return esc(value) }
    }
    function pctBarClass(pct) {
        if (pct === null || pct === undefined) return 'bg-secondary'
        if (pct >= 95) return 'bg-danger'
        if (pct >= 85) return 'bg-warning'
        return 'bg-success'
    }

    function statTile(value, label, sub) {
        return '' +
            '<div class="col-6 col-md-3 mb-2">' +
              '<div class="fs-4 fw-bold">' + value + '</div>' +
              '<div class="small text-muted">' + esc(label) + '</div>' +
              (sub ? '<div class="small text-muted">' + sub + '</div>' : '') +
            '</div>'
    }

    function renderChecks(checks) {
        var levels = {
            critical: { cls: 'danger',  icon: 'times-circle',        title: 'Must fix' },
            warning:  { cls: 'warning', icon: 'exclamation-triangle', title: 'Check this' },
            info:     { cls: 'info',    icon: 'info-circle',          title: 'For information' },
            ok:       { cls: 'success', icon: 'check-circle',         title: 'All good' }
        }
        var order = ['critical', 'warning', 'info', 'ok']
        var html = ''
        order.forEach(function (level) {
            checks.filter(function (c) { return c.level === level }).forEach(function (c) {
                var meta = levels[level] || levels.info
                html += '' +
                    '<div class="alert alert-' + meta.cls + ' py-2 px-3 mb-2">' +
                      '<div class="d-flex">' +
                        '<i class="fa fa-' + meta.icon + ' me-2 mt-1"></i>' +
                        '<div>' +
                          '<div class="fw-bold">' + esc(c.title) + '</div>' +
                          '<div class="small">' + esc(c.detail) + '</div>' +
                          (c.fix ? '<div class="small mt-1"><b>Fix:</b> ' + esc(c.fix) + '</div>' : '') +
                        '</div>' +
                      '</div>' +
                    '</div>'
            })
        })
        $('#ssChecks').html(html || '<div class="text-muted small">No checks returned.</div>')
    }

    function renderRetention(retention) {
        var rows = ['videoDays', 'eventDays', 'timelapseDays', 'logDays']
        var html = ''
        rows.forEach(function (key) {
            var r = retention[key]
            if (!r) return
            var badge = r.isDefault
                ? '<span class="badge bg-warning text-dark">default</span>'
                : '<span class="badge bg-success">set</span>'
            var danger = (key === 'videoDays' && r.isDefault) ? ' table-danger' : ''
            html += '' +
                '<tr class="' + danger + '">' +
                  '<td>' + esc(r.label) + '<div class="small text-muted">' + esc(r.setIn) + '</div></td>' +
                  '<td class="text-end fw-bold">' + fmtDays(r.effective) + '</td>' +
                  '<td class="text-end">' + badge + '</td>' +
                '</tr>'
        })
        $('#ssRetention').html(html)
    }

    function renderQuota(quota, usage) {
        var pct = usage.usedPercentOfQuota
        var shown = pct === null ? 0 : Math.min(pct, 100)
        $('#ssQuotaBar').html('' +
            '<div class="d-flex justify-content-between small mb-1">' +
              '<span>' + fmtMb(usage.usedMb) + ' used</span>' +
              '<span class="text-muted">' + (pct === null ? '' : pct + '% of quota') + '</span>' +
              '<span>' + fmtMb(quota.sizeLimitMb) + ' quota</span>' +
            '</div>' +
            '<div class="progress" style="height:20px">' +
              '<div class="progress-bar ' + pctBarClass(pct) + '" style="width:' + shown + '%"></div>' +
            '</div>' +
            (usage.isPurging ? '<div class="small text-warning mt-1"><i class="fa fa-recycle"></i> Purging is running right now.</div>' : ''))

        function row(label, value, sub, danger) {
            return '<tr' + (danger ? ' class="table-danger"' : '') + '>' +
                '<td>' + esc(label) + (sub ? '<div class="small text-muted">' + esc(sub) + '</div>' : '') + '</td>' +
                '<td class="text-end fw-bold">' + value + '</td></tr>'
        }
        var html = ''
        html += row('Max Storage Amount', fmtMb(quota.sizeLimitMb) +
            (quota.isDefault ? ' <span class="badge bg-warning text-dark">default</span>' : ''),
            quota.setIn, quota.isDefault)
        html += row('Purging starts at', fmtMb(quota.purgeStartsAtMb),
            'Oldest footage is deleted once usage passes this point (' + Math.round(quota.purgeOffset * 100) + '% of the quota)')
        html += row('Recordings share', fmtMb(quota.shares.videoLimitMb),
            quota.shares.videoPercent + '% of the quota')
        html += row('Timelapse share', fmtMb(quota.shares.timelapseLimitMb),
            quota.shares.timelapsePercent + '% of the quota')
        html += row('Exported clips share', fmtMb(quota.shares.fileBinLimitMb),
            quota.shares.fileBinPercent + '% of the quota')
        html += row('Currently used by recordings', fmtMb(usage.videosMb))
        $('#ssQuota').html(html)
    }

    function renderActual(recordings, retention, quota) {
        var held = recordings.spanDays
        // The limit that will actually bite: whichever of days-vs-space runs out first.
        var byDays = retention.videoDays.effective
        var bySpace = recordings.projectedRetentionDays
        var limiting = '—'
        if (bySpace !== null && bySpace !== undefined && !isNaN(bySpace)) {
            limiting = (bySpace < byDays)
                ? '<span class="text-warning">Storage quota</span>'
                : '<span class="text-info">Retention days</span>'
        }
        var html = ''
        html += statTile(held === null ? '—' : fmtDays(Math.round(held * 10) / 10),
            'Footage on disk now', recordings.videoCount ? esc(recordings.videoCount) + ' segments' : '')
        html += statTile(fmtDate(recordings.oldest), 'Oldest recording')
        html += statTile(recordings.gbPerDay ? recordings.gbPerDay + ' GB' : '—',
            'Growing per day', recordings.mbPerDay ? 'measured from disk' : 'needs more data')
        html += statTile(bySpace ? fmtDays(Math.round(bySpace)) : '—',
            'Retention the quota allows', 'Limited by: ' + limiting)
        $('#ssActual').html(html)
    }

    function renderStorage(storage) {
        var html = ''
        storage.forEach(function (entry) {
            var badges = ''
            if (entry.isPrimary) badges += '<span class="badge bg-primary me-1">Primary</span>'
            if (entry.isStreamDir) badges += '<span class="badge bg-secondary me-1">Live streams</span>'
            if (entry.isMountPoint === true) badges += '<span class="badge bg-success me-1">Mounted volume</span>'
            if (entry.isMountPoint === false) badges += '<span class="badge bg-warning text-dark me-1">Not a mount point</span>'
            if (entry.onSameVolumeAsRoot === true) badges += '<span class="badge bg-danger me-1">On OS disk</span>'
            if (!entry.exists) badges += '<span class="badge bg-danger me-1">Missing</span>'

            var pct = entry.usedPercent
            var bar = pct === null ? '' :
                '<div class="progress mt-2" style="height:14px">' +
                  '<div class="progress-bar ' + pctBarClass(pct) + '" style="width:' + Math.min(pct, 100) + '%">' + pct + '%</div>' +
                '</div>'

            html += '' +
                '<div class="border rounded p-3 mb-2">' +
                  '<div class="d-flex justify-content-between align-items-start flex-wrap">' +
                    '<div class="me-3">' +
                      '<div class="fw-bold">' + esc(entry.label) + '</div>' +
                      '<code class="small">' + esc(entry.path) + '</code>' +
                    '</div>' +
                    '<div class="text-end">' + badges + '</div>' +
                  '</div>' +
                  (entry.error
                    ? '<div class="text-danger small mt-2"><i class="fa fa-times-circle"></i> Could not read: ' + esc(entry.error) + '</div>'
                    : '<div class="row small text-muted mt-2">' +
                        '<div class="col-6 col-md-3">Volume size<div class="fw-bold text-body">' + fmtMb(entry.totalMb) + '</div></div>' +
                        '<div class="col-6 col-md-3">Free space<div class="fw-bold text-body">' + fmtMb(entry.freeMb) + '</div></div>' +
                        '<div class="col-6 col-md-3">Used (whole volume)<div class="fw-bold text-body">' + fmtMb(entry.usedMb) + '</div></div>' +
                        '<div class="col-6 col-md-3">Used by this VMS<div class="fw-bold text-body">' + fmtMb(entry.usedByVmsMb) + '</div></div>' +
                      '</div>' + bar) +
                '</div>'
        })
        $('#ssStorage').html(html)
    }

    function renderCron(cron) {
        function line(label, on, detail) {
            return '<div class="d-flex justify-content-between align-items-center py-1 border-bottom">' +
                '<div>' + esc(label) + (detail ? '<div class="small text-muted">' + esc(detail) + '</div>' : '') + '</div>' +
                '<span class="badge bg-' + (on ? 'success' : 'danger') + '">' + (on ? 'On' : 'Off') + '</span>' +
                '</div>'
        }
        var html = ''
        html += line('Scheduled cleanup', cron.enabled, 'Runs every ' + cron.intervalHours + ' hour(s)')
        html += line('Delete old recordings (by age)', cron.deleteOld, 'Enforces the retention days above')
        html += line('Delete over quota (by size)', cron.deleteOverMax, 'Enforces the storage quota above')
        html += line('Delete old events', cron.deleteEvents)
        html += line('Delete old logs', cron.deleteLogs)
        html += line('Delete old exported clips', cron.deleteFileBins)
        $('#ssCron').html(html)
    }

    function renderMonitors(monitors) {
        var html = ''
        html += statTile(monitors.total, 'Cameras configured')
        html += statTile(monitors.recording, 'Set to record')
        html += statTile(monitors.cameraCountCeiling === null ? '—' : monitors.cameraCountCeiling,
            'Maximum cameras', 'system limit')
        $('#ssMonitors').html(html)
    }

    function load() {
        loadingEl.show()
        errorEl.hide()
        $.getJSON(getApiPrefix('storageStatus'))
            .done(function (data) {
                loadingEl.hide()
                if (!data || !data.ok) {
                    errorEl.text(data && data.msg ? data.msg : 'Could not read storage status.').show()
                    return
                }
                renderChecks(data.checks || [])
                renderRetention(data.retention)
                renderQuota(data.quota, data.usage)
                renderActual(data.recordings, data.retention, data.quota)
                renderStorage(data.storage || [])
                renderCron(data.cron)
                renderMonitors(data.monitors)
                updatedEl.text('Updated ' + fmtDate(data.generatedAt))
                bodyEl.show()
            })
            .fail(function (xhr) {
                loadingEl.hide()
                errorEl.text('Could not reach the server (' + (xhr && xhr.status ? xhr.status : 'network error') + ').').show()
            })
    }

    $('#ssRefresh').click(load)

    // Load when the page is first opened, not on every dashboard boot.
    var loaded = false
    $(document).on('click', '[page-open="storageStatus"]', function () {
        if (!loaded) { loaded = true; load() }
    })
    if (win.is(':visible')) { loaded = true; load() }
})
