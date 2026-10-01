#!/usr/bin/env node
// PreToolUse guardrail: blocks tool access to env/secret files across tools
// (Read, Edit, Write, Bash, Grep, Glob...). permissions.deny only covers the
// exact tool+pattern listed and can't see inside a Bash command string - this
// hook inspects the target of every call, so `cat .env`, `Read(.env)` and
// `grep -r KEY backend/.env` are all caught the same way.
//
// Runs even under bypassPermissions - hooks are a separate enforcement layer
// from the permission system.
//
// Scope: this stops accidental or casual access, not a determined agent. It
// matches text, and the shell can build a filename the text never spells out:
// globs (`cat backend/*.local`, `.en?`), quote splitting (`.e""nv`), a `cd`
// followed by a relative glob, or a script that concatenates the name at
// runtime. No regex can close that. Directory-wide searches (Grep with only a
// directory `path`) also can't be blocked here - those rely on env files being
// gitignored, which ripgrep skips by default. Don't treat this hook as the
// only thing standing between an agent and a secret.

// Matches an env file anywhere in the tree: `.env`, plus any suffixed variant.
//
// Suffixes are matched open-endedly (`.env.local`, `.env.test`, `.env.staging`,
// `.env.production.local`) rather than enumerated, because an enumerated list
// silently fails open on the one suffix nobody thought of. The template
// suffixes are then carved back out: `.env.example` / `.sample` / `.template`
// are committed content agents are allowed to read and write.
const ENV_SUFFIX = /\.env(?!\.(?:example|sample|template)(?![\w.-]))(?:\.[\w-]+)*(?![\w.-])/.source

// Path fields: the env file must be a whole path segment, so `src/env.ts` and
// `.envrc` don't match.
const SECRET_FILE_PATTERN = new RegExp(`(^|[/\\\\])${ENV_SUFFIX}`, 'i')

// Command strings: whatever precedes `.env` must be empty, a shell delimiter,
// or end in a path separator. Without that anchor the pattern also swallows
// `import.meta.env` and `process.env` - see the warning in
// block-destructive-bash.mjs, which is where that exact mistake was made before.
//
// Delimiters beyond whitespace/quotes/operators: `:` (`git show HEAD:.env`,
// which would print a committed secret), `<` / `>` (redirects), `{` / `,`
// (brace expansion: `cat {.env,x}`).
//
// Known false positive, accepted deliberately: a regex-escaped `process\.env`
// typed into a grep is indistinguishable from the Windows path `process\` +
// `.env`, so it gets blocked. Backslash has to stay a separator for `type
// frontend\.env` to be caught, and over-blocking a search beats under-blocking
// a read. Search for the unescaped string instead.
const SECRET_IN_COMMAND_PATTERN = new RegExp(`(^|[\\s"'=;|&(:<>{},])(?:[\\w.\\\\/-]*[\\\\/])?${ENV_SUFFIX}`, 'i')

// Only fields that NAME a target are inspected. Deliberately not scanning the
// whole tool_input: a Write's `content` can legitimately mention an env file
// (setup docs, .env.example templates, this hook's own source) without
// touching one - scanning content made the hook unable to edit itself.
// `glob` is Grep's file filter (`glob: ".env*"` would search env files).
const PATH_FIELDS = ['file_path', 'path', 'notebook_path', 'glob']

// Fields that name a target only for specific tools. Glob's `pattern` is a
// file glob, but Grep's `pattern` is a content regex - scanning that would
// block a plain search for the string `.env`.
const TOOL_PATH_FIELDS = { Glob: ['pattern'] }

let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    // Fails open on purpose: a malformed payload shouldn't brick every tool
    // call. Claude Code always sends valid JSON, so this is a should-never-
    // happen path, not a bypass an agent can trigger.
    process.exit(0)
  }

  const toolInput = payload?.tool_input ?? {}
  const fields = [...PATH_FIELDS, ...(TOOL_PATH_FIELDS[payload?.tool_name] ?? [])]

  const blockedPath = fields
    .map(field => toolInput[field])
    .find(value => typeof value === 'string' && SECRET_FILE_PATTERN.test(value))

  // A shell command can reach a secret file without ever naming a path field:
  // `cat .env`, `grep -r KEY .env`, `type frontend\.env`.
  const command = typeof toolInput.command === 'string' ? toolInput.command : ''
  const blockedCommand = SECRET_IN_COMMAND_PATTERN.test(command)

  if (blockedPath || blockedCommand) {
    console.error(
      `[guardrail] Blocked ${payload?.tool_name ?? 'tool'} call touching an env/secret file` +
      `${blockedPath ? `: ${blockedPath}` : ''}. Use .env.example instead.`
    )
    process.exit(2)
  }

  process.exit(0)
})
