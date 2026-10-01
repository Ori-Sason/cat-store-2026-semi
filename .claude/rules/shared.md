---
paths:
  - "shared/**"
---

# Shared package

- Erasable TS syntax only: no `enum`, `namespace` or parameter properties. Node and Vite
  both load it with no build step.
- No `mongodb`, React, DOM or Node imports.
- Type platform objects structurally, e.g. `QueryParamsReader` instead of `URLSearchParams`.
- `src/models/` → types plus their constants and Zod schemas. `src/services/` → logic
  (e.g. `catFilterService`).
