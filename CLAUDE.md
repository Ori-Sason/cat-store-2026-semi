# cat-store v2

A rebuild of cat-store (a reskin of the bootcamp "mister-toy" spec). This round,
Claude writes the code via plan/auto mode. `.docs/roadmap.md` is the source of truth for
scope, part order, and progress. Treat it as the shape of the project, not a literal
script. Stack and decisions live in `.docs/architecture.md`.

## Security
- Never commit or expose secrets (JWT secret, Mongo credentials, `.env*` values).
  Every `.env*` file is local-only, except `.env.example` templates.

## Guardrails
- Hooks live in `.claude/hooks/` and only run if wired in `.claude/settings.json`.
- Settings and hooks are the source of truth for permissions and guardrails. Other docs
  may point to them in a line, but don't restate their rules. If an instruction
  conflicts with a hook, the hook wins.

## Repository Layout
Everything goes in the folder for its kind, even when only one file uses it. A consistent
layout is easier to manage as the project grows than colocating by use. Only small helpers
for one file's own logic stay in it, as `_` functions. Each package's rule lists its folders.

- `.docs/` — hand-written product and architecture docs, plus `roadmap.md` (parts
  with status, open questions). Never create a `docs/` directory.
- `.claude/rules/` — always-on constraints, listed below. Short by design.
- `.claude/skills/` — procedural know-how, loaded on demand by task.
- `.claude/hooks/` — guardrail hooks, wired by `.claude/settings.json`.
- `.handoffs/` — session handoffs (`<topic>.md`, open decisions first) and review-me
  reports. Gitignored and user-managed: never put handoffs in memory, and leave cleanup
  to the user.
- `shared/` — `@cat-store/shared`, the wire contract: types, Zod schemas, constants,
  `catFilterService`, `catPermissionService`. No build step.
- `frontend/` — Vite + React + TS SPA. `react-router` v8, Zustand, axios, SCSS.
  Not Next.js.
- `backend/` — Express 5 + native `mongodb` driver (no Mongoose). Node runs `.ts`
  directly (type stripping), env via `--env-file`.
- `db-local/` — docker-compose for the local MongoDB.
- `learning-notes/` — the user's study notes. Edit only when asked.

npm workspaces: install from the root, run with `npm run <script> -w <pkg>`
(shortcuts: `npm run dev:fe`, `npm run dev:be`, `npm run test:e2e`).

Git hooks: lefthook (`lefthook.yml`). Format, lint and typecheck on commit, tests on push.
A fresh clone needs `npm run hooks:install` once (`.npmrc` has `ignore-scripts`).

## Rules — always in context
Claude Code auto-loads `.claude/rules/*.md`, so they're listed here, not `@`-imported.
Files with `paths:` frontmatter load only when matching files are touched.
- `code-style.md` — formatting, lint, async/await.
- `naming.md` — routes, DB, code, files, domain terms.
- `git-workflow.md` — approval gates, branches, commits, the index as review marker.
- `testing.md` — when to write tests, E2E timing, done = tests + lint + typecheck pass.
- `subagents.md` — research goes to subagents by default; briefs list what was ruled out.
- `shared.md` (`shared/**`) — erasable TS, no platform imports, models vs services.
- `frontend.md` (`frontend/**`) — shared imports, relative `/api` URLs.
- `ui-and-styling.md` (`frontend/**`) — SCSS structure, tokens, class names.
- `backend.md` (`backend/**`) — layering, DB types, server-set fields.

## Skills — load when the task calls for it
- `writing-tests` — how to write and run tests: structure, the test DB helper, mocking,
  per-suite commands. Load it before adding or reviewing tests.
- `review-me` — user-invoked only (`/review-me [scope]`). Reviews recent sessions in a
  forked subagent and saves the report to `.handoffs/reviews/`.

## Product and Domain
- Product definition: `.docs/product-definition.md`.
- Architecture: `.docs/architecture.md`.
- Canonical domain terms: `.docs/glossary.md`. Add a new shared term there before
  using it broadly.
- Roadmap: `.docs/roadmap.md`.
- Keep these docs and the roadmap updated when API routes, auth rules, or collection
  shapes change, or when the plan diverges.

## Calibration
The user is a full-stack engineer who added DevOps, and this project is practice, so
explanations are welcome. Skip the 101 level and start from the mechanism. What to skip
and what to explain more: `.claude/user-background.md`. Read it when an explanation
needs that context. The full CV (`.claude/user-background-full.md`) is for reviews.

## Library docs
Use the context7 MCP for fast-moving libraries (react-router 8, Express 5, zod 4,
Zustand, Socket.io, Vite) instead of relying on training-data recall.

## Update Triggers
- Update this file when the repo layout, stack, workspace scripts, or the list of rules
  and skills changes.
