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
        notifyBaseline: {},     // per-reason-key: newest event ts we've already popped
        notifyArmed: false,     // don't pop on the very first load (only NEW events after)
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
        var active = 0, inactive = 0, error = 0, recording = 0;
        var byRegion = {};

        data.forEach(function (m) {
            var c = classifyMonitor(m);
            if (c === 'active') active++;
            else if (c === 'error') error++;
            else inactive++;
            // Recording = mode 'record' (writing to disk), as opposed to 'start'
            // (watch-only). This is the number that matters for a 24/7 recorder.
            if (String(m.mode || '').toLowerCase() === 'record') recording++;

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
        setText('dx-kpi-recording', recording);
        setText('dx-kpi-recording-sub', recording === 1 ? 'camera to disk' : 'cameras to disk');
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
        var MAX_TILES = 8;   // 2 clean rows of 4 on large screens
        var tiles = monitors.slice(0, MAX_TILES);
        if (empty) empty.style.display = tiles.length === 0 ? '' : 'none';

        // Rebuild the DOM ONLY when the set of tiles actually changes. `monitor_status`
        // socket events arrive constantly, and each one used to re-run innerHTML here —
        // destroying and re-creating every <img>, which is what made the previews blink.
        // When the tile set is unchanged we update the live/offline state in place and
        // leave the images (and their in-flight loads) completely untouched.
        var signature = tiles.map(function (m) { return m.mid; }).join(',');
        if (grid.getAttribute('data-tile-sig') === signature && grid.children.length) {
            tiles.forEach(function (m) {
                var on = classifyMonitor(m) === 'active';
                var tile = null;
                var nodes = grid.querySelectorAll('.dx-live-tile');
                for (var i = 0; i < nodes.length; i++) {
                    if (nodes[i].getAttribute('data-mid') === String(m.mid)) { tile = nodes[i]; break; }
                }
                if (!tile) return;
                tile.classList.toggle('dx-live-on', on);
                var badge = tile.querySelector('.dx-live-badge');
                if (badge) badge.innerHTML = '<span class="dx-live-dot"></span>' + (on ? 'Live' : 'Offline');
            });
            return;
        }
        grid.setAttribute('data-tile-sig', signature);

        var bust = (window.dxSnapBust = (window.dxSnapBust || 0) + 1);
        var html = '';
        tiles.forEach(function (m) {
            var cls = classifyMonitor(m);
            var on = cls === 'active';
            var name = m.name || m.mid || '(unnamed)';
            var src = snapshotUrl(m.mid, bust);
            // 2 per row on phones, 3 on tablets, 4 on desktop. The Live View card spans the
            // full width when the AI-only Alerts card is hidden, so 3-per-row made each tile
            // a third of the screen — far too big for a preview grid.
            html += '<div class="col-6 col-md-4 col-xl-3">'
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
    // DOUBLE-BUFFERED: assigning img.src directly makes the browser tear down the current
    // frame and show a blank tile until the new JPEG arrives — that read as constant
    // "blinking". Instead we preload each frame off-screen and only swap it in once it has
    // fully decoded, so the visible tile goes straight from old frame to new frame.
    // The per-tile in-flight guard also stops requests stacking up on a slow camera.
    function refreshLiveSnapshots() {
        var grid = document.getElementById('dx-live-grid');
        if (!grid) return;
        var bust = (window.dxSnapBust = (window.dxSnapBust || 0) + 1);
        grid.querySelectorAll('.dx-live-tile img.snapshot').forEach(function (img) {
            var mid = img.getAttribute('data-mid');
            if (!mid) return;
            if (img.getAttribute('data-loading') === '1') return;   // previous frame still in flight
            var url = snapshotUrl(mid, bust);
            if (!url) return;
            var pre = new Image();
            img.setAttribute('data-loading', '1');
            pre.onload = function () {
                img.src = url;                    // already decoded+cached: paints with no blank gap
                img.style.display = '';
                var placeholder = img.previousElementSibling;
                if (placeholder) placeholder.style.display = 'none';
                img.setAttribute('data-loading', '0');
            };
            pre.onerror = function () { img.setAttribute('data-loading', '0'); };
            pre.src = url;
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

    // ---- AI analytics charts — datasets are created per distinct event reason ----
    // from the events API (see applyRealEvents -> syncEventsChartDatasets / syncTypeChart).
    // Charts start empty and fill with whatever detection types actually occur; no type is
    // hardcoded here, so any AI service's events render without code changes.
    var DX_HOURS = ['00','02','04','06','08','10','12','14','16','18','20','22'];

    function buildEventsChart() {
        var ctx = document.getElementById('dx-events-chart');
        if (!ctx) return;
        if (dxState.eventsChart) return;
        dxState.eventsChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: { labels: DX_HOURS, datasets: [] },
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
        dxState.typeChart = makeDoughnut(ctx.getContext('2d'), [], [], [], 65);
    }

    function buildAiCharts() {
        if (typeof Chart === 'undefined') return;
        buildEventsChart();
        buildTypeChart();
    }

    // ---- REAL events feed (all AI event reasons) ----
    // Polls Shinobi's events API as the logged-in user (getApiPrefix uses $user.auth_token,
    // which has full access — unlike a restricted API key). Each event's `reason` is treated
    // as an opaque label via the shared dxEventRegistry, then drives the Recent Alerts panel,
    // the KPI card, and the analytics charts from real data. Any AI service's event type
    // renders without code changes here.
    var REG = window.dxEventRegistry || {
        keyFor: function (r) { r = String(r || '').trim().toLowerCase().replace(/[^\w]+/g, '_'); return r || null; },
        isVisible: function (r) { return !!(r && String(r).trim()); },
        metaFor: function (r) { return { key: r || 'event', label: String(r || 'Event'), color: '#4b5563', bg: 'rgba(75,85,99,0.12)', icon: 'fa-bell', severity: 'medium' }; },
        severityFor: function (d, m) { return (d && d.severity) || (m && m.severity) || 'medium'; }
    };
    // Opaque key for an event reason, or null if it should not surface as an AI detection.
    function eventKey(reason) {
        if (!REG.isVisible(reason)) return null;   // empty reason, or an ignored type (e.g. motion)
        return REG.keyFor(reason);
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
            // After the first successful poll, arm popups so only genuinely NEW events pop.
            dxState.notifyArmed = true;
        }).fail(function () {
            // leave placeholders in place; mark as not-live silently
        });
    }

    function applyRealEvents(rows) {
        dxState.realEventsActive = true;
        var alerts = [];
        var counts = {};                 // key -> total count
        var hourBuckets = {};            // key -> Array(12) of per-2h counts
        var eventsByKey = {};            // key -> [{ts, camera}] for popup detection
        var total = 0;

        rows.forEach(function (row) {
            var details = row.details;
            if (typeof details === 'string') { try { details = JSON.parse(details); } catch (e) { details = {}; } }
            var reason = details && details.reason;
            var key = eventKey(reason);
            if (!key) return;            // no reason, or an ignored type (motion) — skip

            var meta = REG.metaFor(key);
            var t = row.time ? new Date(row.time.replace(' ', 'T')) : null;
            var ts = t ? t.getTime() : 0;
            var camName = (window.loadedMonitors && window.loadedMonitors[row.mid] && window.loadedMonitors[row.mid].name) || row.mid || 'Camera';
            var hourBucket = t ? Math.floor(t.getHours() / 2) : 0;

            counts[key] = (counts[key] || 0) + 1;
            if (!hourBuckets[key]) hourBuckets[key] = new Array(12).fill(0);
            hourBuckets[key][hourBucket]++;
            if (!eventsByKey[key]) eventsByKey[key] = [];
            eventsByKey[key].push({ ts: ts, camera: camName });
            total++;

            alerts.push({
                key: key,
                reason: reason,
                camera: camName,
                time: t ? formatClock(t) : '',
                severity: REG.severityFor(details, meta),
                _ts: ts
            });
        });

        // newest first, cap the panel
        alerts.sort(function (a, b) { return b._ts - a._ts; });
        renderAlerts(alerts.slice(0, 12));

        // Popups: notify on NEW events (newer than the last one we popped) per reason key.
        Object.keys(eventsByKey).forEach(function (key) {
            notifyNewEvents(key, eventsByKey[key]);
        });

        // KPI card (single generic "Detections Today" total) + a short per-type breakdown
        setText('dx-kpi-detections', total);
        setText('dx-topbar-alert-badge', total);
        renderKpiBreakdown(counts);
        renderTypeTotals(counts);

        // charts (real) — datasets are per distinct reason key
        syncEventsChartDatasets(hourBuckets);
        syncTypeChart(counts);

        // clear the "awaiting feed" tags now that real data is flowing
        if (total > 0) {
            document.querySelectorAll('.dynatech-dashboard .dx-placeholder-tag').forEach(function (el) {
                el.style.display = 'none';
            });
        }
    }

    // "Fire 3 · Line Crossing 1" style sub-label under the Detections KPI (top 3 by count).
    function renderKpiBreakdown(counts) {
        var el = document.getElementById('dx-kpi-detections-sub');
        if (!el) return;
        var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 3);
        if (!keys.length) return;   // leave the placeholder tag as-is until data flows
        el.textContent = keys.map(function (k) { return REG.metaFor(k).label + ' ' + counts[k]; }).join(' · ');
    }

    // Mini per-type stat row under the analytics area (top 3 by count), colored per registry.
    function renderTypeTotals(counts) {
        var el = document.getElementById('dx-ai-type-totals');
        if (!el) return;
        var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 3);
        el.innerHTML = keys.map(function (k) {
            var meta = REG.metaFor(k);
            return '<div class="text-center">'
                 + '<div style="font-size:20px;font-weight:700;color:' + meta.color + '">' + counts[k] + '</div>'
                 + '<div class="dx-alert-time">' + escapeHtml(meta.label) + '</div>'
                 + '</div>';
        }).join('');
    }

    function hexToRgba(hex, a) {
        var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
        if (!m) return 'rgba(75,85,99,' + a + ')';
        return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')';
    }

    // Reuse existing datasets by label (stable, alphabetical order) so the 5s poll updates
    // in place instead of rebuilding — avoids legend/color flicker and re-animation.
    function syncEventsChartDatasets(hourBucketsByKey) {
        if (!dxState.eventsChart) return;
        var chart = dxState.eventsChart;
        var keys = Object.keys(hourBucketsByKey).sort();
        keys.forEach(function (key) {
            var meta = REG.metaFor(key);
            var existing = chart.data.datasets.filter(function (d) { return d.label === meta.label; })[0];
            if (existing) {
                existing.data = hourBucketsByKey[key];
            } else {
                chart.data.datasets.push({
                    label: meta.label, data: hourBucketsByKey[key],
                    borderColor: meta.color, backgroundColor: hexToRgba(meta.color, 0.12),
                    fill: true, pointRadius: 2, borderWidth: 2, lineTension: 0.35
                });
            }
        });
        chart.update();
    }

    function syncTypeChart(counts) {
        if (!dxState.typeChart) return;
        var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
        var chart = dxState.typeChart;
        chart.data.labels = keys.map(function (k) { return REG.metaFor(k).label; });
        chart.data.datasets[0].data = keys.map(function (k) { return counts[k]; });
        chart.data.datasets[0].backgroundColor = keys.map(function (k) { return REG.metaFor(k).color; });
        chart.update();
    }

    function formatClock(d) {
        var h = d.getHours(), m = d.getMinutes();
        var ap = h >= 12 ? 'PM' : 'AM';
        h = h % 12; if (h === 0) h = 12;
        return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
    }

    // Popup config derived on the fly from the registry for any reason key.
    function notifyConfigFor(key) {
        var meta = REG.metaFor(key);
        var sev = meta.severity;
        return {
            title: meta.label + ' Detected',
            verb: meta.label + ' on',
            type: sev === 'high' ? 'error' : (sev === 'medium' ? 'notice' : 'info'),
            icon: 'fa ' + meta.icon,
            addclass: 'dx-ev-pnotify dx-ev-pnotify-' + sev,
            severity: sev
        };
    }

    // Pop a notification for each NEW event of a reason key (newer than the last we alerted on).
    // On first load we baseline the newest ts per key WITHOUT popping (so we don't blast a stack
    // of historical popups) — only genuinely new events after arming pop.
    function notifyNewEvents(key, events) {
        if (!events || !events.length) return;
        var newestTs = Math.max.apply(null, events.map(function (e) { return e.ts; }));

        if (!dxState.notifyArmed || dxState.notifyBaseline[key] === undefined) {
            dxState.notifyBaseline[key] = newestTs;   // baseline; don't pop existing events
            return;
        }

        var baseline = dxState.notifyBaseline[key];
        var cfg = notifyConfigFor(key);
        var fresh = events.filter(function (e) { return e.ts > baseline; })
                          .sort(function (a, b) { return a.ts - b.ts; });
        fresh.forEach(function (e) { showEventPopup(cfg, e.camera, e.ts); });
        if (newestTs > baseline) dxState.notifyBaseline[key] = newestTs;
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
        // optional audible cue (high-severity only)
        try { if (window.dxAlertBeep && cfg.severity === 'high') window.dxAlertBeep(); } catch (e) {}
    }

    // ---- Recent Alerts (any AI event reason) ----
    // The real integration calls renderAlerts(events) with events shaped like:
    //   { key:'fire', reason:'Fire', camera:'CH1', time:'10:29 AM', severity:'high'|'medium'|'low' }
    // sourced from the events API. Keep this the single entry point.
    // No fabricated alerts. A security dashboard must never display events that did not
    // happen — the panel shows its empty state until real events arrive from the API.
    var DX_PLACEHOLDER_ALERTS = [];

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
            var meta = REG.metaFor(a.key || a.reason);
            var sev = sevCls[a.severity] || 'dx-sev-low';
            html += '<div class="dx-alert-item">'
                + '<div class="dx-alert-thumb"><i class="fa ' + meta.icon + '"></i></div>'
                + '<div class="dx-alert-body">'
                + '<div><span class="dx-alert-tag" style="background:' + meta.bg + ';color:' + meta.color + '">' + escapeHtml(meta.label) + '</span></div>'
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

    function start() {
        if (typeof Chart === 'undefined') { setTimeout(start, 250); return; }
        if (!document.getElementById('dx-region-chart')) { setTimeout(start, 250); return; }
        initGauges();
        bindFilterButtons();
        recomputeCounts();
        buildAiCharts();
        // Live snapshot refresh (near-live preview; monitor writes s.jpg ~1/sec)
        setInterval(refreshLiveSnapshots, 2000);

        // Empty state until the real events API responds (no fabricated data), then the
        // 5s poll fills the panel/KPI/charts with whatever detection types actually occur.
        renderAlerts(DX_PLACEHOLDER_ALERTS);
        setText('dx-kpi-detections', 0);
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
