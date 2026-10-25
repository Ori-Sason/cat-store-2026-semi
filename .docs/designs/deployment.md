# Deployment design

How the app gets from a push to production: CI on GitHub Actions, hosting on Render, the DB on
MongoDB Atlas. Roadmap Part 7.

This doc covers the flow, the setup steps and the decisions behind them. Each "Not chosen" list
exists so a later session doesn't propose a rejected option again. The config itself lives in
`render.yaml` and `.github/workflows/ci.yml`, with the module-level whys in their comments.

## The big picture
```
local:   commit ──▶ lefthook pre-commit: format, lint, typecheck
         push   ──▶ lefthook pre-push:   unit tests, then E2E
                        │
GitHub:  main ──▶ Actions (ci.yml): lint → typecheck → unit → E2E
                        │ all checks green
Render:  autoDeployTrigger: checksPass
           build:  npm ci --include=dev → build FE into backend/public → npm prune --omit=dev
           start:  npm start -w backend  (node server.ts)
           switch: traffic moves to the new instance once GET /api/health answers 200
                        │
                        ▼
         browser ──▶ Express (static FE + /api + socket.io) ──▶ Atlas (cluster0, eu-west-1)
```
- **No PR flow.** It's a solo project: merge locally, push `main`. CI runs on pushes to `main`
  only, since other branches stay local.
- **A red CI doesn't block the push, only the deploy.** The commit is on `origin/main` already,
  but Render deploys only commits whose checks all pass, so prod stays on the last green commit.
  The pre-push hook guards the remote, CI guards prod.
- **A commit with no checks doesn't deploy either.** That includes a `[skip ci]` commit.  
  A commit that only touches tooling, docs or notes is skipped on purpose (`buildFilter.ignoredPaths`).
- **CI skips docs-only commits too** (`paths-ignore` in `ci.yml`). Its list must stay a subset of
  Render's: a path CI skips but Render doesn't would leave that commit with no checks, so it would
  never deploy. CI still runs for `.github/**` (a workflow change must run the workflow) and the
  oxlint / oxfmt configs (CI runs those tools).

## Render
One web service from a Blueprint (`render.yaml`): `plan: free`, `region: frankfurt`, one instance.

- **Render builds the FE.** Vite writes into `backend/public` (`build.outDir`), and Express
  serves it from there. The folder is gitignored, so no build output is ever committed.
- **`--include=dev` on `npm ci`.** `NODE_ENV=production` is a user-set env var, so it applies to
  the build too, and npm then skips devDependencies (vite, tsc, sass).
- **`npm prune --omit=dev` after the build.** The running service keeps only runtime deps. Node's
  type stripping runs the `.ts` files without `typescript`.
- **No `rootDir`.** npm workspaces build from the repo root. `rootDir: backend` would hide
  `shared/` and `frontend/` from the build.
- **Node version comes from `.nvmrc`.** Render reads it before root `engines`.
- **`PORT` comes from Render** (10000). `server.ts` reads it, and `listen()` binds every interface.
- **Free plan, accepted:** sleeps after 15 min without inbound traffic, ~1 min cold start, and open
  sockets drop on sleep (socket.io reconnects). 750 free instance hours per workspace per month,
  and a sleeping service uses none. One always-on service fits in that (a month is ~744 h).
- **One instance only.** Socket.io presence and rooms live in process memory. A second instance
  needs a Redis adapter.

### Env vars
| Key | Source | Notes |
|---|---|---|
| `NODE_ENV` | `value: production` | `secure` cookie, no 500 internals in responses |
| `JWT_SECRET` | `generateValue: true` | Generated once, when the Blueprint creates the service. Survives deploys, restarts and sleep. Changing it logs every user out, which is also how to rotate it |
| `MONGODB_URI` | `sync: false` | Asked for on the first Blueprint apply only |
| `MONGODB_DATABASE` | `sync: false` | Same |

A `sync: false` key added later isn't asked for: set it in the dashboard by hand. A missing one
makes `requireEnv` (`backend/config/index.ts`) throw at boot, so the deploy fails instead of
half-working.

### Not chosen
- **"New Web Service" in the dashboard.** It's a manual questionnaire and ignores `render.yaml`.
- **"Public Git Repository".** No push events and no CI check status, so no auto-deploy and no
  `checksPass`.
- **Branch protection with required checks.** It blocks every direct push to `main`, so it needs a
  PR flow.
- **Committing the build, or `npm run build` + copy by hand.** Render builds on every deploy.
- **`express.static` on `frontend/dist`.** It works too, but the backend folder should hold
  everything it serves.
- **An allow list (`buildFilter.paths`).** A new app folder would silently not deploy until
  someone adds it. The ignore list fails the safe way.

## Health check
`GET /api/health` pings Mongo: `200 { status: 'ok' }`, or `503 SERVICE_UNAVAILABLE` when the
ping fails. It pings the DB on purpose: "up" means the app can serve data, not only that the
process is alive. Render's timings (https://render.com/docs/health-checks): a check must answer
within 5 s, and checks run every few seconds. They don't keep a free instance awake: the docs
don't say so, but Render staff confirm it on the community forum
(https://community.render.com/t/free-accounts-seems-to-launch-every-hour/20597).

### When the DB goes down while the app runs
```
 Atlas down
     │
     ▼
 /api/health ── ping fails (or hangs past the 5 s check timeout) ──▶ 503
     │
     ├─ ~15 s of failed checks ──▶ Render stops routing traffic ──▶ users get Render's error page
     │
     └─ ~60 s of failed checks ──▶ Render restarts the instance
                                       │
                                       ▼
                         server.ts: await mongoService.connect()
                                       │
                          ┌────────────┴─────────────┐
                    Atlas still down             Atlas back
                          │                          │
                 throws → process exits      connects → health 200
                          │                          │
                 Render restarts it ◀─┐       traffic resumes, sockets
                          │           │       reconnect: recovered
                          └── loop ───┘
                          │
                 15 min with no inbound traffic ──▶ the instance sleeps
                 (no hours used; the next visit wakes it into the same check)
```
There's no restart cap on Render, and none is needed here. With one instance, the site is down
either way while the DB is down. Auto-recovery is the part worth keeping, and the loop costs no
money on the free plan.

### When the DB is down during a deploy
```
 push ──▶ CI green ──▶ Render builds the new instance ──▶ health check fails (503 or crash)
                                                               │
                                     15 min without a passing check
                                                               │
                                                               ▼
                                  Render cancels the deploy; the old instance keeps serving
```

## CI (GitHub Actions)
`.github/workflows/ci.yml`, on push to `main`. Expect ~4–6 min per push.

- **Same order as the hooks:** `npm ci` → lint → typecheck → `npm test` → `npm run test:e2e`.
  Unit and E2E never overlap: both wipe `catsTest`.
- **Mongo from `db-local/`, not a `services:` container.** Service containers start before
  checkout, so they can't mount `db-local/init/` (the app users). `docker compose up -d --wait`
  runs the same image and init script as local, and waits for its healthcheck.
- **Committed `.env.ci` files** (`db-local/.env.ci`, `backend/.env.ci`) hold throwaway values,
  for a DB that lives only for one job. CI copies them to the names local runs read. They sit
  next to `.env.example`, so a new key is hard to miss there. The secret-file hook and
  `.gitignore` both allow `.env.ci` by name.
- **No Playwright browser cache.** Playwright's docs recommend against it: restoring the cache
  takes about as long as downloading the browser, and on Linux the OS dependencies must be
  installed every run anyway, since they aren't cacheable
  (https://playwright.dev/docs/ci#caching-browsers). One step,
  `npx playwright install --with-deps chromium`, does both.
- **`concurrency` with `cancel-in-progress`.** Only the newest commit can deploy, so a run for an
  older one is wasted.
- **Failed E2E runs upload their traces** (`frontend/test-results`, 7 days).

### Not chosen
- **CI on every branch and PR.** There's no PR flow, and other branches never leave the machine.
- **A `mongo` service container.** See above.
- **Writing the env files inside the workflow.** A key added to `.env.example` would be easy to
  forget in the YAML.

## Atlas
- **The existing `cluster0` in `eu-west-1` (Ireland), kept.** Render has no Ireland region, so
  Frankfurt is the closest: ~20–25 ms per DB round trip, 2–3 per request. Fine for a practice
  project. In a real one, put the app and the DB in one region.
- **Network access is `0.0.0.0/0`.** Render's free plan has no static outbound IPs. The DB user
  is least-privilege: `readWrite` on the one database.
- **Indexes need no action.** `_ensureIndexes` (`backend/services/mongodb.service.ts`) runs the
  idempotent `createIndex` on every connect, so the first boot creates them.

## Setup, once per project
1. Atlas: create the DB user (`readWrite` on one DB) and allow `0.0.0.0/0`.
2. `backend/.env.prod` (gitignored): the Atlas connection string, the DB name, and the rest of the
   keys from `backend/.env.example`. It's for local runs against prod, such as the seed.
3. GitHub → Settings → Applications → Installed GitHub Apps → Render → Configure →
   "Only select repositories" → add the repo. Render then sees only that repo.
4. Push `render.yaml` and the CI workflow to `main`.
5. Render → New → **Blueprint** → pick the repo → fill in the `sync: false` values → Apply.
   The first deploy runs. The Blueprint name is only a dashboard label: the service name comes
   from `render.yaml`.
6. Check the first build log, then `GET /api/health` on the live URL
   (https://cat-store-i404.onrender.com).
7. Seed once, before real users (below).

After that: push to `main` → CI green → deploy. `render.yaml` edits sync on push and win over
dashboard edits for the fields they set.

## Prod seed
Once, locally, from `backend/`: `node --env-file=.env.prod scripts/seed.ts`.
- **It wipes `cats`, `reviews` and `chatMsgs`** in the DB that `MONGODB_DATABASE` names (users are
  only added). Check the DB name first.
- **One shared `SEED_USERS_PASSWORD` for every seed user, `admin` included.** Insecure, accepted for
  a practice project. No credentials in the README: they're handed out by hand.
- **`JWT_SECRET` in `.env.prod` is a placeholder.** The seed loads `backend/config/index.ts`, whose
  `requireEnv` needs the key to exist, but it never signs a token. Keeping the real secret only on
  Render means a leaked `.env.prod` can't forge logins.

## Rollback
Render → the service → **Events** → **Rollback** on an earlier successful deploy
(https://render.com/docs/rollbacks).
- **It reuses that deploy's build, with no rebuild,** so it's fast. Render keeps only a few recent
  builds, so old deploys may not be available to roll back to.
- **A dashboard rollback turns auto-deploy off.** So does Manual Deploy → "Deploy a specific
  commit". Fix the bad commit on `main` (a revert or a fix), then turn auto-deploy back on in the
  service's Settings. Until then, pushes don't deploy, even with green CI.

## Later
- **Rate-limiting login** (`express-rate-limit`). Behind Render's proxy it needs
  `app.set('trust proxy', 1)`, or every request shares one IP.
- **A request logger** that reads `requestId` / `tokenUser` from the per-request context.
