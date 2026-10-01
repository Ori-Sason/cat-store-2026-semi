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
