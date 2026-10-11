* Mocking axios in the http service tests — [http.service.test.ts](/frontend/src/services/http.service.test.ts)
  * The service calls an axios **instance**, not `axios.get` / `axios.put`. Every method goes through `ajax()`, and that calls the instance as a function:
    ```ts
    // http.service.ts
    import Axios from 'axios'
    const axios = Axios.create({ withCredentials: true })
    ...
    const res = await axios({ url, method, data, params })
    ```
    So to fake the network, the test only has to fake `create()` and make it return a mock function.
    
    The mock:
    ```ts
    const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }))
    vi.mock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>()
      return {
        ...actual,
        default: { create: () => mockRequest, isAxiosError: actual.isAxiosError },
      }
    })
    ```

  * Partial mock: `importOriginal` and `actual`
    * `vi.mock('axios', factory)` replaces the **whole** module with whatever the factory returns.
    * `importOriginal` → a function Vitest passes to the factory. It loads the **real** module and skips the mock.
    * `actual` → the real module object, with all its real exports (`AxiosError`, `isAxiosError`, `default`, …).
    * `<typeof import('axios')>` is only a type hint, so `actual` is typed as the real module.
    * So the factory says:
      ```
      ...actual        → keep every real export (e.g. AxiosError, used to build fake errors)
      default: {...}   → swap only the default export (the `Axios` object the service imports)
      ```
    * **Watch out for the default export.** `...actual` copies the top-level named exports. `default: {...}` is a brand-new object that only holds what you put in it. The service reads the default export:
      ```ts
      import Axios from 'axios'
      Axios.isAxiosError(err)   // reads default.isAxiosError, not the named export
      ```
      That's why `isAxiosError: actual.isAxiosError` is added back by hand. Without it, `Axios.isAxiosError` is `undefined`, and every error test throws a `TypeError`.

  * `vi.hoisted` and the run order
    * Vitest moves every `vi.mock` call above the imports. `vi.hoisted` runs code before the imports too, and lands above `vi.mock`. The file actually runs in this order:
      ```
      1. vi.hoisted(...)                → mockRequest = vi.fn() exists
      2. vi.mock('axios', factory)      → registered
      3. import { httpService } ...     → loads axios → factory runs
      4. http.service.ts runs           → Axios.create() is called ONCE, returns mockRequest
      5. tests                          → httpService.get() → ajax() → mockRequest({...})
      ```
    * With a plain `const mockRequest = vi.fn()`, step 3 would hit a variable that doesn't exist yet → `ReferenceError`.
    * Rule: if a `vi.mock` factory needs a variable from the test file, create it inside `vi.hoisted`.
    * Since `create()` runs only once, the service holds the **same** `mockRequest` for the whole file. So `beforeEach` resets it between tests:
      ```ts
      beforeEach(() => {
        mockRequest.mockReset()
      })
      ```

  * Controlling what the mock returns
    * `mockResolvedValue(x)` → every call returns `Promise.resolve(x)`. Same as `vi.fn(async () => x)`.
      ```ts
      mockRequest.mockResolvedValue({ data: [{ name: 'Mitzi' }] })
      expect(await httpService.get('cats')).toEqual([{ name: 'Mitzi' }])
      ```
    * GET, POST, PUT and DELETE all go through `mockRequest`, so they all get the same value.
    * `mockResolvedValueOnce(x)` → only the next call. Chain it for a different value per call.
    * `mockRejectedValue(err)` → every call returns a rejected promise. Used to test the error mapping:
      ```ts
      mockRequest.mockRejectedValue(_axiosError({ status: 502, data: '<html>Bad Gateway</html>' }))
      await expect(httpService.get('cats')).rejects.toMatchObject({ status: 502, code: 'UNKNOWN' })
      ```
    * The test can also check **how** the service called axios, since it's the same function:
      ```ts
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/cats', params: { name: 'Mitzi' } }),
      )
      ```

* Faking the clock with `vi.useFakeTimers` — [review.routes.test.ts](/backend/api/review/review.routes.test.ts)
  * **Why:** the server sets `createdAt` / `updatedAt` from `new Date()`. A real clock gives a different value on every run, so the test can't assert an exact date. Freezing the clock makes it predictable:
    ```ts
    const NOW = new Date('2026-01-01T00:00:00Z')

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)

    new Date()   // → 2026-01-01T00:00:00Z, every time
    Date.now()   // → same moment
    ```
    Now the test can check `expect(res.body.createdAt).toBe(NOW.toISOString())`.
  * `useFakeTimers` swaps the clock. `setSystemTime(NOW)` picks the frozen moment. The clock doesn't tick on its own after that.
  * **Why fake only `Date`:** by default it also fakes `setTimeout`, `setInterval`, `setImmediate`, etc. Those timers then fire only when the test moves time forward by hand (`vi.advanceTimersByTime`). Supertest and the Mongo driver use real timers inside, so with everything faked the request just hangs → test timeout. `toFake: ['Date']` freezes the date and leaves the timers alone.
  * When you **do** want fake `setTimeout`: testing a debounce ([use-debounced-callback.test.ts](/frontend/src/hooks/use-debounced-callback.test.ts)). There `vi.useFakeTimers()` fakes everything, and `vi.advanceTimersByTime(300)` skips the wait instead of really sleeping.
  * **Restore with `vi.useRealTimers()` in `afterEach`.** Fake timers are global. Without restoring, the frozen clock leaks into the next tests and they get a wrong "now".
    ```ts
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(NOW)
    })
    afterEach(() => {
      vi.useRealTimers()
    })
    ```
