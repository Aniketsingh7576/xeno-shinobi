(function () {
    if (window.dxFloorPlanLoaded) return;
    window.dxFloorPlanLoaded = true;

    var GEO_PREFIX = 'floorplan:'; // marker so we know geolocation is a floor-plan coord, not a real lat/lng
    var STORAGE_KEY = 'dxFloorPlanActive';

    var state = {
        editMode: false,
        activePlan: '',
        plans: [],
        // ke for our group (filled after start)
        ke: null,
    };

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function apiBase() {
        return getApiPrefix() + '/floorplans/' + state.ke;
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function mjpegUrl(monitorId) {
        return getApiPrefix('mjpeg') + '/' + monitorId + '?_=' + Date.now();
    }

    // Parse a monitor's geolocation. Returns { plan, x, y } if it's a floor-plan coord, or null otherwise.
    function parseMonitorPosition(monitor) {
        var geo = monitor && monitor.details && monitor.details.geolocation;
        if (!geo || typeof geo !== 'string' || geo.indexOf(GEO_PREFIX) !== 0) return null;
        var body = geo.slice(GEO_PREFIX.length); // "<plan>|<x>|<y>"
        var parts = body.split('|');
        if (parts.length < 3) return null;
        var x = parseFloat(parts[1]);
        var y = parseFloat(parts[2]);
        if (isNaN(x) || isNaN(y)) return null;
        return { plan: parts[0], x: x, y: y };
    }
    function formatMonitorPosition(planName, xPct, yPct) {
        return GEO_PREFIX + planName + '|' + xPct.toFixed(2) + '|' + yPct.toFixed(2);
    }

    // ------ API calls ------
    function listPlans() {
        return fetch(apiBase()).then(r => r.json());
    }
    function uploadPlan(file) {
        var fd = new FormData();
        fd.append('plan', file);
        return fetch(apiBase(), { method: 'POST', body: fd }).then(r => r.json());
    }
    function deletePlan(name) {
        return fetch(apiBase() + '/' + encodeURIComponent(name), { method: 'DELETE' }).then(r => r.json());
    }
    function saveMonitorPosition(monitor, planName, xPct, yPct) {
        // Reuse the existing configureMonitor() helper. We only need to send a minimal payload.
        // configureMonitor sends f:'addOrEditMonitor' which UPDATEs the row.
        var clone = Object.assign({}, monitor);
        clone.details = Object.assign({}, monitor.details || {});
        clone.details.geolocation = formatMonitorPosition(planName, xPct, yPct);
        return configureMonitor(clone);
    }
    function clearMonitorPosition(monitor) {
        var clone = Object.assign({}, monitor);
        clone.details = Object.assign({}, monitor.details || {});
        clone.details.geolocation = '';
        return configureMonitor(clone);
    }

    // ------ Render ------
    function updateUploadEnabledState() {
        var delBtn = $('#dx-fp-delete');
        if (delBtn) delBtn.disabled = !state.activePlan;
    }

    function refreshPlanList() {
        return listPlans().then(function(d) {
            state.plans = (d && d.files) || [];
            var sel = $('#dx-fp-select');
            sel.innerHTML = '<option value="">-- No floor plan loaded --</option>' +
                state.plans.map(function(f) {
                    return '<option value="' + escapeHtml(f) + '"' + (f === state.activePlan ? ' selected' : '') + '>' + escapeHtml(f) + '</option>';
                }).join('');
            updateUploadEnabledState();
        });
    }

    function setActivePlan(name) {
        state.activePlan = name || '';
        try { localStorage.setItem(STORAGE_KEY, state.activePlan); } catch (e) {}
        var img = $('#dx-fp-image');
        var empty = $('#dx-fp-empty-state');
        var pins = $('#dx-fp-pins');
        if (state.activePlan) {
            img.src = window.libURL + 'assets/floorplans/' + state.activePlan + '?_=' + Date.now();
            img.style.display = 'block';
            empty.style.display = 'none';
            pins.style.display = 'block';
            img.onload = function() { renderPins(); renderUnplacedList(); };
        } else {
            img.removeAttribute('src');
            img.style.display = 'none';
            empty.style.display = '';
            pins.style.display = 'none';
            pins.innerHTML = '';
        }
        updateUploadEnabledState();
        if (state.activePlan) { renderPins(); renderUnplacedList(); }
    }

    function getMonitorsOnActivePlan() {
        var placed = [];
        var unplaced = [];
        Object.values(window.loadedMonitors || {}).forEach(function(m) {
            var pos = parseMonitorPosition(m);
            if (pos && pos.plan === state.activePlan) placed.push({m: m, pos: pos});
            else unplaced.push(m);
        });
        return { placed: placed, unplaced: unplaced };
    }

    function renderPins() {
        var pinsEl = $('#dx-fp-pins');
        if (!pinsEl || !state.activePlan) return;
        var { placed } = getMonitorsOnActivePlan();
        pinsEl.innerHTML = placed.map(function(p) {
            var statusClass = 'dx-fp-pin-online';
            var code = parseInt(p.m.code, 10);
            if (code === 5 || code === 7) statusClass = 'dx-fp-pin-offline';
            return '<div class="dx-fp-pin ' + statusClass + '" data-mid="' + p.m.mid + '"' +
                   ' style="left: ' + p.pos.x + '%; top: ' + p.pos.y + '%;"' +
                   ' title="' + escapeHtml(p.m.name || p.m.mid) + '">' +
                   '<i class="fa fa-video-camera"></i>' +
                   '<span class="dx-fp-pin-label">' + escapeHtml(p.m.name || p.m.mid) + '</span>' +
                   '</div>';
        }).join('');
        bindPinInteractions();
    }

    function renderUnplacedList() {
        var listEl = $('#dx-fp-unplaced-list');
        var emptyEl = $('#dx-fp-unplaced-empty');
        var countEl = $('#dx-fp-unplaced-count');
        if (!listEl) return;
        var { unplaced } = getMonitorsOnActivePlan();
        countEl.textContent = unplaced.length;
        if (unplaced.length === 0) {
            listEl.innerHTML = '';
            emptyEl.style.display = '';
            return;
        }
        emptyEl.style.display = 'none';
        listEl.innerHTML = unplaced.map(function(m) {
            var host = (m.details && m.details.host) || m.host || '';
            return '<div class="dx-fp-unplaced-item" draggable="true" data-mid="' + m.mid + '">' +
                   '<i class="fa fa-video-camera me-2"></i>' +
                   '<strong>' + escapeHtml(m.name || m.mid) + '</strong>' +
                   '<div class="small text-muted">' + escapeHtml(host) + '</div>' +
                   '</div>';
        }).join('');
        bindDragSources();
    }

    // ------ Drag and drop ------
    var draggingMid = null;
    function bindDragSources() {
        $$('.dx-fp-unplaced-item').forEach(function(item) {
            item.addEventListener('dragstart', function(e) {
                draggingMid = item.getAttribute('data-mid');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', draggingMid);
                item.classList.add('dx-fp-dragging');
            });
            item.addEventListener('dragend', function() {
                draggingMid = null;
                item.classList.remove('dx-fp-dragging');
            });
        });
    }

    function bindStageDropTarget() {
        var stage = $('#dx-fp-stage');
        if (!stage) return;
        stage.addEventListener('dragover', function(e) {
            if (!state.editMode || !state.activePlan) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        stage.addEventListener('drop', function(e) {
            if (!state.editMode || !state.activePlan) return;
            e.preventDefault();
            var mid = e.dataTransfer.getData('text/plain') || draggingMid;
            if (!mid) return;
            var monitor = (window.loadedMonitors || {})[mid];
            if (!monitor) return;
            var rect = $('#dx-fp-image').getBoundingClientRect();
            var x = ((e.clientX - rect.left) / rect.width) * 100;
            var y = ((e.clientY - rect.top) / rect.height) * 100;
            x = Math.max(0, Math.min(100, x));
            y = Math.max(0, Math.min(100, y));
            saveMonitorPosition(monitor, state.activePlan, x, y).then(function() {
                renderPins();
                renderUnplacedList();
            });
        });
    }

    function bindPinInteractions() {
        $$('.dx-fp-pin').forEach(function(pin) {
            var mid = pin.getAttribute('data-mid');

            // Click in view mode = open preview. In edit mode = ignore (drag instead).
            pin.addEventListener('click', function(e) {
                if (state.editMode) return; // drag in edit mode
                e.stopPropagation();
                openPreview(mid);
            });

            // Right-click in edit mode = remove from plan
            pin.addEventListener('contextmenu', function(e) {
                if (!state.editMode) return;
                e.preventDefault();
                if (!confirm('Remove this camera from the floor plan?')) return;
                var monitor = (window.loadedMonitors || {})[mid];
                if (!monitor) return;
                clearMonitorPosition(monitor).then(function() {
                    renderPins();
                    renderUnplacedList();
                });
            });

            // Edit mode: drag pin to reposition
            if (state.editMode) {
                pin.style.cursor = 'move';
                var isDragging = false;
                var startedAt = null;
                pin.addEventListener('mousedown', function(downEv) {
                    if (downEv.button !== 0) return; // left button only
                    downEv.preventDefault();
                    isDragging = true;
                    startedAt = { x: downEv.clientX, y: downEv.clientY };
                    var img = $('#dx-fp-image');
                    function onMove(mvEv) {
                        if (!isDragging) return;
                        var rect = img.getBoundingClientRect();
                        var x = ((mvEv.clientX - rect.left) / rect.width) * 100;
                        var y = ((mvEv.clientY - rect.top) / rect.height) * 100;
                        x = Math.max(0, Math.min(100, x));
                        y = Math.max(0, Math.min(100, y));
                        pin.style.left = x + '%';
                        pin.style.top = y + '%';
                    }
                    function onUp(upEv) {
                        if (!isDragging) return;
                        isDragging = false;
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                        var moved = Math.abs(upEv.clientX - startedAt.x) > 3 || Math.abs(upEv.clientY - startedAt.y) > 3;
                        if (!moved) return; // treat as click; do nothing in edit mode
                        var rect = img.getBoundingClientRect();
                        var x = ((upEv.clientX - rect.left) / rect.width) * 100;
                        var y = ((upEv.clientY - rect.top) / rect.height) * 100;
                        x = Math.max(0, Math.min(100, x));
                        y = Math.max(0, Math.min(100, y));
                        var monitor = (window.loadedMonitors || {})[mid];
                        if (monitor) saveMonitorPosition(monitor, state.activePlan, x, y);
                    }
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            }
        });
    }

    function openPreview(mid) {
        var monitor = (window.loadedMonitors || {})[mid];
        if (!monitor) return;
        var backdrop = $('#dx-fp-preview-modal');
        var body = $('#dx-fp-preview-body');
        var old = body.querySelector('img'); if (old) old.remove();
        var live = document.createElement('img');
        live.className = 'dx-tile-media';
        live.src = mjpegUrl(mid);
        body.appendChild(live);
        backdrop.classList.add('active');
    }

    function bindPreviewModalClose() {
        var backdrop = $('#dx-fp-preview-modal');
        var body = $('#dx-fp-preview-body');
        if (!backdrop) return;
        backdrop.addEventListener('click', function(e) {
            if (e.target === backdrop || e.target.classList.contains('dx-close-btn')) {
                backdrop.classList.remove('active');
                var media = body.querySelector('img');
                if (media) media.remove();
            }
        });
    }

    // ------ Wire up controls ------
    function bindControls() {
        $('#dx-fp-select').addEventListener('change', function(e) {
            setActivePlan(e.target.value);
        });
        $('#dx-fp-upload').addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (!file) return;
            uploadPlan(file).then(function(d) {
                if (d && d.ok) {
                    refreshPlanList().then(function() {
                        setActivePlan(d.file);
                        $('#dx-fp-select').value = d.file;
                    });
                } else {
                    alert('Upload failed: ' + (d && d.msg ? d.msg : 'unknown error'));
                }
                e.target.value = '';
            });
        });
        $('#dx-fp-delete').addEventListener('click', function() {
            if (!state.activePlan) return;
            if (!confirm('Delete floor plan "' + state.activePlan + '"? Cameras placed on it will become unplaced.')) return;
            deletePlan(state.activePlan).then(function(d) {
                if (d && d.ok) {
                    setActivePlan('');
                    refreshPlanList();
                } else {
                    alert('Delete failed: ' + (d && d.msg ? d.msg : 'unknown error'));
                }
            });
        });
        $('#dx-fp-toggle-edit').addEventListener('click', function() {
            state.editMode = !state.editMode;
            applyEditMode();
        });
    }

    function applyEditMode() {
        var btn = $('#dx-fp-toggle-edit');
        var sidebar = $('#dx-fp-sidebar');
        if (state.editMode) {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-success');
            btn.innerHTML = '<i class="fa fa-check"></i> Done Editing';
            sidebar.style.display = '';
        } else {
            btn.classList.remove('btn-success');
            btn.classList.add('btn-primary');
            btn.innerHTML = '<i class="fa fa-pencil"></i> Edit Mode';
            sidebar.style.display = 'none';
        }
        renderPins();
        renderUnplacedList();
    }

    function detectGroupKey() {
        try { return ($user && $user.ke) || (window.$user && window.$user.ke); } catch (e) { return null; }
    }

    function start() {
        state.ke = detectGroupKey();
        if (!state.ke) { console.warn('FloorPlan: no group key'); return; }
        bindControls();
        bindStageDropTarget();
        bindPreviewModalClose();
        // Restore last-used plan from localStorage
        try { state.activePlan = localStorage.getItem(STORAGE_KEY) || ''; } catch (e) {}
        refreshPlanList().then(function() {
            if (state.activePlan && state.plans.indexOf(state.activePlan) === -1) state.activePlan = '';
            setActivePlan(state.activePlan);
        });
        applyEditMode();
        // Refresh pins when monitor list changes
        if (typeof onWebSocketEvent === 'function') {
            onWebSocketEvent(function(d){
                if (!d) return;
                if (d.f === 'monitor_edit' || d.f === 'monitor_status' || d.f === 'init_success') {
                    setTimeout(function(){ renderPins(); renderUnplacedList(); }, 80);
                }
            });
        }
    }

    if (typeof addOnTabOpen === 'function') {
        addOnTabOpen('monitorMap', function() {
            if (!state.ke) start();
            else { renderPins(); renderUnplacedList(); }
        });
        // Initial wire on DOM ready
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
        else start();
    } else {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
        else start();
    }
})();
