#!/usr/bin/env node
// PreToolUse guardrail: blocks destructive shell patterns before they run.
// A hook enforces a hard boundary even if the plan or prompt would have
// allowed the command, and even under --permission-mode bypassPermissions.
//
// This is a speed bump, not a sandbox. It only sees the command string, so
// anything destructive done *inside* a script (`npm run seed` calling
// deleteMany) is invisible here.

// Access to env/secret FILES is handled by block-secret-file-access.mjs, which
// runs on every tool. Do not add a bare /\.env\b/ rule here: it also matches
// `process.env`, `import.meta.env` and `$env:`, which blocked ordinary commands.

// A short flag token containing `letter`, e.g. -f, -rf, -fr, -Rf. Anchored to
// whitespace so a path like `some-folder` doesn't count as a flag.
const shortFlag = (letters) => `(?:^|\\s)-[a-zA-Z]*[${letters}][a-zA-Z]*(?=\\s|$)`
// Stay within one command segment, so `rm -r x; git status -f` isn't joined up.
const SAME_CMD = '[^|;&\\n]*'

const DENY_PATTERNS = [
  // --- Filesystem ---
  // rm with both recursive and force, in any spelling: -rf, -fr, -r -f, --recursive --force
  new RegExp(
    `\\brm\\b(?=${SAME_CMD}(?:${shortFlag('rR')}|\\s--recursive\\b))(?=${SAME_CMD}(?:${shortFlag('f')}|\\s--force\\b))`,
  ),

  // --- Git ---
  // force push: --force, --force-with-lease, -f, or a +refspec (`git push origin +main`)
  new RegExp(`\\bgit\\s+push\\b${SAME_CMD}(?:\\s--force|${shortFlag('f')}|\\s\\+\\S)`),
  // --hard anywhere in the command: `git reset HEAD~1 --hard`, `git -C dir reset --hard`
  new RegExp(`\\bgit\\b${SAME_CMD}\\sreset\\b${SAME_CMD}\\s--hard\\b`),
  new RegExp(`\\bgit\\s+clean\\b${SAME_CMD}(?:${shortFlag('f')}|\\s--force\\b)`),
  // Discarding uncommitted work: `checkout -- <path>`, `checkout .`, `checkout -f`
  new RegExp(
    `\\bgit\\s+checkout\\b${SAME_CMD}(?:\\s--(?=\\s|$)|\\s\\.(?=\\s|$)|${shortFlag('f')}|\\s--force\\b)`,
  ),
  // `git restore` overwrites the working tree unless it's only unstaging
  // (--staged / -S). Adding --worktree / -W brings the overwrite back.
  new RegExp(`\\bgit\\s+restore\\b(?!${SAME_CMD}(?:\\s--staged\\b|${shortFlag('S')}))`),
  new RegExp(`\\bgit\\s+restore\\b${SAME_CMD}(?:\\s--worktree\\b|${shortFlag('W')})`),
  // Skipping the lefthook git hooks. On commit -n means --no-verify; on push it's --dry-run.
  new RegExp(`\\bgit\\b${SAME_CMD}\\scommit\\b${SAME_CMD}(?:\\s--no-verify\\b|${shortFlag('n')})`),
  new RegExp(`\\bgit\\b${SAME_CMD}\\spush\\b${SAME_CMD}\\s--no-verify\\b`),
  /\bLEFTHOOK(?:_EXCLUDE)?=/,
  /\bcore\.hooksPath\b/,

  // --- SQL (kept for Postgres/MySQL projects) ---
  /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i,
  /\bTRUNCATE\s+TABLE\b/i,
  /\bdelete\s+from\s+[\w."]+\s*(?:;|["']|$)/i, // DELETE with no WHERE clause, even inside psql -c "..."

  // --- MongoDB (mongosh --eval, docker exec ... mongosh) ---
  /\bdropDatabase\s*\(/,
  /\.drop\s*\(\s*\)/, // db.<collection>.drop()
  /\b(deleteMany|remove)\s*\(\s*(\{\s*\})?\s*\)/, // empty filter = wipe the collection
  /\bmongorestore\b.*\s--drop\b/, // drops each collection before restoring

  // --- Docker volumes (where local DB data actually lives) ---
  new RegExp(
    `\\bdocker(?:\\s+|-)compose\\b${SAME_CMD}\\bdown\\b${SAME_CMD}(?:${shortFlag('v')}|\\s--volumes\\b)`,
  ),
  /\bdocker\s+volume\s+(rm|prune)\b/,
  new RegExp(`\\bdocker\\s+system\\s+prune\\b${SAME_CMD}\\s--volumes\\b`),
]

let input = ''
process.stdin.on('data', (chunk) => {
  input += chunk
})
process.stdin.on('end', () => {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  const command = payload?.tool_input?.command ?? ''
  const match = DENY_PATTERNS.find((pattern) => pattern.test(command))

  if (match) {
    console.error(`[guardrail] Blocked command matching ${match}: ${command}`)
    process.exit(2) // exit code 2 = block the tool call
  }

  process.exit(0)
})
