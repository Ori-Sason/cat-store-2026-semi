---
paths:
  - "backend/**"
---

# Backend

- Layering: route → controller → service. Only services touch the DB.
- Backend-only DB types (e.g. `CatDoc` with `_id: ObjectId`) live in `backend/models/`,
  not in `shared/`.
- `_id`, `createdAt`, `updatedAt` and `ownerId` are server-set. Never take them from the
  request body.
- Expected failures throw `HttpError(status, code, message)`. The error middleware turns
  every error into an `ApiErrorBody`. Don't `res.status().json()` an error by hand.
- Zod failure → `400 VALIDATION_FAILED` with `fieldErrors`. No 422.
- Add a code to `ERROR_CODES` only when a route actually returns it.
