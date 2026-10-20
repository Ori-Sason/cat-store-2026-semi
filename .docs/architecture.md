# Architecture — Cat Store

## Overview
TypeScript monorepo (npm workspaces): `shared`, `frontend`, `backend`.
One Express server serves `/api`, Socket.io and the built FE in prod → same-origin, no CORS.

```
dev:  browser ──▶ Vite :5173 ──(proxy /api, /socket.io)──▶ Express :8000 ──▶ MongoDB `cats`
test: Vitest + Supertest (in memory) ─────────────────────────▶ MongoDB `catsTest`
      Vitest + socket.io-client ──▶ Express + Socket.io :0 ───▶ MongoDB `catsTest`
e2e:  Playwright ──▶ Vite :5174 ──(proxy /api, /socket.io)──▶ Express :8001 ──▶ MongoDB `catsTest`
prod: browser ──▶ Express (static FE + /api + socket.io) ──▶ MongoDB (Atlas)
```

## Components
- `shared/` (`@cat-store/shared`) — the wire contract: types, Zod schemas, constants, and
  the logic both sides must agree on (filter parsing, permission rules).
- `frontend/` — Vite + React SPA. Routes and server data via `react-router`, client state
  in Zustand, HTTP via axios with relative URLs only (`/api/...`).
- `backend/` — Express 5, route → controller → service layers, native `mongodb` driver.
  Socket.io attaches to the same http server (in `server.ts`, not `app.ts`) for the cat chat.
  Each socket event runs a chain of steps, like an Express route: validate → auth → room
  membership → controller.
- Collections: `cats`, `users`, `reviews`, `chatMsgs`. Every doc has server-set `createdAt`/`updatedAt`.

## Auth Boundary
- JWT in an httpOnly cookie (`loginToken`): `sameSite: 'strict'`, `secure` in production.
  "Remember me" (`isRemembered`) → cookie and token last 7 days. Without it → a session cookie
  and a 1-day token, so a browser that never closes doesn't keep the login forever.
- `attachTokenUser` reads the token into the ALS store (`tokenUser`) on every request, with no
  DB read and no blocking. `GET /api/auth/me` re-reads the user from the DB, and returns
  `200 null` for a guest: the FE calls it on every app load, and a guest isn't an error.
- `requireAuth` re-reads the user from the DB and sets `verifiedUser`, the only user permission
  checks trust. A deleted or demoted user is caught before their token expires.
- The backend enforces guest / owner / admin rules on cats and reviews. The FE only hides UI.
  Both check edit / delete through the shared permission services, so they agree on the rule.
- `_id`, `ownerId`, `userId` and the timestamps are server-set. Zod strips them from the body.
- Socket.io: the handshake reads the same cookie into `socket.data.tokenUser` (a guest on a
  missing or bad token, no DB read). A socket can outlive its token, so each event that needs a
  user re-checks `exp`, and chat writes also re-read the user from the DB (`requireSocketUser`,
  the socket `requireAuth`). A failed check rejects the event, never the connection.
- Logout only clears the cookie. A copied token works until its `exp`. Revoking would need a
  denylist checked on every request, which is a session store again.

## Stack
Main libraries only. Exact versions and `@types/*` live in each `package.json`.
- shared: zod. Its schemas are the validation for both FE and BE.
- frontend: React, TypeScript, react-router 8, Zustand, axios, socket.io-client, Vite, Sass,
  OpenLayers (`ol`).
- backend: Express 5, native `mongodb` driver, socket.io. No Mongoose, no `ts-node`/`tsx`.
- auth: jsonwebtoken, bcrypt, cookie-parser.
- testing: Vitest everywhere, React Testing Library + jsdom (FE), Supertest and socket.io-client
  (BE), Playwright (E2E).
- tooling: oxlint, oxfmt, lefthook.

External services: MongoDB (local in dev, Atlas in prod), Render (hosting).
Env: `node --env-file=.env.local`, no dotenv. Prod needs `JWT_SECRET`, Mongo URL,
`NODE_ENV=production`.

## Decisions
- **npm workspaces, and `shared/` has no build step.** Its `exports` points at `.ts` files:
  Vite compiles them for the FE, and Node strips the types for the BE.
  Why: the FE and BE share types and schemas without publishing a package, and there's no
  stale build output or watch process. The cost: erasable-only TS and no DOM/Node types in shared.
- **One query-string parser, in shared.** `catFilterService.paramsToFilter` runs in both the FE
  loader and the BE `GET /api/cats` controller.
  Why: the FE and BE can't disagree on what a URL means.
- **FE server data goes through react-router loaders and actions.** Zustand holds only client
  state, with no cat store. Mutations shared by several pages post to action-only routes
  (`/review`, `/review/:id`), and a section that must reload alone is a child route with its
  own loader.
  Why: the router already holds and revalidates the data, and a store copy would go stale.
  A child route, not `useFetcher().load` from a resource route: that would start the request
  after render instead of in parallel with the parent's loader.
- **Data leaves the DB through allow-lists.** Joins use `$lookup` with an inclusion `$project`
  inside it (`USER_REF_FIELDS`, `CAT_REF_FIELDS`), and `GET /api/users/:id` projects
  `PUBLIC_USER_FIELDS`. Never `password`, and no `username` (half a login).
  Why: an exclusion (`{ password: 0 }`) would let a field added later leak by default.
  `isAdmin` is public on purpose, so the UI can mark staff whose edits leave no other trace.
- **No CORS. The Vite dev proxy forwards `/api`** to Express, and the FE uses only relative URLs.
  Why: CORS only applies to browser requests to a different origin. The browser only talks to
  Vite, and the Vite → Express hop is Node → Node. In prod one Express serves both. Same-origin
  cookies also need no `withCredentials`. CORS would only come back with split hosting.
  Socket.io needs its own proxy entry (`'/socket.io'` with `ws: true`): its default path is
  `/socket.io/`, so `ws: true` on `/api` wouldn't catch it.
- **The cat chat: socket writes, REST history.** Its state lives in a hook (`useCatChat`), the
  one exception to "server data through loaders": live events must merge into the fetched pages.
  Design and whys: `.docs/designs/chat.md`.
- **Tests hit a real MongoDB, never mocks of the driver.** A separate database (`catsTest`) in
  the same `db-local` container serves the backend Vitest suite and E2E.
  Why: mocking the driver tests the mock, not the queries. A second database is free.
- **The app never connects as root.** `db-local/init/create-app-users.js` creates one user
  per database, each with `readWrite` on its own database only.
  Why: least privilege. And since tests wipe their database, a test config pointing at `cats`
  by mistake fails on auth instead of deleting dev data.
- **E2E runs through the Playwright CLI, headless. No browser-driving MCP.**
  Why: the CLI only reports pass/fail, while driving a browser step by step through an MCP
  costs many tokens per run.

## Update Triggers
- Update this file when the stack, auth boundaries, collections, or the dev/prod topology
  change, or when an open question from `roadmap.md` is decided.
- Not for: choices scoped to one module, page or library. Their why goes in a code comment
  next to them, and test how-to goes in the `writing-tests` skill.
- Add a Change Log line (date + one line) only when the architecture itself changes:
  components, how they connect (dev/prod topology), data flow, or the auth boundary.
  New decisions inside the same shape, config, and doc edits don't count.

## Change Log
- 2026-10-01 — Initial architecture.
- 2026-10-04 — FE data flow: server data via react-router loaders/actions, Zustand for client state only.
- 2026-10-06 — Auth boundary: `/api/auth/*` routes, the `loginToken` cookie and `attachTokenUser`.
- 2026-10-11 — Collections: `reviews`, read with its author and cat joined via `$lookup`.
- 2026-10-12 — Compacted to cross-cutting decisions (a major doc edit, so it gets a log line). Module-level decisions moved to code comments, test how-to to the `writing-tests` skill.
- 2026-10-15 — Socket.io on the Express http server, and the `chatMsgs` collection (the cat chat backend).
- 2026-10-20 — The cat chat frontend: an app-wide socket connected on app load, the `chat:presence-changed` push, and the design doc in `.docs/designs/chat.md`.
