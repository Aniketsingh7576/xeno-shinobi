(function () {
    if (window.dxBoxCountLoaded) return;
    window.dxBoxCountLoaded = true;

    var SNAPSHOT_REFRESH_MS = 5000;     // refresh static thumbnail every 5s
    var MOTION_STREAM_MS    = 8000;     // show live stream for 8s after motion event

    var dxBc = {
        tiles: [],            // [{slot, monitor, mediaEl, timer, motionTimer}]
        loadedMonitors: [],
        currentRows: [],
        filters: { camera: '', tag: '', region: '', time: '24', search: '' },
        page: 1,
        pageSize: 15
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
                // Drop the live stream / snapshot when closing
                var media = body.querySelector('img');
                if (media) media.remove();
                var cap = body.querySelector('.dx-modal-caption');
                if (cap) cap.remove();
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
        // Open a detection-row snapshot in the modal (larger view)
        document.addEventListener('click', function (e) {
            var thumb = e.target.closest('.dx-bc-thumb-clickable');
            if (!thumb) return;
            var cam = thumb.getAttribute('data-cam') || '';
            var old = body.querySelector('img'); if (old) old.remove();
            var oldCap = body.querySelector('.dx-modal-caption'); if (oldCap) oldCap.remove();
            var big = document.createElement('img');
            big.className = 'dx-tile-media';
            // open the stored snapshot the thumbnail is showing
            big.src = thumb.src;
            body.appendChild(big);
            if (cam) {
                var cap = document.createElement('div');
                cap.className = 'dx-modal-caption';
                cap.textContent = cam;
                body.appendChild(cap);
            }
            backdrop.classList.add('active');
        });
    }

    // ---------- Real detections (all AI event reasons) ----------
    // Shared registry maps any reason -> display meta (opaque, data-driven). Falls back to a
    // minimal inline shim if the registry script somehow didn't load.
    var REG = window.dxEventRegistry || {
        keyFor: function (r) { r = String(r || '').trim().toLowerCase().replace(/[^\w]+/g, '_'); return r || null; },
        isVisible: function (r) { return !!(r && String(r).trim()); },
        metaFor: function (r) { return { key: r || 'event', label: String(r || 'Event'), color: '#4b5563', bg: 'rgba(75,85,99,0.12)', icon: 'fa-bell', severity: 'medium' }; },
        severityFor: function (d, m) { return (d && d.severity) || (m && m.severity) || 'medium'; }
    };
    function eventKey(reason) {
        if (!REG.isVisible(reason)) return null;   // empty reason, or an ignored type (motion)
        return REG.keyFor(reason);
    }
    function monitorById(mid) {
        return (window.loadedMonitors && window.loadedMonitors[mid]) || null;
    }
    // URL of the STORED detection snapshot for this event — matched EXACTLY by the event's
    // unique name (snapshot saved as <name>.jpg). No live view, no time guessing.
    function storedSnapshotUrl(name) {
        if (!name) return '';
        return 'assets/snapshots/' + String(name).replace(/[^\w\-]/g, '_') + '.jpg';
    }
    // onerror handler (global, from inline HTML): no stored snapshot -> show a clean
    // "no image" placeholder instead of the live camera view.
    window.dxBcThumbFallback = function (imgEl) {
        imgEl.onerror = null;
        var cell = imgEl.parentNode;
        if (cell) cell.innerHTML = '<span class="dx-bc-nothumb" title="No snapshot stored"><i class="fa fa-image"></i></span>';
    };
    // Back-compat: live snapshot for a camera (no event time).
    function eventSnapshotUrl(mid) {
        return liveSnapshotUrl(mid);
    }
    // Fetch real AI detection events from Shinobi's events API (user auth = full access).
    function fetchDetections(cb) {
        if (typeof getApiPrefix !== 'function') { cb([]); return; }
        var now = new Date();
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        // pull a wide window (30 days); the time filter narrows it client-side
        var start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
        var fmt = function (d) {
            return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' +
                pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
        };
        var url = getApiPrefix('events') + '?start=' + fmt(start) + '&end=' + fmt(now) + '&limit=1000';
        $.getJSON(url).done(function (data) {
            var raw = Array.isArray(data) ? data : (data && data.events) || [];
            var rows = [];
            raw.forEach(function (ev) {
                var details = ev.details;
                if (typeof details === 'string') details = safeJsonParse(details, {});
                var reason = details && details.reason;
                var kind = eventKey(reason);
                if (!kind) return;                               // no reason, or ignored (motion)
                var m = monitorById(ev.mid);
                var host = m ? getMonHost(m) : '';
                rows.push({
                    kind: kind,                                  // opaque reason key
                    reason: reason,                              // raw reason (for display)
                    severity: REG.severityFor(details, REG.metaFor(kind)),
                    camName: (m && m.name) || ev.mid,
                    mid: ev.mid,
                    name: (details && details.name) || '',       // unique key -> snapshot file
                    ip: host || '-',
                    location: inferRegion(host),
                    conf: (details && details.confidence) || '',
                    time: ev.time ? new Date(ev.time.replace(' ', 'T') + 'Z') : new Date()
                });
            });
            cb(rows);
        }).fail(function () { cb([]); });
    }

    function applyFilters(rows) {
        var f = dxBc.filters;
        return rows.filter(function (r) {
            if (f.camera && r.camName !== f.camera) return false;
            if (f.tag && r.kind !== f.tag) return false;
            if (f.region && r.location !== f.region) return false;
            if (f.search) {
                var q = f.search.toLowerCase();
                if (
                    String(r.camName).toLowerCase().indexOf(q) === -1 &&
                    String(r.ip).toLowerCase().indexOf(q) === -1 &&
                    String(r.kind).toLowerCase().indexOf(q) === -1
                ) return false;
            }
            if (f.time) {
                var hours = parseFloat(f.time);
                if (Date.now() - r.time.getTime() > hours * 3600 * 1000) return false;
            }
            return true;
        });
    }

    function typeBadge(kind) {
        var meta = REG.metaFor(kind);
        return '<span class="badge" style="background:' + meta.bg + ';color:' + meta.color + ';font-weight:600;">'
             + '<i class="fa ' + meta.icon + '"></i> ' + escapeHtml(meta.label) + '</span>';
    }

    function setCount(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    // Per-type count tiles, data-driven from the filtered rows. Top 4 by count; the rest
    // aggregate into "Other". Renders into #dx-bc-type-counts (empty if the container is absent).
    function renderTypeCounts(rows) {
        var el = document.getElementById('dx-bc-type-counts');
        if (!el) return;
        var counts = {};
        rows.forEach(function (r) { counts[r.kind] = (counts[r.kind] || 0) + 1; });
        var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
        var top = keys.slice(0, 4);
        var otherTotal = keys.slice(4).reduce(function (sum, k) { return sum + counts[k]; }, 0);
        var html = top.map(function (k) {
            var meta = REG.metaFor(k);
            return '<div class="dx-bc-typecount"><span class="dx-bc-typecount-num" style="color:' + meta.color + '">' + counts[k] + '</span>'
                 + '<span class="dx-bc-typecount-lbl">' + escapeHtml(meta.label) + '</span></div>';
        }).join('');
        if (otherTotal > 0) {
            html += '<div class="dx-bc-typecount"><span class="dx-bc-typecount-num" style="color:#4b5563">' + otherTotal + '</span>'
                  + '<span class="dx-bc-typecount-lbl">Other</span></div>';
        }
        el.innerHTML = html;
    }

    function renderTable() {
        var allRows = dxBc.currentRows;
        var rows = applyFilters(allRows);
        // newest first
        rows.sort(function (a, b) { return b.time.getTime() - a.time.getTime(); });
        var tbody = document.querySelector('#dx-bc-table tbody');
        var empty = document.getElementById('dx-bc-empty');
        if (!tbody) return;

        // Header counts (from the full filtered set)
        setCount('dx-bc-total', rows.length);
        renderTypeCounts(rows);

        // Pagination
        var total = rows.length;
        var pageSize = dxBc.pageSize;
        var pageCount = Math.max(1, Math.ceil(total / pageSize));
        if (dxBc.page > pageCount) dxBc.page = pageCount;
        if (dxBc.page < 1) dxBc.page = 1;
        var startIdx = (dxBc.page - 1) * pageSize;
        var pageRows = rows.slice(startIdx, startIdx + pageSize);

        var html = '';
        pageRows.forEach(function (r, i) {
            var serial = startIdx + i + 1;
            var conf = r.conf !== '' && r.conf != null ? escapeHtml(String(r.conf)) + '%' : '-';
            html +=
                '<tr>' +
                '<td><strong>' + serial + '</strong></td>' +
                '<td>' + (r.name
                    ? '<img class="dx-bc-thumb dx-bc-thumb-clickable" ' +
                        'src="' + storedSnapshotUrl(r.name) + '" ' +
                        'data-cam="' + escapeHtml(r.camName) + '" ' +
                        'title="Click to open snapshot" alt="" ' +
                        'onerror="dxBcThumbFallback(this)">'
                    : '<span class="dx-bc-nothumb" title="No snapshot stored"><i class="fa fa-image"></i></span>'
                  ) + '</td>' +
                '<td>' + escapeHtml(r.camName) + '</td>' +
                '<td><code>' + escapeHtml(r.ip) + '</code></td>' +
                '<td>' + escapeHtml(r.location) + '</td>' +
                '<td>' + typeBadge(r.kind) + '</td>' +
                '<td>' + conf + '</td>' +
                '<td class="text-end text-muted">' + r.time.toLocaleString() + '</td>' +
                '</tr>';
        });
        tbody.innerHTML = html;
        if (empty) empty.style.display = total === 0 ? '' : 'none';

        // Pager controls
        var pager = document.getElementById('dx-bc-pager');
        if (pager) {
            pager.style.display = total > pageSize ? 'flex' : 'none';
            setCount('dx-bc-pageinfo',
                total === 0 ? '—'
                : 'Showing ' + (startIdx + 1) + '–' + Math.min(startIdx + pageSize, total) + ' of ' + total
                  + '  (page ' + dxBc.page + '/' + pageCount + ')');
            var prev = document.getElementById('dx-bc-prev');
            var next = document.getElementById('dx-bc-next');
            if (prev) prev.disabled = dxBc.page <= 1;
            if (next) next.disabled = dxBc.page >= pageCount;
        }
    }

    function populateFilterOptions() {
        var monitors = Object.values(window.loadedMonitors || {});
        var camSel = document.getElementById('dx-bc-filter-camera');
        var regionSel = document.getElementById('dx-bc-filter-region');
        var tagSel = document.getElementById('dx-bc-filter-tag');
        var regions = {};
        var camOpts = '<option value="">All Cameras</option>';
        monitors.forEach(function (m) {
            camOpts += '<option value="' + escapeHtml(m.name || m.mid) + '">' + escapeHtml(m.name || m.mid) + '</option>';
            regions[inferRegion(getMonHost(m))] = true;
        });
        // also include regions from the current detection rows
        dxBc.currentRows.forEach(function (r) { regions[r.location] = true; });
        if (camSel) camSel.innerHTML = camOpts;
        var regOpts = '<option value="">All Regions</option>';
        Object.keys(regions).forEach(function (r) { regOpts += '<option value="' + escapeHtml(r) + '">' + escapeHtml(r) + '</option>'; });
        if (regionSel) regionSel.innerHTML = regOpts;

        // Type filter: data-driven from the distinct reason keys actually present.
        // CRITICAL: preserve the user's current selection across the 5s poll rebuild.
        if (tagSel) {
            var prevTag = tagSel.value;
            var keys = {};
            dxBc.currentRows.forEach(function (r) { keys[r.kind] = true; });
            var sorted = Object.keys(keys).sort(function (a, b) {
                return REG.metaFor(a).label.localeCompare(REG.metaFor(b).label);
            });
            var tagOpts = '<option value="">All Types</option>';
            sorted.forEach(function (k) {
                tagOpts += '<option value="' + escapeHtml(k) + '">' + escapeHtml(REG.metaFor(k).label) + '</option>';
            });
            tagSel.innerHTML = tagOpts;
            // restore selection if it still exists; otherwise fall back to "All"
            if (prevTag && keys[prevTag]) {
                tagSel.value = prevTag;
            } else if (prevTag) {
                tagSel.value = '';
                dxBc.filters.tag = '';
            }
        }
    }

    function bindFilters() {
        ['camera', 'tag', 'region', 'time'].forEach(function (k) {
            var el = document.getElementById('dx-bc-filter-' + k);
            if (el) el.addEventListener('change', function () {
                dxBc.filters[k] = el.value;
                dxBc.page = 1;        // reset to first page when filters change
                renderTable();
            });
        });
        var search = document.getElementById('dx-bc-search');
        if (search) search.addEventListener('input', function () {
            dxBc.filters.search = search.value;
            dxBc.page = 1;
            renderTable();
        });
    }

    function bindPager() {
        var prev = document.getElementById('dx-bc-prev');
        var next = document.getElementById('dx-bc-next');
        if (prev) prev.addEventListener('click', function () { dxBc.page--; renderTable(); });
        if (next) next.addEventListener('click', function () { dxBc.page++; renderTable(); });
    }

    // ---------- Socket / motion hook ----------
    function handleEvent(d) {
        if (!d) return;
        if (d.f === 'monitor_status' || d.f === 'monitor_edit' || d.f === 'init_success') {
            // monitor list may have changed
            setTimeout(function () {
                renderTiles();
                populateFilterOptions();
                // re-render so the table stays consistent if the type filter was reset above
                renderTable();
            }, 50);
        }
        // Shinobi motion / detector events: f may be 'trigger', or via 'detector_trigger' channel
        if (d.f === 'trigger' || d.f === 'detector_trigger' || d.f === 'motion') {
            if (d.id || d.mid) flashMotion(d.id || d.mid);
        }
    }

    function reloadDetections() {
        fetchDetections(function (rows) {
            dxBc.currentRows = rows;
            populateFilterOptions();
            renderTable();
        });
    }

    // ---------- Tab-open lifecycle ----------
    function start() {
        renderTiles();
        bindModal();
        bindFilters();
        bindPager();
        dxBc.currentRows = [];
        renderTable();
        reloadDetections();
        setInterval(reloadDetections, 5000);   // keep the page live
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
