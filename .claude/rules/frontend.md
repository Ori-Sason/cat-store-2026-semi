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
    A feature with several components gets its own subfolder, named for its top component:
    `cmps/<page>/<feature>/`.
    When it grows, split it into idea folders (`code-style.md` → "Group a kind folder by idea"),
    named `<prefix>-<idea>`, where `<prefix>` is the feature's short name. An idea isn't
    necessarily a component: `<prefix>-main/`, `<prefix>-footer/`. What's used by 2+ of them goes
    in `<prefix>-common/`, which is shared only inside the feature, unlike `cmps/common/`.
  - `cmps/common/<group>/`: components used by 2+ pages, grouped by entity (`<entity>/`) or
    `util/` for domain-free UI. Move a component here when a second page needs it.
    It's `common`, not `shared`, so it doesn't clash with a shared workspace package.
  - `cmps/layout/`: the app shell, used by the router.
  SCSS mirrors this tree.
