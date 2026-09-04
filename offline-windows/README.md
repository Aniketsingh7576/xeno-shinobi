# Shinobi VMS — Offline Windows Deployment

Two machines are involved:

- **Build machine** — a Windows PC *with* internet. Run `make-bundle.ps1` here once.
- **Target machine** — the offline Windows PC that will run the VMS. Copy the
  bundle here on a USB stick and run `INSTALL.bat`.

There is no "single file" build. The VMS needs a Node runtime, an ffmpeg
binary, and ~600 npm packages (one with a compiled `.node` binary). Those
cannot be collapsed into one executable. What you get instead is a single
**folder** you copy once and install with one double-click.

## On the build machine (internet required)

    powershell -ExecutionPolicy Bypass -File make-bundle.ps1

This downloads a portable Node runtime, an ffmpeg build, the npm
dependencies and the service wrapper, then stages the app into
`dist\ShinobiVMS-Offline\`. Expect ~400-600 MB and several minutes.

Copy that whole `ShinobiVMS-Offline` folder to a USB stick.

## On the target machine (no internet needed)

Copy the folder off the USB to a local disk — **do not run it from the USB
stick**, video recording needs real local disk. `C:\ShinobiVMS` is a good
choice. Then right-click `INSTALL.bat` and pick **Run as administrator**.

It installs a Windows service named `ShinobiVMS` that starts on boot and
restarts on crash. When it finishes, open:

    http://localhost:8080/super

Superuser credentials live in `app\backend\super.json`. **Change the default password
before the system goes live.**

## Where things live once installed

    app\backend\conf.json    port, video directory, database settings
    app\backend\super.json   superuser login
    shinobi.sqlite     the database (this is the file to back up)
    videos\            recorded video
    logs\              service stdout/stderr

## Managing the service

    net stop ShinobiVMS
    net start ShinobiVMS
    UNINSTALL.bat        (as administrator) removes the service

## Backups

Stop the service, copy `shinobi.sqlite` and `conf.json` somewhere safe, start
it again. Video in `videos\` is usually too large for routine backup and is
generally treated as expendable.

## Notes on this build

This bundle uses **SQLite** rather than MariaDB. The app supports it natively
(knex picks the engine straight from `conf.json`) and it needs no service, no
root password and no open port — which matters on an air-gapped box. Tables
are created automatically on first boot, so there is no schema to import.

For a single-site pilot this is the right trade. If this site later grows to
many dozens of busy cameras, SQLite's single-writer design becomes the
bottleneck and MariaDB is the upgrade path — the only change needed is the
`db` block in `conf.json`.
