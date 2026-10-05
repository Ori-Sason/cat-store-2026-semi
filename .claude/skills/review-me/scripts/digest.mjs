#!/usr/bin/env node
// Condenses Claude Code session transcripts into a reviewable digest.
// Keeps user prompts, Claude's text replies and one line per tool call.
// Drops thinking, tool results and system reminders, which are most of the bytes.
//
// Usage: node digest.mjs [since-last (default) | today | YYYY-MM-DD | YYYY-MM-DD..YYYY-MM-DD]

import fs from 'fs'
import os from 'os'
import path from 'path'

const MAX_TEXT_CHARS = 1000
const LARGE_DIGEST_CHARS = 300_000
const MAX_TOOL_CHARS = 200

const projectDir = process.cwd()
const transcriptDir = path.join(
  os.homedir(),
  '.claude/projects',
  projectDir.replace(/[^a-zA-Z0-9]/g, '-'),
)
const reviewsDir = path.join(projectDir, '.handoffs/reviews')

const _localDate = (date) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// The max `Last reviewed:` across all reviews, so reviewing an older range later
// can't move the anchor backwards. File names and mtimes don't matter.
const _lastReview = () => {
  if (!fs.existsSync(reviewsDir)) return null
  let last = null
  for (const name of fs.readdirSync(reviewsDir)) {
    if (!name.endsWith('.md')) continue
    const text = fs.readFileSync(path.join(reviewsDir, name), 'utf8')
    const match = text.match(/^Last reviewed: (\S+)/m)
    if (!match) continue
    const time = new Date(match[1])
    if (Number.isNaN(time.getTime())) continue
    if (!last || time > last.time) last = { time, file: name }
  }
  return last
}

const _startOfDay = (date) => new Date(`${date}T00:00:00`)

const _parseScope = (arg = 'since-last') => {
  const today = _localDate(new Date())
  if (arg === 'today') return { from: _startOfDay(today), to: today }
  if (arg === 'since-last') {
    const lastReview = _lastReview()
    if (lastReview) return { from: lastReview.time, to: today, previousReview: lastReview.file }
    return {
      from: _startOfDay(today),
      to: today,
      note: 'No previous review found, so the scope is today.',
    }
  }
  const range = arg.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/)
  if (range) return { from: _startOfDay(range[1]), to: range[2] }
  if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) return { from: _startOfDay(arg), to: arg }
  console.error(`Unknown scope "${arg}". Use since-last, today, YYYY-MM-DD or a range.`)
  process.exit(1)
}

const _formatTime = (date) => date.toLocaleString('sv-SE').slice(0, 16)

const _truncate = (text, max) =>
  text.length > max ? `${text.slice(0, max)}… [+${text.length - max} chars]` : text

const NOISE_TAGS = [
  'system-reminder',
  'ide_opened_file',
  'ide_selection',
  'local-command-caveat',
  'local-command-stdout',
]
const NOISE_PATTERN = new RegExp(
  NOISE_TAGS.map((tag) => `<${tag}>[\\s\\S]*?</${tag}>`).join('|'),
  'g',
)

const _stripNoise = (text) => text.replace(NOISE_PATTERN, '').trim()

const _toolLine = ({ name, input = {} }) => {
  const detail =
    input.description ?? input.command ?? input.file_path ?? input.skill ?? input.query ?? ''
  const agent = input.subagent_type ? ` (${input.subagent_type})` : ''
  return `- [${name}${agent}] ${_truncate(String(detail).replace(/\s+/g, ' '), MAX_TOOL_CHARS)}`
}

const _userText = (content) => {
  if (typeof content === 'string') return _stripNoise(content)
  return content
    .filter((block) => block.type === 'text')
    .map((block) => _stripNoise(block.text))
    .filter(Boolean)
    .join('\n\n')
}

const _digestFile = (file, { from, to }) => {
  const lines = []
  let title = path.basename(file, '.jsonl')
  let startedAt = null
  let lastRecord = null

  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!raw.trim()) continue
    let record
    try {
      record = JSON.parse(raw)
    } catch {
      continue
    }
    if (record.type === 'ai-title') title = record.aiTitle
    if (record.type !== 'user' && record.type !== 'assistant') continue
    if (record.isSidechain || record.isMeta || !record.timestamp) continue

    const time = new Date(record.timestamp)
    if (time <= from || _localDate(time) > to) continue
    startedAt ??= time
    if (!lastRecord || time > lastRecord.time) {
      lastRecord = {
        time,
        timestamp: record.timestamp,
        sessionId: record.sessionId ?? path.basename(file, '.jsonl'),
      }
    }

    const { content } = record.message
    if (record.type === 'user') {
      const text = _userText(content)
      if (text) lines.push(`**User:** ${text}`)
      continue
    }
    for (const block of content) {
      if (block.type === 'text' && block.text.trim()) {
        lines.push(`**Claude:** ${_truncate(block.text.trim(), MAX_TEXT_CHARS)}`)
      } else if (block.type === 'tool_use') {
        lines.push(_toolLine(block))
      }
    }
  }

  if (!lines.length) return null
  return {
    startedAt,
    lastRecord,
    text: `## Session: ${title} (${_formatTime(startedAt)})\n\n${lines.join('\n\n')}`,
  }
}

const scope = _parseScope(process.argv[2])

const files = fs
  .readdirSync(transcriptDir)
  .filter((name) => name.endsWith('.jsonl'))
  .map((name) => path.join(transcriptDir, name))
  .map((file) => ({ file, mtimeMs: fs.statSync(file).mtimeMs }))
  .sort((a, b) => a.mtimeMs - b.mtimeMs)

// The newest transcript is the session running this review.
files.pop()

const sections = files
  .filter(({ mtimeMs }) => mtimeMs >= scope.from.getTime())
  .map(({ file }) => _digestFile(file, scope))
  .filter(Boolean)
  .sort((a, b) => a.startedAt - b.startedAt)

// Sessions overlap, so the last record is the max across all of them.
const lastRecord = sections
  .map((section) => section.lastRecord)
  .reduce((last, record) => (!last || record.time > last.time ? record : last), null)

const output = sections.map(({ text }) => text).join('\n\n---\n\n')
console.log(
  `# Session digest: ${_formatTime(scope.from)}..${scope.to} (${sections.length} sessions)\n`,
)
if (scope.note) console.log(`_Note: ${scope.note}_\n`)
if (scope.previousReview) {
  console.log(
    `Previous review: ${path.relative(projectDir, path.join(reviewsDir, scope.previousReview))}`,
  )
}
if (lastRecord)
  console.log(`Last record: ${lastRecord.timestamp} (session ${lastRecord.sessionId})`)
if (scope.previousReview || lastRecord) console.log('')
console.log(output || '_No sessions in this scope._')
console.log(`\n_Digest size: ${output.length} chars._`)
if (output.length > LARGE_DIGEST_CHARS) {
  console.log('_Large digest: review it in chunks._')
}
