---
name: deploy
description: Deploy an Express + Vite SPA + MongoDB Atlas project to Render, with GitHub Actions CI gating the deploy. Use when setting up the first deploy of a new project (e.g. a take-home assignment), or adding CI, a Render Blueprint or a health check to one.
---

# Deploy: Express + Vite SPA + Atlas + Render

A fast manual for a new project's first deploy. The user already has Render and Atlas accounts.
Built from cat-store's Part 7, the first time it was done for real. Its design doc
(`.docs/designs/deployment.md` in cat-store) has the full whys and the options not chosen.

## The shape
```
push main ──▶ GitHub Actions: lint → typecheck → unit → E2E
                 │ all checks green
Render ──▶ autoDeployTrigger: checksPass ──▶ build FE into backend/public ──▶ node server
                 │ traffic switches once GET /api/health answers 200
browser ──▶ one Express (static SPA + /api + sockets) ──▶ Atlas
```
One origin, so no CORS. A red CI doesn't block the push, only the deploy: prod stays on the last
green commit, with no PR flow needed.

## Steps

Adapt to the project first. Check its layout (workspaces or not), its test commands, and how it
reads env vars, before copying anything below.

### 1. Code changes (one commit each)
1. **Build output.** Vite `build.outDir` → the folder Express serves (e.g. `../backend/public`),
   with `emptyOutDir: true` (needed when outDir is outside the Vite root). Gitignore the folder.
   Never commit build output: Render builds it.
2. **Express in prod.** `express.static` on that folder, plus an SPA fallback (`app.get('/{*splat}')`
   in Express 5) **after** the `/api` routes and an `/api` 404 handler, so deep links load the app.
   Gate both on `NODE_ENV === 'production'`: in dev the folder doesn't exist.
3. **`GET /api/health`.** Ping the DB through the DB service (`db.command({ ping: 1 })`): 200 when
   it answers, 503 when it doesn't, through the project's normal error path. Supertest: one happy
   path, one failure path (mock the ping).
4. **CI workflow** (`.github/workflows/ci.yml`), on push to `main`:
   - `actions/checkout`, `actions/setup-node` with `node-version-file: .nvmrc` and `cache: npm`.
     Look up the current major versions first.
   - **Env files: commit throwaway `.env.ci` files** next to `.env.example`, and `cp` them to the
     names the tests read. Not a heredoc in the YAML: a new key gets forgotten there. The values
     must pass the app's own validation (e.g. a seed password must meet the password rules).
     Allow `.env.ci` in `.gitignore` and in any secret-file hook.
   - **Mongo:** `docker compose -f <local compose file> up -d --wait` after checkout, so CI runs
     the same image and init scripts as local. A `services:` container starts before checkout and
     can't mount the init scripts.
   - `npm ci` → lint → typecheck → unit → `npx playwright install --with-deps chromium` → E2E.
     Unit and E2E in sequence if they share a test DB.
   - **No Playwright browser cache:** Playwright's docs advise against it
     (https://playwright.dev/docs/ci#caching-browsers).
   - `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`, a `timeout-minutes`,
     and upload the Playwright traces on failure.
   - Lint it: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`.
5. **`render.yaml`** (Blueprint). Check the fields against https://render.com/docs/blueprint-spec:
   ```yaml
   services:
     - type: web
       name: <app>
       runtime: node
       plan: free
       region: frankfurt   # the closest to the Atlas region; fixed after creation
       branch: main
       # --include=dev: NODE_ENV=production applies to the build too, and npm would skip vite/tsc
       buildCommand: npm ci --include=dev && npm run build -w frontend && npm prune --omit=dev
       startCommand: npm start -w backend
       autoDeployTrigger: checksPass
       healthCheckPath: /api/health
       buildFilter:
         ignoredPaths: [.claude/**, .docs/**, .github/**]   # never .nvmrc / .npmrc
       envVars:
         - key: NODE_ENV
           value: production
         - key: JWT_SECRET
           generateValue: true   # generated once; changing it logs everyone out
         - key: MONGODB_URI
           sync: false           # asked for on the first Blueprint apply only
   ```
   No `rootDir` with npm workspaces: the build needs the whole repo. Pin Node in `.nvmrc`.
   The server must read `process.env.PORT` (Render sets 10000) and not bind to localhost only.
6. **Docs:** a design doc, the architecture doc, the README's live URL.

### 2. Reminders for the user (outside the repo)
Tell the user each of these, in order:
1. **Atlas:** create a DB user with `readWrite` on one database only, and allow `0.0.0.0/0` in
   Network Access (Render's free plan has no static outbound IPs).
2. **Copy the Atlas connection string into `backend/.env.prod`** (gitignored), for local runs
   against prod such as the seed.  
   Atlas → Clusters → Connect → Drivers and Client Libraries → Copy the URL string and update 
   the password.
3. **Fill in the rest of `backend/.env.prod`** from `.env.example`. Use a placeholder for
   `JWT_SECRET` if the seed only needs the key to exist: the real one stays on Render.
4. **Render, once per project:**
   - GitHub → Settings → Applications → Installed GitHub Apps → Render → Configure →
     "Only select repositories" → add the repo.
   - Push `render.yaml` and the CI workflow to `main` first.
   - Render → New → **Blueprint** → pick the repo. The Blueprint name is only a dashboard label
     (user the project name, for example).
   - Fill in the `sync: false` values → Apply. The first deploy runs.
   - After that: push to `main` → CI green → deploy. YAML edits sync on push and win over
     dashboard edits for the fields they set. A `sync: false` key added later must be set in
     the dashboard by hand.

### 3. Verify
- The first CI run is green (it also proves native deps like `bcrypt` install without scripts,
  if `.npmrc` has `ignore-scripts`).
- Render's build log: `npm ci`, the Vite build, `npm prune`, then the server's start lines.
- `GET <live URL>/api/health` → 200. That proves the Atlas URI, user and network access.
- The site loads, and a deep link (e.g. `/some-page`) loads too.
- **Seed once**, locally: `node --env-file=.env.prod scripts/seed.ts` from `backend/`. Check the
  DB name in `.env.prod` first if the seed wipes collections.

## Rollback
Render → the service → **Events** → **Rollback** on an earlier successful deploy. It reuses that
build, so it's fast. A dashboard rollback (and Manual Deploy → "Deploy a specific commit") **turns
auto-deploy off**: fix `main`, then turn auto-deploy back on in Settings.

## Free plan facts (checked 2026-10-25)
- Sleeps after 15 min without inbound traffic, ~1 min cold start. Health checks don't keep it
  awake. Sockets drop on sleep.
- 750 instance hours per workspace per month. A sleeping service uses none, and one always-on
  service fits (a month is ~744 h).
- Health checks: answer within 5 s. 15 s of failures → no traffic, 60 s → restart. A deploy whose
  checks never pass within 15 min is cancelled, and the old instance keeps serving.
- A commit with zero CI checks doesn't deploy under `checksPass` (e.g. `[skip ci]`).
- One instance only, unless socket state moves to a shared adapter (e.g. Redis).

## Later, for a real project
- Rate-limit login, with `app.set('trust proxy', 1)` behind Render's proxy.
- A request logger. App and DB in the same region.
