---
paths:
  - "frontend/**"
---

# UI and Styling

## Dependencies
- Don't add a UI library (icons, toasts, component kits) unless the plan calls for it.
  Notifications go through the existing `user-message` component.

## SCSS structure
- Entry point: `frontend/src/assets/scss/main.scss`. Register every new partial there,
  under `/* PAGES */` or `/* COMPONENTS */`.
- One partial per component, mirroring the component tree:
  `cmps/common/util/user-message.tsx` → `scss/cmps/common/util/_user-message.scss`.
- Use `@use` / `@forward` only, never `@import`.
- Pull in tokens and mixins with `@use 'setup' as *;` (resolved via Vite `loadPaths`,
  same line at any depth).

## Tokens
- Colors and other shared values are SASS variables in `setup/_vars.scss`. Reuse them,
  don't hardcode new colors.
- Use CSS custom properties (`--name`) only for values set at runtime from TSX.

## Class names
- A component's root class is its file name: `user-message.tsx` → `.user-message`.
  Nest every child and state class under it: `.user-message { .timer {} &.open {} }`.
- Check `basic/_helper.scss` (`.main-btn`, `.sub-btn`, `.clean-list`, …) before writing
  a new utility class.
