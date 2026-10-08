* Vite is a build tool + dev server. It runs in Node on my machine (not the browser) — it bundles/transforms code in `src/` folder and serves it to the browser during `dev`, or outputs static files during `build`. `vite.config.ts` configures Vite itself, not my app.

  `tsconfig` files are TypeScript type-checkers configurations. Two separate JS environments are involved, so two separate tsconfigs check them:

  | | `src/` (my app) | `vite.config.ts` (Vite's config) |
  |---|---|---|
  | Runs in | browser | Node, on my machine |
  | Shipped to users? | yes (after build) | never |
  | Checked by | `tsconfig.app.json` | `tsconfig.node.json` |
  | Has `lib: DOM`? | yes | no |
  | Has `types: node`? | no | yes |

  `tsconfig.json` itself has no settings — it just points to those two via `references`.

   The browser doesn't have some of Node's APIs, like `fs` for the file system. `tsconfig.app.json` leaves out Node's types so the type-checker matches what `src/` actually runs in — the browser, not Node.
* In [vite.config.ts](/frontend/vite.config.ts), I've added `server: { host: true }`.
  By default, Vite's dev server only binds to `localhost`, which on this machine resolved to IPv6 loopback only (`::1`) — not IPv4 loopback or the VM's real network interface. `host: true` binds to all interfaces instead, so both work.
  It affects `vite (dev)` and `vite preview`, but not `vite build` — no change needed when I publish the site.
* Setting `onerror` to `null` once it triggers prevents looping if fallback image also fails
  ```tsx
  <img 
      src={cat.img} 
      onError={({ currentTarget }) => {currentTarget.onerror=null; currentTarget.src=defaultCatImg }} 
  />
  ```
* Sass Modules: `@use` vs `@forward` (Replacing `@import`)

  * ❌ The Old Way (`@import`)  
    * **How it worked:** Acted like a global "copy-and-paste" mechanism. 
    * **The Problem:** Everything leaked into a single global scope. A component file (`_cat-preview.scss`) could use variables from `vars.scss` just because `main.scss` happened to load them first. The component didn't actually know where its variables came from, risking naming collisions and compilation errors if compiled standalone.

  * 🔒 The New Way (`@use` and `@forward`)  
    Sass modules completely isolate files. Files are now **sandboxed** and cannot see the global scope. If a file wants to use a variable or mixin, it must explicitly request it.

    * **`@use` (Consuming Tools & Styles):** Used when a file needs to actually use variables/mixins or compile CSS rules. It makes tools available *only* within that specific file.
    * **`@forward` (Bundling/Piping Tools):** Used to bundle multiple utility files into a single entry point. It passes tools down the pipeline *without* letting the current file use them.

  * 🛠️ Our Implementation (The 3-Step Strategy)  
    We migrated a project structure by changing how utilities are bundled, how components consume them, and how the final CSS is generated.

    1. The Central Pipeline (`setup/_index.scss`)  
      Instead of importing utilities individually everywhere, we bundle them into a folder index using `@forward`. This file generates no CSS; it just passes the tools forward.
        ```scss
          // src/assets/scss/setup/_index.scss
          @forward 'vars';
          @forward 'typography';
          @forward 'mixins';
          @forward 'functions';
        ```

    2. Isolated Components (`cmps/_cat-list.scss`)  
      Because files are sandboxed, every individual component or layout file that needs variables or mixins must explicitly `@use` the setup folder at the very top. 
        ```scss
        // src/assets/scss/cmps/_cat-list.scss
        @use '../setup' as *; // "as *" removes the need to write "setup.$variable"

        .cat-list {
          color: $primary-color; // Safe, explicit, and isolated
          @include flex-center;
        }
        ```

    3. The Final Orchestrator (`main.scss`)  
      `main.scss` only needs to `@use` files that contain actual, physical CSS layout blocks and components. Because the components already brought their own tools via `@use '../setup'`, **`main.scss` does not need to import the setup utilities at all.**
        ```scss
        // src/assets/scss/main.scss
        @use 'basic/base';
        @use 'basic/layout';
        @use 'cmps/cat-list';
        @use 'cmps/cat-preview';
        // (No setup files needed here!)
        ```
* `onClick` propegades from inside to outside, so from an `<li>` to `<ul>`. The other way around is `onClickCapture`.
* State Management solutions

  | Feature / Library | ⚡ [Zustand](https://pmnd.rs "Zustand Documentation") | 🌐 [TanStack Query](https://tanstack.com "TanStack Query Official Site") | 🧠 [Redux Toolkit (RTK)](https://js.org "Redux Toolkit Official Site") |
  | :--- | :--- | :--- | :--- |
  | **Primary State Type** | Client / UI State | Server / API State | Complex Client State |
  | **Boilerplate** | Extremely Low (No providers) | Low (Hook-based) | High (Slices, reducers, store setup) |
  | **Built-in Caching** | No | Yes (Automatic) | No (Unless using RTK Query) |
  | **Learning Curve** | Gentle | Moderate | Steep |
  | **Best For** | Global UI toggles, preferences | CRUD operations, dashboards | Enterprise-scale apps with complex sync |

  ---

  * ⚡ Zustand
    * **Primary Focus:** Lightweight Client/UI State.
    * **Key Strengths:** Virtually **zero boilerplate**, exceptional performance, hook-based, and requires no `<Provider>` wrappers.
    * **When to Use:** Small-to-medium apps, global UI toggles (themes, sidebars), or multi-step forms.
    * **Key Note:** It is unopinionated; large teams must self-enforce architecture rules to prevent messy code.

  * 🌐 TanStack Query
    * **Primary Focus:** Server State (Asynchronous API Data).
    * **Key Strengths:** Out-of-the-box **caching, de-duplication, pagination**, background refetching, and error/loading state handling.
    * **When to Use:** Any application that heavily relies on CRUD operations, REST/GraphQL APIs, or dashboards.
    * **Key Note:** It drastically reduces the need for traditional client-side global stores by keeping network data out of them.

  * 🧠 Redux (via Redux Toolkit)
    * **Primary Focus:** Complex, Interconnected Client State.
    * **Key Strengths:** Strict architecture (Slices/Reducers), powerful **middleware pipelines**, and elite **time-travel debugging**.
    * **When to Use:** Massive enterprise apps, data-heavy local software (like Figma or spreadsheets), and huge distributed engineering teams.
    * **Key Note:** It requires a steep learning curve and higher boilerplate, but offers unmatched predictability for complex workflows.

  ---

  * Quick Selection Guide
    * **Modern Standard:** Combine **TanStack Query** (for all API data) + **Zustand** (for remaining UI states).
    * **Enterprise Standard:** Use **Redux Toolkit + RTK Query** if your organization requires rigid guardrails, heavy middleware, or centralized event tracking.

  ---
  * When to Move from Zustand + TanStack Query to Redux

    While the **Zustand + TanStack Query** combination is the default choice for most modern applications, it is not a silver bullet. There are specific architectural tipping points where the lightweight, flexible nature of Zustand becomes a liability, and **Redux Toolkit (RTK)** becomes the superior choice.

    You should move away from Zustand + TanStack Query and choose **Redux** when your application meets the following criteria:

    1. Complex, Interconnected Client-Side State  
      Zustand thrives when client-side state is simple and isolated. However, if your application features highly complex, interdependent client state, Zustand's lack of structure can lead to messy, unmaintainable code.
        * **The Redux Advantage:** Redux uses **Reducers** and a strict **unidirectional data flow**. This means a single user action (like clicking "Checkout") can trigger a predictable chain reaction across completely separate parts of your app store. 
        * **Example:** Collaborative design software (like Figma or Canva), complex spreadsheet editors, or online audio/video editing suites.

    2. The Need for Powerful Middleware and Event Pipelines  
      Zustand has simple middleware (like persistence or devtools), but it lacks a powerful, native event-driven lifecycle pipeline.
        * **The Redux Advantage:** Redux features **Redux Middleware** (like custom middleware or `redux-observable`) and **RTK Listeners**. These allow you to intercept actions, run background logic, cancel asynchronous events, and orchestrate complex side effects globally.
        * **Example:** Financial trading applications that need to process thousands of rapid WebSocket updates, sort them, run calculations, and update the UI in a predictable, throttled queue.

    3. "Time-Travel" Debugging and Strict State Auditing  
      Because Zustand allows you to modify state freely inside its actions, it is difficult to audit exactly *how* a state changed over time in a highly complex system.
        * **The Redux Advantage:** Every state mutation in Redux is explicitly logged as a serializable action object (e.g., `{ type: 'cart/addItem', payload: { id: 1 } }`). This enables flawless **Time-Travel Debugging** (stepping backward and forward through every click and state change a user made) and automated error reporting that captures the exact user path leading to a crash.
        * **Example:** Highly regulated enterprise software, medical applications, or banking apps where state predictability and strict bug-tracking diagnostics are critical.

    4. Massive Distributed Teams and Monorepos  
      In very large organizations with dozens or hundreds of developers working on the same codebase, Zustand’s lack of opinionation can backfire. Different developers will write stores in completely different ways, leading to fragmented architecture.
        * **The Redux Advantage:** Redux Toolkit forces a strict, standardized structure (Slices, Selectors, Actions). No matter which team writes the code, a Redux slice looks exactly the same. This makes onboarding new developers easier and prevents "cowboy coding" in massive codebases.

    * Summary Checklist: When to Pivot to Redux  
      | Choose Zustand + TanStack Query if... | Move to Redux (RTK) if... |
      | :--- | :--- |
      | 80%+ of global state is fetched from an API | Global state is heavily computed locally on the client |
      | Quick development speed is a priority | Long-term code standardization across large teams is vital |
      | State changes are simple updates (set value) | State changes involve complex business logic and workflows |
      | You want an easy learning curve | You require advanced debugging, middleware, or logging |
* React Router (data mode): `createBrowserRouter` in [router.tsx](/frontend/src/router.tsx)
  * It's a route tree. Each route pairs a `path` with an `element`, plus optional data functions. Layout routes (no `path`) wrap their children through `<Outlet />`.
  * Everything runs **in the browser**. This is not SSR: `loader` and `action` are plain client-side functions, and "redirects" are client-side navigations via the History API.
  * `loader` → runs **before** the route renders, so the page never renders without its data. The component reads it with `useLoaderData()`.
  * `action` → runs on a submit (`<Form method="post">`, `fetcher.submit(data, { method: 'delete' })`). It gets `params` from the URL and `request.formData()` for the body.
  * What they return:
    * A plain value → data, that can be consumed with `useLoaderData()` / `fetcher.data`.
    * `redirect('/x')` / `replace('/x')` → a navigation instruction. `replace` swaps the history entry instead of pushing, so Back won't return to a deleted cat.
    * `redirect` is only a `Response` object. The router acts on it **only if you `return` or `throw` it**. Calling `replace('/cats')` alone does nothing.
  * After an action, the router **revalidates** the current route's loaders. If the action deleted the cat and didn't redirect, the details loader re-runs the same page, and fails (since the cat was deleted).
  * `useFetcher()` submits to an action without navigating. `fetcher.state` (`idle` / `submitting` / `loading`) drives the spinner.
  * Delete flow ([cat-details-page.tsx](/frontend/src/pages/cat-details-page.tsx)):
    ```
    click Delete → action: remove() → return replace('/cats')
                 → /cats loader runs (navigation.state: 'loading', slow backend = delay)
                 → /cats renders       (navigation.state: 'idle')
    ```
* Why a pending "navigation message" (flash message) ([user-msg.store.ts](/frontend/src/store/user-msg.store.ts))
  * Problem: calling `showSuccessMsg()` in the action shows the user message **before** the redirect. The user sees "Removed X" while still on the deleted cat's page, until the `/cats` loader finishes.
  * The action can't run code after the redirect. Its `return` *is* what starts the redirect, so the action is already finished by the time `/cats` renders.
  * Fix: split *what* to say from *when* to say it. We simply save the message in the state, until the navigator (react-router) will stop rendeiring `/cats` page.
    * The action **queues** the message: `queueSuccessNavigationMsg(txt)` → stored in `navigationMsg`, not shown yet.
    * `UserMessage` lives in `LayoutRoot`, so it stays mounted across routes. It watches `useNavigation().state`, and on `→ 'idle'` it calls `flushPendingNavigationMsg()` (`navigationMsg` → `msg`, and the user massage shows).
    ```tsx
    const navState = useNavigation().state
    useEffect(() => {
        if (navState === 'idle') useUserMsgStore.getState().flushPendingNavigationMsg()
    }, [navState]) // NOT navigationMsg: the action runs while navigation is already 'idle' (a fetcher isn't a navigation)
    ```
  * SSR frameworks (Remix, Rails) do the same "flash message" trick with a session cookie that the next page reads. Here it's all client-side, so a store field plays the cookie's role.
  * Use it only when the action redirects. On errors there's no navigation, so call `showErrorMsg()` directly.
* How to have a varaiable in TSX file and read it in SCSS?  
  set a CSS custom property on the element's inline style: ``style={{ '--x': `${MS}ms` } as React.CSSProperties}``. SCSS reads it with `var(--x)`, and child elements inherit it. Example: [user-message.tsx](/frontend/src/cmps/util/user-message.tsx).
  * It must be a CSS variable, since SCSS `$vars` are gone after the build. The cast turns off type-checking for the key, so a typo there silently breaks the `var()`.
* Login/Signup routes on frontend ([login-signup-page.tsx](/frontend/src/pages/login-signup-page.tsx))
  ```tsx
  { path: '/login',  element: <LoginSignupPage key="login"  mode="login" />,  action: actionLoginSignup },
  { path: '/signup', element: <LoginSignupPage key="signup" mode="signup" />, action: actionLoginSignup },
  ```
  
  **The `key` matters.** Both routes render the same component type in the same `<Outlet>` slot.
  React reconciles by type, so switching `/login` → `/signup` keeps the component's state.
  That includes `touched`, `isSubmitted`, and `fetcher.data` from the other mode.
  A different `key` forces a fresh mount.  
* `unknown` as a return type = "any return value is accepted, and I won't use it".  
  ```ts
  const runTwice = (fn: () => unknown) => { fn(); fn() } // never reads fn's result
  runTwice(() => 42)      // ok
  runTwice(() => 'hello') // ok
  ```
  It's safer than `any`: using the value without narrowing it first is a compile error.
* Fire-and-Forget Promises (ESLint Compliance)  
  When you trigger an asynchronous function but don't want to await it, linters like @typescript-eslint will throw a "floating promise" warning. Prefixing the call with void cleanly tells the linter that you are intentionally discarding the promise.
  ```typescript
  async function trackAnalytics(): Promise<void> { /* ... */ }

  // Safe "fire-and-forget" call that satisfies ESLint
  void trackAnalytics(); 
  ```
* HTML `aria-label` isn't an identifier. It's the text a screen reader speaks, like a visible button label, so it reads "Close". The test has to match it exactly, because string name matching is case-sensitive. This is why we use sentence capitalize.
* `HydrateFallback`  
  **`HydrateFallback` is a route component React Router renders on the app's first load, while the first page's loaders are still running.** It exists in data mode (`createBrowserRouter`, what we use) and in Framework mode.

  **Why is it needed?**
  On every later navigation, React Router keeps the current page on screen until the new page's loaders finish. On the first load there is no current page yet, so it needs something to show. In Framework mode (SSR) that's the server HTML being hydrated. In our SPA it's just the first navigation, and "hydrate" means "the router's initial load".
  * Without `HydrateFallback`: React Router renders nothing (a blank screen) and logs `No HydrateFallback element provided to render during initial hydration`. It never renders the page with missing `loaderData`.
  * With `HydrateFallback`: it renders the fallback instead, e.g. a spinner or a skeleton, until the loaders resolve. `() => null` keeps the blank screen and only silences the warning.

  **Our case:** before, the router was created on import, so its loaders started before we knew who's logged in:
  ```tsx
  // router.tsx - runs on import, and the first page's loaders start right away
  export const router = createBrowserRouter(routes)

  // main.tsx
  import { router } from './router'          // catEditLoader already runs here, the store says "guest"
  await authService.getLoggedInUser()        // too late
  ```
  Bug: a logged-in user who reloads `/cat/:id/edit` gets sent to login. Fix: create the router after `/me`:
  ```tsx
  // main.tsx
  const loggedInUser = await authService.getLoggedInUser()
  // ...set the store
  const router = createBrowserRouter(routes) // loaders start now, with the right user
  ```
  Side effect: the first render now happens while the loaders are still pending, so React Router warns. So the root route gets an empty fallback (same blank screen as before, no warning):
  ```tsx
  { element: <LayoutRoot />, HydrateFallback: () => null, children: [...] }
  ```
