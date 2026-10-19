---
paths:
  - "backend/**"
---

# Backend

- Layering: route → controller → service. Only services touch the DB.
- Middlewares are split by transport, one per file, in `middlewares/<transport>/` (e.g. `http/`,
  `socket/`). Each transport gets its own file suffix: `*.middleware.ts` for HTTP,
  `*.socket-middleware.ts` for socket event chain steps.
- Backend-only DB types (e.g. `CatDoc` with `_id: ObjectId`) live in `backend/models/`,
  not in `shared/`.
- `_id`, `createdAt`, `updatedAt`, `ownerId` and `userId` are server-set. Never take them from the
  request body.
- Joined docs and public users leave the DB through an inclusion projection only: `$lookup` via
  `utilService.buildLookup` with `USER_REF_FIELDS` / `CAT_REF_FIELDS`, `PUBLIC_USER_FIELDS`
  for a public user. Never an exclusion like `{ password: 0 }` (`.docs/architecture.md` → Decisions).
- Permission checks and controllers read the user via `alsService.getVerifiedUser()`, never
  the ALS `tokenUser` (token-only, can be stale). The two exceptions read `socket.data.tokenUser`
  on purpose, where a stale name is harmless: the `chat:typing` relay (`requireTokenUser`), since
  a DB read every few seconds per typer isn't worth it, and the presence snapshot
  (`socketService.getLiveTokenUser`), which runs on every join and leave.
- Expected failures throw `HttpError(status, code, message)`. The error middleware turns
  every error into an `ApiErrorBody`. Don't `res.status().json()` an error by hand.
- Zod failure → `400 VALIDATION_FAILED` with `fieldErrors`. No 422.
- Add a code to `ERROR_CODES` only when a route actually returns it.
