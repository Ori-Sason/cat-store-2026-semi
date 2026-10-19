# Glossary

## Purpose
The one canonical name for each domain concept, and the synonyms to avoid. Check it before
naming a new type, field, route or variable.

An entry is: the term with its code names, a line or two of meaning, and `Avoid:`. Add a
`Rule:` only when the name itself needs one (an exception to `naming.md`, a term that's easy to
misuse).

Not here, so it isn't kept twice:
- Field lists → the types in `shared/src/models/` and `backend/models/`.
- Permissions → `product-definition.md` and the shared permission services.
- How something works and why → `architecture.md`, or a code comment next to it.
- General naming conventions (casing, `is` prefix, file names) → `.claude/rules/naming.md`.

## Entities
- **cat** (`cats`, `Cat`, `catService`): one cat offered on the store by its owner. The core entity.
  Avoid: `listing`, `item`, `product`, `pet`.
- **user** (`users`, `User`, `userService`): an account that can log in. A user with `isAdmin` is
  an admin.
  Avoid: `account`, `member`, `customer`.
- **owner** (`ownerId`): the user who created a cat.
  Rule: named for the role, not the entity, an exception to the `<entity>Id` rule. It holds a
  `users` `_id`.
  Avoid: `seller`, `creator`, `createdBy`, `userId` (on a cat).
- **review** (`reviews`, `Review`, `reviewService`): one user's written text about one cat. Its
  author is `userId` and its cat is `catId`.
  Avoid: `comment`, `feedback`, `rating` (there's no score), `author` as a field name.
- **chat** (`chatService`, `useCatChat`, `chat:*` events): the live room on one cat's page, one
  per cat. The room is identified by `catId`. Modules and files are named `chat`. Its
  **presence** (`ChatPresence`, `chat:presence-changed`) is who's on the cat's page right now,
  i.e. in the room, whether or not the chat panel is open: distinct logged-in users, and guests
  see the count, never the names.
  Avoid: `room` as a module or type name, `conversation`, `thread`, `channel`. For presence:
  `online`, `viewers`, `watchers`, `active users`.
- **chat msg** (`chatMsgs`, `ChatMsgWithRefs`, `CHAT_MSG_NOT_FOUND`, `chat:msg-*`): one message in a
  chat. Its author is `userId`, its cat is `catId`. The wire type is only ever the joined
  `ChatMsgWithRefs`. There's no plain `ChatMsg`. Not a user msg (that's a UI popup, see UI).
  Rule: `msg` in code and routes (`/chat-msgs`), "message" in user-facing text.
  Avoid: `chatMessage`, `post`, `comment`, `message` in code names.
- **label** (`labels`, `CatLabel`, `CAT_LABELS`): one of a fixed set of descriptors on a cat. A
  cat can have several.
  Avoid: `traits`, `tags`, `categories`, `type`.
- **pickup point** (`PickupPoint`, `PICKUP_POINTS`): a fixed place where a buyer collects a cat,
  shown on the About map. FE-only static data, not a collection.
  Avoid: `store` (clashes with the app and the Zustand stores), `branch`, `location`, `shop`.

## Type shapes
Entity types are named by suffix. The last column lists every type that exists today. A
suffix missing for an entity means that type doesn't exist yet. Add it when it's needed,
don't assume it.

| Suffix | Meaning | Lives in | Exists today |
|---|---|---|---|
| (none) | the stored entity as the API returns it, with string ids | `shared/` | `Cat`, `User` (no password), `Review` |
| `*Input` | what the client sends, inferred from its `*Schema` (`catSchema` → `CatInput`) | `shared/` | `CatInput`, `UserInput`, `ReviewInput`, `ChatMsgInput`, `ChatMsgUpdateInput`, `ChatMsgRemoveInput`, `ChatRoomInput`, `ChatTypingInput` |
| `*WithRefs` | the wire type with refs joined in place of their ids (`ownerId` → `owner`). A ref can be `null` where the join is a left join: chat keeps a msg whose author is gone (`user: null`) | `shared/` | `CatWithRefs`, `ReviewWithRefs`, `ChatMsgWithRefs` |
| `*Ref` | the slice of an entity a join carries, from `<ENTITY>_REF_FIELDS` | `shared/` | `CatRef`, `UserRef` |
| `*Doc` | the DB shape of any of the above, with `ObjectId` ids | `backend/models/` | `CatDoc`, `UserDoc` (with the hash), `ReviewDoc`, `ChatMsgDoc`, `CatRefDoc`, `UserRefDoc`, `PublicUserDoc` |
| `*JoinedDoc` | the aggregation output behind a `*WithRefs` | `backend/models/` | `CatJoinedDoc`, `ReviewJoinedDoc`, `ChatMsgJoinedDoc` |

Socket events:
- Every client → server event gets its own `*Input` and schema, since a socket event has no URL
  to carry the ids (`ChatMsgUpdateInput` carries `catId` and `msgId`).
- A server → client payload is named for what it reports, with no suffix and no schema, since
  the client never sends it: `ChatTyping` (`ChatTypingInput` plus the typer's `user`),
  `ChatPresence` (`{ catId, count, users }`, `users: null` for a guest socket).

Avoid for all of them: `*Dto`, `New*`, `*Payload`, `*ToSave`, `Populated*`, `*Summary`, and
page names (`CatDetails`, `Profile`, `ReviewDetails`) as type names. Also avoid:
- `*With<Ref>` (`CatWithOwner`): use `*WithRefs`.
- `ReviewJoined` for the wire type: that's `ReviewWithRefs`, and `*JoinedDoc` is backend-only.
- `ReviewCat`, `Author` as type names: use `CatRef`, `UserRef`.

The ones that don't follow the pattern:
- `ReviewContentInput`: what editing a review sends, `content` only.
  Avoid: `ReviewUpdate`.
- `ChatHistoryQuery`: the `beforeId` / `afterId` cursor of `GET /api/cats/:id/chat-msgs`.
  `ChatMsgOlderPage` / `ChatMsgNewerPage`: what it returns, by direction.
  Avoid: `ChatFilter` (it doesn't filter), `offset`, `cursor` as a field name.
- `PublicUser`: a user as anyone may see them (`GET /api/users/:id`). `UserRef` is a subset of it.
  Avoid: `UserProfile`.
- `SignupInput` / `LoginInput`: the bodies of `POST /api/auth/signup` and `/login`.
  Avoid: `Credentials`, `LoginDto`, `AuthPayload`.
- `CatFilter` / `filterBy`: `CatFilter` is the type for how the cat list is filtered and sorted.
  `filterBy` is a variable that holds one.
  Avoid: `criteria` (that's the Mongo query built from it), `query`, `searchParams` (for the
  parsed value).
- `ReviewFilter`: which reviews `GET /api/reviews` returns, by `catId`, `userId` or both.
  Avoid: `ReviewQuery`, `criteria`.
- `CatLabelStats` / label stats: per-label price and stock stats over the whole catalog, for the
  dashboard.
  Avoid: `stats` alone in type names, `metrics`, `analytics`.

## Auth
- `auth` vs `login` / `signup` / `logout`: `auth` is the area (routes, service, middleware). The
  others are the actions.
  Avoid: `signin`, `register`, `signout`.
- `loggedInUser` / `LoggedInUser`: the session identity, and the JWT payload.
  Avoid: `currentUser`, `authUser`, `sessionUser`, `me` (only in the route `GET /api/auth/me`).
- `LoggedInUserOrGuest`: what the permission services take. `null` is a guest.
- token user (`tokenUser`): the `LoggedInUser` decoded from the `loginToken`, with no DB read.
  Can be stale.
- verified user (`verifiedUser`): the `LoggedInUser` re-read from the DB by `requireAuth`.
  Avoid: `freshUser`, `dbUser`.
- `loginToken`: the signed JWT, and the name of the cookie that holds it.
  Avoid: `token`, `jwt`, `accessToken`, `session`.
- `DecodedLoginToken`: a verified `loginToken`'s user plus its `exp` (seconds). Backend-only, for
  the socket handshake.
  Avoid: `TokenPayload`, `JwtClaims`.
- `isRemembered`: the "remember me" choice sent with login and signup. Not stored on the user.
  Avoid: `rememberMe`, `isPersistent`, `stayLoggedIn`.
- `isAdmin`: the admin flag on a user.
  Avoid: `role`, `admin`.
- `require*` vs `attach*` middleware: `require*` (`requireAuth`, `requireCatOwner`) throws on
  failure. `attach*` (`attachTokenUser`) only decorates the request and never blocks.

## Errors + request context
- `HttpError`: BE class for expected failures (`status`, `code`, `message`).
- `ApiErrorBody`: the one JSON error shape on the wire (`shared/`).
- `ApiError`: FE class that `httpService` turns every axios failure into.
- error `code`: machine-readable error id from `ERROR_CODES`.
  Rule: `<THING>_<PROBLEM>` when a thing is involved (`CAT_NOT_FOUND`, `USERNAME_TAKEN`).
  Generic codes can be a word or a plain phrase (`FORBIDDEN`, `INVALID_CREDENTIALS`).
- `fieldErrors`: per-field validation errors, `field → string[]`.
  Avoid: `errors`, `validationErrors`, `details`.
- `requestId`: per-request id, sent as `X-Request-Id` and in error bodies.
  Avoid: `traceId`, `correlationId`.
- `als`: the per-request `AsyncLocalStorage` context (`alsService`, `AlsStore`). Short form only.
  Avoid: `context`, `ctx`, `requestContext`.

## UI
- **user msg** (`UserMsg`, `useUserMsgStore`, the `UserMessage` component): a short success or
  error message that pops up and closes by itself after a few seconds. A navigation msg
  (`navigationMsg`) is one queued to show once the next navigation finishes.
  Avoid: `toast`, `snackbar`, `alert`, `notification`.
- **user chip** (`UserChips`): a small tag next to a user's name: You, Owner (of the cat) or
  Admin. Each caller decides which ones show. Not a label chip (`LabelChip`, a cat's label).
  Avoid: `badge`, `tag`, `role chip`.

## Update Triggers
- Add a term when a new entity, type shape or shared concept appears, before it spreads.
- A new suffixed type (e.g. `UserWithRefs`) → add it to the "Exists today" column.
- A synonym for an existing term needs the user's OK, and then an entry here.
