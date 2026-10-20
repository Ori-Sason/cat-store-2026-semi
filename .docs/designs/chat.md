# Chat design

The live chat on `cat-details`: one room per cat. Roadmap Part 6 item 1.

This doc covers the flow and the decisions behind it. Each "Not chosen" list exists so a later
session doesn't propose a rejected option again. Payload details live in
`shared/src/models/chat.ts`, and the module-level whys sit in code comments next to the code.

## Scope
- **One room per cat.** Anyone can read it. Only logged-in users write.
  - **Guests are read-only.** They see the log and the typing line, plus a "Log in to chat" CTA (Call To Action).
- **Each message shows the author's full name**, never `username` (it's half a login, see
  `architecture.md` → Decisions). If the author's account is gone, the message shows
  "[Deleted User]".
- **History:** the last 50 messages on open, plus "load older".
- **Typing line:** "X is typing…", "A and B are typing…".
- **Unread badge:** on the closed chat icon, counting messages since page load.
- **Presence:** "2 here now" on the panel header, plus a list of who's here.
- **Edit and delete:**
  - The author edits their own messages. The author or an admin deletes.
  - An edited message shows "Edited at <time>", and a deleted one shows "Message deleted" in
    place. Both reasons are the same: later replies to it still make sense.
- **User chips:** Owner and Admin next to the name, as on reviews. There's no You chip: a row
  style marks your own messages (see "UI").

## The big picture
```
 cat-details ── <CatChat key={cat._id}> ── useCatChat(catId, isOpen)
                                             │                 │
              socket (app-wide singleton) ◀──┘                 └──▶ REST (axios)
   join / leave, msg add / update / remove,                         GET /api/cats/:id/chat-msgs
   typing  ⇅  acks + room events                                    ?beforeId= / ?afterId=
                     │                                                    │
                     ▼                                                    ▼
   Socket.io on the Express http server                  chat.routes.ts → chat.controller.ts
   chat.socket-routes.ts: one chain per event
   validate → auth → room member → [permission] → chatSocketController
                     │                                                    │
                     └──────────────▶ chatService ◀──────────────────────┘
                                          │
                                 chatMsgs + $lookup users
```

## Data model

### Storage: a `chatMsgs` collection
```
chatMsgs: { _id, catId, userId, clientMsgId, text, isDeleted, createdAt, updatedAt }
indexes:  { catId: 1, _id: -1 }             paging, both directions (no `unique`: `_id` already is)
          { userId: 1, clientMsgId: 1 }     unique, the retry dedupe (see "Add-msg flow and retries")
```
- **The room is identified by `catId`.** The server builds the socket room name, `cat:<catId>`.
- **Only `userId` is stored. The name is joined on read**, like reviews. A renamed user shows
  the new name on every message.
- **A left join, unlike reviews.** Reviews use an inner join, so a review whose author is gone
  drops out. Chat keeps the message and sends `user: null`. Two reasons:
  - A dropped message would leave later replies without context.
  - A dropped row inside the fetched 51 would break the paging check (see "History").
- **The join is a `$set`, not an `$unwind`:**
  ```ts
  utilService.buildLookup(USER_COLLECTION, 'userId', 'user', USER_REF_FIELDS),
  { $set: { user: { $ifNull: [{ $first: '$user' }, null] } } },
  ```
  How it works:
  - `$lookup` always yields an array, and `[]` when nothing matches.
  - `$first` takes element 0, so `[]` → missing.
  - `$ifNull` turns missing into `null`.

  A `$set` can't drop a row, so "keep every message" is built into the stage. Its output is the
  wire shape as is.
- **Soft delete keeps the text in the DB, never on the wire.** If a user disputes an admin's
  delete, an admin can check what it said. That's DB only: there's no UI for it.
- **"Edited" means `updatedAt > createdAt`.** A remove sets only `isDeleted`, never `updatedAt`.
  - So "Edited at" stays true on a message that was edited and then deleted.
  - And a repeat remove changes nothing.
- **Server-set fields:** `_id`, `userId`, `createdAt`, `updatedAt`, `isDeleted`. `clientMsgId`
  is client-set, since it's the client's retry key, and it's validated as a UUID.
- **Deleting a cat deletes its `chatMsgs`**, in `catService.remove`, like reviews.

**Not chosen:**
- *History on the cat document* (the roadmap's original wording). The cat would grow with no
  limit, against Mongo's 16MB cap. Every cat read would also carry the chat, unless it's
  projected out with an exclusion projection, which the architecture avoids.
- *A `chats` collection, one doc per cat.* It only makes sense with the messages embedded, which
  brings the size cap back and makes paging and edit awkward.
- *A generic `roomId` (`cat:<catId>`)*, for possible future chats.
  - `catId` follows the `<entity>Id` rule. The cascade delete, the `CAT_NOT_FOUND` check and the
    nested REST route use it directly.
  - A `roomId` string is a polymorphic ref: every check would parse the room type first.
  - No other chat is planned. If one comes, the cost is a one-time migration.
- *Hard delete.* Replies would lose their context, and an admin's delete couldn't be checked.
- *`$unwind` with `preserveNullAndEmptyArrays`.* It keeps the row, but leaves `user` absent, not
  `null`. The mapper would have to patch it.

### Wire shape (shared)
```ts
// A socket event has no URL, so the ids ride in the payload and every event gets its own schema.
// userId is server-set: Zod strips it
chatMsgSchema          // { catId, clientMsgId, text }      chat:msg-add
chatMsgUpdateSchema    // { catId, msgId, text }            chat:msg-update (catId is the scope)
chatMsgRemoveSchema    // { catId, msgId }                  chat:msg-remove
chatRoomSchema         // { catId }                         chat:join, chat:leave
chatTypingSchema       // { catId, isTyping }               chat:typing
chatHistoryQuerySchema // { beforeId?, afterId? }, not both GET …/chat-msgs

// Like ReviewWithRefs: userId replaced by the slim UserRef (never username), null when the
// author is gone. A tombstone is a union branch, so TS won't let the FE read text off it
interface ChatMsgWithRefsBase { _id, catId, clientMsgId, createdAt, updatedAt, user: UserRef | null }
type ChatMsgWithRefs =
  | (ChatMsgWithRefsBase & { isDeleted: false; text: string })
  | (ChatMsgWithRefsBase & { isDeleted: true })
```
- **The schemas lowercase every id.** The shared ObjectId regex is case-insensitive, but room
  names and the FE's `catId` filter compare strings. Without lowercasing, `cat:ABC…` and
  `cat:abc…` would be two rooms. The server builds the room name from `toHexString()`, and the
  FE takes `catId` from the cat doc's `_id`, never from the route param.
- **Max text length: 1000** (`CHAT_MSG_TEXT_MAX_LENGTH`), trimmed, at least one character.
  - It follows chat-app convention, not the 500 review cap. Twitch allows 500, Discord 2000 and
    Telegram 4096.
  - 1000 sits in that range without inviting essays.
- **`chatPermissionService`**, in shared:
  - `canEditChatMsg` passes the author only. `canRemoveChatMsg` passes the author or an admin.
  - The FE uses them to hide buttons, and the backend uses them to enforce.
  - A `null` author (a deleted user) passes only an admin.

## Transport: socket for chat writes, REST for history

| Operation | Channel | Why |
|---|---|---|
| Send / edit / delete a message | **socket event + ack** | Lean frames, on a connection that's open anyway |
| Typing | socket | Frequent and short-lived, only the room cares |
| Join / leave the room | socket | Room membership is a socket concept |
| Presence | socket (server push) | Changes with room membership |
| Last 50, "load older", the reconnect gap fill | **REST** | Only the reader needs it, and paging is a plain HTTP query |

Cat and review CRUD stays REST.

**Why the writes go over the socket, not REST + a socket broadcast.** Discord and Slack work the
REST way. That option was a real contender: it would have reused
`requireAuth`, the validate middleware, `HttpError` and Supertest for free. The socket won
anyway:

| | REST write + socket broadcast | Socket write + ack |
|---|---|---|
| Bytes per message | ~0.5–1KB of headers (the cookie included) | a 2–14 byte frame header |
| Per-write work | a JWT verify on every request + the whole Express chain | the JWT is verified once, at the handshake, then each event checks only `exp` + runs its own chain (see "Authorization → Identity and freshness") |
| The DB re-read of the user | yes | yes (see "Authorization"): not a difference |
| What the WebSocket is for | push only, so REST + SSE with rooms would do | writes, typing and pushes |

- **The last row ("What the WebSocket is for") is the deciding one.** The first two rows are
  real but small savings. The socket must be open anyway, for typing and live
  pushes. With REST writes it becomes a push-only channel, and then SSE would do the job.
  A WebSocket only earns its place if the traffic goes both ways over it.
- **The cost:** the socket side needed its own pipeline. That's `on()`, the chain steps, the ALS
  store per event, error acks and a socket test harness (see "Authorization → Socket routes").
- *A weaker argument, not relied on:* an idle HTTP connection closes, so a POST after a pause may
  pay a new TCP + TLS handshake, while the socket stays warm. In prod that depends on Render's
  proxy idle timeout, which is unknown. Real, but unmeasured.

**The DB write is awaited before the broadcast and the ack.** Chat feels fast because of the
optimistic UI, not because it skips the `await`.

**Not chosen:**
- *Fire-and-forget writes* (broadcast without awaiting the insert).
  - A failed insert leaves a phantom message: others saw it live, and it's gone on reload.
  - The insert takes ~1–5ms. WhatsApp's single tick means the same thing: the server stored it.
- *History in the `chat:join` ack.* "Load older" needs a paged query anyway. The race it would
  prevent is solved by joining before fetching (see "Frontend data flow").

## Socket protocol
Commands (client → server) are present tense. Facts (server → clients) are past tense.

| Client → server | Payload | Ack | Server → room |
|---|---|---|---|
| `chat:join` | `{ catId }` | `{}` or `{ error }` | presence (below) |
| `chat:leave` | `{ catId }` | none | presence |
| `chat:msg-add` | `{ catId, clientMsgId, text }` | `{ msg }` or `{ error }` | `chat:msg-added { msg }` |
| `chat:msg-update` | `{ catId, msgId, text }` | `{ msg }` or `{ error }` | `chat:msg-updated { msg }` |
| `chat:msg-remove` | `{ catId, msgId }` | `{ msg }` (the tombstone) or `{ error }` | `chat:msg-removed { msg }` |
| `chat:typing` | `{ catId, isTyping }` | none | `chat:typing { catId, user, isTyping }`, sender excluded |
| (a join, a leave, a disconnect) | | | `chat:presence-changed { catId, count, users }`, per socket |

- **Broadcasts go to the whole room, the sender included** (`io.to(room)`, not `socket.to(room)`).
  The reason: Socket.io drops a late ack, but not a late event.
  ```
  server:  saves the msg → the broadcast and the ack go out together
  client:  its 5s ack timeout already fired (slow network) → the msg shows "failed"
           the late ack arrives      → dropped: emitWithAck already rejected
           the late broadcast arrives → a normal listener handles it
                                      → its clientMsgId matches the failed msg → "saved"
  ```
  With `socket.to`, the message would stay "failed" though everyone else sees it. The FE merges by
  `_id` and `clientMsgId`, so getting both the ack and the broadcast is harmless. Typing is the
  exception: it excludes the sending socket (ack is not needed).
- **Every outgoing event carries `catId`.** The FE socket is app-wide, so the hook drops events
  for a cat it's not showing (e.g. a late event from the room it just left).
- **`{ error }` is the HTTP error body** (`ApiErrorBody`, the same `ERROR_CODES`, plus the
  `requestId`). `CHAT_MSG_NOT_FOUND` is the only new code.
- **`user` on the wire is always a `UserRef`.** The handshake user is a full `LoggedInUser`,
  `username` included, so it never goes out as is.
  - A message's `user` is joined from the doc's `userId`, never taken from whoever sent the event.
    So an admin's remove still broadcasts the original author, not the admin.
  - One mapper (`_toWireMsg`) serves history, acks and broadcasts. It drops `text` from
    tombstones, so no path can leak it.

## Authorization

### Identity and freshness
- **The handshake verifies the JWT once per connection.** An `io.use` step reads the `loginToken`
  cookie and verifies it (signature and `exp`, `authService.verifyLoginTokenWithExp`). It stores
  the result in `socket.data.tokenUser` and `tokenExp`, with no DB read. A missing, invalid or
  expired token makes a guest, not a rejected handshake.
  The connection is same-origin, so the browser sends the cookie by itself.
- **A socket can stay open for hours.** A deleted user, a demoted admin or an expired token would
  keep the handshake identity until a reconnect. Two chain steps re-check it, the same split as
  REST's `attachTokenUser` vs `requireAuth`:

  | Step | Used by | Checks | DB read |
  |---|---|---|---|
  | `requireTokenUser` | typing | not a guest, `tokenExp` not passed | no: typing is frequent, and a stale name for a few seconds is harmless |
  | `requireSocketUser` | send / edit / remove | the same, plus a DB re-read → `verifiedUser` | yes: permission checks trust only a DB-verified user (`architecture.md` → Auth Boundary) |

- **A failed check rejects the event. The server never disconnects the socket.** When the server
  disconnects a socket, the client doesn't reconnect by itself. The user would be left with a dead
  socket, and Part 6 item 2's notifications ride on it too.
- Expiry is caught on the next write, not the moment the token expires. A timer per socket isn't
  worth it for a chat.

**Not chosen:**
- *Trust the handshake for the connection's life.* Nothing is caught until a reconnect.
- *A disconnect on ban or demote* (`io.in(<user room>).disconnectSockets()`). There's no ban or
  demote action yet. When one lands, it could replace the DB re-read.

### Who may emit what
One rule for every room-scoped event: **you can only act in a room you joined**
(`socket.rooms.has('cat:<catId>')`, no DB read).

| Event | Guest | Logged-in user | Room membership | Other checks |
|---|---|---|---|---|
| `chat:join` | yes | yes | n/a | the cat exists, else `CAT_NOT_FOUND` |
| `chat:leave` | yes | yes | n/a | none |
| `chat:msg-add` | **no**, `UNAUTHORIZED` | yes | required, else `FORBIDDEN` | none |
| `chat:msg-update` | **no**, `UNAUTHORIZED` | **the author only**, else `FORBIDDEN` | required, else `FORBIDDEN` | the msg is in that room, else `CHAT_MSG_NOT_FOUND` |
| `chat:msg-remove` | **no**, `UNAUTHORIZED` | **the author or an admin**, else `FORBIDDEN` | required, else `FORBIDDEN` | the msg is in that room, else `CHAT_MSG_NOT_FOUND` |
| `chat:typing` | **no**, dropped | yes | required, else dropped | none |

- **Auth runs before membership**, like REST, so a guest gets `UNAUTHORIZED`, never `FORBIDDEN`.
- **Edit and remove differ on purpose.** Reviews let an admin do both. In chat, an admin
  rewriting someone's message would put words in their mouth, while removing one is moderation.
- **Edit and remove also check the message's room.** Otherwise a client could name room A and
  edit a message in room B. It's the same idea as REST nesting.
- **Only `chat:join` reads the cat.** Join is the gate. Membership then means "the cat existed
  when I joined".
- **"Is it there" lives in the service's DB filters**, like REST:

  | Service function | Filter | No match → |
  |---|---|---|
  | `getByIdAndRoom` (read by the permission step) | `{ _id, catId }` | `CHAT_MSG_NOT_FOUND`: missing, or in another room |
  | `update` | `{ _id, catId, isDeleted: false }` | `CHAT_MSG_NOT_FOUND`: a deleted msg can't be edited |
  | `remove` | `{ _id, catId }`, sets only `isDeleted` | `CHAT_MSG_NOT_FOUND`. A repeat still matches, so it acks the tombstone with no second broadcast |

  - A missing message is a 404 before the permission check, so it never shows as a 403.
  - The filter is atomic. A message deleted between the permission check and the edit is caught
    by `isDeleted: false`.

**Not chosen:** *a cat read on every send.* It's one DB trip per message for what join already
guarantees, and it wouldn't close the orphan race either (see "When a cat is deleted").

### Socket routes: one place for every event's checks
Each event declares its chain in `chat.socket-routes.ts`, like an Express route with its
middlewares. The setup function calls `registerChatSocketRoutes(socket)` on every connection:

```ts
// chat.socket-routes.ts (condensed: on = socketService.on)
on(socket, CHAT_JOIN,       validatePayload(chatRoomSchema),                                            chatSocketController.join)
on(socket, CHAT_LEAVE,      validatePayload(chatRoomSchema),                                            chatSocketController.leave)
on(socket, CHAT_MSG_ADD,    validatePayload(chatMsgSchema),       requireSocketUser, requireRoomMember, chatSocketController.addMsg)
on(socket, CHAT_MSG_UPDATE, validatePayload(chatMsgUpdateSchema), requireSocketUser, requireRoomMember,
   requireChatMsgPermission(chatPermissionService.canEditChatMsg),   chatSocketController.updateMsg)
on(socket, CHAT_MSG_REMOVE, validatePayload(chatMsgRemoveSchema), requireSocketUser, requireRoomMember,
   requireChatMsgPermission(chatPermissionService.canRemoveChatMsg), chatSocketController.removeMsg)
on(socket, CHAT_TYPING,     validatePayload(chatTypingSchema),    requireTokenUser,  requireRoomMember, chatSocketController.relayTyping)
```

`socketService.on()` is the socket version of Express's plumbing:
- **It opens an ALS store per event** (`requestId`, `socketId`, `tokenUser`, `verifiedUser`).
  So the chat service reads `getVerifiedUser()` like every REST service does.
- **It turns a thrown error into `ack({ error })`.** An `HttpError` goes out as is. Anything else
  becomes `INTERNAL`, with no internals leaked.
- **It logs like `errorHandler`.** A 4xx gets one `console.warn` line, and a 5xx gets
  `console.error` with the stack. Each line carries the event name, `requestId` and `socketId`.
- **The ack is optional.** Our FE always asks for one, but anyone can call
  `socket.emit('chat:msg-add', payload)` from devtools. Calling a missing ack in the error path
  would throw inside the handler: an unhandled rejection, which crashes Node. So `on()` answers
  only when the last argument is a function, and one try/catch wraps the whole chain, the error
  path included.

The steps live in `backend/middlewares/socket/`, one per file. The layering matches REST: route →
controller (ack, broadcast) → service (DB).

**Not chosen:** *Socket.io's own per-packet middleware* (`socket.use`). Its `next(err)` fires a
generic `error` event instead of calling the ack. The client would wait out its 5s timeout and show
"failed" for what is really an auth error.

## History (REST)
```
GET /api/cats/:id/chat-msgs                  → the last 50     → { msgs, nextBeforeId }   ChatMsgOlderPage
GET /api/cats/:id/chat-msgs?beforeId=<msgId> → the 50 before   → { msgs, nextBeforeId }   ChatMsgOlderPage
GET /api/cats/:id/chat-msgs?afterId=<msgId>  → the 50 after    → { msgs, nextAfterId }    ChatMsgNewerPage
```
- It's open to guests, and an unknown cat gets 404 `CAT_NOT_FOUND`. `beforeId` and `afterId`
  together get 400 `VALIDATION_FAILED`.
- It's the first nested route (`Router({ mergeParams: true })`). Reviews are flat.
- **Cursor paging by `_id`, not an offset:**
  - **Offsets drift.** `skip(50)` after 3 new messages returns 3 messages the user already has.
  - **Offsets slow down with depth.** `skip(n)` still walks the n skipped index entries. A range on
    `_id` jumps straight to its spot in the `{ catId, _id }` index, so every page costs the same.
- **It fetches 51 to know if more exist.** `nextBeforeId` is the oldest returned `_id`, or `null`
  when nothing older exists. `nextAfterId` mirrors it.
- `msgs` come back oldest first, in both directions, ready to render.

## Add-msg flow and retries
- **The client makes a `clientMsgId` (UUID) per message** and reuses it on every retry.
  - It's built from `crypto.getRandomValues()`, not `crypto.randomUUID()`. The latter exists only
    in a secure context, and dev runs on `http://<vm-ip>:5173`. E2E runs on `localhost`, so it
    wouldn't catch this.
- **The server dedupes on `{ userId, clientMsgId }`, a unique index.** A duplicate-key error means
  a retry of a message that was already saved, so it returns the saved message.
  - The scope is per user, so one user can't block another's id.
  - **A dedupe hit acks only, with no second broadcast.** The first try already broadcast it.
- `clientMsgId` also matches the optimistic pending row to the saved message, which arrives
  with an `_id` the pending row never had.

**Not chosen:**
- *The same for the REST forms (cats, reviews).* A form waits for the response with its button
  disabled, and nothing retries it automatically. A lost response there is rare and visible (the
  user deletes the duplicate). The REST version is an `Idempotency-Key` header (Stripe), worth it
  for payments, not for cat forms.
- *`catId` in the unique index* (`{ userId, catId, clientMsgId }`). Without it, a `clientMsgId`
  reused in another cat acks the old message from the first cat and saves nothing. Our client
  makes a fresh id per message, so only a tampered client can reuse one, and then it only blocks
  itself: it can't post more, it just gets its old message back.

## Frontend data flow
`useCatChat(catId, isOpen)` owns the chat state, and `chatService` makes the REST calls.
- There's no Zustand store, since only this page uses the chat.
- There's no router loader either, even though `architecture.md` → Decisions routes server data
  through loaders. The fetch runs on a click, and live events must merge into it. Router data
  can't take that merge.

```
page load → chat:join ─ack→ live events flow in; the closed icon's badge counts them
first open → await the join ack → GET the last 50 → merge with the events since the join
close / reopen → only the panel toggles: the room stays joined, the state stays in the hook
unmount → typing false → chat:leave
```
- **The socket connects on app load**, not on the cat page: Part 6 item 2's notifications need it
  everywhere. It connects after the `/me` check, so the handshake carries the cookie `/me` just
  read.
- **Join on page load, fetch on open.** A visitor who never opens the chat pays only the join, and
  a closed chat still feeds the unread badge.
- **Join before fetching.** A message sent between the join and the fetch arrives as a live event,
  so it isn't lost.
- **One mount per cat.** `cat-details` renders `<CatChat key={cat._id}>`, so moving to another cat
  remounts the chat. The old room is left, the new one is joined, and the state starts fresh. The
  hook has no cat-switch path of its own.
- **The work lives in plain functions**, around a tracker built per mount
  (`hooks/cat-chat/use-cat-chat/`). The React file holds state and effects, and `room-sync.ts`,
  `msg-writes.ts` and `typing.ts` hold the logic. A late result from a previous mount sees its
  tracker is inactive and is dropped.

### Merge rules
Every fetch and every live event goes through the same rules:
- **Dedupe by `_id`.** A pending row is matched by `clientMsgId`.
- **Insert by `_id` order, never append.** Two sends at the same moment each await their insert,
  so B's broadcast can land before A's. Pending rows (no `_id` yet) stay at the bottom.
- **When one `_id` arrives twice, the content decides, not the arrival order:**
  ```ts
  function _isNewerCopy(incomingMsg, heldMsg) {
    if (heldMsg.isDeleted) return false // a tombstone is never replaced
    if (incomingMsg.isDeleted) return true // a remove doesn't touch updatedAt, so it needs its own rule
    return incomingMsg.updatedAt > heldMsg.updatedAt // a tie keeps the held copy
  }
  ```
  The race it fixes: a first-page fetch reads X, the author edits X, the live update lands, and
  then the slow fetch lands with the old X.
- **An edit or remove only replaces a message the hook already holds.** It never inserts one. An
  old message would otherwise sit alone above a gap, and "load older" would skip everything in
  between. The hook keeps the latest changed copy per `_id`, so a fetch that lands later still
  resolves to it.
- **"Load older" pages from the oldest held `_id`**, not the server's `nextBeforeId`. Live events
  plus the first fetch can reach further back than the fetch alone.

**Not chosen:**
- *The incoming copy wins.* A slow fetch would undo a live edit, or revive a deleted message.
- *Events replace, fetches only fill.* Right today, but it rests on "a fetch never knows more than
  the events", which nothing enforces.
- *A server `version` counter.* Changes to shared, the backend and the seed, for a race the rule
  above already covers.

### Optimistic add; edit and remove wait
| | Add | Edit / remove |
|---|---|---|
| On click | shows at once as **pending** | the row dims, its actions are disabled |
| On the ack | the saved message replaces the pending row | the ack replaces the row by `_id` |
| On a timeout (5s) or an error ack | **failed, tap to retry** (same `clientMsgId`) | back to how it was, plus a user msg. A failed edit keeps its text |

- **Why the split:** an add is the common, cheap path, so it's worth hiding the latency. An edit
  or delete rewrites what others already read, so it should show only what the server accepted.
- **A failed add can still turn into "saved".** If the connection dropped while the packet was in
  flight, the server may have saved it. A later broadcast or the gap fill brings its
  `clientMsgId` back.
- **Only the author can retry.** After a logout, the row keeps its text and a plain "Not sent".
- **A write goes out only once the room is joined.** Offline, it fails at once as a
  `NETWORK_ERROR`; online, it waits for the latest join's ack. Otherwise a write buffered offline,
  or sent right after a reconnect, can reach the server before the rejoin and get `FORBIDDEN`.
- **No client `retries` / `ackTimeout` options.** They would resend on their own, and stacked on
  the manual retry the attempts multiply. The manual retry keeps the failure visible.

### Reconnect, identity and session expiry
- **Rejoin on every `connect`, then fill the gap forward.** Socket.io drops room membership with
  the connection, and `connectionStateRecovery` is off.
  ```
  connect → cursor = the newest held _id → chat:join ─ack→ GET ?afterId=cursor … until nextAfterId is null
  ```
  - **The cursor is taken before the rejoin is emitted.** A live message landing after the rejoin
    is newer than the gap, and would make the fill skip it.
  - **The rejoin waits for its ack before the fill**, for the same reason as the first open.
  - Nothing already on screen is refetched, and more than 50 missed messages leave no hole.
  - A first chat panel open that failed is retried by the rejoin too.
- **A login change reconnects the socket**, since the handshake reads the cookie only once. One
  `useLoggedInUserStore.subscribe` compares the old and new `_id`, and reconnects only when it
  differs.
- **Other tabs follow a login or logout through `BroadcastChannel('auth')`.** Without it, tab 2's
  REST calls become a guest after a logout in tab 1, but its socket still writes as the old user.
  The DB re-read doesn't catch that: the user still exists. Each tab re-reads `/me`, and the
  `_id` compare above reconnects its socket.
  - **Not chosen:** *disconnecting the user's sockets on the server at logout.* It would also log
    out their other devices, which hold their own cookie.
- **An `UNAUTHORIZED` ack is handled like a REST 401.** The user is cleared, and a user msg says
  "Your session expired. Log in to keep chatting." There's no redirect: the user stays as a guest.
  - The unsent text goes to `sessionStorage` (`chatDraft:<catId>`). It's back in the composer
    when they log in and return to the cat.
  - A lost connection is a timeout, never a logout.

### Typing
```
typer:    keystroke → true (at most every 2s) ··· 3s idle, send, empty composer or leave → false
receiver: shows the line ··· no refresh for 5s → drops the typer (when a false never came)
```
- **The client owns the typing state, and the server keeps none.** The server only relays, and
  excludes the sending socket.
  - So a lost connection or a closed tab sends no `false`. The receivers' 5s timeout clears the
    line.
- **On leave, `false` goes out before `chat:leave`.** Typing needs room membership, so after the
  leave it would be dropped. One socket's emits stay in order.

**Not chosen:** *the server sends `false` on leave and disconnect.* It only saves the ~5s of a stale
line, and costs a `disconnecting` handler plus its tests.

## Presence ("2 here now")
**"Here" means on the cat's page**, i.e. in the room. The socket joins on page load, so someone
who never opens the panel counts too. It's the same model as the unread badge, and it needed no
protocol change.
- **The count is the distinct logged-in users in the room**, the viewer included. Two tabs count
  once. Guests aren't counted, since they have no id to dedupe.
- **Guests get the count only, never the names, on the wire too.**

### Mechanism
```
socket.join / socket.leave / a disconnect (leaveAll)
        │  the in-memory adapter emits join-room / leave-room
        ▼
registerChatRoomEvents(io): one listener, once per server, cat rooms only
        ▼
snapshot: the room's sockets ─▶ a live tokenUser ─▶ dedupe by _id ─▶ UserRef[]   (no DB read)
        ▼
for each socket in the room:  chat:presence-changed { catId, count, users }
                              users = UserRef[] for a logged-in socket, null for a guest
```
- **No new server state.** The adapter already keeps `room → socket ids`, and each socket has its
  `tokenUser`. A rename shows after the user's next login, which is fine for presence.
- **Adapter events, not the controllers.** One listener covers join, leave and disconnect.
  `leave-room` fires after the socket is removed, so the snapshot already leaves it out.
- **The full snapshot, not a ±1 delta.** A missed event is fixed by the next one, while a missed
  delta would leave the count wrong for good.
- **A loop over the room's sockets, not one `io.to(room).emit`**, so guests never get the names.
- **An expired token counts as a guest**, the same check as `requireTokenUser`.

### UI
- **The count sits on the header's subtitle:** "About Mitzi · 2 here now", or "Just you here".
  For a logged-in viewer with others there, it opens a "Here now" list inside the panel, with
  Owner / Admin chips.
- **The FE clears presence on `disconnect`.** An offline count is stale, and nothing would correct
  it. The rejoin brings a fresh one.

**Not chosen:**
- *Emits from the controllers plus a `disconnecting` handler.* Three call sites, and
  `disconnecting` needs the leaver filtered out by hand.
- *A pull on click* (`chat:presence` with an ack). The count needs live updates anyway, so the push
  already carries the list.

## Backend setup
- **Socket.io attaches to the existing http server** through a setup function `server.ts` calls,
  never in `app.ts`. Prod gets one server for the FE, `/api` and `/socket.io`. `app.ts` stays the
  bare Express app Supertest uses.
- **Setup and close live in `socketSetupService`, apart from `socketService`.** Setup registers
  the chat routes, while routes, controllers and steps import `socketService`. One file would make
  an import cycle.
- **Shutdown: `socketSetupService.close()` (`io.close()`) replaces `http.close()`.** `io.close()`
  disconnects every socket, then closes the http server itself. `http.close()` alone would wait on
  the open WebSockets until the safety timer kills the process. Clients see a transport close, so
  they keep reconnecting through a deploy, and the gap fill brings anything missed.
- **`maxHttpBufferSize: 16KB`** (the default is 1MB). Zod caps the text, but without it one frame
  could still be 1MB.
- **`connectionStateRecovery` stays off.** By default it restores the old `socket.data` user for up
  to 2 minutes without re-running the handshake auth. Its sessions also live in process memory, so
  a deploy drops them anyway. Rejoin + gap fill already cover it.
- **`socketService` holds `io`, so REST controllers can emit** (Part 6 item 2). Its emit is a no-op
  until `io` is set, so the Supertest files need no socket.
- **Join is async and leave isn't**, so a fast leave could run while the join is still reading the
  cat, and the join would then land for good. `socket.data.wantedCatIds` fixes it: join adds the
  `catId`, leave removes it, and join calls `socket.join` only if it's still wanted.

**Not chosen:** *an `Origin` check on the handshake.* Browsers apply no CORS to WebSockets, so the
cookie is what matters, and `sameSite: 'strict'` keeps it off a socket opened from another site.
That socket is a guest, and a guest can only read a chat that's public anyway.

## When a cat is deleted
**Built:** `catService.remove` deletes the cat's `chatMsgs`. A client that rejoins a deleted cat
gets `CAT_NOT_FOUND`, and the FE goes to `/cat` with a user msg.

**Planned with Part 6 item 2** (the site-wide notifications):
```
REST delete: catService.remove ─▶ io.in(room).socketsLeave(room) ─▶ the site-wide "cat removed" event
                                                                     ─▶ a page showing that cat goes to /cat
```
- Once the room is emptied, every send fails membership (`FORBIDDEN`). `FORBIDDEN` can't tell
  "deleted" from "never joined", so the event, or the rejoin's `CAT_NOT_FOUND`, is what redirects.
- **The race that's left:** a send that passed the membership check just before `socketsLeave` can
  insert an orphan. Reviews accept the same race, and the history route 404s on a missing cat, so
  an orphan is never shown.

## Known limits
- **An edit or delete of an older message during a socket drop is missed until a reload.** The
  gap fill only brings new messages.
- **The unread badge counts since page load**, and the gap fill's messages don't count. It's a
  hint, not a full unread count.
- **Presence:**
  - A token expiring doesn't re-announce, so the count can lag until the room's next change.
  - Adapter events are per process. With a multi-node adapter (e.g. Redis), each node would see
    only its own sockets. Fine for one Render instance.
- **The deleted-cat redirect for someone online** waits for Part 6 item 2 (see above).

## Not built (optional)
- **A per-socket rate limit on `chat:msg-add`.** Nothing stops a logged-in user from flooding a
  room, and the typing throttle is client-side only. A small token bucket in `socket.data` (e.g. 5
  messages per 10s) as a chain step would answer a new `RATE_LIMITED` code. A practice project with
  seeded users isn't a spam target.
