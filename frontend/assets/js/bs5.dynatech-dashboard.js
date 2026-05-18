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
        document.getElementById('dx-count-active').textContent = active;
        document.getElementById('dx-count-inactive').textContent = inactive;
        document.getElementById('dx-count-error').textContent = error;
        document.getElementById('dx-pct-active').textContent = pct(active, total);
        document.getElementById('dx-pct-inactive').textContent = pct(inactive, total);
        document.getElementById('dx-pct-error').textContent = pct(error, total);
        document.getElementById('dx-region-total').textContent = 'Total ' + total;

        updateRegionChart(byRegion);
        renderCameraTable(data);
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
                document.getElementById('dx-cpu-pct').textContent = cpuP.toFixed(1) + '%';
                document.getElementById('dx-ram-pct').textContent = ramP.toFixed(1) + '%';
                if (d.ram && typeof d.ram.used !== 'undefined')
                    document.getElementById('dx-ram-used').textContent = parseFloat(d.ram.used).toFixed(0);
                break;
            case 'diskUsed':
                var used = parseFloat(d.size) || 0;
                var limit = parseFloat(d.limit) || 0;
                var diskP = limit ? (used / limit) * 100 : 0;
                setGauge(dxState.diskChart, diskP, colorForPercent(diskP));
                document.getElementById('dx-disk-pct').textContent = diskP.toFixed(1) + '%';
                document.getElementById('dx-disk-used').textContent = formatMB(used);
                document.getElementById('dx-disk-total').textContent = formatMB(limit);
                break;
            case 'monitor_status':
            case 'monitor_edit':
                setTimeout(recomputeCounts, 50);
                break;
        }
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
