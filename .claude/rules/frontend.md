---
paths:
  - "frontend/**"
---

# Frontend

- Import shared types straight from `@cat-store/shared`. No FE re-export file.
- axios calls use relative `/api/...` URLs only. No base URL, no CORS: the Vite dev proxy
  handles it (see `.docs/architecture.md` → Decisions).
- Branch on `ApiError.code`, never on `message` (it's developer-facing). Show the
  `requestId` as a ref ("Ref: ab12cd34") so a user report maps to a log line.
- Each page gets a folder: `pages/<page>/` holds the page, its loader/action and their tests.
  Components only that page uses live in `cmps/<entity>/<page>/`, while shared ones stay in
  `cmps/<entity>/`. SCSS mirrors both.
