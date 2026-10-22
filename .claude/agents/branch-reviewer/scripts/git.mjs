#!/usr/bin/env node
// Read-only git for the branch-reviewer agent: `node .claude/agents/branch-reviewer/scripts/git.mjs
// <subcommand> [args]`. The agent's Bash gate lets only these scripts run, so this file is
// where "read-only" is decided for git.
//
// Runs git through execFileSync (no shell), so the args can't chain another command.

import { execFileSync } from 'node:child_process'

// Subcommands that only read. `branch`, `checkout`, `stash` etc. stay out: with the wrong args
// they change refs or the worktree.
const READ_ONLY_SUBCOMMANDS = new Set([
  'diff',
  'log',
  'show',
  'merge-base',
  'rev-parse',
  'ls-files',
  'blame',
  'status',
  // Code search over tracked files. Some Claude Code builds have no Grep/Glob tools, so
  // `git grep` and `ls-files` are the agent's search and find.
  'grep',
])

// Flags that make a read-only subcommand do more than read:
// --output writes the diff/log to a file; --no-index diffs any path on disk, which would let
// the agent print an untracked `.env` past block-secret-file-access.mjs; --ext-diff runs a
// configured external program. For grep: --untracked and --no-exclude-standard search files
// git doesn't track (an untracked `.env` again); --open-files-in-pager runs a program.
const BLOCKED_FLAGS = [
  '--output',
  '--no-index',
  '--ext-diff',
  '--untracked',
  '--no-exclude-standard',
  '--open-files-in-pager',
]

// The short form of --open-files-in-pager, alone or bundled (`-O`, `-nO`)
const SHORT_PAGER_FLAG = /^-[a-zA-Z]*O/

const [subcommand, ...args] = process.argv.slice(2)

if (!READ_ONLY_SUBCOMMANDS.has(subcommand)) {
  console.error(`git.mjs: allowed subcommands: ${[...READ_ONLY_SUBCOMMANDS].join(', ')}`)
  process.exit(1)
}

const blocked = args.find(
  (arg) =>
    BLOCKED_FLAGS.some((flag) => arg.startsWith(flag)) ||
    (subcommand === 'grep' && SHORT_PAGER_FLAG.test(arg)),
)
if (blocked) {
  console.error(`git.mjs: flag not allowed: ${blocked}`)
  process.exit(1)
}

try {
  // --no-pager: the output goes back to the agent, not to a terminal
  execFileSync('git', ['--no-pager', subcommand, ...args], { stdio: 'inherit' })
} catch (err) {
  process.exit(err.status ?? 1)
}
