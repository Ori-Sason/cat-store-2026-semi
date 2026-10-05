# cat-store v2 — roadmap

A rebuild of cat-store (a reskin of the bootcamp "mister-toy" spec), this time built with plan/auto mode.
The roadmap gives the shape of the project, not a literal script.

This file covers **what** gets built, **in what order**, and how far along it is.
Stack, dependencies and the **why** behind decisions live in `architecture.md`.

**Current:** Part 1 is done: the cat API, the FE list, details and edit pages (over loaders and
actions), and Vitest in every package. `npm run seed -w backend` re-seeds the `cats` collection.
Part 2.1 is done: `/dashboard` charts the median price + range and the in-stock share per
label as HTML/CSS bars with the stats shown (over `GET /api/cats/stats`). Next: Part 2.2 (about page).

## Part 1: DB + backend + frontend skeleton (CRUD over cats)

No localStorage and no JSON-file stage. The app runs on a real DB from day one.

- [x] 1. Set up MongoDB with a `cats` collection.
- [x] 2. Cat shape: `{ _id, name, price, labels: [...], isInStock, imgUrl, createdAt, updatedAt }`.
   No `ownerId` yet. It's added in Part 3, when users exist.
   `imgUrl` is optional in the form, and the user can leave it empty. If it's empty, it's stored as `''` and the FE shows a default image (`cat-default-bw.png`), also used when an image fails to load. There's no upload. The field is a URL only.
- [x] 3. Express backend split into service, controller and route layers.
- [x] 4. Build the routes in Postman order: GET list (with filterBy) → GET by id → DELETE → POST → PUT.
- [x] 5. No CORS. Use the Vite dev proxy (`/api` → `:8000`). The FE calls relative
   URLs only (`/api/cats`). Why: see `architecture.md` → Decisions.
- [x] 6. Zod validation on backend requests, using the shared `catSchema`. The schema covers only the fields the client may send. `_id`, `createdAt`, `updatedAt` (and later `ownerId`) are set by the server, and Zod strips unknown keys, so the client can't set them.
- [x] 7. Scaffold `frontend/` with a CLI (Vite + React + TS). `catService` calls the API over AJAX (axios).
- [x] 8. `cat-app` page (smart, routable), made of `cat-list`, `cat-preview` and `cat-filter-bar`.
- [x] 9. Filter by name, in-stock and several labels at once. Sort by name, price or created.
   The filter lives in the URL, so it survives a reload and works with Back.
- [x] 10. `cat-details` page (smart, routable). No reviews yet.
- [x] 11. `cat-edit` page (smart, routable) for add and edit.
   One page at `/cat/new` and `/cat/:id/edit`. Save → the cat's details. Cancel → details (edit)
   or the list (add), keeping the list filter. A failed save stays on the page with the form filled.
   Server field errors aren't shown: the form runs the same `catSchema`, so a 400 gets the generic message.
- [x] 12. Client state lives in Zustand (user messages, later the logged-in user). Cat data loads
  through react-router loaders and actions, with no cat store (`architecture.md` → Decisions).
- [x] 13. Hand-rolled form validation: errors come from the Zod schema on every render, plus `touched`/`isSubmitted` state. No form library.
   Price stays a string in form state until it's parsed, so an empty field shows empty, not 0.

The order of BE and FE can go either way, as long as the DB comes first.

## Styling (ongoing, not a separate stage)

- SCSS from the start: nesting, variables, mixins, functions.
- Responsive on desktop, tablet and mobile as each feature is built.
- No Figma. Before Part 1 item 8, pick a layout from 2–3 throwaway HTML mockups (kept out of
   the repo), then add spacing, breakpoint, radius and shadow tokens before the first real component.
   **Picked:** the list has a top filter bar (search, stock toggle, sort dropdown, label chips) over a
   compact card grid. Details uses a two-column layout, a small image next to the info. Edit is one
   column, with the image preview next to the Image URL field.
   Keep the current blue palette. Each label gets its own soft color.

## Testing (ongoing, not a separate stage)

- [x] Remove `passWithNoTests` (root `vitest.config.ts`, and `--passWithNoTests` in the
   `shared`, `frontend` and `backend` test scripts) once every package has at least one test.
   Until then it keeps an empty package from failing the run. After that, it would hide a broken
   `include` pattern that finds 0 tests.

## Part 2: Dashboard + About page

- [x] 1. Dashboard with charts: median price + range per label, in-stock % per label.
- [ ] 2. About page with a pickup-point locator: one marker per pickup point, click a pickup point to center the map on it. Google Maps is one option.

## Part 3: Users + auth

- [ ] 1. Set up Playwright E2E first, before any auth code.
   - Install the test runner with headless Chromium only (`npx playwright install --with-deps chromium`).
     It runs on the VM from the CLI. No browser-driving MCP.
   - Specs live in `frontend/e2e/`, excluded from Vitest's `include`.
   - Prove the setup with one guest smoke flow: browse → filter → cat details.
   - Then add an E2E test with each auth piece as it lands: sign up → log in, the cat rules,
     admin cat CRUD. Auth is where mocks hide the most (cookies, the proxy, BE guards).
   - After Part 3, add E2E only when asked, or when a part adds a new end-to-end flow.
- [ ] 2. `users` collection: `{ _id, fullname, username, password, isAdmin, createdAt, updatedAt }`, with one seeded admin.
   `password` is a bcrypt hash, never the plain text.
- [ ] 3. Login and signup pages.
- [ ] 4. Auth uses a JWT stored in a cookie.
- [ ] 5. Add `ownerId` to cats:
   - New cats get `ownerId` = the logged-in user's `_id`, set by the server.
   - `ownerId` is not in `catSchema`, so the client can't send or change it.
   - Existing cats need an owner, e.g. backfill them to the seeded admin.
- [ ] 6. Rules for cats:

   | Action          | Guest | Logged-in user  | Admin |
   |-----------------|-------|-----------------|-------|
   | Read            | ✅    | ✅              | ✅    |
   | Add             | ❌    | ✅              | ✅    |
   | Edit / delete   | ❌    | Own cats only   | ✅    |

- [ ] 7. Backend middleware enforces these rules. The FE hides buttons and pages the user can't use.

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

- Which maps library to use (Google Maps is one option).
- Deploy: Render build/start steps.

## Update Triggers
- Mark an item `[x]` only when it's fully done, and update the **Current** line in the same change.
- Update this file when a part's scope or order changes, or when an open question is added or decided.
