// The snapshot ffmpeg is spawned by a Worker (cameraThread/snapshot.js) which
// self-kills it at a fixed deadline with `taskkill /f /t`. monitor.js keeps a
// backstop that calls worker.terminate() -- that kills the JS thread WITHOUT
// running its exit handler, so any ffmpeg still alive is orphaned. An orphan
// holds s.m3u8 open, and on Windows that blocks the HLS playlist rewrite: the
// player keeps fetching a frozen playlist naming segments +delete_segments has
// already removed, so the camera reads "connected" but shows nothing.
// The backstop must therefore always fire AFTER the worker's own deadline.
// Run: node test/snapshotTimeout.js
const assert = require('assert')
const fs = require('fs')

const worker = fs.readFileSync(__dirname + '/../backend/libs/cameraThread/snapshot.js', 'utf8')
const monitor = fs.readFileSync(__dirname + '/../backend/libs/monitor.js', 'utf8')

const workerDeadline = +/setTimeout\(\(\) => \{\s*exitAction\(\)\s*\},(\d+)\)/.exec(worker)[1]
const formula = /var dynamicTimeout = (.+);/.exec(monitor)[1]
const backstop = (secondsInward) => eval(formula)

for (let s = 1; s <= 30; s++) {
    const padded = String(s).length === 1 ? '0' + s : String(s)   // monitor.js pads to 2 chars
    assert(
        backstop(padded) > workerDeadline,
        `secondsInward=${padded}: backstop ${backstop(padded)}ms must exceed worker deadline ${workerDeadline}ms, else worker.terminate() orphans the ffmpeg`
    )
}
console.log(`ok - backstop outlives the ${workerDeadline}ms worker deadline for secondsInward 1..30`)
