# Naming

## API routes
- Collections are plural nouns, items are `/:id`: `/api/users`, `/api/users/:id`.
- Nest a child collection one level at most: `/api/users/:id/orders`. Deeper than that,
  go flat with a query param: `/api/orders?userId=…`.
- Multi-word segments are kebab-case: `/api/order-items`.
- Singletons and actions are the exceptions: `/api/auth/login`, `/api/users/me`.

## Database
- MongoDB collections are plural, camelCase when multi-word: `users`, `orderItems`.
- Fields are camelCase, the same in the DB, the types and the JSON. No mapping layer.
- References are `<entity>Id`: `userId`, `orderId`. Mongo's `_id` stays as is.

## Code
- Types, interfaces and React components: `PascalCase`. Variables and functions:
  `camelCase`. Constants: `SCREAMING_SNAKE`.
- Booleans take an `is` prefix, never `has`: `isAdmin`, `isInStock`.
- Numeric constants with a unit carry it in the name: `SESSION_TTL_MS`.
- Module-private helpers take a `_` prefix and are not exported: `_toErrorResponse`.
- Entity names in code are singular: `User`, `userService`.

## Files
- kebab-case for every file, including components: `user-list.tsx`.
- Modules with a role get a dot suffix: `user.service.ts`, `auth.middleware.ts`,
  `cart.store.ts`.

## Domain terms
- Use the canonical term from `.docs/glossary.md`, never a synonym. Add a new shared
  term there before using it broadly.
