#!/usr/bin/env node
// Condenses Claude Code session transcripts into a reviewable digest.
// Keeps user prompts, the user's tool feedback (rejections, plan approvals, answers),
// Claude's text replies, one line per tool call, and the commits in scope.
// Drops thinking, other tool results and system reminders, which are most of the bytes.
//
// Usage: node digest.mjs [since-last (default) | today | YYYY-MM-DD | YYYY-MM-DD..YYYY-MM-DD]
//                        [--exclude-session <id>]

import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseArgs } from 'util'

const MAX_TEXT_CHARS = 1000
const MAX_USER_CHARS = 4000
const LARGE_DIGEST_CHARS = 300_000
const MAX_TOOL_CHARS = 200
const CONFIG_PATHS = ['.claude/', '.docs/', 'CLAUDE.md']

const projectDir = path.resolve(import.meta.dirname, '../../../..')
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
  if (arg === 'today') return { from: _startOfDay(today), to: today, notes: [] }
  if (arg === 'since-last') {
    const lastReview = _lastReview()
    if (lastReview) {
      return { from: lastReview.time, to: today, previousReview: lastReview.file, notes: [] }
    }
    return {
      from: _startOfDay(today),
      to: today,
      notes: ['No previous review found, so the scope is today.'],
    }
  }
  const range = arg.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/)
  if (range) return { from: _startOfDay(range[1]), to: range[2], notes: [] }
  if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) return { from: _startOfDay(arg), to: arg, notes: [] }
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
const COMMAND_PATTERN = /<command-(name|message|args)>[\s\S]*?<\/command-\1>/g

const _stripNoise = (text) => text.replace(NOISE_PATTERN, '').trim()

// `<command-name>/x</command-name>…<command-args>y</command-args>` → `/x y`
const _collapseCommand = (text) => {
  const name = text.match(/<command-name>([\s\S]*?)<\/command-name>/)?.[1]
  if (!name) return text
  const args = text.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1] ?? ''
  const rest = text.replace(COMMAND_PATTERN, '').trim()
  return [`${name} ${args}`.trim(), rest].filter(Boolean).join('\n\n')
}

const _toolLine = ({ name, input = {} }) => {
  const detail =
    input.description ??
    input.command ??
    input.file_path ??
    input.skill ??
    input.query ??
    input.pattern ??
    input.plan?.trim().split('\n')[0] ??
    ''
  const agent = input.subagent_type ? ` (${input.subagent_type})` : ''
  return `- [${name}${agent}] ${_truncate(String(detail).replace(/\s+/g, ' '), MAX_TOOL_CHARS)}`
}

const _resultText = ({ content }) =>
  typeof content === 'string'
    ? content
    : (content ?? []).map((block) => (block.type === 'text' ? block.text : '')).join(' ')

// Only the tool results the user wrote or decided. Everything else is tool output.
const _feedbackLine = (block) => {
  const text = _resultText(block).trim()
  if (text.startsWith("The user doesn't want to proceed")) {
    const reason = text.match(/reason for the rejection:\s*([\s\S]*)/)?.[1]?.trim()
    return `**User (rejected):** ${reason ? _truncate(reason, MAX_USER_CHARS) : 'no reason'}`
  }
  if (text.startsWith('User has approved your plan')) return '**User:** (approved the plan)'
  const answers = text.match(/^The user answered: ([\s\S]*?)(?:\. Read the answers carefully|$)/)
  if (answers) return `**User (answered):** ${_truncate(answers[1], MAX_USER_CHARS)}`
  return null
}

const _userLines = (content) => {
  const text = (raw) => _truncate(_collapseCommand(_stripNoise(raw)), MAX_USER_CHARS)
  if (typeof content === 'string') {
    const prompt = text(content)
    return prompt ? [`**User:** ${prompt}`] : []
  }
  return content
    .map((block) => {
      if (block.type === 'tool_result') return _feedbackLine(block)
      if (block.type !== 'text') return null
      const prompt = text(block.text)
      return prompt ? `**User:** ${prompt}` : null
    })
    .filter(Boolean)
}

const _digestFile = (file, { from, to }) => {
  const lines = []
  let title = path.basename(file, '.jsonl')
  let startedAt = null
  let lastRecord = null
  let promptCount = 0

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
      const userLines = _userLines(content)
      promptCount += userLines.filter(
        (line) => line.startsWith('**User:** ') && !line.startsWith('**User:** /'),
      ).length
      lines.push(...userLines)
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
    promptCount,
    text: `## Session: ${title} (${_formatTime(startedAt)})\n\n${lines.join('\n\n')}`,
  }
}

// Commit subjects in scope, plus the config files each one touched. No diffs.
const _commits = ({ from, to }) => {
  let log
  try {
    log = execFileSync(
      'git',
      [
        'log',
        `--since=${from.toISOString()}`,
        `--until=${to} 23:59:59`,
        '--format=%x00%h %ad %s',
        '--date=short',
        '--name-only',
      ],
      { cwd: projectDir, encoding: 'utf8' },
    )
  } catch {
    return null
  }
  const commits = log
    .split('\0')
    .filter((entry) => entry.trim())
    .map((entry) => {
      const [subject, ...files] = entry.trim().split('\n')
      const configFiles = files.filter((file) =>
        CONFIG_PATHS.some((prefix) => file.startsWith(prefix)),
      )
      return [`- ${subject}`, ...configFiles.map((file) => `  - ${file}`)].join('\n')
    })
  if (!commits.length) return null
  return `## Commits (${commits.length})\n\n${commits.join('\n')}`
}

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: { 'exclude-session': { type: 'string' } },
})
const scope = _parseScope(positionals[0])
// The session that invoked the review. The forked reviewer's own transcript lives
// under subagents/, so this is the parent session, excluded as a whole.
const excludedFile = options['exclude-session'] && `${options['exclude-session']}.jsonl`

const files = fs
  .readdirSync(transcriptDir)
  .filter((name) => name.endsWith('.jsonl'))
  .map((name) => path.join(transcriptDir, name))
  .map((file) => ({ file, mtimeMs: fs.statSync(file).mtimeMs }))
  .filter(({ mtimeMs }) => mtimeMs >= scope.from.getTime())

const excluded = files.find(({ file }) => path.basename(file) === excludedFile)
const skippedPrompts = excluded ? (_digestFile(excluded.file, scope)?.promptCount ?? 0) : 0
if (skippedPrompts) {
  scope.notes.push(
    `The invoking session had ${skippedPrompts} prompts in scope, and they're skipped. ` +
      'Run /review-me in a fresh session to cover them.',
  )
}

const sections = files
  .filter(({ file }) => file !== excluded?.file)
  .map(({ file }) => _digestFile(file, scope))
  .filter(Boolean)
  .sort((a, b) => a.startedAt - b.startedAt)

// Sessions overlap, so the last record is the max across all of them.
const lastRecord = sections
  .map((section) => section.lastRecord)
  .reduce((last, record) => (!last || record.time > last.time ? record : last), null)

const commits = sections.length ? _commits(scope) : null
const output = [commits, ...sections.map(({ text }) => text)].filter(Boolean).join('\n\n---\n\n')
console.log(
  `# Session digest: ${_formatTime(scope.from)}..${scope.to} (${sections.length} sessions)\n`,
)
for (const note of scope.notes) console.log(`_Note: ${note}_\n`)
if (scope.previousReview) {
  console.log(
    `Previous review: ${path.relative(projectDir, path.join(reviewsDir, scope.previousReview))}`,
  )
}
if (lastRecord)
  console.log(`Last record: ${lastRecord.timestamp} (session ${lastRecord.sessionId})`)
if (scope.previousReview || lastRecord) console.log('')
console.log(sections.length ? output : '_No sessions in this scope._')
console.log(`\n_Digest size: ${output.length} chars._`)
if (output.length > LARGE_DIGEST_CHARS) {
  console.log('_Large digest: review it in chunks._')
}
