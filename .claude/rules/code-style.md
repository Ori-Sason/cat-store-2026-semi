# Code Style

Applies to every JavaScript and TypeScript file in this repository.

- Don't hand-format. A PostToolUse hook runs oxfmt on every JS/TS file you Edit/Write.
  Edits made via Bash (sed, heredoc) skip the hook, so run `npm run format` after those.
- Before finishing a JS/TS change, run `npm run lint` (oxlint) and fix what it reports.
- Use `async/await` with `try/catch`. Avoid `.then()` chains, except when you need to hold
  a promise without awaiting it (e.g. caching a connect promise).

Match the surrounding code for everything this file does not cover.
