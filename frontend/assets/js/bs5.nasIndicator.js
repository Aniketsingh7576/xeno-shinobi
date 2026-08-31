// NAS live status indicator — a sidebar pill + a dashboard card, both fed by the
// lightweight /nasStatus endpoint. The one question it answers at a glance:
// "is footage actually landing on the NAS right now?"
//
// Green = healthy, amber = warning (filling up / not mounted / writes stalled),
// red = critical (offline / not writable / recording to the OS disk). Clicking
// either opens the full Storage & Retention page.
$(document).ready(function () {
    var POLL_MS = 20000
    var COLOR = { ok: '#16a34a', warning: '#d97706', critical: '#dc2626' }
    var LEVEL_TEXT = { ok: 'Healthy', warning: 'Warning', critical: 'Critical' }

    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
    function fmtGb(gb) {
        if (gb === null || gb === undefined || isNaN(gb)) return '—'
        var n = Number(gb)
        return n >= 1024 ? (n / 1024).toFixed(1) + ' TB' : n.toFixed(0) + ' GB'
    }
    function agoText(min) {
        if (min === null || min === undefined || isNaN(min)) return '—'
        if (min < 1) return 'just now'
        if (min >= 120) return (min / 60).toFixed(1) + ' h ago'
        return min + ' min ago'
    }
    function openStoragePage() {
        var t = $('[page-open="storageStatus"]').first()
        if (t.length) t.click()
    }

    // pulse animation for a critical dot (injected once)
    if (!document.getElementById('nasIndicatorStyle')) {
        var st = document.createElement('style')
        st.id = 'nasIndicatorStyle'
        st.textContent = '@keyframes nasPulse{0%,100%{opacity:1}50%{opacity:.25}}'
        document.head.appendChild(st)
    }

    // --- Sidebar pill -----------------------------------------------------
    function ensureSidebarPill() {
        var menu = $('#menu-side')
        if (!menu.length) return null
        if ($('#nasIndicatorPill').length) return $('#nasIndicatorPill')
        var pill = $(
            '<li id="nasIndicatorPill" class="nav-link side-menu-link cursor-pointer" ' +
            'title="NAS storage status — click for details" ' +
            'style="display:flex;align-items:center;gap:8px">' +
              '<span id="nasDot" style="width:10px;height:10px;border-radius:50%;background:#888;flex:none"></span>' +
              '<span style="flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' +
                '<span style="font-weight:600">NAS</span> ' +
                '<span id="nasPillFree" class="text-muted" style="font-size:.8em"></span>' +
              '</span>' +
            '</li>')
        pill.on('click', openStoragePage)
        menu.prepend(pill)
        return pill
    }
    function updateSidebar(d) {
        ensureSidebarPill()
        var color = COLOR[d.level] || '#888'
        $('#nasDot').css({ background: color, animation: d.level === 'critical' ? 'nasPulse 1s infinite' : 'none' })
        $('#nasPillFree').text(d.online ? (fmtGb(d.freeGb) + ' free') : 'OFFLINE')
        $('#nasIndicatorPill').attr('title', (d.message || 'NAS status') + ' — click for details')
    }

    // --- Dashboard card ---------------------------------------------------
    function updateDashboard(d) {
        var card = $('#dxNasCard')
        if (!card.length) return
        var color = COLOR[d.level] || '#888'
        $('#dxNasDot').css({ background: color, animation: d.level === 'critical' ? 'nasPulse 1s infinite' : 'none' })
        $('#dxNasLevel').text(LEVEL_TEXT[d.level] || '—').css('color', color)
        $('#dxNasMessage').text(d.message || '')
        $('#dxNasFree').text(fmtGb(d.freeGb))
        $('#dxNasTotal').text(fmtGb(d.totalGb))

        var pct = d.usedPercent == null ? 0 : Math.min(d.usedPercent, 100)
        var barColor = d.usedPercent >= 95 ? COLOR.critical : d.usedPercent >= 85 ? COLOR.warning : COLOR.ok
        $('#dxNasBar').css({ width: pct + '%', background: barColor })
        $('#dxNasBarPct').text(d.usedPercent == null ? '—' : d.usedPercent + '% used')

        function chip(ok, label) {
            return '<span class="badge me-1" style="background:' + (ok ? COLOR.ok : COLOR.critical) + '">' + esc(label) + '</span>'
        }
        var chips = chip(d.online, d.online ? 'Online' : 'Offline')
        chips += d.mounted
            ? '<span class="badge me-1" style="background:' + COLOR.ok + '">Mounted</span>'
            : '<span class="badge text-dark me-1" style="background:' + COLOR.warning + '">Not mounted</span>'
        chips += chip(d.writable, d.writable ? 'Writable' : 'Not writable')
        $('#dxNasChips').html(chips)

        $('#dxNasLastWrite').text(agoText(d.lastWriteAgoMin))
        $('#dxNasRecording').text(d.recordingMonitors + ' recording')
    }

    // --- Poll -------------------------------------------------------------
    function poll() {
        if (typeof getApiPrefix !== 'function') return
        $.getJSON(getApiPrefix('nasStatus'))
            .done(function (d) {
                if (!d || !d.ok) { $('#nasDot,#dxNasDot').css('background', '#888'); return }
                updateSidebar(d)
                updateDashboard(d)
            })
            .fail(function () {
                // server unreachable — show unknown rather than a stale healthy dot
                $('#nasDot,#dxNasDot').css('background', '#888')
                $('#nasPillFree').text('—')
            })
    }

    $(document).on('click', '#dxNasCard', openStoragePage)

    // let the app build the sidebar first, then start polling
    setTimeout(function () { ensureSidebarPill(); poll(); setInterval(poll, POLL_MS) }, 1500)
})
