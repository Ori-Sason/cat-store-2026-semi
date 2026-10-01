---
paths:
  - "frontend/**"
---

# Frontend

- Import shared types straight from `@cat-store/shared`. No FE re-export file.
- axios calls use relative `/api/...` URLs only. No base URL, no CORS: the Vite dev proxy
  handles it (see `.docs/architecture.md` → Decisions).
