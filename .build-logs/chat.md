# Build log: the cat chat (Part 6 item 1)

How the chat was built: the order, the commit sizes and the seed. The feature itself, with every
decision and its why, is in `.docs/designs/chat.md`.

The design came first. It went through two fresh-context reviews before any code. Then every
commit below was one review stop: Claude wrote it in auto mode, and the user reviewed it and
approved the commit.

## Stages
```
A  backend  ──▶  B  seed  ──▶  C  frontend  ──▶  docs wrap-up
   socket infra,    needs A's      mockup round,      (last commit
   history, join,   schemas +      hook, panel,        on C's branch)
   send, edit,      ChatMsgDoc     actions, typing,
   delete, typing                  presence, E2E
```
- **One branch per stage:** `feat/chat-be`, `feat/chat-seed` and `feat/chat-fe`. Each one was
  reviewed as a whole, then merged to main.
- **Each side is finished within its own stage.** Typing and edit / delete were built on the
  backend in A, and on the frontend in C.
- **The seed comes between the backend and the frontend.** The FE's "load older", unread badge and
  message states can only be checked by hand against a real log.
- **Left for later:** the live "cat deleted" redirect, which goes with Part 6 item 2's site-wide
  events, and the optional rate limit.

Commit sizes: **S** = a few files, one idea. **M** = a feature slice with its tests. Nothing was
planned as **L**. An M that grew past that was split at its planned "split point".

## Stage A: backend (`feat/chat-be`)

| # | Commit | Size | What's in it |
|---|---|---|---|
| A0 | `docs: split part 6 item 1 into sub-items` | S | Roadmap: item 1 gets the sub-items backend, seed and frontend. Each stage ticks its own sub-item in its last feature commit. |
| A1 | `chore(be): add socket.io` | S | `socket.io@^4.8.4`, plus `socket.io-client` as a backend devDependency for the socket tests. `npm audit`, and a lockfile check for the patched `engine.io` and `socket.io-parser`. |
| A2 | `feat(shared): add chat models` | M | `shared/src/models/chat.ts`: the tombstone union, every payload schema, the history query schema, the page types, `CHAT_MSG_TEXT_MAX_LENGTH`, the event names. `CHAT_MSG_NOT_FOUND`. Tests. Glossary: chat, chat msg. |
| A3 | `feat(shared): add chatPermissionService` | S | `canEditChatMsg`, `canRemoveChatMsg` (a `null` author → admin only). Tests. |
| A4 | `refactor(be): expose the login token's exp` | S | `verifyLoginTokenWithExp`, next to the old `verifyLoginToken`, over one private verify. Tests. |
| A5 | `refactor(be): add socketId to the ALS store` | S | `socketId` (null for HTTP). The `getVerifiedUser` guard message becomes generic. |
| A6 | `feat(be): attach socket.io to the http server` | M | `socket.service.ts`: the setup function, the handshake auth, the `io` holder with a no-op emit, `close()`. Shutdown awaits it. The socket test helper, and its section in the `writing-tests` skill. |
| A7 | `feat(be): add the socket event chain` | M | `on()` (an ALS store per event, the chain, error → ack, the optional ack, logs), plus the chain steps. Tests with the real test DB. **Split** into A7a (`on()`) and A7b (the steps). |
| A8 | `feat(be): add the chat history route` | M | `ChatMsgDoc`, both indexes, `chatService.query` (fetch 51, both directions, the `$set` join), the wire mapper, `GET /api/cats/:id/chat-msgs`. Supertest. |
| A9 | `feat(be): delete a cat's chat msgs with the cat` | S | The cascade in `catService.remove`. |
| A10 | `feat(be): add chat:join and chat:leave` | M | `registerChatSocketRoutes`, `wantedCatIds`, the room name. Socket tests, a leave during a slow join included. |
| A11 | `feat(be): add chat:msg-add` | M | `chatService.add` with the duplicate-key dedupe, the ack and the `io.to(room)` broadcast. |
| A12 | `feat(be): add chat:msg-update` | M | `requireChatMsgPermission`, `chatService.getByIdAndRoom` / `update` with the `isDeleted: false` filter. |
| A13 | `feat(be): add chat:msg-remove` | S | `remove` sets only `isDeleted`. An admin's remove broadcasts the author, not the admin. A repeat remove acks the same tombstone. |
| A14 | `feat(be): relay chat:typing` | S | The relay, sender excluded. Ticks the backend sub-item. |
| A15 | `docs: record socket.io and chatMsgs in architecture` | S | Stack, topology, the `chatMsgs` collection, a Change Log line. |

Plus a refactor and the fix-ups from the branch review.

## Stage B: seed (`feat/chat-seed`)

| Commit | What's in it |
|---|---|
| `feat(be): add the chat thread pool` | `scripts/data/chat-threads.json` and `buildSeedChatMsg`, one plain msg validated by `chatMsgSchema`. |
| `feat(be): build the paging cats' chat logs` | The shared core `buildChatLog` and the scripted planner, with `SCRIPTED_CHAT_SPECS`. The page size became the exported `CHAT_MSG_PAGE_SIZE`. |
| `feat(be): build the random chat logs` | `buildRandomChatLog` on the same core. |
| `feat(be): seed chat msgs` | `pickScriptedChatCats` and the wiring in `seed.ts`. Ticks the seed sub-item. |
| `refactor(be): rename the paging cats to scripted cats` | "Scripted vs random" names what sets them apart. Paging is only one of the things they check. |
| fix-ups after the branch review | Two comments. Tests that pin distinct threads per log and one user per speaker slot. |

**What npm run seed -w backend gives the FE.** Two kinds of cat, one core. The logic lives in `scripts/chat-seed.ts`, and `seed.ts` only
wires it, like reviews:
```
scripted spec ────────┐
                      ├──▶ core: threads → lines with authors → times → states → ChatMsgDocs
random picks ─────────┘
```
- **The core holds every rule that makes a log valid, and throws on a break.**
  - Docs are built oldest first, so `_id` order matches `createdAt` order. History pages by `_id`.
  - Every msg sits between the cat's `createdAt` and now.
  - An edit sets `updatedAt = createdAt + 5 min`. A delete sets only `isDeleted`, like the real
    remove, so "Edited at" survives on an edited-then-deleted msg.

**The 4 scripted chats are the manual checks for the frontend.** They're the top 4 of `/cat`'s
default sort, picked by sort, not by name. Each re-seed gives them the same threads, authors,
states and positions.

| Position on `/cat` | Msgs | Owner | Pages (newest first) | What it checks |
|---|---|---|---|---|
| 1st (newest) | 120 | `user` | 50 + 50 + 20 | "Load older" twice |
| 2nd | 70 | `admin` | 50 + 20 | "Load older" once |
| 3rd | 50 | `user` | 50 | `nextBeforeId: null`, no button |
| 4th | 51 | `admin` | 50 + 1 | One load, and the one older msg is "[Deleted User]" |

Every page of 20 or more msgs carries the same showcase, counted from its newest msg:
- Offset 1 is edited, 4 is deleted, and 7 is edited then deleted.
- Offset 10 is the ghost: a fresh `ObjectId` with no user doc, so it shows "[Deleted User]".
- All 5 seed users speak on every page. So every page has the Owner chip, the Admin chip, and
  users with no chip.
- Times count back from now: the newest msg is 2 hours ago, lines are 2 min apart, and threads
  are 2 days apart.

**The other 96 chats are background.** About 20% have an empty log, and the rest get 3–20 msgs.
States are rolled: about 10% edited, 5% deleted, and 10% of logs have a ghost. Nothing is
guaranteed there, so states are checked on the scripted chats.

**The thread pool** is 31 threads of 3–8 lines. Each line is a speaker slot and a text. A thread
fills its slots with distinct users, so nobody answers themselves. Threads repeat across cats, so
no line names a cat, an owner or a gender.

**Re-seed and E2E.** A re-seed wipes `chatMsgs` only after every log is built, so a bad thread line
fails with the DB untouched. E2E re-seeds on every run, so the chat E2E uses a cat it creates
itself, with an empty log.

## Stage C: frontend (`feat/chat-fe`)
**C0, a mockup round (not a commit).** Four directions as tabs on one page. The fourth, the final
one, became the spec in the design doc's UI section.

| # | Commit | Size | What's in it |
|---|---|---|---|
| C1 | `chore(fe): add socket.io-client and the ws proxy` | S | The dependency, plus the `'/socket.io'` proxy entry with `ws: true`. |
| C2 | `feat(fe): connect the socket on app load` | S | The FE `socketService` singleton, connected in `main.tsx` after the `/me` check. |
| C3 | `feat(fe): reconnect the socket when the user changes` | S | `useLoggedInUserStore.subscribe` with the `_id` compare. Tests. |
| C4 | `feat(fe): sync login state across tabs` | S | `BroadcastChannel('auth')`: the other tabs re-hydrate from `/me`. Tests. |
| C5 | `feat(fe): add chatService and a uuid helper` | S | The history calls, and the `getRandomValues` v4 helper. Tests. |
| C6 | `feat(fe): add useCatChat history` | M | Join on mount, leave on unmount. First open: join ack → fetch. The merge rules, the "load older" cursor. Tests. |
| C7 | `feat(fe): add live msgs and reconnect to useCatChat` | M | `chat:msg-added` and the unread count. Rejoin on `connect` → gap fill after the ack. The failed-join state, and `CAT_NOT_FOUND` → `/cat`. Tests. |
| C8 | `refactor(fe): extract user chips from the review row` | S | `UserChips`, shared by reviews and chat. Glossary: user chip. |
| C9 | `feat(fe): add the chat panel, read-only` | M | The icon with the badge, the panel, every saved message state, the chips and the own-row style, "load older" with the scroll restore, the guest CTA, the error state. |
| C10 | `feat(fe): send chat msgs` | M | The composer, optimistic pending → saved, timeout → failed → retry, `UNAUTHORIZED` → guest + the saved draft. Tests. |
| C11 | `feat(fe): edit and remove chat msgs` | M | The hook's update and remove (wait for the ack), then the actions menu, inline edit and the delete confirm. |
| C12 | `feat(fe): add the typing indicator` | M | The 2s throttle, the 3s idle `false`, the 5s receive timeout. Tests with fake timers. |
| C13 | `test(fe): add chat e2e` | S | Two browser contexts on a fresh cat: send, typing, edit, delete, and a guest with no input. |
| C14a | `feat: add chat presence` | M | shared + backend: `chat:presence-changed`, the adapter listener, the per-socket emit. Socket tests. |
| C14b | `feat(fe): show who's in the chat` | M | The count and the "here now" list. **Split** into the hook, then the UI. |
| C15 | `docs: add the chat design doc` | S | `.docs/designs/chat.md` from the design handoff, the architecture summary, the roadmap ticks. |

Plus a refactor round after C11, a refactor moving the presence list's logic into a hook, and the
fixes from the branch review.

## What changed during the build
The plan was a shape, not a script. These changed on the way:
- **The hook has no cat-switch path.** C6 planned one. `cat-details` renders
  `<CatChat key={cat._id}>` instead, so a switch remounts the chat with fresh state. `catId` comes
  from the cat doc's lowercase `_id`, so the FE lowercasing went too.
- **`useCatChat` became a folder.** After C11 the hook held too much. The React side stayed in
  `use-cat-chat.ts`, and the logic moved to plain functions on a per-mount tracker
  (`room-sync.ts`, `msg-writes.ts`, `typing.ts`).
- **The chat components moved into idea folders** (`chat-header/`, `chat-main/`, `chat-footer/`,
  `chat-msg/`).
- **Presence wasn't in the original design.** It came after the mockup round, with its own mockup,
  and got C14a / C14b.
- **A class-name trap:** `CatChat` renders inside `.cat-details`, whose SCSS already styles
  `.panel`, `.actions` and others. C9 hit it with `.panel`, so later chat class names avoid them.
