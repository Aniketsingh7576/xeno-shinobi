// Bulk Monitor Settings — apply a chosen subset of settings to many monitors at once.
// Reuses the normal per-monitor save (configureMonitor -> addOrEditMonitor); only the
// ticked fields are changed, everything else on each monitor is preserved.
$(document).ready(function () {
    var win        = $('#tab-monitorBulkEdit')
    if (!win.length) return
    var listEl     = $('#mbeMonitorList')
    var listEmpty  = $('#mbeListEmpty')
    var countBadge = $('#mbeSelectedCount')
    var searchEl   = $('#mbeSearch')
    var applyBtn   = $('#mbeApplyBtn')
    var results    = $('#mbeResults')
    var progWrap   = $('#mbeProgressWrap')
    var progBar    = $('#mbeProgressBar')

    function parseDetails(d) {
        if (d && typeof d === 'object') return d
        try { return JSON.parse(d || '{}') } catch (e) { return {} }
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    }
    // rtsp://user:pass@host:port/path?query  -> parts (creds stored raw, like Shinobi).
    // Split userinfo on the LAST '@' (a password may legitimately contain '@'), and split
    // user:pass on the FIRST ':' (a password may contain ':' or '/'). The old single-regex
    // parser truncated the password at the first '@'/'/' and swallowed the truncation into
    // the host — a bulk edit over any such camera wrote a garbage host + wrong password and,
    // on save, restarted the monitor into a failed RTSP connect (silent recording loss).
    function parseRtsp(url) {
        url = String(url || '')
        var scheme = url.match(/^(\w+):\/\//)
        if (!scheme) return null
        var rest = url.slice(scheme[0].length)
        var user = '', pass = ''
        var at = rest.lastIndexOf('@')
        if (at > -1) {
            var creds = rest.slice(0, at)
            rest = rest.slice(at + 1)
            var c = creds.indexOf(':')
            if (c > -1) { user = creds.slice(0, c); pass = creds.slice(c + 1) }
            else { user = creds }
        }
        var m = rest.match(/^([^:\/?#]+)(?::(\d+))?([^?#]*)?(\?.*)?$/)
        if (!m) return null
        return { scheme:scheme[1], user:user, pass:pass, host:m[1], port:m[2]||'', path:m[3]||'', query:m[4]||'' }
    }
    function buildRtsp(p) {
        var auth = p.user ? (p.user + (p.pass ? (':' + p.pass) : '') + '@') : ''
        var port = p.port ? (':' + p.port) : ''
        var path = p.path || ''
        if (path && path[0] !== '/') path = '/' + path
        return p.scheme + '://' + auth + p.host + port + path + (p.query || '')
    }

    function allMonitors() {
        var out = []
        var src = window.loadedMonitors || {}
        Object.keys(src).forEach(function (mid) {
            var m = src[mid]
            if (m && m.mid) out.push(m)
        })
        out.sort(function (a, b) { return String(a.name||'').localeCompare(String(b.name||'')) })
        return out
    }

    function renderList() {
        var q = (searchEl.val() || '').toLowerCase()
        var mons = allMonitors().filter(function (m) {
            if (!q) return true
            var d = parseDetails(m.details)
            return String(m.name||'').toLowerCase().indexOf(q) !== -1
                || String(m.mid||'').toLowerCase().indexOf(q) !== -1
                || String(d.host || d.auto_host || '').toLowerCase().indexOf(q) !== -1
        })
        if (!mons.length) { listEmpty.text('No monitors found.').show(); listEl.find('.mbe-row').remove(); updateCount(); return }
        listEmpty.hide()
        var html = mons.map(function (m) {
            var d = parseDetails(m.details)
            var host = d.host || (parseRtsp(d.auto_host) || {}).host || ''
            return '<label class="mbe-row d-flex align-items-center border-bottom py-1" style="cursor:pointer">'
                + '<input type="checkbox" class="form-check-input me-2 mbe-mon" value="' + esc(m.mid) + '">'
                + '<span class="flex-grow-1"><b>' + esc(m.name || m.mid) + '</b> <span class="text-muted small">' + esc(host) + '</span></span>'
                + '<span class="badge bg-light text-muted">' + esc(m.mode || '') + '</span>'
                + '</label>'
        }).join('')
        listEl.find('.mbe-row').remove()
        listEl.append(html)
        updateCount()
    }

    function selectedMids() {
        return listEl.find('.mbe-mon:checked').map(function () { return this.value }).get()
    }
    function updateCount() { countBadge.text(selectedMids().length + ' selected') }

    listEl.on('change', '.mbe-mon', updateCount)
    searchEl.on('input', renderList)
    $('#mbeSelectAll').on('click', function () { listEl.find('.mbe-mon').prop('checked', true); updateCount() })
    $('#mbeSelectNone').on('click', function () { listEl.find('.mbe-mon').prop('checked', false); updateCount() })

    // which fields are ticked + their values
    function gatherChanges() {
        var changes = {}
        win.find('.mbe-apply:checked').each(function () {
            changes[$(this).data('field')] = true
        })
        var val = function (field) { return win.find('[data-field-value="' + field + '"]').val() }
        return {
            fields: changes,
            mode: val('mode'),
            max_keep_days: val('max_keep_days'),
            stream_type: val('stream_type'),
            substream_type: val('substream_type'),
            stream_fps: val('stream_fps'),
            stream_vcodec: val('stream_vcodec'),
            path: val('path'),
            muser: val('muser'),
            mpass: val('mpass'),
        }
    }

    // apply ticked changes onto a single monitor's config, return the save form.
    // IMPORTANT: start from a FULL deep clone so no existing field is dropped on save,
    // and write the stream path/host to the TOP-LEVEL columns (host/path/port) — that's
    // what buildMonitorUrl() actually uses, not details.auto_host.
    function buildForm(monitor, c) {
        var base = window.loadedMonitors[monitor.mid]
        var form = JSON.parse(JSON.stringify(base))
        form.details = parseDetails(base.details)
        // The client config may not carry top-level host/port/path — they are derived from
        // details.auto_host (authoritative when auto_host_enable=1). buildMonitorUrl() needs
        // form.host to exist, so backfill all connection fields from auto_host.
        var ah = parseRtsp(form.details.auto_host) || {}
        if (form.host == null || form.host === '' || form.host === '0.0.0.0') form.host = ah.host || form.host || ''
        if (form.port == null || form.port === '') form.port = ah.port || form.port || '554'
        if (form.path == null || form.path === '') form.path = ah.path || form.path || ''
        if (!form.protocol) form.protocol = ah.scheme || 'rtsp'
        if (!form.details.muser && ah.user) form.details.muser = ah.user
        if (!form.details.mpass && ah.pass) form.details.mpass = ah.pass
        var f = c.fields
        if (f.mode) form.mode = c.mode
        if (f.max_keep_days) form.details.max_keep_days = c.max_keep_days
        if (f.stream_type) form.details.stream_type = c.stream_type
        if (f.substream_type) {
            if (!form.details.substream) form.details.substream = { input: {}, output: {} }
            if (!form.details.substream.output) form.details.substream.output = {}
            form.details.substream.output.stream_type = c.substream_type
        }
        if (f.stream_fps) form.details.stream_fps = c.stream_fps
        if (f.stream_vcodec) form.details.stream_vcodec = c.stream_vcodec
        if (f.path) {
            var np = (c.path && c.path.charAt(0) === '/') ? c.path : ('/' + (c.path || ''))
            form.path = np                    // top-level path drives the actual stream URL
            form.details.path = np
        }
        if (f.creds) {
            form.details.muser = c.muser
            form.details.mpass = c.mpass
        }
        // keep details.auto_host consistent (display + auto_host_enable re-parse)
        if (f.path || f.creds) {
            form.details.auto_host = buildRtsp({
                scheme: form.protocol || 'rtsp',
                user: form.details.muser || '',
                pass: form.details.mpass || '',
                host: form.host,
                port: form.port,
                path: form.path,
            })
        }
        return form
    }

    applyBtn.on('click', async function () {
        var mids = selectedMids()
        var c = gatherChanges()
        var changedFieldCount = Object.keys(c.fields).length
        if (!mids.length) { new PNotify({ title: 'Nothing selected', text: 'Select at least one monitor.', type: 'notice' }); return }
        if (!changedFieldCount) { new PNotify({ title: 'No fields ticked', text: 'Tick at least one setting to change.', type: 'notice' }); return }
        if (!confirm('Apply ' + changedFieldCount + ' setting(s) to ' + mids.length + ' monitor(s)? Each will restart.')) return

        applyBtn.prop('disabled', true)
        results.empty()
        progWrap.show(); progBar.css('width', '0%').text('0%')
        var done = 0, ok = 0, fail = 0
        for (var i = 0; i < mids.length; i++) {
            var monitor = window.loadedMonitors[mids[i]]
            var label = (monitor && monitor.name) || mids[i]
            try {
                var form = buildForm(monitor, c)
                var resp = await configureMonitor(form)
                if (resp && resp.ok === false) { fail++; results.append('<div class="small text-danger">✗ ' + esc(label) + ': ' + esc(resp.msg || 'failed') + '</div>') }
                else { ok++; results.append('<div class="small text-success">✓ ' + esc(label) + ' saved</div>') }
            } catch (e) {
                fail++; results.append('<div class="small text-danger">✗ ' + esc(label) + ': ' + esc(e && e.message) + '</div>')
            }
            done++
            var pct = Math.round((done / mids.length) * 100)
            progBar.css('width', pct + '%').text(pct + '%')
        }
        progBar.text('Done — ' + ok + ' ok, ' + fail + ' failed')
        applyBtn.prop('disabled', false)
        new PNotify({ title: 'Bulk update complete', text: ok + ' saved, ' + fail + ' failed.', type: fail ? 'notice' : 'success' })
    })

    // populate on load and whenever the tab is opened
    renderList()
    if (typeof addOnTabOpen === 'function') addOnTabOpen('monitorBulkEdit', renderList)
})
