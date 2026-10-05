#!/usr/bin/env node
// Memory-write notice: tells the user, at the end of each turn, which auto-memory
// files Claude wrote or edited. Memory lives outside the repo, so no diff or
// commit ever surfaces these writes, and in auto mode the tool call scrolls past.
//
// Wired on two events, one script:
// - PostToolUse (Edit|Write): records the memory file path, silently.
// - Stop: prints one `systemMessage` line listing them, right after Claude's
//   final reply, then clears the record. A notice at write time would land
//   mid-turn and get buried under the rest of the tool calls.
//
// `systemMessage` reaches the user only, not Claude's context - the point is
// oversight, not steering.
//
// Limit: writes through Bash (heredoc, `sed`, `rm`) don't fire Edit/Write hooks,
// so they skip this notice - same gap as the oxfmt hook.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Auto-memory path: ~/.claude/projects/<project-slug>/memory/<file>.md
const MEMORY_FILE = /[/\\]\.claude[/\\]projects[/\\][^/\\]+[/\\]memory[/\\][^/\\]+\.md$/

// Each hook call is a fresh process, so the per-turn list lives on disk.
// One file per session keeps parallel sessions independent.
function _recordPath(sessionId) {
  const safe = String(sessionId).replace(/[^A-Za-z0-9_-]/g, '_')
  return path.join(os.tmpdir(), `claude-memory-writes-${safe}`)
}

function _record(data) {
  const filePath = data.tool_input?.file_path
  if (typeof filePath !== 'string' || !MEMORY_FILE.test(filePath)) return
  const verb = data.tool_name === 'Edit' ? 'edited' : 'wrote'
  fs.appendFileSync(_recordPath(data.session_id), `${verb}\t${path.basename(filePath)}\n`)
}

function _report(data) {
  const file = _recordPath(data.session_id)
  let lines
  try {
    lines = fs.readFileSync(file, 'utf8').trim().split('\n')
  } catch {
    return // nothing recorded this turn
  }
  fs.rmSync(file, { force: true })

  // A file edited three times in one turn is listed once, with its last verb.
  const byName = new Map(lines.map((line) => line.split('\t').reverse()))
  const list = [...byName].map(([name, verb]) => `${verb} ${name}`).join(', ')

  // No process.exit() after this: exiting can truncate a pipe mid-write.
  process.stdout.write(JSON.stringify({ systemMessage: `[memory] This turn Claude ${list}` }))
}

let raw = ''
process.stdin.on('data', (chunk) => (raw += chunk))
process.stdin.on('end', () => {
  let data
  try {
    data = JSON.parse(raw || '{}')
  } catch {
    process.exit(0)
  }
  if (!data.session_id) process.exit(0)

  try {
    if (data.hook_event_name === 'PostToolUse') _record(data)
    else if (data.hook_event_name === 'Stop') _report(data)
  } catch {
    // A notice is not worth failing a tool call or a turn over.
  }
})
