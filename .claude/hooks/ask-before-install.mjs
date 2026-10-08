#!/usr/bin/env node
// PreToolUse guardrail: asks the user before any command that installs,
// removes or downloads packages. Claude used to install packages on its own
// to try things out; the user wants to see each one before it happens.
//
// Returns permissionDecision "ask" rather than blocking, so an approved install
// still runs. A hook's "ask" forces the prompt even when an allow rule matches.
//
// Why a hook and not permissions.ask rules: those match a literal prefix, so
// `npm -w frontend install zod` (flag before the subcommand) and the many npm
// aliases slip through. A regex over the whole command segment catches them.
//
// Speed bump, not a sandbox: an install run from inside a script or via
// `node -e` is invisible here. False positives (e.g. `grep "npm install"`)
// only cost a prompt.

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'

// Stay within one command segment, so `npm test; echo add` isn't joined up.
const SAME_CMD = '[^|;&\\n]*'
// The subcommand as a whole word, anywhere after the binary. This allows flags
// before it: `npm -w frontend install zod`.
const subcommand = (bin, names) =>
  new RegExp(`(?:^|[\\s|;&(])${bin}\\b${SAME_CMD}\\s(?:${names.join('|')})(?=\\s|$|[|;&)])`)

const ASK_PATTERNS = [
  // npm, including its aliases and typo aliases (`npm isntall` is real).
  // `npm exec` / `npm x` are npx under another name, handled by _npxNeedsAsk.
  subcommand('npm', [
    'install',
    'i',
    'in',
    'ins',
    'inst',
    'insta',
    'instal',
    'isnt',
    'isnta',
    'isntal',
    'isntall',
    'add',
    'ci',
    'clean-install',
    'install-test',
    'it',
    'install-ci-test',
    'cit',
    'update',
    'up',
    'upgrade',
    'udpate',
    'uninstall',
    'un',
    'unlink',
    'remove',
    'rm',
    'r',
  ]),

  // Other package managers, in case one gets reached for. Their one-off
  // runners (dlx, bunx) always ask: they're rare here and fetch by design.
  subcommand('pnpm', [
    'install',
    'i',
    'add',
    'update',
    'up',
    'upgrade',
    'remove',
    'rm',
    'un',
    'uninstall',
    'dlx',
  ]),
  subcommand('yarn', ['install', 'add', 'up', 'upgrade', 'remove', 'dlx']),
  /(?:^|[\s|;&(])yarn\s*(?:$|[|;&)])/, // bare `yarn` installs
  subcommand('bun', ['install', 'i', 'add', 'a', 'update', 'remove', 'rm', 'x']),
  /(?:^|[\s|;&(])bunx\b/,
]

// npx downloads a missing package, and without a TTY it assumes --yes, so no
// prompt of its own shows up. But nearly every npx run here is a local bin
// (vitest, oxlint, lefthook...), and asking for each one trained the user to
// click through. So npx only asks when it could fetch something:
// - the bin isn't in the repo's node_modules/.bin, or
// - it's a package spec (`zod@4`, `@scope/pkg`, a path or URL), or
// - npx flags we can't vouch for (-p, -c, --prefix, -y...), or
// - the working dir is outside the repo (a scratchpad has no local bins), or
// - the local bin itself downloads (`playwright install`).

// npx flags that don't change where the bin comes from. `-w x` runs it in a
// workspace, which still resolves bins from the hoisted root.
const NPX_SAFE_FLAGS_WITH_VALUE = new Set(['-w', '--workspace'])
const NPX_SAFE_FLAGS = new Set(['--workspaces', '-ws', '--include-workspace-root'])
// Local bins whose subcommand downloads things anyway.
const DOWNLOADING_SUBCOMMANDS = { playwright: ['install', 'install-deps'] }
// A plain bin name: no version, scope, path or URL.
const BIN_NAME = /^[a-z0-9][\w.-]*$/i

// Split on shell separators. Heredoc bodies get split too; a stray "npx" in
// one only costs a false-positive prompt.
const _segments = (command) =>
  command
    .split(/&&|\|\||[;|\n(){}]/)
    .map((segment) => segment.trim())
    .filter(Boolean)

const _words = (segment) =>
  segment
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/^['"]|['"]$/g, ''))

// Bin dirs npx would search from inside the repo. Bins are hoisted to the
// root today, but a workspace may get its own .bin later.
const _binDirs = (projectDir) =>
  ['', 'shared', 'frontend', 'backend'].map((pkg) => join(projectDir, pkg, 'node_modules', '.bin'))

const _isInside = (dir, parent) => {
  const rel = relative(parent, dir)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

// `args` are the words after `npx` / `npm exec`.
const _npxNeedsAsk = (args, cwd, projectDir) => {
  if (cwd === null || !_isInside(cwd, projectDir)) return true

  let i = 0
  while (i < args.length && args[i].startsWith('-')) {
    if (args[i] === '--') {
      i++
      break
    }
    if (NPX_SAFE_FLAGS_WITH_VALUE.has(args[i])) i += 2
    else if (NPX_SAFE_FLAGS.has(args[i]) || /^--workspace=/.test(args[i])) i++
    else return true
  }

  const bin = args[i]
  if (!bin || !BIN_NAME.test(bin)) return true
  if (!_binDirs(projectDir).some((dir) => existsSync(join(dir, bin)))) return true

  // Only the bin's first positional arg counts as its subcommand, so
  // `playwright test e2e/install.spec.ts` doesn't ask.
  const sub = args.slice(i + 1).find((arg) => !arg.startsWith('-'))
  return DOWNLOADING_SUBCOMMANDS[bin]?.includes(sub) ?? false
}

// Walks the segments in order, tracking `cd` so `cd /tmp/x && npx tsc` is
// judged from /tmp/x. A cd target we can't resolve ($VAR, `-`) makes the cwd
// unknown, which asks. Subshell scoping isn't modeled: `(cd /tmp); npx vitest`
// over-asks, which is the safe direction.
const _npxCommandNeedsAsk = (command, startCwd, projectDir) => {
  let cwd = startCwd
  for (const segment of _segments(command)) {
    const words = _words(segment)
    // Skip leading env assignments and `time`: `CI=1 npx vitest`, `time npx tsc`.
    while (words.length && (/^\w+=/.test(words[0]) || words[0] === 'time')) words.shift()
    const [first, second, ...rest] = words

    if (first === 'cd') {
      const target = second ?? homedir()
      if (cwd === null || target === '-' || target.includes('$')) cwd = null
      else cwd = resolve(cwd, target.replace(/^~(?=\/|$)/, homedir()))
      continue
    }

    if (first === 'npx' && _npxNeedsAsk([second, ...rest].filter(Boolean), cwd, projectDir))
      return true
    if (first === 'npm' && (second === 'exec' || second === 'x')) {
      if (_npxNeedsAsk(rest, cwd, projectDir)) return true
      continue
    }
    // npx or npm exec somewhere we didn't parse as a command start, e.g.
    // `time npx ...` or `xargs npx ...`. Ask rather than guess.
    if (first !== 'npx' && first !== 'npm' && /(?:^|\s)npx\s/.test(segment)) return true
    if (first !== 'npm' && /(?:^|\s)npm\s+(?:exec|x)\s/.test(segment)) return true
  }
  return false
}

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
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? payload?.cwd ?? process.cwd()
  const cwd = payload?.cwd ?? process.cwd()

  const needsAsk =
    ASK_PATTERNS.some((pattern) => pattern.test(command)) ||
    _npxCommandNeedsAsk(command, cwd, projectDir)

  if (needsAsk) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: `[guardrail] This command installs or fetches packages: ${command}`,
        },
      }),
    )
  }

  process.exit(0)
})
