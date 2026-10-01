# Architecture — Cat Store

## Overview
TypeScript monorepo (npm workspaces): `shared`, `frontend`, `backend`.
One Express server serves both `/api` and the built FE in prod → same-origin, no CORS.

```
dev:  browser ──▶ Vite :5173 ──(proxy /api, ws)──▶ Express :8000 ──▶ MongoDB
prod: browser ──▶ Express (static FE + /api + socket.io) ──▶ MongoDB (Atlas)
```

## Components
- `shared/` (`@cat-store/shared`) — wire contract: types, Zod schemas, constants,
  `catFilterService`. No build step, erasable TS only, no DOM/Node/mongodb imports.
- `frontend/` — Vite + React SPA. Routes via `react-router`, state in Zustand,
  HTTP via axios with relative URLs only (`/api/...`).
- `backend/` — Express 5, route → controller → service layers, native `mongodb`
  driver (no Mongoose). Node runs `.ts` directly (type stripping).
- Collections: `cats`, `users`, `reviews`. Every doc has server-set `createdAt`/`updatedAt`.

## Auth Boundary
- JWT in an httpOnly cookie (`loginToken`). Backend middleware enforces
  guest / owner / admin rules on cats and reviews. The FE only hides UI.
- `ownerId` / `userId` are set by the server, never accepted from the client.

## Dependencies
| Package | Runtime | Dev |
|---|---|---|
| shared | zod | — (uses root-hoisted typescript) |
| frontend | @cat-store/shared, react, react-dom, react-router 8, zustand, axios, zod | vite, @vitejs/plugin-react, typescript, sass, oxlint, oxfmt, @types/react, @types/react-dom |
| backend | @cat-store/shared, express 5, mongodb, zod | typescript, @types/node, @types/express |
| backend, Part 3 | jsonwebtoken, bcrypt, cookie-parser | matching @types/* |
| Part 5 | socket.io (BE), socket.io-client (FE) | |
| root | | vitest |
| frontend, tests | | @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom |
| backend, tests | | supertest, @types/supertest |
| frontend, Part 3 | | @playwright/test (headless Chromium) |

- Validation: `zod`, with the schemas shared by FE and BE through `@cat-store/shared`.
- Lint/format: `oxlint`, `oxfmt`.
- Backend TS: Node runs `.ts` directly via type stripping. No build step, no `ts-node`/`tsx`.

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
- **Server-set timestamps:** every doc (cats, users, reviews) has `createdAt`/`updatedAt`, set
  by the server with `Date.now()`. `updatedAt` changes on every update. Client-sent values are
  stripped by Zod.
  Why: the client clock and the client itself aren't trusted.
- **No CORS. Use the Vite dev proxy** (`/api` → `:8000`, `ws: true`), and the FE uses only
  relative URLs.
  Why:
  - CORS is a browser rule. It only applies to browser requests to a *different origin*.
  - With the proxy, the browser only talks to Vite's port. Vite forwards `/api` to Express
    Node → Node, with no browser in that hop, so there's no CORS check.
  - In prod, Express serves the FE and `/api` from one origin, so the proxy is dev-only.
  - Same-origin cookies (auth from Part 3) need no `cors({ credentials })` / `withCredentials`.
  - `ws: true` forwards WebSocket upgrades too, for Socket.io in Part 5.
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
- **The app never connects as root.** `db-local/init/create-app-users.js` creates one user
  per database, each with `readWrite` on its own database only (`cats` → dev, `catsTest` → tests).
  Why: least privilege. And since tests wipe their database, a test config pointing at `cats`
  by mistake fails on auth instead of deleting dev data.
- **E2E with the Playwright CLI, from Part 3.** Headless Chromium on the VM, no browser-driving MCP.
  Why: before auth there's no full flow worth covering end to end. The CLI only reports
  pass/fail, while driving a browser step by step costs many tokens.

Open questions live in `roadmap.md`. When one is decided, record it here.

## Update Triggers
- Update this file when API routes, auth boundaries, org boundaries, or major component ownership changes.

## Change Log
- 2026-10-01 — Initial architecture.
