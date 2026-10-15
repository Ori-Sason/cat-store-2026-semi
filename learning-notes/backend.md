* [server.ts](/backend/server.ts)
  * I used to use `app.get('/**', (req, res) => ..)`.  
    However, Express 5 upgraded its path matcher (`path-to-regexp` v8). Wildcards must be named now:
    ```typescript
    app.get('/*splat', ...)   // matches /anything/deep, but NOT bare "/"
    app.get('/{*splat}', ...) // also matches "/" (braces = optional)
    ```
    For an SPA fallback you want `'/{*splat}'`. The name ends up in `req.params.splat`, and you can ignore it here.  

    The same fix applies to my old out `app.all('*', setupAsyncLocalStorage)`. For "run on every request" middleware, `app.use(setupAsyncLocalStorage)` is simpler anyway.
* Dev proxy instead of `cors` — [frontend/vite.config.ts](/frontend/vite.config.ts)
  ```ts
  server: { proxy: { '/api': 'http://localhost:8000' } }
  ```
  The frontend calls relative URLs (`fetch('/api/cat')`), never `http://localhost:8000/...`.
  * **Vite exists only in dev and build.** `server.proxy` lives inside the dev server. After `vite build`, the static files go to `backend/public` and Express serves them. Vite isn't running, so the proxy does nothing in prod. It doesn't need to: the page and `/api` come from the same Express server, so it's already same-origin.
  * **Why I don't need `cors` anymore.** The browser enforces CORS, and only on requests the browser itself makes. With the proxy, the browser only ever talks to `:5173`:
    ```
    browser ──▶ Vite :5173 ──▶ Express :8000
            same origin     server-to-server (Node → Node), no browser = no CORS check
    ```
    So both dev and prod are same-origin, and the `cors` package can go.  
    I'd need it back for split hosting, e.g. the frontend on one domain and the API on another.
* Central error handler — [error.middleware.ts](/backend/middlewares/http/error.middleware.ts)
  * **Why it's registered last in [server.ts](/backend/server.ts).** Errors only travel *forward*. When something throws, Express skips all normal middleware and jumps to the next 4-arg `(err, req, res, next)` handler *below* that point. Last in the file = downstream of every route. At the top, nothing would reach it.
  ```
  express.json()
  catRouter        ← throws here
  /api 404         ← skipped (normal middleware)
  /{*splat}        ← skipped (normal middleware)
  errorHandler     ← first 4-arg handler downstream → runs
  ```
  * **`if (res.headersSent) return next(err)`.** Status + headers go out before the body and can't be taken back. If a **streamed** response fails midway, the client already has `200 OK`, and `res.status(500)` would throw `Cannot set headers after they are sent`. `next(err)` passes it to Express's default handler, which just kills the connection (the client sees a truncated response, not a fake-complete one).
* Request validation with Zod — [validate.middleware.ts](/backend/middlewares/http/validate.middleware.ts)
  ```ts
  const catIdParams = z.object({ catId: objectIdSchema })
  router.put('/:catId', validate({ params: catIdParams, body: catSchema }), updateCat)
  ```
  Runs before the controller. Bad input → `400` + per-field errors, and the controller never runs.
  * **Bad ID:** `GET /api/cat/abc`
    ```json
    400 { "message": "Invalid URL params", "errors": { "catId": ["Invalid ID"] } }
    ```
  * **Bad body:** `POST /api/cat` with `{ "name": "M", "price": 0, ... }`
    ```json
    400 { "message": "Invalid request body",
          "errors": { "name": ["Name must be at least 2 characters"],
                      "price": ["Price must be at least $1"] } }
    ```
  * **On success `req.body` is replaced** with Zod's parsed copy: trimmed, and unknown keys (e.g. a client-sent `_id`) stripped.
  * `req.params` is only checked, not replaced. Express resets it for every route layer.
* Login timing attack & `DUMMY_HASH` — [auth.service.ts](/backend/api/auth/auth.service.ts)
  * Fetching the user from the DB takes ~1-5ms.
  * `bcrypt.compare` takes ~50ms (on purpose, to slow down brute force).
  * **The leak.** If we return early when there's no user, only real users pay for bcrypt:
    ```ts
    const user = await userService.getByUsername(username)
    if (!user) throw invalidCreds()                // ~2ms  → username doesn't exist
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) throw invalidCreds()             // ~50ms → username exists
    ```
    Same error body, different response time. An attacker sends a list of usernames and sorts them into fast (doesn't exist) and slow (exists).
  * **The fix (implemented).** Always run one compare. With no user, compare against a dummy hash, computed once at startup (top-level `await`), not per request:
    ```ts
    const DUMMY_HASH = await bcrypt.hash('time-consuming-dummy', BCRYPT_COST)

    const isMatch = await bcrypt.compare(password, user?.password ?? DUMMY_HASH)
    if (!user || !isMatch) throw invalidCreds()    // ~50ms either way
    ```
    Bonus: one `throw` instead of two. TS still narrows `user` to non-null after it.
  * **Honest caveat.** Signup returns `USERNAME_TAKEN`, so anyone can already check if a username exists there. The dummy hash closes the login leak only. It's defense in depth, not a full fix.
* `clientMsgId`: idempotency for chat writes (Part 6 chat, planned)
  * **The problem.** A chat message goes over a socket event with an ack. If the server saved it but the ack got lost (timeout, a dropped connection), the client retries, and the retry saves it a second time:
    ```
    client ──msg──▶ server: insert ✓ ──ack──✗ (lost)
    client: timeout → retry ──msg──▶ server: insert ✓   ← duplicate
    ```
  * **The fix.** The client generates a UUID per message (`clientMsgId`) and sends the same one on every retry. A unique index `{ userId, clientMsgId }` turns the second insert into a duplicate-key error, and the server answers with the already-saved message instead.
    * Scoped per user, so one user can't block another user's id.
  * **It does two jobs:**
    1. **Dedupe retries.** Chat retries on purpose: timeout → retry, and Socket.io resends its buffered emits after a reconnect.
    2. **Match pending → saved.** The optimistic message shows before the server gives it an `_id`, so it needs its own key. When the ack or the broadcast arrives, `clientMsgId` says which pending message it replaces.
  * **Why not on the REST forms (cats, reviews).** A form waits for the response with its button disabled, and nothing retries it by itself. A lost response is rare and visible: the user sees a duplicate review and deletes it. There's also no optimistic item that needs a key before the `_id`.
  * **The REST version of this** is an `Idempotency-Key` header (Stripe uses it): the client sends a unique key per operation, and the server stores the first response under that key and replays it on a retry. Worth it where a duplicate costs money (payments), not for cat forms.
* Socket.io transports: polling first, then WebSocket — [socket.service.ts](/backend/services/socket.service.ts)
  * **A WebSocket starts as HTTP.** The client sends a `GET` with `Upgrade: websocket`, the server answers `101 Switching Protocols`, and from then on both sides send frames over that one TCP connection.
  * **Why not open a WebSocket right away.**
    * A failed WebSocket attempt is often not a quick "no". Some proxies, antivirus tools and middleboxes accept the `101` and then drop the frames, or just hang. The client waits for a timeout before it falls back: seconds of a dead connection.
    * History: when Socket.io was designed, many browsers and networks had no WebSocket at all.
  * **The fix: engine.io (the layer under Socket.io) starts on plain HTTP long-polling.** The first request gets a session id (`sid`), and every later request carries it.
    * **Server → client:** the client sends a `GET`, and the server holds it open until it has something to send, then answers. The client sends the next `GET` right away. So there's always a request waiting, and the server can "push" at any moment.
    * **Client → server:** each message goes as its own `POST`, with the same `sid`.
    * Plain HTTP almost always works, so the app is live at once. The upgrade is tried in the background. If it fails, the client stays on polling and nobody notices.
  * **The default flow:**
    ```
    1. GET  ?transport=polling                      → handshake, the server assigns a sid
    2. GET / POST ?transport=polling&sid=X          → the app is already live
    3. GET  ?transport=websocket&sid=X  (Upgrade)   → 101, tried in the background
    4. a probe ping/pong over the WebSocket, then polling stops and everything goes over frames
    ```
    With `transports: ['websocket']` there's no polling: the upgrade request is the first contact (no `sid` yet), and the handshake happens on it.
  * **Why it mattered for the handshake cookie.** The handshake can arrive on a polling `GET` or on a WebSocket upgrade, depending on the transport. `io.engine.use(cookieParser())` runs on every engine.io HTTP request, the upgrade included, so `socket.request.cookies` is there either way.
  * **Bottom line:** a few extra round trips at connect time, in exchange for "always connects fast, even on hostile networks". `transports: ['websocket']` skips them, at the cost of no fallback.
* Socket acks: when the client asks for an answer — [socket.service.ts](/backend/services/socket.service.ts)
  * **A client emit is two arguments:** the payload (the object the event's schema checks), then an optional ack function. `on()` takes the last argument as the ack only if it's a function, and the payload is what's left (`args[0]`).
  * **The FE doesn't write the callback by hand.** `socket.timeout(5000).emitWithAck(event, payload)` adds it and returns a promise of the ack body.
  * **The ack isn't only for errors. It carries the success answer too:**
    * **Send:** the saved msg, with its `_id`. It replaces the pending one, and it's the proof the msg is stored.
    * **Edit / delete:** the updated msg. The UI stays dimmed until it arrives.
    * **Join:** `{}`. The FE waits for it before it fetches the history, so nothing sent in between is lost.
  * **Leave and typing use a plain `socket.emit` (no ack).** Nothing depends on their result.
  * **Bottom line:** without an ack, the FE can't tell "saved" from "lost". Use one wherever the next step depends on the answer.
