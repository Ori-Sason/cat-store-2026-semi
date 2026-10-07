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
- Folders by kind (see CLAUDE.md → Repository Layout): `models/` (types, schemas,
  constants), `services/`, `store/`, `hooks/`, `pages/`, `cmps/`.
- Each page gets a folder: `pages/<page>/` holds the page, its loader/action and their tests.
  Pages compose. Components are the building blocks and live in `cmps/`:
  - `cmps/<page>/`: components only that page uses. The folder name matches `pages/<page>/`.
  - `cmps/common/<group>/`: components used by 2+ pages, grouped by entity (`cat/`) or
    `util/` for domain-free UI. Move a component here when a second page needs it.
    It's `common`, not `shared`, because `shared/` is the workspace package.
  - `cmps/layout/`: the app shell, used by the router.
  SCSS mirrors this tree.
