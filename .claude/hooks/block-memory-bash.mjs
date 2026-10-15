#!/usr/bin/env node
// PreToolUse guardrail: blocks Bash commands that name the auto-memory path,
// so every memory write goes through Edit/Write. notify-memory-write.mjs only
// sees Edit/Write, and a heredoc or `echo >>` into a memory file used to slip
// past its end-of-turn notice.
//
// Reads are blocked too (`cat`, `grep`): the Read tool covers them, and one
// path match is simpler than telling reads from writes in a shell string.
//
// Speed bump, not a sandbox: it matches the command text, so a path built at
// runtime (`cd ~/.claude/projects/x; cd memory`, a variable, a script) gets
// through. It's there to catch the habit, not a determined agent.

// Same path as notify-memory-write.mjs's MEMORY_FILE, cut at the directory:
// ~/.claude/projects/<project-slug>/memory, whatever spells the home part
// (`~`, `$HOME`, an absolute path). A glob slug (`*`) matches too.
const MEMORY_DIR = /\.claude[/\\]projects[/\\][^/\\\s]+[/\\]memory(?![\w.-])/

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
  if (MEMORY_DIR.test(command)) {
    console.error('[guardrail] Use Write/Edit for memory, not Bash (reads: use Read).')
    process.exit(2) // exit code 2 = block the tool call
  }

  process.exit(0)
})
