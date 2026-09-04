# Camera limit and licence behaviour — where it lives, when it fires, what it does

Investigation for a ~100-camera on-premise deployment on an **air-gapped Windows
server**. Read-only: no code was changed, and nothing in this document is a
workaround.

**How this was established.** Most of the enforcement is plain source and is cited
by file and line. The licence check itself lives in
[backend/libs/checker/actCheck.js](backend/libs/checker/actCheck.js), which is a
single 65 KB obfuscated line, so its behaviour was established by loading it in a
throwaway sandbox with `require` intercepted — the network stubbed out and asserting
if anything tried to reach the internet, `child_process` stubbed, and `s` / `config` /
the licence response wrapped in Proxies that record every property read and write.
**No real network request was made at any point.** Where a claim comes from that
observation rather than from readable source it is marked *(observed)*.

Anything I could not establish is marked **unknown** rather than guessed.

---

## TL;DR — the six things that matter for this deployment

1. The default limit is **15 cameras**, set unconditionally when the module loads.
2. It counts **monitors that exist**, not streams. Watch-Only counts. Disabled counts.
3. It is checked in exactly **two places**: when you create a monitor, and once when
   the process starts. Nothing checks it while a stream is running.
4. The licence check **fails closed** with **no grace period and no cache**. Air-gapped
   means unactivated, every boot, forever.
5. On a restart with more cameras configured than the limit allows, the extra cameras
   are **silently dropped** — no error, no log line, nothing. This is the one that will
   bite you at 3am after a Windows Update reboot.
6. There is an **offline licence format** that validates locally with no network. That
   is the only viable path to 100 cameras at this site, and you have to get one from
   Shinobi Systems.

---

## 1. What the limit actually counts

There are **two independent limits**. They are checked together and only one of them
is the licence.

### Limit A — the global licence ceiling, `s.cameraCount`

[backend/libs/checker/utils.js:11-24](backend/libs/checker/utils.js#L11-L24):

```js
function canAddMoreMonitors() {
    const cameraCountChecks = [
        { kind: 'ec2',           maxCameras: 2,              condition: config.isEC2 },
        { kind: 'highCoreCount', maxCameras: 50,             condition: config.isHighCoreCount },
        { kind: 'default',       maxCameras: s.cameraCount,  condition: true },
    ];
    const monitorCountOnSystem = getTotalMonitorCount();
    for (const check of cameraCountChecks) {
        if (check.condition && monitorCountOnSystem >= check.maxCameras) return false;
    }
    return true;
}
```

`getTotalMonitorCount()` (lines 25-36) sums `Object.keys(s.group[ke].rawMonitorConfigurations).length`
across **every** group.

So it counts **monitor configurations that exist in memory** — one per row in the
`Monitors` table that was loaded at boot. It is not counting streams, not counting
ffmpeg processes, and not counting recording monitors.

| Question | Answer |
|---|---|
| Monitors created? | **Yes — this is what it counts** |
| Monitors in Record mode? | No, mode is irrelevant |
| Monitors actively streaming? | No |
| Concurrent ffmpeg processes? | No |
| Does a Watch-Only monitor count? | **Yes** |
| Does a disabled / stopped (`mode: 'stop'`) monitor count? | **Yes** |
| Is it global or per account? | **Global**, across all group keys |

⚠️ **`isEC2` and `isHighCoreCount` are read but never written anywhere in the
codebase.** A repo-wide grep finds them only at the two lines above; the licence
module never sets them either *(observed — they stayed `undefined` through every
instrumented run)*. They can therefore only come from `conf.json`. If anyone ever
puts `"isEC2": true` in that file the whole system silently caps at **2 cameras**,
and `"isHighCoreCount": true` caps it at **50** — regardless of the licence. Keep
both out of `conf.json`.

### Limit B — the per-account setting, `max_camera`

[backend/libs/checker/utils.js:87-96](backend/libs/checker/utils.js#L87-L96):

```js
function isGroupBelowMaxMonitorCount(groupKey){
    const theGroup = s.group[groupKey];
    try{
        const initData = theGroup.init;
        const maxCamerasAllowed = parseInt(initData.max_camera) || false;
        return (!maxCamerasAllowed || Object.keys(theGroup.activeMonitors).length <= parseInt(maxCamerasAllowed))
    }catch(err){ return true }
}
```

- `max_camera` is the superuser panel field **"Max Number of Cameras"**, defined at
  [backend/definitions/base.js:3357](backend/definitions/base.js#L3357) with the
  placeholder *"Leave blank for unlimited"*.
- It is stored in the group's **admin user** `details` JSON and copied into
  `s.group[ke].init` at [backend/libs/user.js:310-312](backend/libs/user.js#L310-L312).
- Blank, `0`, or non-numeric → `parseInt(...) || false` → **unlimited**.
- It counts `activeMonitors` for that one group — again mode-independent.
- Any exception → returns `true` (permissive).
- The comparison is `<=`, so it lets you reach *one more than* the configured number.
  Limit A uses `>=` and does not. The two are off by one relative to each other.

### So which one am I hitting?

They produce **different messages**, and that is how you tell them apart. From
[backend/libs/monitor.js:677-679](backend/libs/monitor.js#L677-L679):

```js
endData.msg = !systemMax ? lang.monitorEditFailedMaxReachedUnactivated
                         : lang.monitorEditFailedMaxReached
```

[shared/languages/en_CA.json:740-741](shared/languages/en_CA.json#L740-L741):

| Message | Which limit |
|---|---|
| *"Your **system** has reached the maximum number of cameras that can be created. You must **activate your installation** to create more."* | **Limit A — the licence.** This is the one you will hit at 15. |
| *"Your **account** has reached the maximum number of cameras that can be created. Speak to an **administrator** if you would like this changed."* | **Limit B — the superuser `max_camera` field.** Fixable in the UI, no licence involved. |

**Yes, there are two limits in play.** For a fresh install with a blank `max_camera`,
only Limit A is active.

---

## 2. When the check runs — the important part

A grep for every call site of `canAddMoreMonitors`, `isGroupBelowMaxMonitorCount` and
`s.cameraCount` across `backend/` returns **exactly four**, two of which are the
definitions. The enforcement points are:

### Point 1 — creating or editing a monitor

[backend/libs/monitor.js:595-597](backend/libs/monitor.js#L595-L597), inside
`s.addOrEditMonitor()`:

```js
const monitorExists = selectResponse.rows && selectResponse.rows[0];
const systemMax = canAddMoreMonitors();
const groupMax  = isGroupBelowMaxMonitorCount(form.ke);
const canDoTheDo = systemMax && groupMax;
```

and then at lines 616 / 645 / 677:

```js
if(monitorExists){          ... update ...          // limit NOT consulted
}else if(canDoTheDo){       ... insert ...
}else{                      ... refused ...
```

⚠️ **Editing an existing monitor bypasses both limits completely.** `monitorExists`
is tested first. Only creating a *new* monitor is gated. That matters operationally:
if you somehow get 100 rows into the database, you can still edit all 100 through the
UI, which makes the system feel healthy right up until it restarts.

Every add path funnels through this one function — dashboard save, REST
`POST /:auth/configureMonitor/:ke/:id`
([backend/libs/webServerAdminPaths.js:67](backend/libs/webServerAdminPaths.js#L67)),
websocket `addOrEditMonitor`
([backend/libs/monitor/websocket.js:75](backend/libs/monitor/websocket.js#L75)),
ONVIF add, bulk edit, JSON import, monitor-state import
([backend/libs/monitor.js:829](backend/libs/monitor.js#L829)).

### Point 2 — process startup

[backend/libs/startup.js:71-99](backend/libs/startup.js#L71-L99):

```js
var loadMonitor = function(monitor){
    const checkAnother = function(){
        ++loadCompleted
        if(loadCompleted <= s.cameraCount && monitors[loadCompleted]){
            loadMonitor(monitors[loadCompleted])
        }else{
            if(didNotLoad > 0)console.log(`${didNotLoad} Monitor... not loaded because Admin user does not exist...`);
            callback()
        }
    }
    ...
}
loadMonitor(monitors[loadCompleted])
```

This walks the `Monitors` table and **stops the chain** once `loadCompleted` exceeds
`s.cameraCount`. Section 3 covers what that does.

### Where the check does **not** run

- **Not on monitor start.** `s.camera('record'|'start')`, `monitorStart`,
  `launchMonitorProcesses`, `createCameraFfmpegProcess` — none of them consult either
  limit. A monitor that is loaded in memory will start, restart after a crash, and
  keep recording regardless of the licence.
- **Not on a timer, in any meaningful sense.** See below.
- **Not per ffmpeg spawn.**

### The licence check itself

`checkSubscription` runs **once per process**, at
[backend/libs/startup.js:429](backend/libs/startup.js#L429), and it runs *before*
monitors load:

```js
checkSubscription(config.subscriptionId || config.peerConnectKey || config.p2pApiKey, function(){
    checkForTerminalCommands(function(){
        loadAdminUsers(async function(){
            loadMonitors(function(){ ... })
```

So `s.cameraCount` is final before the truncation in Point 2 happens. On an
air-gapped box, boot waits for that request to fail — **up to 30 seconds**, since the
fetch timeout is 30 000 ms *(observed)*. With no DNS it usually fails much faster;
behind a black-hole firewall it will be the full 30 s.

### Does it re-check periodically? Effectively no.

[backend/libs/startup.js:446](backend/libs/startup.js#L446) arms
`s.subscriptionIntervalCheck = checkAgainSubscription()`, which calls
`setInterval(fn, 86400000)` — **every 24 hours** *(observed)*.

I captured that callback and fired it in three states — already subscribed, not
subscribed with a key present, and no key at all. In **all three** it produced:

- no network request,
- no read or write of any property on `s` or `config`,
- no `child_process` call,
- no log line,
- no change to `s.cameraCount` or `config.userHasSubscribed`.

*(observed)* So the 24-hour timer is armed but inert in this build. **A licence that
was validated at boot is not revoked while the process keeps running.** I can only say
it made no observable call in my harness — I cannot prove it is a literal no-op — but
nothing it could plausibly do is visible through `s`, `config`, the network or
`child_process`.

**The re-validation risk is entirely at process start, not on a timer.**

### "Would adding cameras appear to work until the next restart?"

You asked this plainly, so here is the plain answer.

**Not in the direction you feared, but the mirror image is real and worse.**

Adding the 16th camera to an *unactivated* running system is refused **at the time of
adding** — Point 1 catches it, nothing is written to the database. You cannot quietly
accumulate 100 rows on an unactivated box through the UI.

The dangerous sequence is the opposite:

1. You activate in the office with internet. `s.cameraCount` becomes your licensed
   number *(observed: the ceiling comes straight from the licence server's response)*.
2. You add 100 cameras. All 100 are written to the database. Everything works.
3. The server goes to the client site. No internet.
4. **First restart** — Windows Update at 3am, a power cut, a service restart:
   - `checkSubscription` fails (no network) → **fail closed** → `s.cameraCount = 15`
   - the startup loop loads **16** monitors and stops
   - **84 cameras stop recording, silently, with no log line**

That is the scenario to plan around, and it happens unattended after you have left.

### Windows Update reboot / power cut

Identical to any other restart, and there is nothing special about how they happen:

- Service starts, `checkSubscription` runs, fails (air-gapped), ceiling drops to 15.
- Startup loop loads 16 monitors.
- The other 84 rows stay in the database, untouched, and are simply never loaded.
- The service reports Running. ffmpeg is running. 16 cameras are recording normally.
- Nothing anywhere says why the other 84 are not.

---

## 3. What it does when it triggers

### On create — refuses, and whether you see it depends entirely on which button you pressed

[backend/libs/monitor.js:676-680](backend/libs/monitor.js#L676-L680):

```js
}else{
    txData.f = 'monitor_edit_failed'
    txData.ff = 'max_reached'
    endData.msg = !systemMax ? lang.monitorEditFailedMaxReachedUnactivated : lang.monitorEditFailedMaxReached
}
```

No database insert. `endData.ok` stays falsy. Note also that the failure branch does
**not** call `s.userLog` — the two success branches above it do. So a refused add is
**not written to the Logs table**.

The websocket event `monitor_edit_failed` / `ff: 'max_reached'` is broadcast — and
**nothing in the frontend handles it.** A grep for `monitor_edit_failed` and
`max_reached` across `frontend/` returns zero matches. It is a dead event.

What the operator actually sees therefore depends on the code path:

| How you add the camera | Visible? | Why |
|---|---|---|
| Monitor Settings → Save | ✅ **Visible** | [bs5.monitorSettings.js:834-841](frontend/assets/js/bs5.monitorSettings.js#L834-L841) checks `d.ok === false` and raises a PNotify with `d.msg` |
| Bulk Edit | ✅ **Visible** | [bs5.monitorBulkEdit.js:191-193](frontend/assets/js/bs5.monitorBulkEdit.js#L191-L193) checks `resp.ok === false` and lists each failure |
| **ONVIF scanner "add"** | ❌ **SILENT** | [bs5.onvifScanner.js:157-160](frontend/assets/js/bs5.onvifScanner.js#L157-L160) is `$.post(..., function(d){ debugLog(d) })`. The REST endpoint returns **HTTP 200** with `ok:false` in the body, so `.fail()` never fires. The camera just never appears. |
| **JSON import** (`importMonitor`) | ❌ **SILENT** | [bs5.monitorsUtils.js:559](frontend/assets/js/bs5.monitorsUtils.js#L559) — `configureMonitor(v)` fire-and-forget, no `.then` |
| **Monitor-state import** | ❌ **SILENT** | [backend/libs/monitor.js:829](backend/libs/monitor.js#L829) — `s.addOrEditMonitor(..., null, user)`, callback is `null` |

⚠️ **The ONVIF path is the silent one, and it is the path you used last time.** You
scan, you tick the cameras, you click add, you get no error, and the ones over the
limit simply are not there. That is the same class of failure as the recording-folder
bug you already found.

### On startup — silently drops the excess

I transcribed the loop from [backend/libs/startup.js:71-99](backend/libs/startup.js#L71-L99)
verbatim and ran it with the async body replaced by a recorder:

| Rows in `Monitors` | `s.cameraCount` | Loaded | Never registered | Console output |
|---|---|---|---|---|
| 100 | 15 | **16** (CAM001–CAM016) | **84** (CAM017–CAM100) | **nothing** |
| 100 | 150 | 100 | 0 | nothing |
| 16 | 15 | 16 | 0 | nothing |
| 15 | 15 | 15 | 0 | nothing |

Two things to note:

- **It loads `cameraCount + 1`, not `cameraCount`.** The guard is
  `loadCompleted <= s.cameraCount` with `loadCompleted` starting at 0, so indices
  `0..cameraCount` inclusive get through. At a ceiling of 15 you get 16 running
  cameras.
- **It is completely silent.** The `console.log` in the `else` branch reports
  `didNotLoad`, which is a different counter — it only increments for monitors whose
  admin user is missing. Hitting the ceiling increments nothing and prints nothing.

The dropped monitors are never passed to `s.initiateMonitorObject`, so they never
appear in `s.group[ke].activeMonitors` and never enter `rawMonitorConfigurations`.
Their database rows are untouched.

### Does it stop already-running streams, or degrade the system?

**No, and no.** Nothing anywhere kills a running monitor because of the limit. The
truncation is a *failure to start*, not a stop. Cameras that did load run completely
normally — full frame rate, full recording, no throttling. There is no shared
degradation.

### Is it logged?

| Event | Where it goes | Level |
|---|---|---|
| Licence check failed / never activated | `s.systemLog('This Install of Shinobi is NOT Activated')` → console **and** the `Logs` table as `ke='$'`, `mid='$SYSTEM'` ([backend/libs/basic.js:172-189](backend/libs/basic.js#L172-L189)), plus a raw `!!!!!!` console banner and the `licenses.shinobi.video/subscribe` URL | info; visible in the superuser log viewer |
| Licence check succeeded | `s.systemLog('This Install of Shinobi is Activated')` | info |
| **A create refused by the limit** | **Nowhere.** No `s.userLog`, no `s.systemLog`, no console line. Only the API response body. | — |
| **Monitors dropped at startup** | **Nowhere.** No log line of any kind. | — |

`config.systemLog` defaults to `true` ([backend/libs/config.js:50](backend/libs/config.js#L50)),
so the activation banner will be there. If anyone sets it to `false` in `conf.json`,
**even that disappears** — `s.systemLog` becomes a complete no-op, console included.

### If it drops streams, is the set consistent across restarts?

The startup query is `SELECT * FROM Monitors` with **no `ORDER BY` and no `LIMIT`**.
`orderBy` is only applied when the caller passes it
([backend/libs/database/utils.js:138-139](backend/libs/database/utils.js#L138-L139)),
and this caller does not.

- **In practice: stable.** SQLite without an `ORDER BY` normally returns rows in rowid
  order, i.e. insertion order. So the *earliest-added* cameras survive and the *most
  recently added* go dark, the same ones each reboot.
- **By contract: arbitrary.** Nothing guarantees it. A `VACUUM`, a database restore, a
  different query plan, or a move to MariaDB can reorder the result and change which
  cameras survive. If it ever does change, different cameras go dark after a reboot
  with nothing in the logs to explain it.

Treat it as "stable until something touches the database, then unspecified".

---

## 4. Offline and air-gapped behaviour

### Local file, or phone home?

**Phone home**, on the normal path. *(observed)*

```
GET https://licenses.shinobi.video/subscribe/check?subscriptionId=<key>&commitId=<git rev-parse HEAD>
timeout: 30000 ms
```

The key comes from `config.subscriptionId || config.peerConnectKey || config.p2pApiKey`
([backend/libs/startup.js:429](backend/libs/startup.js#L429)). The commit id comes from
running `git rev-parse HEAD` in the process working directory.

The response is parsed with `s.parseJSON` and the module reads `ok`, `cameraCount`,
`expired` and `timeExpires` from it *(observed — the last two were probed on a payload
that did not contain them, which is how I know they are part of the real schema)*.

On success it sets `s.cameraCount = response.cameraCount` and
`config.userHasSubscribed = true`. **The camera ceiling is supplied by the licensing
server on every successful check** — it is not stored locally anywhere.

### What happens when the request fails?

**Fail closed. No grace period. No cache.** *(observed, four ways)*

| Failure | `s.cameraCount` after | `userHasSubscribed` | Callback |
|---|---|---|---|
| Network unreachable (air-gap) | **15** | `false` | `false` |
| Request times out | **15** | `false` | `false` |
| Server responds `ok: false` | **15** | `false` | `false` |
| Server responds with HTML (captive portal / proxy) | **15** | `false` | `false` |
| No key configured at all | **15** | `undefined` | `null` |

There is no "last known good" value, no retry-with-tolerance, no offline days
allowance. A failed check is identical to never having activated.

`config.disableOnlineSubscriptionCheck = true` skips the request entirely — no network
call, no git — but leaves `s.cameraCount = 15` *(observed)*. **It suppresses the
phone-home; it does not grant anything.** It is not an offline licence switch.

### Does an activated licence survive going offline and rebooting?

**No.** This is the blocker.

The ceiling is re-derived from the licence server at **every process start**. There is
nothing on disk that remembers "this install was activated for 150 cameras". Take an
activated server offline and restart it and it is a 15-camera system again, silently.

### Is there an offline path? Yes — and it is your only route to 100 cameras here.

The module has a second branch for keys beginning with **`offline__`**. *(observed)*

- **No network request. No `git rev-parse`.** Nothing leaves the machine.
- The remainder of the key is decrypted locally: `crypto.scryptSync(...)` producing a
  32-byte key, then `crypto.createDecipheriv('aes-256-cbc', <32-byte key>, <16-byte IV>)`,
  and the plaintext is parsed as JSON. The secret and salt are compiled into the module.
- The decrypted payload carries a camera count and an expiry.

Observed behaviour, driving the branch with a synthetic payload inside the sandbox:

| Payload | Result |
|---|---|
| expiry in the **future** | **Accepted** — `cameraCount` taken from the payload, `userHasSubscribed = true`, no network, no git |
| expiry in the **past** | Rejected — back to 15, "NOT Activated" |
| `lifetime: true`, no expiry | Runs `git log -1 --format=%cI` (the build's commit date). With git unavailable → **rejected**, back to 15 |
| garbage after `offline__` | Rejected — back to 15 |

**I did not construct, derive or attempt to forge an offline key, and no key material
is reproduced in this document.** The mechanism is described because it decides
whether your deployment is possible at all. Obtaining a real `offline__` key is a
commercial matter — ask Shinobi Systems for an **offline / air-gapped licence** for a
100-camera site, and tell them explicitly that the server has no internet at any point,
including first boot.

### What is cached, and where? Would it survive a rebuild?

Only the **key** is persisted, and only in `conf.json`:

```json
{ "subscriptionId": "..." }
```

written by `POST /super/:auth/system/activate`
([backend/libs/webServerSuperPaths.js:145-173](backend/libs/webServerSuperPaths.js#L145-L173)),
which merges `subscriptionId` into `conf.json` and then calls `checkSubscription`.
`peerConnectKey` and `p2pApiKey` are accepted as fallbacks.

Nothing else is cached — no licence file, no database row, no token, no timestamp of
the last successful check.

| Scenario | Survives? |
|---|---|
| Service restart | Key survives; **entitlement does not** — it is re-fetched and fails offline |
| Server reboot | Same |
| Reinstall keeping `conf.json` | Key survives |
| Reinstall regenerating `conf.json` (what `INSTALL.bat` does when the file is absent) | **Key lost.** Re-enter it via `/super` |
| Full server rebuild | Key lost unless you kept `conf.json` |

Back up `conf.json`. It is the only place the licence key exists.

---

## 5. Failure and edge behaviour in production

### Restart with more cameras configured than the limit allows

Covered in section 3. `cameraCount + 1` monitors load, the rest are silently never
registered, and the database rows survive untouched. When a valid licence is restored
and the process restarts, all of them come back automatically — nothing is destroyed.

The dropped cameras produce a specific, checkable symptom:

- They were never passed to `s.initiateMonitorObject`, so `s.group[ke].activeMonitors[mid]`
  does not exist.
- `getMonitors` only attaches `status` / `code` when the active monitor exists
  ([backend/libs/monitor/utils.js:2035-2039](backend/libs/monitor/utils.js#L2035-L2039)).
- The frontend falls through: `definitions['Monitor Status Codes'][undefined] || item.status || lang.Initializing`
  ([bs5.monitorsUtils.js:1411-1413](frontend/assets/js/bs5.monitorsUtils.js#L1411-L1413)).

➡️ **A camera dropped by the limit shows "Initializing" forever** in the monitors list,
and a permanent spinner on its dashboard tile
([bs5.monitorsUtils.js:42](frontend/assets/js/bs5.monitorsUtils.js#L42)). Not "Died",
not "Stopped" — *Initializing*, indefinitely. That is your fingerprint for this exact
failure.

### Missing, corrupted or wrong licence key

| Condition | Result |
|---|---|
| No key in `conf.json` | No network call at all, ceiling 15, "NOT Activated" logged |
| Key present, garbage value | Online check runs and the server rejects it → ceiling 15 |
| `offline__` key that fails to decrypt | Rejected locally, ceiling 15, no network call |
| `conf.json` itself missing/corrupt | The app will not get this far — config load fails first (out of scope here) |

All of them land in the same place: 15 cameras, one log line.

### Wrong system clock

**This is a real risk and it is specific to the offline licence.**

The `offline__` path validates the expiry **against the machine's own clock**, with no
external time source *(observed: a past expiry is rejected, a future expiry accepted,
with no network call in either case)*.

An air-gapped Windows server has no NTP and no internet time sync. If the CMOS battery
dies, or the clock is set wrong during a rebuild, or someone changes the timezone
carelessly, the system clock can jump forward past the licence expiry. The next restart
then silently drops to 15 cameras.

The online path is unaffected — expiry is decided server-side there.

Also note: a wrong clock independently corrupts recording timestamps and makes playback
searches return nothing, so it is worth guarding regardless. Set the BIOS clock, verify
Windows time, and replace the CMOS battery if the server is not new.

### Expiry that could stop a live system

| Mechanism | Can it stop a live system? |
|---|---|
| Subscription expires (online) | Only at the **next restart**. The 24h timer is inert, so a running process is not revoked mid-flight. |
| `offline__` licence expiry passes | Only at the **next restart**, same reasoning. |
| `lifetime` offline licence + missing git | **Yes, at the next restart** — see below. |

⚠️ **The `lifetime` offline path needs `git` and a `.git` directory.** It runs
`git log -1 --format=%cI` to read the build's commit date, and when git fails it
**rejects the licence** *(observed)*. The offline bundle produced by
[offline-windows/make-bundle.ps1](offline-windows/make-bundle.ps1) copies `backend/`,
`frontend/`, `shared/` and `patches/` — **no `.git`** — and a client's Windows server
will not have `git.exe` either. So a *lifetime* offline licence would fail on a
deployed bundle while working perfectly on your development machine.

(In the earlier install rehearsal the bundle *did* resolve a git commit — but only
because `dist/` happened to sit inside the repository working tree. At
`C:\ShinobiVMS` it will not.)

➡️ **If you buy an offline licence, ask for a dated-expiry one, not a "lifetime" one**,
or confirm with Shinobi Systems that lifetime keys do not depend on the git commit date.
A dated key needs no git at all *(observed)*.

For completeness: when git is missing on the **online** path, the failure is caught, a
console line `Error getting commit ID: ...` is printed, and the request goes out with
`commitId=` empty *(observed)*. Whether the real licence server accepts an empty
commitId is **unknown** — I did not contact it.

### Noisy vs silent — what you can and cannot detect

**Noisy (you will see these):**

- The startup banner: `!!!!!!` + `This Install of Shinobi is NOT Activated` +
  `https://licenses.shinobi.video/subscribe`, on the console and in the `Logs` table.
- A single camera added through Monitor Settings → Save being refused (PNotify).
- Bulk Edit failures, listed per camera.

**Silent (you will not see these):**

- 🔴 **Monitors dropped at startup.** No log, no console line, no UI banner. The
  fingerprint is a camera stuck on "Initializing".
- 🔴 **ONVIF scanner adds refused by the limit.** HTTP 200, `ok:false`, callback only
  calls `debugLog`. The camera silently does not appear.
- 🔴 **JSON import and monitor-state import refused.** Fire-and-forget.
- 🔴 **The `monitor_edit_failed` websocket event.** Broadcast by the backend, handled
  by nothing in the frontend.
- 🟠 A refused create is not written to the `Logs` table at all.

---

## 6. What to tell the client, and what to plan around

### Maximum cameras you can reliably run offline

**15.** With no licence, or with any licence that requires an internet check, an
air-gapped server is a 15-camera server after every restart. Not 100. Not "100 until
something goes wrong" — 15, from the first reboot.

The **only** configuration that gives you 100 cameras on this site is an **offline
(`offline__`) licence** with a **dated expiry**, obtained in advance from Shinobi
Systems.

### Which licence you need for 100 cameras

- A tier covering **at least 100 cameras** — the ceiling is whatever `cameraCount` the
  licence carries, so it must be ≥ 100. Budget for the 150-camera tier if 100 is not
  a listed size; the existing [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) quotes roughly
  $1,480/year or ~$4,400 one-off for 150 cameras.
- It must be issued as an **offline / air-gapped licence**. A normal subscription key
  is worthless here: it validates over the internet at every boot and fails closed.
- Prefer a **dated expiry** over "lifetime" — lifetime triggers the git commit-date
  check that will fail on the deployed bundle.
- **Yes, the offline behaviour changes with the right licence**: an `offline__` key
  makes no network call at all, so an air-gapped server is fully licensed at every boot.
  A paid *online* key changes nothing about the offline problem.

Ask them, in writing, for: *an offline/air-gapped licence for ≥100 cameras, with a
fixed expiry date, for a server that has no internet access at any time including
first activation.* Get it working on a bench machine **with the network cable
unplugged** before you travel.

### Operational risks to plan around

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | **Online licence + air-gapped site** | 84 of 100 cameras stop recording at the first restart, silently, after you have left | Offline licence only. Test with the cable unplugged. |
| 2 | **Silent startup truncation** | No alarm, no log, discovered days later | Add the post-restart check below to the runbook and to any monitoring |
| 3 | **Wrong system clock vs offline expiry** | Whole system drops to 15 at the next restart | Set BIOS time, replace the CMOS battery, verify Windows time before handover |
| 4 | **Offline licence expiry date passes** | Same as #3, on a known date | Put the expiry date in the client's calendar and in the handover document; plan the renewal visit |
| 5 | **`lifetime` offline key + no git in the bundle** | Licence rejected on the deployed server though it works on your bench | Insist on a dated key, or ship a `.git` directory and `git.exe` |
| 6 | **`conf.json` regenerated on reinstall** | Licence key lost, back to 15 | Back up `conf.json`; re-enter the key via `/super` after any reinstall |
| 7 | **ONVIF add silently refused** | Cameras you believe you added do not exist | After every add batch, count cameras in the list against what you added |
| 8 | **`isEC2` / `isHighCoreCount` in `conf.json`** | Hard cap at 2 or 50 regardless of licence | Never set them; check they are absent |
| 9 | **Which cameras survive is unspecified** | After a database restore, a *different* 16 could survive | Do not rely on it; fix the licence rather than living with truncation |

### What to monitor

**After every restart — this is the check that catches the whole failure class:**

```powershell
# Cameras actually running. Should equal the number configured.
(Get-Process ffmpeg -ErrorAction SilentlyContinue).Count
```

If that is stuck at ~16 while the monitors list shows 100 cameras, the limit truncated
your system.

**In the dashboard — Storage & Retention page** (`GET /:auth/storageStatus/:ke`,
rendered at [bs5.storageStatus.js:220-226](frontend/assets/js/bs5.storageStatus.js#L220-L226))
shows three tiles:

- **Cameras configured** — `monitors.total`
- **Set to record**
- **Maximum cameras** — `cameraCountCeiling`, i.e. `s.cameraCount`

➡️ **"Maximum cameras" must read your licensed number, not 15.** Check it after every
restart and after any change to `conf.json`.

⚠️ Two caveats on that page:
- `monitors.total` is counted from the **in-memory** `rawMonitorConfigurations`
  ([storageStatus.js:450-455](backend/libs/webPaths/storageStatus.js#L450-L455)), so
  after a truncated boot it reads **16**, not 100. The monitors list, which reads the
  database, still shows **100**. **That discrepancy is your detection signal** — 100 in
  the list, 16 on the storage page.
- `buildChecks` contains **no check comparing configured cameras against the ceiling**,
  so nothing warns you. You have to read the numbers yourself.

**Superuser system info** — `GET /super/:auth/system/info`
([webServerSuperPaths.js:762-769](backend/libs/webServerSuperPaths.js#L762-L769)):

```json
{ "info": { "Maximum Cameras": 150, "Versions": { "isActivated": true } } }
```

`isActivated: false` or `Maximum Cameras: 15` means the licence check failed.

**In the logs** — search the superuser log viewer, or the console output, for:

- `This Install of Shinobi is NOT Activated` → the licence check failed this boot.
  Earliest and clearest signal; it appears within ~30 s of service start.
- `This Install of Shinobi is Activated` → good.

**In the monitors list** — any camera stuck on **"Initializing"** that never moves to
Watching or Recording. That is a monitor the startup loop never registered.

**A one-line post-restart smoke test worth putting in the runbook:**

```powershell
# after every reboot, before you consider the system healthy
$running = (Get-Process ffmpeg -ErrorAction SilentlyContinue).Count
$expected = 100    # <- your camera count
if ($running -lt $expected) { Write-Warning "Only $running of $expected cameras are recording - check Maximum Cameras on the Storage page" }
```

---

## Appendix — what I could not establish

- Whether the real licence server accepts a request with an empty `commitId`. I never
  contacted it.
- The full schema of the licence server's response. I confirmed `ok` and `cameraCount`
  drive the outcome, and that `expired` and `timeExpires` are read; there may be more.
- The exact field names inside a genuine `offline__` payload. I drove the branch with a
  synthetic payload to observe accept/reject behaviour, which establishes that a camera
  count and an expiry govern it, but not the real key names.
- Whether the 24-hour interval callback is a literal no-op. It made no observable call
  through `s`, `config`, the network or `child_process` in any state I tested.
- Whether `isEC2` / `isHighCoreCount` are ever set by something outside this repository
  (a deployment script, a Docker entrypoint). Nothing in `backend/` writes them.
- Pricing and available tiers — the figures quoted above come from
  [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md), not from the vendor directly.
