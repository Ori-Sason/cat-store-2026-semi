---
paths:
  - "backend/**"
---

# Backend

- Layering: route → controller → service. Only services touch the DB.
- Middlewares are split by transport, one per file: REST in `middlewares/http/`
  (`*.middleware.ts`), socket event chain steps in `middlewares/socket/`
  (`*.socket-middleware.ts`).
- Backend-only DB types (e.g. `CatDoc` with `_id: ObjectId`) live in `backend/models/`,
  not in `shared/`.
- `_id`, `createdAt`, `updatedAt`, `ownerId` and `userId` are server-set. Never take them from the
  request body.
- Joined docs and public users leave the DB through an inclusion projection only: `$lookup` via
  `utilService.buildLookup` with `USER_REF_FIELDS` / `CAT_REF_FIELDS`, `PUBLIC_USER_FIELDS`
  for a public user. Never an exclusion like `{ password: 0 }` (`.docs/architecture.md` → Decisions).
- Permission checks and controllers read the user via `alsService.getVerifiedUser()`, never
  the ALS `tokenUser` (token-only, can be stale). The one exception is the `chat:typing` relay:
  it reads `socket.data.tokenUser` on purpose (`requireTokenUser`), since a DB read every few
  seconds per typer isn't worth it for a name that's harmless when stale.
- Expected failures throw `HttpError(status, code, message)`. The error middleware turns
  every error into an `ApiErrorBody`. Don't `res.status().json()` an error by hand.
- Zod failure → `400 VALIDATION_FAILED` with `fieldErrors`. No 422.
- Add a code to `ERROR_CODES` only when a route actually returns it.
