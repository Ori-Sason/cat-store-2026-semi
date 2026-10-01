# cat-store v2

A rebuild of cat-store (a reskin of the bootcamp "mister-toy" spec). This round,
Claude writes the code via plan/auto mode. `.docs/roadmap.md` is the source of truth for
scope, part order, and progress. Treat it as the shape of the project, not a literal
script. Stack and decisions live in `.docs/architecture.md`.

## Security
- Never commit or expose secrets (JWT secret, Mongo credentials, `.env*` values).
  `backend/.env.local`, `backend/.env.prod`, `db-local/.env` are local-only. Only
  `.env.example` files are committed.

## Guardrails
- Hooks live in `.claude/hooks/` and only run if wired in `.claude/settings.json`.
- Don't duplicate permission or hook rules in other docs. If an instruction conflicts
  with a hook, the hook wins.

## Repository Layout
- `.docs/` — hand-written product and architecture docs, plus `roadmap.md` (parts
  with status, open questions). Never create a `docs/` directory.
- `.claude/rules/` — always-on constraints, imported below. Short by design.
- `.claude/skills/` — procedural know-how, loaded on demand by task.
- `.claude/agents/` — sub-agent definitions.
- `.claude/hooks/` — guardrail hooks, wired by `.claude/settings.json`.
- `shared/` — `@cat-store/shared`, the wire contract: types, Zod schemas, constants,
  `catFilterService`. No build step, erasable TS only, no DOM/Node/mongodb imports.
- `frontend/` — Vite + React + TS SPA. `react-router` v8, Zustand, axios with relative
  `/api/...` URLs only (Vite dev proxy, no CORS). SCSS. Not Next.js.
- `backend/` — Express 5 + native `mongodb` driver (no Mongoose). route → controller →
  service layers. Node runs `.ts` directly (type stripping), env via `--env-file`.
- `db-local/` — docker-compose for the local MongoDB.
- `learning-notes/` — the user's study notes. Edit only when asked.

npm workspaces: install from the root, run with `npm run <script> -w <pkg>`
(shortcuts: `npm run dev:fe`, `npm run dev:be`).

## Rules — always in context
<!-- TODO: @-import .claude/rules/*.md once they exist -->

## Skills — load when the task calls for it
<!-- TODO: table of skill → when to use -->

## Product and Domain
- Product definition: `.docs/product-definition.md`.
- Architecture: `.docs/architecture.md`.
- Canonical domain terms: `.docs/glossary.md`. Add a new shared term there before
  using it broadly.
- Roadmap: `.docs/roadmap.md`.
- Keep these docs and the roadmap updated when API routes, auth rules, or collection
  shapes change, or when the plan diverges.

## Calibration
Background: `.claude/user-background.md`. Skip 101-level Docker/K8s/AWS/Git/Linux/
networking/JS-async explanations. Don't extend that skip-list to React, Express,
TS types, MongoDB (incl. aggregation), SCSS, or Socket.io. Explain those at the
depth asked.

## Library docs
Use the context7 MCP for fast-moving libraries (react-router 8, Express 5, zod 4,
Zustand, Socket.io, Vite) instead of relying on training-data recall.
