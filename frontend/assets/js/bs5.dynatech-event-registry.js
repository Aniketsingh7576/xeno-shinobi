/*
 * Shared event-type registry for the generic VMS dashboard.
 *
 * The VMS core is detection-agnostic: an AI service posts events via the /motion
 * route carrying an opaque `reason` label (e.g. "Fire", "Intrusion", "PPE_NoHelmet").
 * This registry is the SINGLE place that maps a reason -> {label,color,icon,severity}
 * for display. Unknown reasons get a neutral default, so any new AI service renders
 * without touching the dashboard code. Known reasons are seeded so existing
 * deployments look identical to before.
 *
 * Consumers: bs5.dynatech-dashboard.js, bs5.dynatech-boxcount.js
 * Load order: this script MUST be included BEFORE both consumers.
 */
(function () {
    if (window.dxEventRegistry) return;

    // Reasons that are NOT surfaced as AI detections in the UI. Shinobi's built-in
    // motion detector writes reason "motion"; on a busy camera that floods the panel
    // and is not a meaningful security alert, so it is hidden by default.
    // (Kept as a list so a deployment can adjust what counts as an "alert".)
    var IGNORED_KEYS = { motion: true };

    // Seeded known types — keeps current fire/line-crossing deployments pixel-identical.
    // Any reason not listed here falls through to NEUTRAL.
    var REGISTRY = {
        fire:  { label: 'Fire',          color: '#dc2626', bg: 'rgba(220,38,38,0.12)',  icon: 'fa-fire',     severity: 'high'   },
        smoke: { label: 'Smoke',         color: '#ea580c', bg: 'rgba(234,88,12,0.12)',  icon: 'fa-fire',     severity: 'high'   },
        linex: { label: 'Line Crossing', color: '#d97706', bg: 'rgba(217,119,6,0.12)',  icon: 'fa-exchange', severity: 'medium' }
    };

    // Legacy alias map: older code + the camera-AI adapters emit these raw reasons.
    // We fold them onto the seeded keys so historic events still render as before.
    var ALIASES = {
        linecrossing: 'linex',
        line_crossing: 'linex',
        'line crossing': 'linex'
    };

    var NEUTRAL = { color: '#4b5563', bg: 'rgba(75,85,99,0.12)', icon: 'fa-bell', severity: 'medium' };

    // Turn any reason string into an opaque, safe key: lowercased, non-word runs -> "_".
    function keyFor(reason) {
        var r = String(reason == null ? '' : reason).trim().toLowerCase();
        if (!r) return null;                          // no reason => not an AI detection
        var k = r.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '');
        if (ALIASES[r]) return ALIASES[r];
        if (ALIASES[k]) return ALIASES[k];
        return k || null;
    }

    // True if this reason should be shown as an alert/detection at all.
    function isVisible(reason) {
        var k = keyFor(reason);
        return !!k && !IGNORED_KEYS[k];
    }

    // Build a readable label from an unknown key: "ppe_nohelmet" -> "Ppe Nohelmet".
    function humanize(key) {
        return String(key || '')
            .split('_')
            .filter(Boolean)
            .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
            .join(' ') || 'Event';
    }

    // Full display metadata for a reason (or an already-computed key).
    function metaFor(reasonOrKey) {
        var key = (reasonOrKey && REGISTRY[reasonOrKey]) ? reasonOrKey : keyFor(reasonOrKey);
        var base = key && REGISTRY[key];
        if (base) {
            return {
                key: key, label: base.label, color: base.color,
                bg: base.bg, icon: base.icon, severity: base.severity
            };
        }
        return {
            key: key || 'event', label: humanize(key),
            color: NEUTRAL.color, bg: NEUTRAL.bg, icon: NEUTRAL.icon, severity: NEUTRAL.severity
        };
    }

    // Severity comes from the event payload first (the AI service decides), and only
    // falls back to the registry default. Never derived from a hardcoded type check.
    function severityFor(details, meta) {
        var s = details && details.severity;
        s = String(s == null ? '' : s).toLowerCase();
        if (s === 'high' || s === 'medium' || s === 'low') return s;
        return (meta && meta.severity) || 'medium';
    }

    window.dxEventRegistry = {
        keyFor: keyFor,
        isVisible: isVisible,
        metaFor: metaFor,
        severityFor: severityFor,
        // exposed so a deployment/integration can register a new type at runtime
        register: function (key, meta) { if (key) REGISTRY[keyFor(key)] = meta; },
        ignore: function (key) { var k = keyFor(key); if (k) IGNORED_KEYS[k] = true; }
    };
})();
