# Glossary

## Purpose
- Define canonical domain terms and approved short forms used across code, API routes, docs, and plans.

## Core Terms
### Entities
- cat (`cats`, `Cat`, `catService`)
	- Canonical meaning: one cat offered on the store by its owner. The core entity:
	  it has a name, price, labels, stock flag and photo, plus reviews and a chat room.
	- Avoid: `listing`, `item`, `product`, `pet`.
- user (`users`, `User`, `UserDoc`)
	- Canonical meaning: an account that can log in. A user with `isAdmin` is an admin.
	- Avoid: `account`, `member`, `customer`.
- owner (`ownerId`)
	- Canonical meaning: the user who created a cat. Only the owner (or an admin) can
	  edit or delete it. Set by the server, never by the client.
	- Rule: `ownerId` is named for the role, not the entity, a deliberate exception to
	  the `<entity>Id` rule in `naming.md`. It holds a `users` `_id`.
	- Rule: `catPermissionService` (`shared/`) holds the cat rules. The FE hides what fails
	  them. The BE checks edit / delete through it (`requireCatOwner`), and add with `requireAuth`.
	- Avoid: `seller`, `creator`, `createdBy`, `userId` (on a cat).
- review (`reviews`, `Review`, `reviewService`)
	- Canonical meaning: one user's written text about one cat. Its author is `userId`
	  (server-set from the verified user, never from the body) and its cat is `catId`.
	- Rule: a review stays on its cat. An edit changes `content` only.
	- Rule: `reviewPermissionService` (`shared/`) holds the review rules. Any logged-in user can
	  add one (on their own cat too). Only the author (or an admin) can edit or delete it: the BE
	  checks that through `requireReviewOwner`, and add with `requireAuth`.
	- Avoid: `comment`, `feedback`, `rating` (there's no score), `author` as a field name.
- label (`labels`, `CatLabel`, `CAT_LABELS`)
	- Canonical meaning: one of a fixed set of descriptors attached to a cat.
	  A cat can have several. Used for filtering cats and for dashboard stats.
	- Values: `Kitten`, `Adult`, `Senior`, `Playful`, `Calm`, `Affectionate`,
	  `Long-hair`, `Short-hair`, `Indoor`, `Good with kids`.
	- Avoid: `traits`, `tags`, `categories`, `type`.
- pickup point (`PickupPoint`, `PICKUP_POINTS`)
	- Canonical meaning: a fixed place where a buyer collects a cat. Shown on the
	  About page map with its address and hours.
	- Rule: FE-only static data (`frontend/src/models/pickup-point.ts`), not a
	  collection and not on the wire.
	- Avoid: `store` (clashes with the app and Zustand stores), `branch`, `location`, `shop`.

### Type shapes
- `Cat` vs `CatInput`
	- Canonical meaning: `Cat` is a stored cat as the API returns it (with `_id`,
	  `createdAt` and `updatedAt`). Its `imgUrl` can be `''`, and the FE then shows the
	  default image. `CatInput` is
	  what the client sends (POST / PUT body, edit-form state), inferred from `catSchema`.
	- Avoid: `CatDto`, `NewCat`, `CatPayload`, `CatToSave`.

- `User` vs `UserInput` vs `UserDoc`
	- Canonical meaning: `User` is a stored user as the API returns it, with no password.
	  `UserInput` is the user fields a client may set (`fullname`, `username`, `password`),
	  inferred from `userSchema`. `UserDoc` is the backend-only DB shape, with `password` as the bcrypt hash.
	- Rule: `isAdmin` is never client-set. `userSchema` leaves it out, so Zod strips it.
	- Avoid: `UserDto`, `NewUser`, `Credentials` (for the signup body).

- `Review` vs `ReviewInput` vs `ReviewContentInput` vs `ReviewDoc`
	- Canonical meaning: `Review` is a stored review as the API returns it (with `_id`,
	  `userId` and the timestamps). `ReviewInput` is what adding one sends (`catId`, `content`),
	  inferred from `reviewSchema`. `ReviewContentInput` is what editing one sends (`content`
	  only), inferred from `reviewContentSchema`. `ReviewDoc` is the backend-only DB shape,
	  with `userId` / `catId` as `ObjectId`.
	- Avoid: `ReviewDto`, `NewReview`, `ReviewUpdate`.

- `ReviewWithRefs` vs `ReviewJoinedDoc`
	- Canonical meaning: a review joined with its author and its cat, as `GET /api/reviews`
	  returns it: `{ _id, content, createdAt, updatedAt, user: { _id, fullname },
	  cat: { _id, name, imgUrl } }`, with no `userId` / `catId`. `ReviewWithRefs` is the wire
	  type (`shared/`, string ids). `ReviewJoinedDoc` is the backend-only aggregation output
	  (`ObjectId` ids). Same split as `Cat` / `CatDoc`.
	- Rule: the joined `user` is an allow-list (`_id`, `fullname`), so `password` and `isAdmin`
	  never leave the DB. One shape serves both pages: each ignores the side it already knows.
	- Avoid: `ReviewJoined` (for the wire type), `PopulatedReview`, `ReviewDetails`.

- `ReviewFilter`
	- Canonical meaning: which reviews `GET /api/reviews` returns: `catId`, `userId`, or both
	  (AND). At least one is required, so there's no system-wide list. Parsed by
	  `reviewFilterSchema`.
	- Avoid: `ReviewQuery`, `criteria`.

- `SignupInput` / `LoginInput`
	- Canonical meaning: the request bodies of `POST /api/auth/signup` and `/login`.
	  `SignupInput` is `UserInput` plus `isRemembered`. `LoginInput` is `username`,
	  `password` and `isRemembered`, with no signup rules. Inferred from `signupSchema` / `loginSchema`.
	- Avoid: `Credentials`, `LoginDto`, `AuthPayload`.

- `CatFilter` / `filterBy` / `catFilterService`
	- Canonical meaning: `CatFilter` is the type for how the cat list is filtered and
	  sorted (`txt`, `isInStock`, `labels`, `sortBy`, `sortDir`, `limit`). `filterBy` is a variable
	  that holds one. `catFilterService.paramsToFilter` parses the query string into it,
	  on both the FE and the BE.
	- Rule: several `labels` match with `$all`, so a cat must have every selected label.
	- Rule: `limit` keeps the first N cats after the sort. `null` means every match, and a bad
	  or `0` value parses to `null`, like the other params (no 400).
	- Avoid: `criteria` (that's the Mongo query built from it), `query`, `searchParams` (for the parsed value).

- `CatLabelStats` / label stats
	- Canonical meaning: one row per label in `CAT_LABELS` order, over the whole catalog
	  (it ignores `filterBy`): `count`, `inStockCount`, and the `medianPrice` / `minPrice` /
	  `maxPrice` (`null` when the label has no cats). A cat with several labels counts once
	  per label. Served by `GET /api/cats/stats`, charted on the dashboard.
	- Avoid: `stats` alone in type names, `metrics`, `analytics`.

### Auth
- `loggedInUser` / `LoggedInUser`
	- Canonical meaning: the session identity. `_id`, `username`, `fullname`,
	  `isAdmin` only. It's the JWT payload and the type of both ALS user fields
	  (`tokenUser`, `verifiedUser`).
	- Avoid: `currentUser`, `authUser`, `sessionUser`, `me`. (`me` only
	  appears in the route `GET /api/auth/me`.)
	- `LoggedInUserOrGuest`: what the permission services take. `_id` and `isAdmin`, or
	  `null` for a guest.
- token user (`tokenUser`)
	- Canonical meaning: the `LoggedInUser` decoded from the `loginToken`, with no DB read.
	  `attachTokenUser` puts it in the ALS store on every request. It can be up to 7 days stale
	  (`isAdmin` revoked, user deleted), so it's for logs and `/me`'s lookup only.
	- Avoid: using it in a permission check.
- verified user (`verifiedUser`)
	- Canonical meaning: the `LoggedInUser` re-read from the DB. Only `requireAuth` sets it.
	  Permission checks and controllers read it through `alsService.getVerifiedUser()`,
	  which throws (500) when `requireAuth` didn't run.
	- Avoid: `freshUser`, `dbUser`.
- `loginToken`
	- Canonical meaning: the signed JWT, and the name of the cookie that holds it.
	- Avoid: `token`, `jwt`, `accessToken`, `session`.
- `isRemembered`
	- Canonical meaning: the "remember me" choice sent with login and signup. `true` → a
	  7-day `loginToken` cookie. `false` → a session cookie. Not stored on the user.
	- Avoid: `rememberMe`, `isPersistent`, `stayLoggedIn`.
- `isAdmin`
	- Canonical meaning: admin flag on a user.
	- Avoid: `role`, `admin`.
- `auth` vs `login` / `signup` / `logout`
	- Canonical meaning: `auth` is the area (routes, service, middleware).
	  `login` / `signup` / `logout` are the actions.
	- Avoid: `signin`, `register`, `signout`.
- `require*` vs `attach*` middleware
	- Canonical meaning: `require*` (`requireAuth`, `requireCatOwner`, `requireAdmin`) throws on
	  failure. `attach*` (`attachTokenUser`) only decorates the request and
	  never blocks.
	- Rule: a `require*` that needs a user bundles `requireAuth` in front of its check
	  (`requireCatOwner = [requireAuth, _checkCatOwner]`), so it's mounted alone.

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
