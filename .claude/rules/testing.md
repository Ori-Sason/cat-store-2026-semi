# Testing

When to write tests. How to write them lives in the `writing-tests` skill.

## Ship tests with the code, without being asked
- `shared/`: every service and schema with logic (e.g. `catFilterService`, `catSchema`).
- `backend/`: every new or changed route gets Supertest tests, one happy path and one
  failure path (400 / 404, and 401 / 403 once auth exists). They run against the test DB.
- `frontend/`: stores, hooks and utils with logic, plus components with real behavior
  (forms with validation, the filter). Purely presentational components get none.
- Bug fixes: a regression test that fails before the fix and passes after.

## Skip
- Infra, config, docs, and SCSS-only changes.

## E2E
- Playwright, from Part 3 on (see `.docs/roadmap.md`). Before that, none.
- After the first set, write E2E only when asked, or when a part adds a new end-to-end flow.
- Run the Playwright CLI headless. Never drive a browser through an MCP.

## Done means
- `npm test` passes alongside `npm run lint` before a task is finished.
