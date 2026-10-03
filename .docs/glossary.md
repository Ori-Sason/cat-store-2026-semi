# Glossary

## Purpose
- Define canonical domain terms and approved short forms used across code, API routes, docs, and plans.

## Core Terms
### Entities
- cat (`cats`, `Cat`, `catService`)
	- Canonical meaning: one cat offered on the store by its owner. The core entity:
	  it has a name, price, labels, stock flag and photo, plus reviews and a chat room.
	- Avoid: `listing`, `item`, `product`, `pet`.
- owner (`ownerId`)
	- Canonical meaning: the user who created a cat. Only the owner (or an admin) can
	  edit or delete it. Set by the server, never by the client.
	- Rule: `ownerId` is named for the role, not the entity, a deliberate exception to
	  the `<entity>Id` rule in `naming.md`. It holds a `users` `_id`.
	- Avoid: `seller`, `creator`, `createdBy`, `userId` (on a cat).
- label (`labels`, `CatLabel`, `CAT_LABELS`)
	- Canonical meaning: one of a fixed set of descriptors attached to a cat.
	  A cat can have several. Used for filtering cats and for dashboard stats.
	- Values: `Kitten`, `Adult`, `Senior`, `Playful`, `Calm`, `Affectionate`,
	  `Long-hair`, `Short-hair`, `Indoor`, `Good with kids`.
	- Avoid: `traits`, `tags`, `categories`, `type`.

### Type shapes
- `Cat` vs `CatInput`
	- Canonical meaning: `Cat` is a stored cat as the API returns it (with `_id`,
	  `createdAt`, `updatedAt`, and an `imgUrl` that is always set). `CatInput` is
	  what the client sends (POST / PUT body, edit-form state), inferred from `catSchema`.
	- Avoid: `CatDto`, `NewCat`, `CatPayload`, `CatToSave`.

### Auth
- `loggedInUser` / `LoggedInUser`
	- Canonical meaning: the session identity. `_id`, `username`, `fullname`,
	  `isAdmin` only. It's the JWT payload and the ALS store field.
	- Avoid: `currentUser`, `authUser`, `sessionUser`, `me`. (`me` only
	  appears in the route `GET /api/auth/me`.)
- `loginToken`
	- Canonical meaning: the signed JWT, and the name of the cookie that holds it.
	- Avoid: `token`, `jwt`, `accessToken`, `session`.
- `isAdmin`
	- Canonical meaning: admin flag on a user.
	- Avoid: `role`, `admin`.
- `auth` vs `login` / `signup` / `logout`
	- Canonical meaning: `auth` is the area (routes, service, middleware).
	  `login` / `signup` / `logout` are the actions.
	- Avoid: `signin`, `register`, `signout`.
- `require*` vs `attach*` middleware
	- Canonical meaning: `require*` (`requireAuth`, `requireAdmin`) throws on
	  failure. `attach*` (`attachLoggedInUser`) only decorates the request and
	  never blocks.

### Errors + request context
- `HttpError`
	- Canonical meaning: BE class for expected failures (`status`, `code`, `message`).
- `ApiErrorBody`
	- Canonical meaning: the one JSON error shape on the wire (`shared/`).
- `ApiError`
	- Canonical meaning: FE class that `httpService` turns every axios failure into.
- error `code`
	- Canonical meaning: machine-readable error id from `ERROR_CODES`.
	- Rule: `SCREAMING_SNAKE`. Prefer `<THING>_<PROBLEM>` when a thing is involved
	  (e.g. `CAT_NOT_FOUND`, `USERNAME_TAKEN`). Generic codes can be a single word
	  or a plain phrase (`UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL`, `INVALID_CREDENTIALS`).
	  The FE branches on `code`, never on `message`.
- `fieldErrors`
	- Canonical meaning: per-field validation errors, `field → string[]`.
	- Avoid: `errors`, `validationErrors`, `details`.
- `requestId`
	- Canonical meaning: per-request id, sent as `X-Request-Id` and in error bodies.
	- Avoid: `traceId`, `correlationId`.
- `als`
	- Canonical meaning: the per-request `AsyncLocalStorage` context (`alsService`,
	  `AlsStore`).
	- Rule: short form only.
	- Avoid: `context`, `ctx`, `requestContext`.

## Naming Alignment
- Keep this glossary aligned with naming decisions in `../.claude/rules/naming.md`.
- If a new domain term is introduced, add it here before broad usage.

## Update Triggers
- Add new terms when introducing a new bounded context, entity, or shared API concept.
- Avoid synonyms for existing terms unless explicitly approved and documented here.
