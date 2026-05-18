(function () {
    if (window.dxBoxCountLoaded) return;
    window.dxBoxCountLoaded = true;

    var SNAPSHOT_REFRESH_MS = 5000;     // refresh static thumbnail every 5s
    var MOTION_STREAM_MS    = 8000;     // show live stream for 8s after motion event

    var dxBc = {
        tiles: [],            // [{slot, monitor, mediaEl, timer, motionTimer}]
        loadedMonitors: [],
        currentRows: [],
        filters: { camera: '', tag: '', region: '', time: '24', search: '' }
    };

    // ---------- Helpers ----------
    function safeJsonParse(s, fallback) {
        if (typeof s !== 'string') return s || fallback;
        try { return JSON.parse(s); } catch (e) { return fallback; }
    }
    function getMonHost(m) {
        var d = m.details;
        if (typeof d === 'string') d = safeJsonParse(d, {});
        return (d && d.host) || m.host || '';
    }
    function inferRegion(host) {
        if (!host) return 'Unknown';
        var m = String(host).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\./);
        if (!m) return host;
        var a = parseInt(m[1], 10);
        if (a === 192) return 'Switch ' + m[3];
        return 'Switch ' + m[1] + '.' + m[2] + '.' + m[3];
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function snapshotUrl(monitor) {
        // Shinobi JPEG snapshot endpoint
        return getApiPrefix('jpeg') + '/' + monitor.mid + '/s.jpg?_=' + Date.now();
    }
    function mjpegUrl(monitor) {
        return getApiPrefix('mjpeg') + '/' + monitor.mid + '?_=' + Date.now();
    }

    // ---------- Tile management ----------
    function pickFiveMonitors() {
        var all = Object.values(window.loadedMonitors || {});
        return all.slice(0, 5);
    }
    function renderTiles() {
        var monitors = pickFiveMonitors();
        var slots = document.querySelectorAll('#dx-bc-tiles .dx-tile');
        slots.forEach(function (slotEl, i) {
            var m = monitors[i];
            // Tear down any previous timers on this slot
            var prev = dxBc.tiles[i];
            if (prev) {
                if (prev.refreshTimer) clearInterval(prev.refreshTimer);
                if (prev.motionTimer) clearTimeout(prev.motionTimer);
            }
            slotEl.innerHTML = '';
            slotEl.classList.remove('dx-empty', 'dx-motion');

            if (!m) {
                slotEl.classList.add('dx-empty');
                slotEl.textContent = 'No camera in slot ' + (i + 1);
                dxBc.tiles[i] = null;
                return;
            }

            // Build static snapshot tile
            var img = document.createElement('img');
            img.src = snapshotUrl(m);
            img.alt = m.name || '';
            img.onerror = function () {
                // No snapshot yet — show placeholder
                slotEl.classList.add('dx-empty');
                slotEl.innerHTML = '<div>' + escapeHtml(m.name || '(camera ' + m.mid + ')') + '<br><small>No preview</small></div>';
            };

            var overlay = document.createElement('div');
            overlay.className = 'dx-tile-overlay';
            overlay.innerHTML =
                '<span>' + escapeHtml(m.name || m.mid) + '</span>' +
                '<span class="opacity-75">' + escapeHtml(getMonHost(m) || '') + '</span>';

            var badge = document.createElement('div');
            badge.className = 'dx-motion-badge';
            badge.innerHTML = '<i class="fa fa-circle"></i> MOTION';

            slotEl.appendChild(img);
            slotEl.appendChild(overlay);
            slotEl.appendChild(badge);

            // Periodic snapshot refresh
            var refreshTimer = setInterval(function () {
                if (!slotEl.classList.contains('dx-motion')) {
                    img.src = snapshotUrl(m);
                }
            }, SNAPSHOT_REFRESH_MS);

            dxBc.tiles[i] = { slot: i, monitor: m, mediaEl: img, refreshTimer: refreshTimer, motionTimer: null };
        });
    }

    function flashMotion(monitorId) {
        // Find which tile matches this monitor
        dxBc.tiles.forEach(function (t) {
            if (!t || !t.monitor || t.monitor.mid !== monitorId) return;
            var slotEl = document.querySelector('#dx-bc-tiles .dx-tile[data-slot="' + t.slot + '"]');
            if (!slotEl) return;
            slotEl.classList.add('dx-motion');
            // Swap to live mjpeg
            t.mediaEl.src = mjpegUrl(t.monitor);
            if (t.motionTimer) clearTimeout(t.motionTimer);
            t.motionTimer = setTimeout(function () {
                slotEl.classList.remove('dx-motion');
                t.mediaEl.src = snapshotUrl(t.monitor);
            }, MOTION_STREAM_MS);
        });
    }

    // ---------- Modal ----------
    function bindModal() {
        var backdrop = document.getElementById('dx-tile-modal');
        var body = document.getElementById('dx-tile-modal-body');
        if (!backdrop) return;
        backdrop.addEventListener('click', function (e) {
            if (e.target === backdrop || e.target.classList.contains('dx-close-btn')) {
                backdrop.classList.remove('active');
                // Drop the live stream when closing
                var media = body.querySelector('img');
                if (media) media.remove();
            }
        });
        document.addEventListener('click', function (e) {
            var tile = e.target.closest('#dx-bc-tiles .dx-tile');
            if (!tile || tile.classList.contains('dx-empty')) return;
            var slotIdx = parseInt(tile.getAttribute('data-slot'), 10);
            var t = dxBc.tiles[slotIdx];
            if (!t) return;
            // Reuse modal body, append a live mjpeg
            var old = body.querySelector('img'); if (old) old.remove();
            var live = document.createElement('img');
            live.className = 'dx-tile-media';
            live.src = mjpegUrl(t.monitor);
            body.appendChild(live);
            backdrop.classList.add('active');
        });
    }

    // ---------- Table ----------
    function buildMockRows() {
        // No object-detection plugin installed yet, so no real rows to show.
        // When a detector is wired up (e.g. TensorFlow COCO-SSD plugin), swap this
        // for a getEvents() call that returns the real Events from the DB.
        return [];
    }

    function applyFilters(rows) {
        var f = dxBc.filters;
        return rows.filter(function (r) {
            if (f.camera && r.camName !== f.camera) return false;
            if (f.tag && r.tag !== f.tag) return false;
            if (f.region && r.location !== f.region) return false;
            if (f.search) {
                var q = f.search.toLowerCase();
                if (
                    String(r.camName).toLowerCase().indexOf(q) === -1 &&
                    String(r.ip).toLowerCase().indexOf(q) === -1 &&
                    String(r.tag).toLowerCase().indexOf(q) === -1
                ) return false;
            }
            if (f.time) {
                var hours = parseFloat(f.time);
                if (Date.now() - r.time.getTime() > hours * 3600 * 1000) return false;
            }
            return true;
        });
    }

    function tagBadge(tag) {
        var palette = {
            person: ['#dbeafe', '#1e40af'],
            car: ['#dcfce7', '#166534'],
            bicycle: ['#fef3c7', '#92400e'],
            dog: ['#fce7f3', '#9d174d'],
            unknown: ['#e2e8f0', '#475569']
        };
        var c = palette[tag] || palette.unknown;
        return '<span class="badge" style="background:' + c[0] + ';color:' + c[1] + ';font-weight:600;">' + escapeHtml(tag) + '</span>';
    }

    function renderTable() {
        var allRows = dxBc.currentRows;
        var rows = applyFilters(allRows);
        var tbody = document.querySelector('#dx-bc-table tbody');
        var empty = document.getElementById('dx-bc-empty');
        if (!tbody) return;

        document.getElementById('dx-bc-total').textContent = rows.length;
        var unid = rows.filter(function (r) { return r.tag === 'unknown'; }).length;
        document.getElementById('dx-bc-unidentified').textContent = unid;

        var html = '';
        rows.forEach(function (r, idx) {
            html +=
                '<tr>' +
                '<td><strong>' + (idx + 1) + '</strong></td>' +
                '<td>' + escapeHtml(r.camName) + '</td>' +
                '<td><code>' + escapeHtml(r.ip) + '</code></td>' +
                '<td>' + escapeHtml(r.location) + '</td>' +
                '<td>' + tagBadge(r.tag) + '</td>' +
                '<td>' + r.w + ' &times; ' + r.h + ' px</td>' +
                '<td class="text-end text-muted">' + r.time.toLocaleString() + '</td>' +
                '</tr>';
        });
        tbody.innerHTML = html;
        if (empty) empty.style.display = rows.length === 0 ? '' : 'none';
    }

    function populateFilterOptions() {
        var monitors = Object.values(window.loadedMonitors || {});
        var camSel = document.getElementById('dx-bc-filter-camera');
        var regionSel = document.getElementById('dx-bc-filter-region');
        var regions = {};
        var camOpts = '<option value="">All Cameras</option>';
        monitors.forEach(function (m) {
            camOpts += '<option value="' + escapeHtml(m.name || m.mid) + '">' + escapeHtml(m.name || m.mid) + '</option>';
            regions[inferRegion(getMonHost(m))] = true;
        });
        // also include synthetic regions from mock rows if no monitors yet
        dxBc.currentRows.forEach(function (r) { regions[r.location] = true; });
        camSel.innerHTML = camOpts;
        var regOpts = '<option value="">All Regions</option>';
        Object.keys(regions).forEach(function (r) { regOpts += '<option value="' + escapeHtml(r) + '">' + escapeHtml(r) + '</option>'; });
        regionSel.innerHTML = regOpts;
    }

    function bindFilters() {
        ['camera', 'tag', 'region', 'time'].forEach(function (k) {
            var el = document.getElementById('dx-bc-filter-' + k);
            if (el) el.addEventListener('change', function () {
                dxBc.filters[k] = el.value;
                renderTable();
            });
        });
        var search = document.getElementById('dx-bc-search');
        if (search) search.addEventListener('input', function () {
            dxBc.filters.search = search.value;
            renderTable();
        });
    }

    // ---------- Socket / motion hook ----------
    function handleEvent(d) {
        if (!d) return;
        if (d.f === 'monitor_status' || d.f === 'monitor_edit' || d.f === 'init_success') {
            // monitor list may have changed
            setTimeout(function () {
                renderTiles();
                populateFilterOptions();
            }, 50);
        }
        // Shinobi motion / detector events: f may be 'trigger', or via 'detector_trigger' channel
        if (d.f === 'trigger' || d.f === 'detector_trigger' || d.f === 'motion') {
            if (d.id || d.mid) flashMotion(d.id || d.mid);
        }
    }

    // ---------- Tab-open lifecycle ----------
    function start() {
        renderTiles();
        bindModal();
        bindFilters();
        dxBc.currentRows = buildMockRows();
        populateFilterOptions();
        renderTable();
        if (typeof onWebSocketEvent === 'function') {
            onWebSocketEvent(handleEvent);
        }
    }

    function lazyStart() {
        if (!document.getElementById('dx-bc-tiles')) { setTimeout(lazyStart, 250); return; }
        start();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', lazyStart);
    } else {
        lazyStart();
    }
})();
