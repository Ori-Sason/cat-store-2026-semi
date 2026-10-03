# cat-store v2 — roadmap

A rebuild of cat-store (a reskin of the bootcamp "mister-toy" spec), this time built with plan/auto mode.
The roadmap gives the shape of the project, not a literal script.

This file covers **what** gets built, **in what order**, and how far along it is.
Stack, dependencies and the **why** behind decisions live in `architecture.md`.

**Current:** Part 1. The skeleton is in place: the BE server (error middleware, ALS, Mongo
connection), the FE scaffold (router, layout, HTTP and error services, user messages), the
shared user, error and cat models (`catSchema` with tests), and Vitest in every package.
`npm run seed -w backend` wipes and re-seeds the `cats` collection from
`backend/scripts/data/cats.json`, adding random labels and a robohash `imgUrl`. There's no cat route yet.

## Part 1: DB + backend + frontend skeleton (CRUD over cats)

No localStorage and no JSON-file stage. The app runs on a real DB from day one.

- [x] 1. Set up MongoDB with a `cats` collection.
- [x] 2. Cat shape: `{ _id, name, price, labels: [...], isInStock, imgUrl, createdAt, updatedAt }`.
   No `ownerId` yet. It's added in Part 3, when users exist.
   `imgUrl` is optional in the form, and the user can leave it empty. If it's empty, the backend fills in a default image link before saving. There's no upload. The field is a URL only.
- [ ] 3. Express backend split into service, controller and route layers.
- [ ] 4. Build the routes in Postman order: GET list (with filterBy) → GET by id → DELETE → POST → PUT.
- [x] 5. No CORS. Use the Vite dev proxy (`/api` → `:8000`). The FE calls relative
   URLs only (`/api/cats`). Why: see `architecture.md` → Decisions.
- [ ] 6. Zod validation on backend requests, using the shared `catSchema`. The schema covers only the fields the client may send. `_id`, `createdAt`, `updatedAt` (and later `ownerId`) are set by the server, and Zod strips unknown keys, so the client can't set them.
- [ ] 7. Scaffold `frontend/` with a CLI (Vite + React + TS). `catService` calls the API over AJAX (axios).
- [ ] 8. `cat-app` page (smart, routable), made of `cat-list`, `cat-preview` and `cat-filter`.
- [ ] 9. Filter by name, in-stock and several labels at once. Sort by name, price or created.
- [ ] 10. `cat-details` page (smart, routable). No reviews yet.
- [ ] 11. `cat-edit` page (smart, routable) for add and edit.
- [ ] 12. App state lives in a Zustand store.
- [ ] 13. Hand-rolled form validation: errors come from the Zod schema on every render, plus `touched`/`isSubmitted` state. No form library.

The order of BE and FE can go either way, as long as the DB comes first.

## Styling (ongoing, not a separate stage)

- SCSS from the start: nesting, variables, mixins, functions.
- Responsive on desktop, tablet and mobile as each feature is built.

## Testing (ongoing, not a separate stage)

- [x] Remove `passWithNoTests` (root `vitest.config.ts`, and `--passWithNoTests` in the
   `shared`, `frontend` and `backend` test scripts) once every package has at least one test.
   Until then it keeps an empty package from failing the run. After that, it would hide a broken
   `include` pattern that finds 0 tests.

## Part 2: Dashboard + About page

- [ ] 1. Dashboard with charts: price per label, in-stock % per label. **The chart library is still open.**
- [ ] 2. About page with a pickup-point locator: one marker per pickup point, click a pickup point to center the map on it. Google Maps is one option.

## Part 3: Users + auth

- [ ] 1. `users` collection: `{ _id, fullname, username, password, isAdmin, createdAt, updatedAt }`, with one seeded admin.
   `password` is a bcrypt hash, never the plain text.
- [ ] 2. Login and signup pages.
- [ ] 3. Auth uses a JWT stored in a cookie.
- [ ] 4. Add `ownerId` to cats:
   - New cats get `ownerId` = the logged-in user's `_id`, set by the server.
   - `ownerId` is not in `catSchema`, so the client can't send or change it.
   - Existing cats need an owner, e.g. backfill them to the seeded admin.
- [ ] 5. Rules for cats:

   | Action          | Guest | Logged-in user  | Admin |
   |-----------------|-------|-----------------|-------|
   | Read            | ✅    | ✅              | ✅    |
   | Add             | ❌    | ✅              | ✅    |
   | Edit / delete   | ❌    | Own cats only   | ✅    |

- [ ] 6. Backend middleware enforces these rules. The FE hides buttons and pages the user can't use.
- [ ] 7. E2E with Playwright. This is the first point with a full flow, so no E2E before it.
   - Install the test runner with headless Chromium only (`npx playwright install --with-deps chromium`).
     It runs on the VM from the CLI. No browser-driving MCP.
   - Specs live in `frontend/e2e/`, excluded from Vitest's `include`.
   - Start with a few critical flows: browse → filter → cat details, sign up → log in, admin cat CRUD.
   - After that, add E2E only when asked, or when a part adds a new end-to-end flow.

## Part 4: Reviews + user page

- [ ] 1. `reviews` collection: `{ _id, userId, catId, content, createdAt, updatedAt }`.
- [ ] 2. An aggregation (`$lookup`) that joins review + cat + user into one shape.
- [ ] 3. On `cat-details`: a list of that cat's reviews plus a form to add one.
- [ ] 4. Rules for reviews:

   | Action          | Guest | Logged-in user    | Admin |
   |-----------------|-------|-------------------|-------|
   | Read            | ✅    | ✅                | ✅    |
   | Add             | ❌    | ✅                | ✅    |
   | Edit / delete   | ❌    | Own reviews only  | ✅    |

- [ ] 5. `user-details` page with two sub-pages: the user's cats and the user's reviews.
   Anyone can open any user's profile. For example, user1 can see the cats and reviews user2 created.
- [ ] 6. Reviews show up in exactly two places: per cat on `cat-details`, and per user on the user's reviews sub-page. There's no system-wide reviews page.

## Part 5: Deploy + realtime

- [ ] 1. Deploy to Render, with MongoDB Atlas as the prod DB. Express serves the built FE from `backend/public`.
   **Open:** the Render build/start steps aren't configured yet.
- [ ] 2. Socket.io chat room on `cat-details`, one room per `cat._id`:
   - Dev proxy first: Socket.io connects on `/socket.io/`, not `/api`. So add a
     `'/socket.io'` entry with `ws: true` to the Vite proxy. `ws: true` on the `/api`
     entry wouldn't catch it.
   - Chat log with a username before each message.
   - A "X is typing…" indicator.
   - Chat history saved on the cat document.
- [ ] 3. When any user adds, edits or deletes a cat or a review, notify all connected users.

No image upload.

### Prod checklist

Before the first real deploy. This turns into a `deploy` skill once Part 5 starts.

- `JWT_SECRET` set on the host, different from the local one (`openssl rand -base64 32`). Without it the server refuses to start.
- Mongo connection env vars point at the prod DB (e.g. Atlas).
- `NODE_ENV=production`, so the auth cookie gets `secure` and 500 errors don't leak internals.
- Node version pinned (root `engines` or `.nvmrc`), since running `.ts` directly needs a recent Node.
- Consider rate-limiting login (`express-rate-limit`).
- Consider a logger that reads `requestId` / `loggedInUser` from the per-request context.

## Extras (optional)

- [ ] Pagination on the cat list.
- [ ] CI: GitHub Actions runs lint, typecheck and tests on every push and PR, with a `mongo`
   service container for the backend tests. Most useful before the Part 5 deploy.

## Open questions

Single home for open questions. Once one is decided, record the answer in `architecture.md` → Decisions and remove it here.

- Which chart library to use for the dashboard.
- Which maps library to use (Google Maps is one option).
- Deploy: Render build/start steps.

## Update Triggers
- Mark an item `[x]` only when it's fully done, and update the **Current** line in the same change.
- Update this file when a part's scope or order changes, or when an open question is added or decided.
