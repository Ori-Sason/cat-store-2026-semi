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

// Stay within one command segment, so `npm test; echo add` isn't joined up.
const SAME_CMD = '[^|;&\\n]*'
// The subcommand as a whole word, anywhere after the binary. This allows flags
// before it: `npm -w frontend install zod`.
const subcommand = (bin, names) =>
  new RegExp(`(?:^|[\\s|;&(])${bin}\\b${SAME_CMD}\\s(?:${names.join('|')})(?=\\s|$|[|;&)])`)

const ASK_PATTERNS = [
  // npm, including its aliases and typo aliases (`npm isntall` is real).
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
    'exec',
    'x',
  ]),
  // npx downloads a missing package, and without a TTY it assumes --yes,
  // so no prompt of its own shows up. Every npx run asks.
  /(?:^|[\s|;&(])npx\b/,

  // Other package managers, in case one gets reached for.
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
  const match = ASK_PATTERNS.find((pattern) => pattern.test(command))

  if (match) {
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
