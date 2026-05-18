const v8 = require('v8');
const fs = require('fs');
const path = require('path');
module.exports = function(s,config,lang,app,io){
    const HEAPDUMP_DIR = path.join('/dev/shm', 'heapdumps');
    if (!fs.existsSync(HEAPDUMP_DIR)) {
      fs.mkdirSync(HEAPDUMP_DIR);
    }

    // Generate heap snapshot using built-in v8 module
    app.get('/debug/heapdump', (req, res) => {
      const filename = path.join(HEAPDUMP_DIR, `heapdump-${Date.now()}.heapsnapshot`);

      let snapshotStream;
      let fileStream;
      let downloadComplete = false;

      const cleanupFile = () => {
        fs.rm(filename, { force: true }, (err) => {
          if (err) console.error('Error removing dump from RAM:', err);
        });
      };

      // If client disconnects at any point before download completes,
      // abort both streams immediately so the heap buffer is released
      // and the RAM file is removed.
      res.on('close', () => {
        if (!downloadComplete) {
          if (snapshotStream) snapshotStream.destroy();
          if (fileStream) fileStream.destroy();
          cleanupFile();
        }
      });

      try {
        snapshotStream = v8.getHeapSnapshot();
        fileStream = fs.createWriteStream(filename);

        // If write fails, destroy the read stream too so it doesn't hang in memory
        fileStream.on('error', (err) => {
          console.error('Error writing heap dump:', err);
          snapshotStream.destroy();
          cleanupFile();
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to write heap dump' });
          }
        });

        snapshotStream.on('error', (err) => {
          console.error('Error reading heap snapshot:', err);
          fileStream.destroy();
          cleanupFile();
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to read heap snapshot' });
          }
        });

        snapshotStream.pipe(fileStream);

        fileStream.on('finish', () => {
          // Explicitly destroy the snapshot stream to release
          // the V8 serialization buffer before we start the download
          snapshotStream.destroy();
          console.log(`Heap dump written to ${filename}`);
          // Mark complete BEFORE res.download so the close handler
          // knows not to double-cleanup if the response ends normally
          downloadComplete = true;
          res.download(filename, (err) => {
            if (err) console.error('Error sending heap dump:', err);
            // Always clean up the file from RAM after download attempt
            cleanupFile();
            // Nudge GC to reclaim the snapshot allocation now that
            // the stream and file reference are both released.
            // Requires --expose-gc flag; skipped silently if not available.
            if (typeof global.gc === 'function') {
              setImmediate(() => global.gc());
            }
          });
        });
      } catch (err) {
        console.error('Heap dump failed:', err);
        cleanupFile();
        if (!res.headersSent) {
          res.status(500).json({ error: err.message });
        }
      }
    });

    // Delete all heap dumps
    app.get('/debug/heapdumps/delete', (req, res) => {
      fs.readdir(HEAPDUMP_DIR, (err, files) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        const heapFiles = files.filter(f => f.endsWith('.heapsnapshot'));

        if (heapFiles.length === 0) {
          return res.json({ message: 'No heap dumps to delete', deleted: 0 });
        }

        let deleted = 0;
        let errors = [];

        heapFiles.forEach(file => {
          const filePath = path.join(HEAPDUMP_DIR, file);
          try {
            fs.unlinkSync(filePath);
            deleted++;
            console.log(`Deleted: ${file}`);
          } catch (err) {
            errors.push({ file, error: err.message });
          }
        });

        res.json({
          message: `Deleted ${deleted} heap dump(s)`,
          deleted,
          errors: errors.length ? errors : undefined
        });
      });
    });

    // List heap dumps
    app.get('/debug/heapdumps', (req, res) => {
      fs.readdir(HEAPDUMP_DIR, (err, files) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        const heapFiles = files
          .filter(f => f.endsWith('.heapsnapshot'))
          .map(f => {
            const stat = fs.statSync(path.join(HEAPDUMP_DIR, f));
            return {
              name: f,
              size: stat.size,
              sizeMB: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
              created: stat.birthtime
            };
          })
          .sort((a, b) => b.created - a.created);

        res.json(heapFiles);
      });
    });

    if(config.debugMp4Frag){
        app.get('/debug/mp4frag', (req, res) => {
            res.end(JSON.stringify(s.mp4FragMemoryFreed,null,3));
        });
    }
}
