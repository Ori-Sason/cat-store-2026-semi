# Cat Store

A community marketplace for cats. Owners list cats with a price, labels and a photo. Anyone can
browse and filter cats, read reviews, and chat live with others looking at the same cat. The
handover happens off-platform, at one of Cat Store's pickup points.

![Cat Store demo: browse, filter, open a cat, chat live](.docs/assets/demo.gif)

## Features

- **Catalog:** browse cats, filter by name, availability and labels, sort by name, price or date
  listed. Add, edit and delete your own cats.
- **Accounts:** sign up, log in, log out, with an optional "remember me". Each cat belongs to the
  user who listed it.
- **Permissions:** guests read, logged-in users add and manage their own cats and reviews,
  admins moderate everything. The server enforces the rules, and the UI hides what you can't do.
- **Reviews and profiles:** reviews on each cat's page. A public profile shows everything a user
  has listed and reviewed.
- **Live chat:** a real-time chat room per cat, with a typing indicator and saved history. If a
  cat is deleted, everyone viewing it goes back to the list with a message.
- **Dashboard:** median price (with range) and % in stock, per label.
- **About page:** a map of the pickup points.

## Tech stack

| Package    | Tools                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `shared`   | TypeScript, Zod. One set of schemas validates both sides of the wire.                                    |
| `frontend` | React, Vite, react-router 8 (routes and data loading), Zustand (client state), axios, socket.io-client, Sass, OpenLayers (map). |
| `backend`  | Express 5, the native `mongodb` driver (no Mongoose), Socket.io, JWT in an httpOnly cookie. Node runs the `.ts` files directly. |
| Tooling    | npm workspaces, Vitest, Supertest, Playwright, oxlint, oxfmt, lefthook, Docker (local MongoDB).          |

## Project structure

```
cat-store/
├── shared/      # @cat-store/shared: types, Zod schemas, constants, permission and filter logic
├── frontend/    # Vite + React SPA
│   ├── src/     # pages, cmps, hooks, store, services
│   └── e2e/     # Playwright specs
├── backend/     # Express + Socket.io server
│   ├── api/     # one folder per resource: auth, cat, chat, review, user
│   ├── services/
│   └── scripts/ # seed scripts
├── db-local/    # docker-compose for the local MongoDB
├── .docs/       # product definition, architecture, roadmap, feature designs
└── .claude/     # Claude Code rules, skills, hooks and agents
```

- `shared` is the contract between the frontend and the backend. Both import it, so a schema or
  permission rule can't drift between them.
- In dev, Vite proxies `/api` and `/socket.io` to Express.
- In prod, one Express server serves the built frontend, the API and Socket.io.

More in [`.docs/architecture.md`](.docs/architecture.md).

## Getting started

### Prerequisites

- Node 24 (see [`.nvmrc`](.nvmrc))
- Docker, for the local MongoDB

### Quick start

```sh
npm install
npm run hooks:install        # .npmrc sets ignore-scripts, so git hooks need this once

# env files: fill them in from the variables table below
cp db-local/.env.example db-local/.env
cp backend/.env.example backend/.env.local
cp backend/.env.example backend/.env.test

docker compose -f db-local/docker-compose.yaml up -d
npm run seed -w backend      # demo users, cats, reviews and chat messages

npm run dev:be               # Express on :8000
npm run dev:fe               # Vite on :5173
```

Open http://localhost:5173. The seeded users are `user`, `admin`, `maya`, `noam` and `dana`, all
with the password set in `SEED_USERS_PASSWORD`.

### Environment variables

The values live only in local env files. The `.env.example` templates list the keys.

**`db-local/.env`**: read by Docker when the volume is first created.

| Variable                                                          | Purpose                                   |
| ----------------------------------------------------------------- | ----------------------------------------- |
| `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`        | MongoDB root user                         |
| `MONGO_DEV_USERNAME`, `MONGO_DEV_PASSWORD`, `MONGO_DEV_DATABASE`  | app user for dev, read/write on `cats` only |
| `MONGO_TEST_USERNAME`, `MONGO_TEST_PASSWORD`, `MONGO_TEST_DATABASE` | app user for tests, on `catsTest` only  |

**`backend/.env.local`** (dev) and **`backend/.env.test`** (tests): same keys, different
user and database.

| Variable              | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `MONGODB_URI`         | connection string with the app user, not root                 |
| `MONGODB_DATABASE`    | `cats` for dev, `catsTest` for tests                          |
| `JWT_SECRET`          | signs the login token. Generate with `openssl rand -hex 32`   |
| `SEED_USERS_PASSWORD` | password for every seeded user (dev and tests only)           |

## Scripts

Run from the repo root.

| Script                        | What it does                                         |
| ----------------------------- | ---------------------------------------------------- |
| `npm run dev:be`              | backend in watch mode                                |
| `npm run dev:fe`              | frontend dev server                                  |
| `npm run seed -w backend`     | add missing seed users, re-seed cats, reviews, chat  |
| `npm test`                    | unit and integration tests for all packages (Vitest) |
| `npm run test:e2e`            | Playwright end-to-end tests                          |
| `npm run lint`                | oxlint                                               |
| `npm run typecheck`           | `tsc` in every package                               |
| `npm run format`              | oxfmt                                                |

## Testing

- **Unit:** Vitest for `shared` services and schemas, plus frontend stores, hooks and forms.
- **API:** Supertest against Express in memory, and socket.io-client for the chat events. Both
  use the `catsTest` database, so MongoDB must be running.
- **E2E:** Playwright starts its own backend (:8001) and frontend (:5174) on `catsTest` and
  re-seeds it before each run.

Playwright needs headless Chromium once per machine, and again after a `@playwright/test`
upgrade:

```sh
npx playwright install --with-deps chromium
```

Lefthook runs format, lint and typecheck on commit, and the tests on push.

## Deployment

Coming in Part 7 of the [roadmap](.docs/roadmap.md).

## How it was built

Claude Code wrote the code in plan/auto mode. The repo keeps the setup it worked from:

- [`CLAUDE.md`](CLAUDE.md) and [`.claude/`](.claude/): project instructions, rules, skills,
  guardrail hooks and custom agents.
- [`.docs/roadmap.md`](.docs/roadmap.md): parts, order and progress.
