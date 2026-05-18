# Shinobi Monorepo Layout

This repository is split into three top-level workspaces:

- `frontend/` - EJS templates and browser assets from the original `web/` directory.
- `backend/` - Shinobi server, libraries, plugins, SQL, definitions, and tools.
- `shared/` - Shared resources. Language files live in `shared/languages`.

## Install

From the repository root:

```sh
npm install
```

Or install only the backend:

```sh
cd backend
npm install
```

## Run Backend

From the repository root:

```sh
npm run backend
```

Or from the backend workspace:

```sh
cd backend
npm start
```

The backend still serves the Shinobi UI and API on the configured Shinobi port, usually `8080`. Existing environment variables and `backend/conf.json` / `backend/super.json` continue to drive runtime behavior.

## Run Frontend Independently

The frontend workspace can be served by itself for static asset/template inspection:

```sh
npm run frontend
```

This starts a static server for `frontend/` on port `8081`. Full Shinobi functionality still requires the backend because the UI is rendered by Express/EJS and communicates with Shinobi APIs and websockets.

## Docker

Docker still uses the existing root `Dockerfile`, but runtime paths now point at `backend/`:

- PM2 starts `/home/Shinobi/backend/camera.js`
- SQL bootstrap files are loaded from `/home/Shinobi/backend/sql`
- Configuration files are created in `/home/Shinobi/backend`

The same environment variables are preserved.
