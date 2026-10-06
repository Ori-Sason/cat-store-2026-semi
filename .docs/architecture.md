# Architecture — Cat Store

## Overview
TypeScript monorepo (npm workspaces): `shared`, `frontend`, `backend`.
One Express server serves both `/api` and the built FE in prod → same-origin, no CORS.

```
dev:  browser ──▶ Vite :5173 ──(proxy /api)──▶ Express :8000 ──▶ MongoDB
prod: browser ──▶ Express (static FE + /api + socket.io) ──▶ MongoDB (Atlas)
```

## Components
- `shared/` (`@cat-store/shared`) — wire contract: types, Zod schemas, constants,
  `catFilterService`. No build step, erasable TS only, no DOM/Node/mongodb imports.
- `frontend/` — Vite + React SPA. Routes and data loading via `react-router`, client state
  in Zustand, HTTP via axios with relative URLs only (`/api/...`).
- `backend/` — Express 5, route → controller → service layers, native `mongodb`
  driver (no Mongoose). Node runs `.ts` directly (type stripping).
- Collections: `cats`, `users`, `reviews`. Every doc has server-set `createdAt`/`updatedAt`.

## Auth Boundary
- JWT in an httpOnly cookie (`loginToken`). Backend middleware enforces
  guest / owner / admin rules on cats and reviews. The FE only hides UI.
- `ownerId` / `userId` are set by the server, never accepted from the client.

## Stack
Main libraries only. Exact versions and `@types/*` live in each `package.json`.
- shared: zod. Its schemas are the validation for both FE and BE.
- frontend: React, TypeScript, react-router 8, Zustand, axios, Vite, Sass, OpenLayers (`ol`,
  about-page map).
- backend: Express 5, native `mongodb` driver. No Mongoose, no `ts-node`/`tsx`.
- auth: jsonwebtoken, bcrypt, cookie-parser. Installed already, used from Part 3.
- testing: Vitest everywhere, React Testing Library + jsdom (FE), Supertest (BE).
- tooling: oxlint, oxfmt.
- planned: Playwright (Part 3), socket.io + socket.io-client (Part 5).

External services: MongoDB (local in dev, Atlas in prod), Render (hosting).
Env: `node --env-file=.env.local`, no dotenv. Prod needs `JWT_SECRET`, Mongo URL,
`NODE_ENV=production`.

## Decisions
- **npm workspaces** (`shared`, `frontend`, `backend`): one root `node_modules`, one root
  `package-lock.json`. Run scripts with `npm run <script> -w <pkg>`.
  Why: the FE and BE need to share types and Zod schemas without publishing a package.
- **`shared/` has no build step.** Its `exports` points at `.ts` files: Vite compiles them
  for the FE, and Node strips the types for the BE.
  Why: no build step means no stale build output and no watch process. The cost is
  erasable-only TS syntax and no DOM/Node types in shared's tsconfig.
- **The query-string → filter parsing lives in shared** (`catFilterService.paramsToFilter`),
  and both the FE loader and the BE `GET /api/cats` controller call it.
  Why: one parser, so the FE and BE can't disagree on what a URL means.
- **FE server data goes through react-router loaders and actions.** Zustand holds only client
  state, with no cat store.
  Why: the router already holds and revalidates the data, and a store copy would go stale.
- **Server-set timestamps:** every doc (cats, users, reviews) has `createdAt`/`updatedAt`, set
  by the server with `Date.now()`. `updatedAt` changes on every update. Client-sent values are
  stripped by Zod.
  Why: the client clock and the client itself aren't trusted.
- **No CORS. Use the Vite dev proxy** (`/api` → `:8000`), and the FE uses only
  relative URLs.
  Why:
  - CORS is a browser rule. It only applies to browser requests to a *different origin*.
  - With the proxy, the browser only talks to Vite's port. Vite forwards `/api` to Express
    Node → Node, with no browser in that hop, so there's no CORS check.
  - In prod, Express serves the FE and `/api` from one origin, so the proxy is dev-only.
  - Same-origin cookies (auth from Part 3) need no `cors({ credentials })` / `withCredentials`.
  - Socket.io (Part 5) needs its own proxy entry: `'/socket.io'` with `ws: true`. Its
    default request path is `/socket.io/`, so `ws: true` on `/api` wouldn't catch it.
  - CORS would only be needed for split hosting: FE on one domain, API on another.

- **Tests: Vitest everywhere, one root run.** The root `vitest.config.ts` lists `shared`,
  `frontend` and `backend` as projects, so `npm test` runs all three. Each package can still
  run alone with `npm test -w <pkg>`. Unit tests sit next to their source as `*.test.ts(x)`.
  Why: Vitest reuses the Vite config, so the FE tests get the same plugins and SCSS paths as
  the app. It runs TS directly, matching the no-build-step setup.
- **Backend tests hit a real MongoDB.** Same `db-local` container, separate database, set via
  `backend/.env.test`. Supertest calls the Express app in memory.
  Why: mocking the native driver tests the mock, not the queries. A second database is free,
  so no extra container is needed.
- **DB setup is opt-in per test file.** A file that touches Mongo calls `setupTestDb()`
  (`backend/test/test-db.helper.ts`). It empties collections with `deleteMany` before each test.
  Why: files without DB work never connect. `deleteMany` keeps the indexes, which a drop would lose.
- **Backend test files run one at a time** (`fileParallelism: false`).
  Why: they share `catsTest`, so a parallel file's wipe would delete another file's data.
  If the suite gets slow, move to one DB per worker. That needs the `catStoreTest` user widened.
- **The app never connects as root.** `db-local/init/create-app-users.js` creates one user
  per database, each with `readWrite` on its own database only (`cats` → dev, `catsTest` → tests).
  Why: least privilege. And since tests wipe their database, a test config pointing at `cats`
  by mistake fails on auth instead of deleting dev data.
- **E2E with the Playwright CLI, from Part 3.** Headless Chromium on the VM, no browser-driving MCP.
  Why: before auth there's no full flow worth covering end to end. The CLI only reports
  pass/fail, while driving a browser step by step costs many tokens.
- **About-page map: OpenLayers + OSM raster tiles, no React wrapper.**
  Why: no API key or billing (Google Maps needs both). Compared with MapLibre, it's a
  ~3–5x smaller bundle, has no Vite worker workaround, has a clean security record with rare
  majors, and its tests run real map code in jsdom.

Open questions live in `roadmap.md`. When one is decided, record it here.

## Update Triggers
- Update this file when the stack, auth boundaries, collections, or the dev/prod topology
  change, or when an open question from `roadmap.md` is decided.
- Add a Change Log line (date + one line) only when the architecture itself changes:
  components, how they connect (dev/prod topology), data flow, or the auth boundary.
  New decisions inside the same shape, config, and doc edits don't count.

## Change Log
- 2026-10-01 — Initial architecture.
- 2026-10-04 — FE data flow: server data via react-router loaders/actions, Zustand for client state only.
