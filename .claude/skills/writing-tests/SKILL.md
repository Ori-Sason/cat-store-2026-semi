---
name: writing-tests
description: Write or review unit, integration, and end-to-end tests. Use when adding tests for a new feature, writing a regression test for a bug fix, deciding what needs coverage, or judging whether a test suite is good enough to ship. Covers coverage areas, mocking and timer rules, the test DB helper, and how to run each suite in this repo.
---

# Writing Tests

How to write tests. When to write them lives in `.claude/rules/testing.md`.

## What to cover
- Domain logic: filtering, sorting, schema validation.
- API request validation and error responses (`ApiErrorBody` shape, `code`, status).
- Auth and ownership rules: guest / owner / admin on cats and reviews (Part 3 on).
- Server-set fields: the client can't set `_id`, `createdAt`, `updatedAt` or `ownerId`.
- User-facing failure flows for key features.

## Reliability
- Mock only unstable external dependencies. Don't mock the `mongodb` driver. Backend
  tests hit the real test DB.
- Freeze or override time and randomness when behavior depends on them.
- With `vi.useFakeTimers()`, user-event hangs: its async wrapper waits on a `setTimeout` the
  fake clock never fires. Use `fireEvent` for clicks, or
  `vi.useFakeTimers({ shouldAdvanceTime: true })` when you need user-event (typing, focus).

## When a test fails
- Fix the code, unless the behavior changed on purpose. Then update or delete the test.

## This repository

| Suite | Location | Run |
|---|---|---|
| All | — | `npm test` (root, runs every project) |
| Shared | `shared/src/**/*.test.ts` | `npm test -w shared` (Vitest, node) |
| Frontend | `frontend/src/**/*.test.{ts,tsx}` | `npm test -w frontend` (Vitest + RTL, jsdom) |
| Backend | `backend/**/*.test.ts` | `npm test -w backend` (Vitest + Supertest, node) |
| E2E | `frontend/e2e/*.spec.ts` | `npm run test:e2e` (Playwright, headless Chromium) |

- Unit tests sit next to the file they test: `cat.service.ts` → `cat.service.test.ts`.
- Vitest runs with `globals: false`, so import explicitly:
  `import { describe, expect, it } from 'vitest'`.
- Frontend: `src/test-setup.ts` registers the jest-dom matchers (`toBeInTheDocument()`,
  `toHaveValue()`, ...) and runs RTL `cleanup` after each test. Don't repeat either in a test file.
  It also imports `vitest-canvas-mock` globally, so canvas code (the OpenLayers map) runs in jsdom.
- Backend: Supertest calls the Express app in memory, with no open port. Tests use a separate
  database (`MONGODB_DATABASE` in `backend/.env.test`) in the same `db-local` container, and
  wipe it freely. Never point tests at the dev database.
- Backend DB tests call `setupTestDb()` (`backend/test/test-db.helper.ts`) at the top level of
  the file. It refuses to run unless the DB is `catsTest`, empties every collection before
  each test, and closes the client after the file. Files that don't touch the DB skip it.
- Tooling is installed and configured. Don't reinstall or reconfigure it without a plan that
  calls for it.
- E2E: Playwright starts its own backend (:8001, `catsTest`, re-seeded each run) and Vite
  (:5174), so `npm run dev` can stay up. Specs start from the seed data in
  `backend/scripts/data/cats.json`. Seed labels are random, so don't assert on them. Don't run
  E2E and the backend Vitest suite at the same time, since both use `catsTest`.
- Keep output short when running suites, e.g. `npm test -- --reporter=dot`.
