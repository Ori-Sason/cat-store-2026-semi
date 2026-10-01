* npm workspaces — [package.json](/package.json)
  * The repo is **one npm project with 3 packages**: `shared`, `frontend`, `backend`.
    ```
    package.json          ← { "workspaces": ["shared", "frontend", "backend"] }
    package-lock.json     ← the ONLY lockfile
    node_modules/         ← the ONLY install (deps of all 3, deduplicated)
    └── @cat-store/shared → ../../shared   (symlink npm creates)
    ```
  * **Deps are still declared per package.** Each `package.json` owns its list. Only the *install* is merged into the root.
  * Always run `npm install` from the **root**. Target a package with `-w`:
    ```bash
    npm i express -w backend      # writes to backend/package.json, installs into root node_modules
    npm run dev -w frontend       # or the root shortcuts: npm run dev:fe / dev:be
    ```
  * Why it works: Node looks for a package in the nearest `node_modules`, then walks up the folders → `backend/server.ts` finds `express` in the root one.
  * Exceptions to "one node_modules":
    * Version conflicts get nested. That's why `frontend/node_modules/typescript` (v6) exists next to the root's v7.
    * Vite keeps its cache in `frontend/node_modules/.vite`.
  * ⚠️ **Phantom deps.** The backend *can* import something only the frontend declared, and it'll work locally. Keep each `package.json` honest.

* Shared package — [shared/](/shared/) = `@cat-store/shared`
  * The **wire contract** between FE and BE, which is what goes over HTTP: `CAT_LABELS` / `CatLabel`, `Cat` (`_id: string`), the Zod `catSchema`, and the filter query shape (`SortFilterMap`).
  * Split into 2 folders:
    ```
    shared/src/
    ├── index.ts                  ← re-exports everything
    ├── models/                   ← types + the constants/schemas that define them
    │   ├── cat.ts                ← Cat, CatLabel, catSchema, FILTER_LABELS, SortFilterMap...
    │   └── util.ts               ← SortByDirection, DynamicObj
    └── services/                 ← logic
        └── cat-filter.service.ts ← catFilterService.paramsToFilter
    ```
  * Imported like any npm package: `import { Cat } from '@cat-store/shared'`
  * **No build step.** `exports` in [shared/package.json](/shared/package.json) points straight at `./src/index.ts`:
    * Frontend → Vite compiles it like its own source files.
    * Backend → Node strips the types. Node refuses to strip types for files under `node_modules`, but it follows the symlink to the real path `shared/src/…` first, so the check passes.
  * Rules for code in `shared/`:
    * Erasable syntax only (no `enum` / `namespace`), because both sides strip types.
    * Relative imports keep the `.ts` extension (`./models/cat.ts`), which the backend's `nodenext` resolution requires.
    * No `mongodb`, React or DOM imports, since it has to run on both sides.
    * Shared's tsconfig loads **no DOM or Node types** (`lib: ["esnext"]`, `types: []`). So names like `URLSearchParams` don't exist there, even though both runtimes have them.
      * Fix: describe only the methods you use, as an interface. TS types are structural (it checks the shape, not the class name), so the real object from each side fits.
      * Example: `paramsToFilter(params: QueryParamsReader)`, where `QueryParamsReader = { get, getAll }`. It's only a type, with no logic. The real `get` / `getAll` come from the `URLSearchParams` each side passes in.

* What goes where
  | Type | Lives in | Why |
  |---|---|---|
  | `Cat` (`_id: string`) | [shared/src/models/cat.ts](/shared/src/models/cat.ts) | JSON shape both sides agree on |
  | `CatDoc` (`_id: ObjectId`) | [backend/models/cat.ts](/backend/models/cat.ts) | Mongo-only. `res.json` turns the ObjectId back into a string |
  | `CatLabelFilter`, `SortFilterMap`, `FILTER_LABELS` | [shared/src/models/cat.ts](/shared/src/models/cat.ts) | The filter query contract. FE builds it from the page URL, BE parses it from the request URL |
  | `paramsToFilter` | [shared/src/services/cat-filter.service.ts](/shared/src/services/cat-filter.service.ts) | One parser for both sides → they can't drift apart |
  | `DynamicObj` | [shared/src/models/util.ts](/shared/src/models/util.ts) | Generic helper type, expected on both sides |
  | `UserMsg` | [frontend/src/models/util.ts](/frontend/src/models/util.ts) | UI-only |
  | `CAT_LABEL_MAP` (colors) | [frontend/src/services/cat.service.ts](/frontend/src/services/cat.service.ts) | UI-only. Typed `Record<CatLabel, string>` → a new label without a color won't compile |
  * Frontend imports shared types straight from `@cat-store/shared`. There's no FE re-export file anymore.

* Parsing the filter query on the backend — [cat.controller.ts](/backend/api/cat/cat.controller.ts)
  * `paramsToFilter` wants a `URLSearchParams`. Express doesn't give you one:
    * `req.params` → route segments like `/:catId`. Always `{}` on `GET /`.
    * `req.query` → a plain object. A repeated key becomes an array, a single one stays a string (`labels: 'Scratchers'` vs `labels: ['Scratchers', 'In-stock']`). No `.get()` / `.getAll()`.
    * `req.originalUrl` → a plain string: `'/api/cat?text=tom&labels=...'`
  * So build one: `new URL(req.originalUrl, 'http://localhost').searchParams`. The base is a dummy, needed only because `URL` requires an absolute URL.
  * Same object the FE loader gets from `new URL(request.url).searchParams` → one parser, same behavior on both sides.

* Deploy (Render)
  * Root Directory = **repo root**. If it's `backend/`, Render won't see the root lockfile and `@cat-store/shared` won't resolve.
  * Build: `npm ci && npm run build -w frontend` (+ copy `frontend/dist` → `backend/public`)
  * Start: `npm start -w backend`
