#!/usr/bin/env node
// PreToolUse guardrail for the branch-reviewer agent, wired in that agent's frontmatter
// (.claude/agents/branch-reviewer.md), so it runs only while the agent is active.
//
// The agent is read-only: its tool list has no Edit/Write, but Bash can still write
// (`>`, `rm`, `git checkout`). This gate lets Bash run only the agent's own scripts in
// .claude/agents/branch-reviewer/scripts/. Each script decides which args are safe.
//
// An allowlist, not a denylist: anything it doesn't recognize is blocked. Shell
// metacharacters are blocked too, so an allowed script can't be chained (`;`, `&&`, `|`),
// redirected (`>`), or fed a substitution (`$(...)`, backticks).

const SCRIPT_PATH = '.claude/agents/branch-reviewer/scripts/'
const SCRIPT_NAMES = ['git', 'test']
const SHELL_METACHARS = /[;&|<>$`\\\n\r]/

// The relative path, or the same path under the project root
const prefixes = [SCRIPT_PATH]
if (process.env.CLAUDE_PROJECT_DIR)
  prefixes.push(`${process.env.CLAUDE_PROJECT_DIR}/${SCRIPT_PATH}`)

function _isAllowed(command) {
  if (SHELL_METACHARS.test(command)) return false
  const [runner, script] = command.trim().split(/\s+/)
  if (runner !== 'node' || !script) return false
  return prefixes.some((prefix) => SCRIPT_NAMES.some((name) => script === `${prefix}${name}.mjs`))
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
    // Fail closed: this gate is the agent's only write barrier on Bash
    console.error('[guardrail] branch-reviewer: could not read the tool call.')
    process.exit(2)
  }

  const command = payload?.tool_input?.command ?? ''
  if (!_isAllowed(command)) {
    console.error(
      `[guardrail] branch-reviewer is read-only. Bash runs only \`node ${SCRIPT_PATH}{git,test}.mjs <args>\`, ` +
        'with no shell operators. Read files with Read; search with `git.mjs grep` / `ls-files`.',
    )
    process.exit(2) // exit code 2 = block the tool call
  }

  process.exit(0)
})
