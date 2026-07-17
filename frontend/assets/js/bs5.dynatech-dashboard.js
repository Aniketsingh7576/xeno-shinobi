(function () {
    if (window.dxDashboardLoaded) return;
    window.dxDashboardLoaded = true;

    var STATUS_ACTIVE = [2, 3, 9];    // Watching, Recording, Detecting
    var STATUS_ERROR  = [7, 5, 8];    // Died, Disconnected, Reconnecting

    var dxState = {
        cpuChart: null,
        ramChart: null,
        diskChart: null,
        regionChart: null,
        eventsChart: null,
        typeChart: null,
        realEventsActive: false,
        lastFireTs: 0,          // newest fire event we've already popped a notification for
        fireNotifyArmed: false, // don't pop on the very first load (only NEW fires after)
        lastLinexTs: 0,         // same, for line-crossing popups
        linexNotifyArmed: false,
        currentFilter: 'all',
        searchTerm: ''
    };

    function inferRegion(host) {
        if (!host) return 'Unknown';
        var m = String(host).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
        if (!m) return host;
        var a = parseInt(m[1], 10);
        if (a === 10)  return 'Switch ' + m[1] + '.' + m[2] + '.' + m[3];
        if (a === 172) return 'Switch ' + m[1] + '.' + m[2] + '.' + m[3];
        if (a === 192) return 'Switch ' + m[3];
        return 'Switch ' + m[1] + '.' + m[2] + '.' + m[3];
    }

    function classifyMonitor(m) {
        var code = parseInt(m.code, 10);
        var mode = (m.mode || '').toLowerCase();
        if (STATUS_ERROR.indexOf(code) !== -1) return 'error';
        if (STATUS_ACTIVE.indexOf(code) !== -1) return 'active';
        // Mode 'start' = watch-only streaming, 'record' = streaming + recording — both active.
        if (mode === 'start' || mode === 'record') return 'active';
        if (mode === 'stop' || mode === 'disabled') return 'inactive';
        return 'inactive';
    }

    function getMonitorHost(m) {
        var d = m && m.details;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } }
        return (d && d.host) || m.host || '';
    }

    function pct(part, total) {
        if (!total) return '0%';
        return ((part / total) * 100).toFixed(1) + '%';
    }

    function makeDoughnut(ctx, dataValues, dataLabels, colors, cutoutPercent) {
        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: dataLabels,
                datasets: [{ data: dataValues, backgroundColor: colors, borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutoutPercentage: cutoutPercent != null ? cutoutPercent : 70,
                legend: {
                    display: dataLabels.length > 0 && dataLabels.length <= 12,
                    position: 'right',
                    labels: { boxWidth: 10, fontSize: 11 }
                },
                tooltips: { enabled: true },
                animation: { duration: 400 }
            }
        });
    }

    function makeGauge(canvasEl) {
        return new Chart(canvasEl.getContext('2d'), {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [0, 100],
                    backgroundColor: ['#0d6efd', '#e5e7eb'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutoutPercentage: 78,
                rotation: -Math.PI,
                circumference: Math.PI * 2,
                legend: { display: false },
                tooltips: { enabled: false },
                animation: { duration: 400 }
            }
        });
    }

    function setGauge(chart, percent, color) {
        if (!chart) return;
        var p = Math.max(0, Math.min(100, percent || 0));
        chart.data.datasets[0].data = [p, 100 - p];
        if (color) chart.data.datasets[0].backgroundColor[0] = color;
        chart.update();
    }

    function colorForPercent(p) {
        if (p >= 85) return '#ef4444';
        if (p >= 60) return '#f59e0b';
        return '#22c55e';
    }

    function regionPalette(n) {
        var base = ['#ef4444', '#22c55e', '#f59e0b', '#0d6efd', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#14b8a6', '#f97316', '#8b5cf6', '#64748b'];
        var out = [];
        for (var i = 0; i < n; i++) out.push(base[i % base.length]);
        return out;
    }

    function recomputeCounts() {
        var data = Object.values(window.loadedMonitors || {});
        var active = 0, inactive = 0, error = 0;
        var byRegion = {};

        data.forEach(function (m) {
            var c = classifyMonitor(m);
            if (c === 'active') active++;
            else if (c === 'error') error++;
            else inactive++;

            var host = getMonitorHost(m);
            var region = inferRegion(host);
            if (!byRegion[region]) byRegion[region] = 0;
            byRegion[region]++;
        });

        var total = data.length;
        setText('dx-count-active', active);
        setText('dx-count-inactive', inactive);
        setText('dx-count-error', error);
        setText('dx-pct-active', pct(active, total));
        setText('dx-pct-inactive', pct(inactive, total));
        setText('dx-pct-error', pct(error, total));
        setText('dx-region-total', 'Total ' + total);
        // KPI strip
        setText('dx-kpi-total', total);
        setText('dx-kpi-total-sub', total === 1 ? 'camera' : 'cameras');
        setText('dx-kpi-offline', inactive + error);
        // Sidebar System Status card
        setText('dx-sys-online', active);
        setText('dx-sys-total', total);
        setText('dx-sys-alerts', inactive + error);
        // Top bar alert badge
        var badge = document.getElementById('dx-topbar-alert-badge');
        if (badge) {
            var alertCount = inactive + error;
            badge.textContent = alertCount;
            badge.style.display = alertCount > 0 ? '' : 'none';
        }

        updateRegionChart(byRegion);
        renderCameraTable(data);
        renderLiveTiles(data);
    }

    // Live View preview tiles. Each tile's <img> points at the direct authed JPEG
    // Live snapshot: the /jpeg/<ke>/<mid>/s.jpg route serves the fresh frame ffmpeg
    // writes continuously (requires the monitor to have snapshot output enabled, snap=1).
    // The cache-buster forces the browser to fetch a new frame each refresh, so the tile
    // actually updates. (The static /icon thumbnail does NOT refresh, so we don't use it.)
    function snapshotUrl(mid, bust) {
        if (typeof getApiPrefix !== 'function') return '';
        return getApiPrefix('jpeg') + '/' + mid + '/s.jpg?_=' + bust;
    }

    function renderLiveTiles(monitors) {
        var grid = document.getElementById('dx-live-grid');
        var empty = document.getElementById('dx-live-empty');
        if (!grid) return;
        var MAX_TILES = 6;
        var tiles = monitors.slice(0, MAX_TILES);
        if (empty) empty.style.display = tiles.length === 0 ? '' : 'none';
        var bust = (window.dxSnapBust = (window.dxSnapBust || 0) + 1);
        var html = '';
        tiles.forEach(function (m) {
            var cls = classifyMonitor(m);
            var on = cls === 'active';
            var name = m.name || m.mid || '(unnamed)';
            var src = snapshotUrl(m.mid, bust);
            html += '<div class="col-6 col-xl-4">'
                + '<div class="dx-live-tile' + (on ? ' dx-live-on' : '') + '" data-mid="' + escapeHtml(m.mid || '') + '">'
                + '<span class="dx-live-label">' + escapeHtml(name) + '</span>'
                + '<span class="dx-live-badge"><span class="dx-live-dot"></span>' + (on ? 'Live' : 'Offline') + '</span>'
                + '<div class="dx-live-noimg"><i class="fa fa-video-camera"></i></div>'
                + (src
                    ? '<img class="snapshot" data-mid="' + escapeHtml(m.mid || '') + '" alt="' + escapeHtml(name) + '" src="' + src + '" onload="this.previousElementSibling.style.display=\'none\'" onerror="this.style.display=\'none\'">'
                    : '')
                + '</div></div>';
        });
        grid.innerHTML = html;
    }

    // Refresh the visible snapshot <img> srcs in place (no DOM rebuild) for a live feel.
    function refreshLiveSnapshots() {
        var grid = document.getElementById('dx-live-grid');
        if (!grid) return;
        var bust = (window.dxSnapBust = (window.dxSnapBust || 0) + 1);
        grid.querySelectorAll('.dx-live-tile img.snapshot').forEach(function (img) {
            var mid = img.getAttribute('data-mid');
            if (mid) { img.style.display = ''; img.src = snapshotUrl(mid, bust); }
        });
    }

    function updateRegionChart(byRegion) {
        var ctx = document.getElementById('dx-region-chart');
        if (!ctx) return;
        var labels = Object.keys(byRegion);
        var values = labels.map(function (k) { return byRegion[k]; });
        var colors = regionPalette(labels.length);

        if (dxState.regionChart) {
            dxState.regionChart.data.labels = labels;
            dxState.regionChart.data.datasets[0].data = values;
            dxState.regionChart.data.datasets[0].backgroundColor = colors;
            dxState.regionChart.update();
        } else {
            dxState.regionChart = makeDoughnut(ctx.getContext('2d'), values, labels, colors, 60);
        }
    }

    function renderCameraTable(monitors) {
        var tbody = document.querySelector('#dx-camera-table tbody');
        var empty = document.getElementById('dx-empty');
        if (!tbody) return;
        var rows = '';
        var filter = dxState.currentFilter;
        var search = dxState.searchTerm.toLowerCase();
        var count = 0;

        monitors.forEach(function (m) {
            var cls = classifyMonitor(m);
            if (filter !== 'all' && filter !== cls) return;
            var name = m.name || m.mid || '(unnamed)';
            var host = getMonitorHost(m);
            if (search && name.toLowerCase().indexOf(search) === -1 && host.toLowerCase().indexOf(search) === -1) return;
            var region = inferRegion(host);
            var statusLabel = cls.charAt(0).toUpperCase() + cls.slice(1);
            var modeLabel = m.mode || '-';
            count++;
            rows += '<tr data-mid="' + (m.mid || '') + '">'
                + '<td><span class="dx-status-dot dx-status-' + cls + '"></span></td>'
                + '<td>' + escapeHtml(name) + '</td>'
                + '<td><span class="badge bg-light text-dark text-uppercase">' + escapeHtml(modeLabel) + '</span></td>'
                + '<td><code>' + escapeHtml(host || '-') + '</code></td>'
                + '<td>' + escapeHtml(region) + '</td>'
                + '<td>' + statusLabel + '</td>'
                + '<td class="text-end">'
                + '<a class="btn btn-sm btn-outline-primary" href="#monitor-' + (m.mid || '') + '">Open</a>'
                + '</td>'
                + '</tr>';
        });

        tbody.innerHTML = rows;
        if (empty) empty.style.display = count === 0 ? '' : 'none';
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // ---- AI analytics charts (Fire + Line Crossing ONLY) ----
    // PLACEHOLDER data until the camera-AI feed is wired. Real integration will call
    // window.dxRenderAiCharts({ hours:[...], fire:[...], linex:[...] }) per day.
    var DX_FIRE = '#dc2626', DX_LINEX = '#d97706';
    // Charts start at zero — never show fabricated counts. Real totals arrive from the
    // events API poll within seconds and replace these via applyRealEvents().
    var DX_AI_PLACEHOLDER = {
        hours: ['00','02','04','06','08','10','12','14','16','18','20','22'],
        fire:  [0,0,0,0,0,0,0,0,0,0,0,0],
        linex: [0,0,0,0,0,0,0,0,0,0,0,0]
    };

    function buildEventsChart() {
        var ctx = document.getElementById('dx-events-chart');
        if (!ctx) return;
        if (dxState.eventsChart) return;
        dxState.eventsChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: DX_AI_PLACEHOLDER.hours,
                datasets: [
                    { label: 'Fire', data: DX_AI_PLACEHOLDER.fire, borderColor: DX_FIRE, backgroundColor: 'rgba(220,38,38,0.12)', fill: true, pointRadius: 2, borderWidth: 2, lineTension: 0.35 },
                    { label: 'Line Crossing', data: DX_AI_PLACEHOLDER.linex, borderColor: DX_LINEX, backgroundColor: 'rgba(217,119,6,0.12)', fill: true, pointRadius: 2, borderWidth: 2, lineTension: 0.35 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                legend: { display: true, position: 'bottom', labels: { boxWidth: 10, fontSize: 11 } },
                tooltips: { mode: 'index', intersect: false },
                scales: {
                    yAxes: [{ ticks: { beginAtZero: true, precision: 0 }, gridLines: { color: '#f1f3f5' } }],
                    xAxes: [{ gridLines: { display: false } }]
                },
                animation: { duration: 400 }
            }
        });
    }

    function buildTypeChart() {
        var ctx = document.getElementById('dx-type-chart');
        if (!ctx) return;
        if (dxState.typeChart) return;
        var fireTotal = DX_AI_PLACEHOLDER.fire.reduce(function (a, b) { return a + b; }, 0);
        var linexTotal = DX_AI_PLACEHOLDER.linex.reduce(function (a, b) { return a + b; }, 0);
        dxState.typeChart = makeDoughnut(ctx.getContext('2d'), [fireTotal, linexTotal], ['Fire', 'Line Crossing'], [DX_FIRE, DX_LINEX], 65);
        setText('dx-ai-fire-total', fireTotal);
        setText('dx-ai-linex-total', linexTotal);
    }

    function buildAiCharts() {
        if (typeof Chart === 'undefined') return;
        buildEventsChart();
        buildTypeChart();
    }

    // ---- REAL events feed (Fire + Line Crossing) ----
    // Polls Shinobi's events API as the logged-in user (getApiPrefix uses $user.auth_token,
    // which has full access — unlike a restricted API key). Classifies each event's reason
    // into fire / line-crossing, then drives the Recent Alerts panel, the KPI cards, and the
    // analytics charts from real data. Falls back to placeholders if the API isn't reachable.
    function classifyReason(reason) {
        var r = String(reason || '').toLowerCase();
        if (r.indexOf('fire') !== -1 || r.indexOf('smoke') !== -1) return 'fire';
        if (r.indexOf('line') !== -1 || r.indexOf('cross') !== -1) return 'linex';
        return null;   // ignore non fire/line-crossing events (motion, object, etc.)
    }

    function todayRange() {
        var now = new Date();
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        var ymd = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
        return { start: ymd + 'T00:00:00', end: ymd + 'T23:59:59' };
    }

    function fetchRealEvents() {
        if (typeof getApiPrefix !== 'function' || typeof $ === 'undefined') return;
        var range = todayRange();
        var url = getApiPrefix('events') + '?start=' + range.start + '&end=' + range.end + '&limit=500';
        $.getJSON(url).done(function (data) {
            // API returns either a bare array (noFormat) or { events: [...] }
            var rows = Array.isArray(data) ? data : (data && data.events) || [];
            applyRealEvents(rows);
        }).fail(function () {
            // leave placeholders in place; mark as not-live silently
        });
    }

    // Capture the camera's current frame as a base64 JPEG (draws the live s.jpg snapshot
    // onto a canvas). Returns a Promise resolving to the data URL (or null on failure).
    // NOTE: the snapshot is SAME-ORIGIN (served from this Shinobi), so we must NOT set
    // crossOrigin='anonymous' — doing so makes the load fail when the route doesn't echo
    // CORS headers. Same-origin draw → canvas is not tainted → toDataURL works.
    function captureCameraFrame(mid) {
        return new Promise(function (resolve) {
            try {
                var img = new Image();
                img.onload = function () {
                    try {
                        var c = document.createElement('canvas');
                        c.width = img.naturalWidth || 640;
                        c.height = img.naturalHeight || 360;
                        c.getContext('2d').drawImage(img, 0, 0);
                        resolve(c.toDataURL('image/jpeg', 0.7));
                    } catch (e) { console.warn('dx capture toDataURL failed', e); resolve(null); }
                };
                img.onerror = function () { console.warn('dx capture image load failed'); resolve(null); };
                img.src = snapshotUrl(mid, (window.dxSnapBust = (window.dxSnapBust || 0) + 1));
            } catch (e) { resolve(null); }
        });
    }

    // Save a captured frame to Shinobi keyed to the event's unique NAME, so the Detections
    // page matches it EXACTLY (snapshot file = <name>.jpg = the event's name). Returns a
    // Promise so the trigger can wait until the snapshot is saved before firing /motion.
    function saveDetectionSnapshot(mid, name, dataUrl) {
        if (!dataUrl) return Promise.resolve(false);
        return new Promise(function (resolve) {
            try {
                $.ajax({
                    url: getApiPrefix('detectionSnapshot') + '/' + mid,
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ name: name, image: dataUrl })
                }).done(function (r) { resolve(!!(r && r.ok)); })
                  .fail(function () { resolve(false); });
            } catch (e) { resolve(false); }
        });
    }

    // Manual fire trigger (button + shortcut). Generates ONE unique name, captures the frame,
    // saves it as <name>.jpg, THEN fires /motion with that same name. The Detections page
    // shows assets/snapshots/<name>.jpg for the event — exact match, no time guessing.
    function triggerFireAlert() {
        if (typeof getApiPrefix !== 'function') return;
        var monitors = Object.values(window.loadedMonitors || {});
        if (!monitors.length) {
            if (typeof PNotify === 'function') new PNotify({ title: 'No camera', text: 'No monitor available to trigger.', type: 'notice' });
            return;
        }
        var target = monitors.filter(function (m) { return classifyMonitor(m) === 'active'; })[0] || monitors[0];
        var mid = target.mid;
        var name = (target.name || mid);
        var evName = 'Fire_manual_' + Date.now();   // the shared key (snapshot file + event name)
        var btn = document.getElementById('dx-trigger-fire');
        if (btn) { btn.disabled = true; setTimeout(function () { btn.disabled = false; }, 3000); }

        captureCameraFrame(mid).then(function (dataUrl) {
            // save snapshot FIRST (so it exists before the event row appears), then /motion
            return saveDetectionSnapshot(mid, evName, dataUrl);
        }).then(function () {
            var url = getApiPrefix('motion') + '/' + mid +
                      '?plug=manualTrigger&name=' + encodeURIComponent(evName) +
                      '&reason=Fire&confidence=' + randomConfidence();
            $.getJSON(url).done(function (resp) {
                if (resp && resp.ok) {
                    showEventPopup(DX_NOTIFY.fire, name, Date.now());
                    setTimeout(fetchRealEvents, 900);   // let the event write, then refresh
                } else {
                    if (typeof PNotify === 'function') new PNotify({ title: 'Trigger failed', text: (resp && resp.msg) || 'Could not trigger.', type: 'error' });
                }
            }).fail(function () {
                if (typeof PNotify === 'function') new PNotify({ title: 'Trigger failed', text: 'Request error.', type: 'error' });
            });
        });
    }
    window.dxTriggerFireAlert = triggerFireAlert;

    // A realistic-looking confidence (75-85%) instead of a flat 100%.
    function randomConfidence() {
        return 75 + Math.floor((Date.now() % 11));   // 75..85, deterministic-ish, no Math.random needed
    }

    // UTC minute-bucket (YYYY-MM-DD_HH-mm) so the saved snapshot filename matches the event's
    // DB time (server stores UTC). MUST use UTC to align with the Detections page key.
    function nowBucketIso() {
        var d = new Date();
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + '_' +
               p(d.getUTCHours()) + '-' + p(d.getUTCMinutes());
    }

    function applyRealEvents(rows) {
        dxState.realEventsActive = true;
        var alerts = [];
        var fireCount = 0, linexCount = 0;
        var hourFire = new Array(12).fill(0);
        var hourLinex = new Array(12).fill(0);
        var fireEvents = [];    // {ts, camera} for popup detection
        var linexEvents = [];

        rows.forEach(function (row) {
            var details = row.details;
            if (typeof details === 'string') { try { details = JSON.parse(details); } catch (e) { details = {}; } }
            var kind = classifyReason(details && details.reason);
            if (!kind) return;

            var t = row.time ? new Date(row.time.replace(' ', 'T')) : null;
            var ts = t ? t.getTime() : 0;
            var camName = (window.loadedMonitors && window.loadedMonitors[row.mid] && window.loadedMonitors[row.mid].name) || row.mid || 'Camera';
            var hourBucket = t ? Math.floor(t.getHours() / 2) : 0;
            if (kind === 'fire') { fireCount++; hourFire[hourBucket]++; fireEvents.push({ ts: ts, camera: camName }); }
            else { linexCount++; hourLinex[hourBucket]++; linexEvents.push({ ts: ts, camera: camName }); }

            alerts.push({
                type: kind === 'fire' ? 'Fire' : 'LineCrossing',
                camera: camName,
                time: t ? formatClock(t) : '',
                severity: kind === 'fire' ? 'high' : 'medium',
                _ts: ts
            });
        });

        // newest first, cap the panel
        alerts.sort(function (a, b) { return b._ts - a._ts; });
        renderAlerts(alerts.slice(0, 12));

        // Popups: notify on NEW events (newer than the last one we popped) per type.
        notifyNewEvents('fire', fireEvents);
        notifyNewEvents('linex', linexEvents);

        // KPI cards
        setText('dx-kpi-fire', fireCount);
        setText('dx-kpi-linex', linexCount);
        setText('dx-ai-fire-total', fireCount);
        setText('dx-ai-linex-total', linexCount);
        setText('dx-topbar-alert-badge', fireCount + linexCount);

        // charts (real)
        if (dxState.eventsChart) {
            dxState.eventsChart.data.datasets[0].data = hourFire;
            dxState.eventsChart.data.datasets[1].data = hourLinex;
            dxState.eventsChart.update();
        }
        if (dxState.typeChart) {
            dxState.typeChart.data.datasets[0].data = [fireCount, linexCount];
            dxState.typeChart.update();
        }
        // clear the "awaiting feed" tags now that real data is flowing
        document.querySelectorAll('.dynatech-dashboard .dx-placeholder-tag').forEach(function (el) {
            el.style.display = 'none';
        });
    }

    function formatClock(d) {
        var h = d.getHours(), m = d.getMinutes();
        var ap = h >= 12 ? 'PM' : 'AM';
        h = h % 12; if (h === 0) h = 12;
        return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
    }

    // Per-type popup config: how each event type renders + which state tracker it uses.
    var DX_NOTIFY = {
        fire: {
            armed: 'fireNotifyArmed', last: 'lastFireTs',
            title: '🔥 Fire Detected', verb: 'Fire detected on',
            type: 'error', icon: 'fa fa-fire', addclass: 'dx-fire-pnotify'
        },
        linex: {
            armed: 'linexNotifyArmed', last: 'lastLinexTs',
            title: '⇄ Line Crossing', verb: 'Line crossing on',
            type: 'notice', icon: 'fa fa-exchange', addclass: 'dx-linex-pnotify'
        }
    };

    // Pop a notification for each NEW event of a type (newer than the last we alerted on).
    // On first load we just record the newest ts WITHOUT popping (so we don't blast a stack
    // of historical popups) — only genuinely new events after that pop.
    function notifyNewEvents(kind, events) {
        var cfg = DX_NOTIFY[kind];
        if (!cfg) return;
        if (!events || !events.length) { dxState[cfg.armed] = true; return; }
        var newestTs = Math.max.apply(null, events.map(function (e) { return e.ts; }));

        if (!dxState[cfg.armed]) {
            dxState[cfg.last] = newestTs;   // baseline; don't pop existing events
            dxState[cfg.armed] = true;
            return;
        }

        var fresh = events.filter(function (e) { return e.ts > dxState[cfg.last]; })
                          .sort(function (a, b) { return a.ts - b.ts; });
        fresh.forEach(function (e) { showEventPopup(cfg, e.camera, e.ts); });
        if (newestTs > dxState[cfg.last]) dxState[cfg.last] = newestTs;
    }

    function showEventPopup(cfg, camera, ts) {
        var timeStr = ts ? formatClock(new Date(ts)) : '';
        if (typeof PNotify === 'function') {
            new PNotify({
                title: cfg.title,
                text: cfg.verb + ' <strong>' + escapeHtml(camera) + '</strong>' + (timeStr ? ' at ' + timeStr : ''),
                type: cfg.type,
                icon: cfg.icon,
                delay: 12000,             // stays 12s
                hide: true,
                addclass: cfg.addclass,
                buttons: { closer: true, sticker: false }
            });
        } else {
            console.warn(cfg.title + ' on ' + camera);
        }
        // optional audible cue
        try { if (window.dxFireBeep) window.dxFireBeep(); } catch (e) {}
    }

    // ---- Recent Alerts (Fire + Line Crossing ONLY) ----
    // PLACEHOLDER data until the camera-AI feed is wired. The real integration
    // will call renderAlerts(events) with events shaped like:
    //   { type:'Fire'|'LineCrossing', camera:'CH1', time:'10:29 AM', severity:'high'|'medium'|'low' }
    // sourced from the socket.io 'f' event. Keep this the single entry point.
    // No fabricated alerts. A security dashboard must never display events that did not
    // happen — the panel shows its empty state until real events arrive from the API.
    var DX_PLACEHOLDER_ALERTS = [];

    function alertMeta(type) {
        if (String(type).toLowerCase().indexOf('fire') !== -1) {
            return { label: 'Fire Detected', tag: 'dx-tag-fire', icon: 'fa-fire' };
        }
        return { label: 'Line Crossing', tag: 'dx-tag-linex', icon: 'fa-exchange' };
    }

    function renderAlerts(alerts) {
        var list = document.getElementById('dx-alerts-list');
        var empty = document.getElementById('dx-alerts-empty');
        var count = document.getElementById('dx-alerts-count');
        if (!list) return;
        alerts = alerts || [];
        if (count) count.textContent = alerts.length;
        if (empty) empty.style.display = alerts.length === 0 ? '' : 'none';
        var sevCls = { high: 'dx-sev-high', medium: 'dx-sev-med', low: 'dx-sev-low' };
        var html = '';
        alerts.forEach(function (a) {
            var meta = alertMeta(a.type);
            var sev = sevCls[a.severity] || 'dx-sev-low';
            html += '<div class="dx-alert-item">'
                + '<div class="dx-alert-thumb"><i class="fa ' + meta.icon + '"></i></div>'
                + '<div class="dx-alert-body">'
                + '<div><span class="dx-alert-tag ' + meta.tag + '">' + meta.label + '</span></div>'
                + '<div class="dx-alert-meta">' + escapeHtml(a.camera || '-') + '</div>'
                + '</div>'
                + '<div class="text-end">'
                + '<div class="dx-alert-time">' + escapeHtml(a.time || '') + '</div>'
                + '<div><span class="dx-sev-dot ' + sev + '"></span><span class="dx-alert-time">' + escapeHtml((a.severity || '').replace(/^./, function(c){return c.toUpperCase();})) + '</span></div>'
                + '</div>'
                + '</div>';
        });
        list.innerHTML = html;
    }
    // expose for the future camera-AI integration to push real events in
    window.dxRenderAlerts = renderAlerts;

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function bindFilterButtons() {
        document.querySelectorAll('.dx-filter').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.dx-filter').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                dxState.currentFilter = btn.getAttribute('data-filter');
                renderCameraTable(Object.values(window.loadedMonitors || {}));
            });
        });
        var s = document.getElementById('dx-search');
        if (s) s.addEventListener('input', function () {
            dxState.searchTerm = s.value || '';
            renderCameraTable(Object.values(window.loadedMonitors || {}));
        });
    }

    function initGauges() {
        var c = document.getElementById('dx-cpu-gauge');
        var r = document.getElementById('dx-ram-gauge');
        var d = document.getElementById('dx-disk-gauge');
        if (c) dxState.cpuChart = makeGauge(c);
        if (r) dxState.ramChart = makeGauge(r);
        if (d) dxState.diskChart = makeGauge(d);
    }

    function handleSystemEvent(d) {
        switch (d.f) {
            case 'init_success':
                if (d.os) {
                    if (typeof d.os.cpuCount !== 'undefined')
                        document.getElementById('dx-cpu-cores').textContent = d.os.cpuCount;
                    if (d.os.platform)
                        document.getElementById('dx-cpu-os').textContent = d.os.platform;
                    if (typeof d.os.totalmem !== 'undefined')
                        document.getElementById('dx-ram-total').textContent = (d.os.totalmem / 1048576).toFixed(0);
                }
                break;
            case 'os':
                var cpuP = parseFloat(d.cpu) || 0;
                var ramP = (d.ram && parseFloat(d.ram.percent)) || 0;
                setGauge(dxState.cpuChart, cpuP, colorForPercent(cpuP));
                setGauge(dxState.ramChart, ramP, colorForPercent(ramP));
                setText('dx-cpu-pct', cpuP.toFixed(1) + '%');
                setText('dx-ram-pct', ramP.toFixed(1) + '%');
                if (d.ram && typeof d.ram.used !== 'undefined')
                    setText('dx-ram-used', parseFloat(d.ram.used).toFixed(0));
                updateServerHealth(cpuP, ramP);
                break;
            case 'diskUsed':
                var used = parseFloat(d.size) || 0;
                var limit = parseFloat(d.limit) || 0;
                var diskP = limit ? (used / limit) * 100 : 0;
                setGauge(dxState.diskChart, diskP, colorForPercent(diskP));
                setText('dx-disk-pct', diskP.toFixed(1) + '%');
                setText('dx-disk-used', formatMB(used));
                setText('dx-disk-total', formatMB(limit));
                // Sidebar System Status card
                setText('dx-sys-disk-pct', diskP.toFixed(0) + '%');
                setText('dx-sys-disk-used', formatMB(used));
                setText('dx-sys-disk-total', formatMB(limit));
                var bar = document.getElementById('dx-sys-disk-bar');
                if (bar) {
                    bar.style.width = Math.min(100, diskP).toFixed(0) + '%';
                    bar.className = 'progress-bar ' + (diskP >= 85 ? 'bg-danger' : diskP >= 60 ? 'bg-warning' : 'bg-success');
                }
                break;
            case 'monitor_status':
            case 'monitor_edit':
                setTimeout(recomputeCounts, 50);
                break;
        }
    }

    function updateServerHealth(cpuP, ramP) {
        var el = document.getElementById('dx-sys-health');
        var led = document.querySelector('.dx-sys-led');
        var worst = Math.max(cpuP || 0, ramP || 0);
        var state = worst >= 90 ? 'critical' : worst >= 75 ? 'warning' : 'healthy';
        var map = {
            healthy:  { cls: 'text-success', icon: 'fa-check-circle', label: 'Healthy', led: '#22c55e' },
            warning:  { cls: 'text-warning', icon: 'fa-exclamation-circle', label: 'Elevated', led: '#f59e0b' },
            critical: { cls: 'text-danger',  icon: 'fa-times-circle', label: 'Critical', led: '#ef4444' }
        };
        var m = map[state];
        if (el) { el.className = 'dx-sys-val ' + m.cls; el.innerHTML = '<i class="fa ' + m.icon + '"></i> ' + m.label; }
        if (led) led.style.background = m.led;
    }

    function formatMB(mb) {
        if (!mb) return '0 MB';
        if (mb >= 1024 * 1024) return (mb / 1024 / 1024).toFixed(2) + ' TB';
        if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
        return mb.toFixed(2) + ' MB';
    }

    function bindFireTrigger() {
        // DISABLED (vms-core-hardening): the manual fire trigger + "F" keyboard shortcut
        // injected a FABRICATED fire event (with a fake confidence) into the real events
        // database, indistinguishable from a genuine detection. That is unacceptable in a
        // production security VMS. Left as a no-op; real events come only from the AI service
        // via the /motion route. Do not re-enable in production.
        return;
    }

    function start() {
        if (typeof Chart === 'undefined') { setTimeout(start, 250); return; }
        if (!document.getElementById('dx-region-chart')) { setTimeout(start, 250); return; }
        initGauges();
        bindFilterButtons();
        bindFireTrigger();
        recomputeCounts();
        buildAiCharts();
        // Live snapshot refresh (near-live preview; monitor writes s.jpg ~1/sec)
        setInterval(refreshLiveSnapshots, 2000);

        // Show placeholders immediately so the panel is never empty, then replace with
        // REAL fire/line-crossing events from Shinobi's events API (and keep polling).
        renderAlerts(DX_PLACEHOLDER_ALERTS);
        setText('dx-kpi-fire', DX_AI_PLACEHOLDER.fire.reduce(function (a, b) { return a + b; }, 0));
        setText('dx-kpi-linex', DX_AI_PLACEHOLDER.linex.reduce(function (a, b) { return a + b; }, 0));
        fetchRealEvents();
        setInterval(fetchRealEvents, 5000);
        if (typeof onWebSocketEvent === 'function') {
            onWebSocketEvent(handleSystemEvent);
        }
        // Periodically resync from loadedMonitors in case events fire before we registered
        var ticks = 0;
        var poll = setInterval(function () {
            recomputeCounts();
            ticks++;
            if (ticks > 30) clearInterval(poll); // ~30 sec of catch-up then rely on events
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
