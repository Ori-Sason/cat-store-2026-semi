# Code Style

Applies to every JavaScript and TypeScript file in this repository.

- Don't hand-format. A PostToolUse hook runs oxfmt on every JS/TS file you Edit/Write.
  Edits made via Bash (sed, heredoc) skip the hook, so run `npm run format` after those.
- Before finishing a JS/TS change, run `npm run lint` (oxlint) and fix what it reports.
- Use `async/await` with `try/catch`. Avoid `.then()` chains, except when you need to hold
  a promise without awaiting it (e.g. caching a connect promise).
- Comment where it helps a later reader: a decision, a constraint, a non-obvious flow.
  The user edits or removes comments they don't want. That's their review pass, not a
  signal to write fewer, so don't infer comment density from the existing files.
- Comments state the reason itself. Never cite what lives only in `.handoffs/` (stop numbers,
  research ids like "R3", sub-part names): handoffs get deleted. `.docs/` is fine to cite.

## Split a file when it holds too much context
- The trigger is how much a reader must keep in mind to follow one part, not a line count. Split
  when a file mixes concerns that can be read on their own (e.g. a hook's sync, writes and merge
  helpers), or when a diff of it is too big to review in one pass.
- Logic: a folder named for the file (`hooks/<hook-name>/`), the entry file keeps its name inside
  it (`hooks/<hook-name>/<hook-name>.ts`), and the parts sit next to it as files it imports. Each
  part is one concern.
- TSX: extract child components, placed per `frontend.md`.
- Its tests follow it: split them by the same concerns, with repeated setup in a `*.helper.ts`
  in the same folder.

## Group a kind folder by idea
- A kind folder (e.g. `hooks/`, `middlewares/`) gets subfolders once several files in it share
  one idea, such as a feature (`hooks/<feature>/`) or a transport (`middlewares/<transport>/`).
  Name the subfolder for that idea. Files that share nothing stay at the kind folder's root.
- A split file's folder (above) moves into the subfolder as is: `hooks/<feature>/<hook-name>/`.
- A package's rule adds any extra naming for its subfolders (e.g. the components folder in
  `frontend.md`).

Match the surrounding code for everything this file does not cover.
