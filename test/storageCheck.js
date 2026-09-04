// storageCheck.js decides whether the recorder is allowed to start. If it ever returns
// null for a directory that cannot actually hold footage, every camera reports
// "Recording" while nothing lands on the NAS -- the failure this whole module exists to
// prevent, and one that looks like success from the UI.
//
// The load-bearing case is "writable but not mounted": an unmounted SMB/NFS mount point
// is an ordinary, writable, EMPTY local directory, so fs.existsSync() and node-fstab's
// checkDiskPathExists() both pass exactly when the footage is about to be lost. That case
// is asserted below with a real directory, not a mock.
//
// Run: node test/storageCheck.js
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { checkStorageTarget } = require(__dirname + '/../backend/libs/storageCheck.js')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'storagecheck-'))
const skipped = []

const refuses = (name, dir, options, expectedFragment) => {
    const result = checkStorageTarget(dir, options)
    assert(result !== null, `${name}: expected a refusal, got null (the path was ACCEPTED)`)
    assert(
        result.indexOf(expectedFragment) !== -1,
        `${name}: the message must name the cause "${expectedFragment}" so an operator knows what to do, got: ${result}`
    )
}
const accepts = (name, dir, options) => {
    const result = checkStorageTarget(dir, options)
    assert.strictEqual(result, null, `${name}: expected acceptance, got refusal: ${result}`)
}

refuses('empty path', '', {}, 'Storage path is empty')
refuses('undefined path', undefined, {}, 'Storage path is empty')
refuses('missing directory', path.join(tmp, 'nope'), {}, 'DOES NOT EXIST')

const aFile = path.join(tmp, 'afile')
fs.writeFileSync(aFile, 'x')
refuses('a file, not a directory', aFile, {}, 'NOT A DIRECTORY')

const good = path.join(tmp, 'good')
fs.mkdirSync(good)
accepts('writable directory, mount guard off', good, { requireMount: false })

// THE ONE THAT MATTERS. Same directory, same permissions, mount guard on: this stands in
// for the mount point left behind when the share is not mounted.
refuses('writable but not mounted', good, { requireMount: true }, 'NOT MOUNTED')
refuses('refusal names the marker', good, { requireMount: true, sentinel: '.nas-online' }, '.nas-online')

fs.writeFileSync(path.join(good, '.nas-online'), '')
accepts('mounted share', good, { requireMount: true })
refuses('a different marker is still missing', good, { requireMount: true, sentinel: '.my-marker' }, 'NOT MOUNTED')

// The probe must clean up after itself: a stray file appearing in the recording directory
// every time the check runs would be its own bug, and on a NAS it would be visible to the
// customer.
const before = fs.readdirSync(good).sort().join(',')
checkStorageTarget(good, { requireMount: true })
assert.strictEqual(fs.readdirSync(good).sort().join(','), before, 'the write probe left a file behind')

// Permission denied is the likeliest real-world failure (a service account against an SMB
// share), but chmod is a no-op for the owner on Windows, so asserting it there would be a
// test that cannot fail. Skipped loudly rather than silently.
if (process.platform !== 'win32' && process.getuid && process.getuid() !== 0) {
    const ro = path.join(tmp, 'readonly')
    fs.mkdirSync(ro, 0o500)
    refuses('unwritable directory', ro, {}, 'ACCESS DENIED')
    fs.chmodSync(ro, 0o700)
} else {
    skipped.push('unwritable directory -- needs POSIX permissions; on ' + process.platform +
        ' this branch is verified by hand against a real share, see the notes in storageCheck.js')
}

fs.rmSync(tmp, { recursive: true, force: true })

if (skipped.length) {
    console.log('SKIPPED (' + skipped.length + '):')
    skipped.forEach((s) => console.log('  - ' + s))
}
console.log('storageCheck: all assertions passed')
