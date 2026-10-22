#!/usr/bin/env node
// Runs the unit/integration suites for the branch-reviewer agent:
// `node .claude/agents/branch-reviewer/scripts/test.mjs [file filters...] [-t <name pattern>]`.
// With no filters it runs every workspace's suite (root vitest.config.ts).
//
// Only filters and -t pass through. Other vitest flags can write to the repo
// (--update rewrites snapshots, --outputFile writes a report), and the agent is read-only.
// E2E stays out: it needs the dev servers, and the pre-push hook runs it anyway.

import { execFileSync } from 'node:child_process'

const NAME_PATTERN_FLAGS = new Set(['-t', '--testNamePattern'])

const args = process.argv.slice(2)

for (let i = 0; i < args.length; i++) {
  if (NAME_PATTERN_FLAGS.has(args[i])) {
    // A pattern that starts with `-` would reach vitest as a flag (`-t -u`)
    if (args[i + 1]?.startsWith('-')) {
      console.error('test.mjs: a -t pattern can not start with "-"')
      process.exit(1)
    }
    i++ // skip the pattern value
    continue
  }
  if (args[i].startsWith('-')) {
    console.error(`test.mjs: only file filters and -t <pattern> are allowed, got: ${args[i]}`)
    process.exit(1)
  }
}

try {
  execFileSync('node_modules/.bin/vitest', ['run', ...args], { stdio: 'inherit' })
} catch (err) {
  process.exit(err.status ?? 1)
}
