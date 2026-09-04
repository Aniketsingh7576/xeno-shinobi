const fs = require('fs');
const os = require('os');
const path = require('path');
//
// Prove a directory is usable for recording RIGHT NOW, as the account this process is
// running as.
//
// Nothing in here is an existence check, on purpose. When an SMB/NFS share is not
// mounted, its mount point is still an ordinary, writable, EMPTY directory on the local
// disk: fs.existsSync() and node-fstab's checkDiskPathExists() both return true in
// exactly the condition we are trying to catch, and the recorder then fills the OS drive
// while every camera reports "Recording". The only honest test is to write a file, flush
// it to the device, read it back and delete it.
//
// Returns null when the directory is usable, otherwise a message meant to be shown to an
// operator verbatim. It always names WHICH failure it was -- unmounted, read-only,
// permission denied, missing, full -- because "invalid path" does not tell anyone whether
// to mount the share, fix permissions or free up space.
//
const PROBE_BODY = 'xeno-write-probe';

function whoAmI(){
    try{
        return os.userInfo().username;
    }catch(err){
        return 'the service account';
    }
}

// Node's errno is the only thing that distinguishes these cases, and the distinction is
// the whole value of the message.
function describeWriteError(err, dir){
    switch(err.code){
        case 'EROFS':
            return dir + ' is mounted READ-ONLY. A share that was remounted read-only after a server'
                + ' hiccup still looks healthy and records nothing.';
        case 'EACCES':
        case 'EPERM':
            return 'PERMISSION DENIED writing to ' + dir + ' as "' + whoAmI() + '".'
                + ' On a Windows share the service account needs write permission on BOTH the share'
                + ' and the NTFS folder, and a service running as LocalSystem cannot authenticate to'
                + ' a share at all.';
        case 'ENOSPC':
            return dir + ' is FULL -- there is not enough room to write a test file.';
        case 'ENOENT':
            return dir + ' DISAPPEARED while it was being tested. The share was unmounted mid-check.';
        case 'EIO':
        case 'ESTALE':
            return dir + ' returned an I/O error (' + err.code + ') -- a stale mount or a failing disk.';
        default:
            return 'Cannot write to ' + dir + ': ' + err.message + ' (' + (err.code || 'no errno') + ')';
    }
}

// options.requireMount : check for the mount marker file as well as writability.
// options.sentinel     : marker filename, default '.nas-online'.
function checkStorageTarget(dir, options){
    options = options || {};

    if(typeof dir !== 'string' || dir.trim() === ''){
        return 'Storage path is empty. Set it to the recording volume, for example D:/Videos'
            + ' or //STORAGE-PC/ShinobiVideos.';
    }

    // MEASURED: statSync against a host that is not on the network takes ~21 SECONDS to
    // fail (a reachable server with a wrong share name fails in ~0.2s). Every caller today
    // is one-shot -- boot, and the two config write paths -- so that delay only ever slows
    // down a refusal that was going to happen anyway. If this is ever put on a timer or in
    // a request path, it MUST move off the main thread first: 21s of blocked event loop
    // stops every camera, which would make the health check worse than the problem.
    let stat;
    try{
        stat = fs.statSync(dir);
    }catch(err){
        if(err.code === 'ENOENT'){
            return 'Storage path DOES NOT EXIST: ' + dir
                + ' -- if this is a network share, it is not mounted or the drive letter is not connected.';
        }
        if(err.code === 'EACCES' || err.code === 'EPERM'){
            // Deliberately not "denied reading": failing at the open means the account has
            // no access to the path AT ALL, and an operator told the problem was "reading"
            // goes and checks read permission, which is not what is wrong.
            return 'ACCESS DENIED opening ' + dir + ' as "' + whoAmI() + '" -- the account cannot'
                + ' use this path at all. On a Windows share check the SHARE permissions first,'
                + ' then the NTFS permissions; and note that a service running as LocalSystem'
                + ' cannot authenticate to a share at all, whatever the permissions say.';
        }
        // Windows collapses almost every network failure into UNKNOWN, so the raw errno is
        // useless to an operator: "unknown error" is what you get when the NAS is switched
        // off, which is the single likeliest thing to be wrong at a site. Measured against
        // a real share: a wrong share name on a reachable server and a server that is not
        // on the network BOTH arrive here as UNKNOWN.
        if(err.code === 'UNKNOWN' || err.code === 'ENODEV' || err.code === 'ETIMEDOUT'
            || err.code === 'EHOSTUNREACH' || err.code === 'ENETUNREACH'){
            return 'Storage path is UNREACHABLE: ' + dir + ' (' + err.code + ').'
                + ' The storage server is switched off or not on the network, the share name is'
                + ' wrong, or the mapped drive is no longer connected. The path itself is not the'
                + ' problem -- the volume is not there. Note that a mapped drive letter belongs to'
                + ' the session that created it, so a service will not see one mapped by hand.';
        }
        return 'Cannot read storage path ' + dir + ': ' + err.message + ' (' + (err.code || 'no errno') + ')';
    }
    if(!stat.isDirectory()){
        return 'Storage path is NOT A DIRECTORY: ' + dir;
    }

    // Unique per process and per call so two nodes pointed at the same share, or a retry
    // after a crash, cannot collide on the probe file. 'wx' fails rather than clobbering
    // anything that is somehow already there.
    const probe = path.join(dir, '.xeno-writecheck-' + process.pid + '-' + Date.now());
    let fd;
    try{
        fd = fs.openSync(probe, 'wx');
        fs.writeSync(fd, PROBE_BODY);
        // fsync, not just write. On a full or read-only volume the write lands in the page
        // cache and succeeds; only the flush to the device reports the failure, which is
        // the difference between catching this now and catching it as corrupt footage.
        fs.fsyncSync(fd);
    }catch(err){
        return describeWriteError(err, dir);
    }finally{
        if(fd !== undefined){
            try{ fs.closeSync(fd); }catch(err){ /* already gone; the read-back below decides */ }
        }
    }

    try{
        const readBack = fs.readFileSync(probe, 'utf8');
        if(readBack !== PROBE_BODY){
            return dir + ' returned DIFFERENT BYTES than were written to it -- the volume is'
                + ' corrupting data. Refusing it rather than recording footage nobody can play.';
        }
    }catch(err){
        return 'Wrote a test file to ' + dir + ' but could not read it back: ' + err.message
            + ' (' + (err.code || 'no errno') + ')';
    }finally{
        try{ fs.unlinkSync(probe); }catch(err){ /* best effort; a stray probe file is harmless */ }
    }

    if(options.requireMount){
        const marker = options.sentinel || '.nas-online';
        try{
            // Read, not stat. A stale NFS/SMB handle stats fine and only reveals itself on
            // the first real read.
            fs.readFileSync(path.join(dir, marker));
        }catch(err){
            return 'The recording volume is NOT MOUNTED: the marker file "' + marker + '" is missing'
                + ' or unreadable in ' + dir + ' (' + (err.code || 'no errno') + ').'
                + ' The marker lives ON the NAS, so it disappears exactly when the share does.'
                + ' Mount the volume, or set "requireStorageMount": false in conf.json for a'
                + ' genuine local-storage install.';
        }
    }

    return null;
}

// The boot-time contract, in one place so every caller fails the same way: say what is
// wrong, say that nothing was substituted, and exit non-zero so the service manager
// retries. This is the power-cut case -- the server boots faster than the NAS, and waiting
// through a few restart cycles is correct where recording to the local disk is not.
function refuseToStart(what, reason){
    console.error('==================================================================');
    console.error('FATAL: ' + what);
    console.error(reason);
    console.error('Refusing to start. Nothing has been substituted: no footage will be');
    console.error('written to a fallback directory. Fix the path (or mount the volume)');
    console.error('and the service will come up on its next restart.');
    console.error('==================================================================');
    process.exit(1);
}

module.exports = {
    checkStorageTarget,
    refuseToStart,
};
