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
* Central error handler — [error.middleware.ts](/backend/middlewares/error.middleware.ts)
  * **Why it's registered last in [server.ts](/backend/server.ts).** Errors only travel *forward*. When something throws, Express skips all normal middleware and jumps to the next 4-arg `(err, req, res, next)` handler *below* that point. Last in the file = downstream of every route. At the top, nothing would reach it.
  ```
  express.json()
  catRouter        ← throws here
  /api 404         ← skipped (normal middleware)
  /{*splat}        ← skipped (normal middleware)
  errorHandler     ← first 4-arg handler downstream → runs
  ```
  * **`if (res.headersSent) return next(err)`.** Status + headers go out before the body and can't be taken back. If a **streamed** response fails midway, the client already has `200 OK`, and `res.status(500)` would throw `Cannot set headers after they are sent`. `next(err)` passes it to Express's default handler, which just kills the connection (the client sees a truncated response, not a fake-complete one).
* Request validation with Zod — [validate.middleware.ts](/backend/middlewares/validate.middleware.ts)
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
