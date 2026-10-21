#!/usr/bin/env node
// Adds a "Level vs previous review" table to a saved review, just before "Since last
// review" (or at the end if there's none). It runs after the whole report is written,
// so the previous levels never reach the grader while it places. That keeps the
// "this axis rose" view without the anchor.
//
// Usage: node level-diff.mjs <new review file> <previous review file>

import fs from 'fs'
import path from 'path'

const STEP = { junior: 0, mid: 1, senior: 2, 'beyond senior': 3 }

// `junior→mid` sits half a step above junior. A "signal" adds nothing: the rubric
// counts one moment as a signal, not a placement.
const _score = (level) => {
  const [low, high] = level.split('→').map((part) => STEP[part.trim()])
  if (low === undefined) return null
  return high === undefined ? low : low + 0.5
}

// Placement rows from tables whose header has a "Level" column. Two row shapes exist
// in old reviews: `| 1. Axis | **level** |` and `| 1 | Axis | **level** |`.
const _placements = (file) => {
  const placements = new Map()
  let isLevelTable = false
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.startsWith('|')) {
      isLevelTable = false
      continue
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())
    if (cells.some((cell) => /^level$/i.test(cell))) {
      isLevelTable = true
      continue
    }
    if (!isLevelTable) continue
    const numbered = cells[0].match(/^(\d+)\.?\s*(.*)$/)
    if (!numbered) continue
    const [, axis, inlineName] = numbered
    const name = inlineName || cells[1]
    const levelCell = inlineName ? cells[1] : cells[2]
    const level = levelCell?.match(/\*\*(.+?)\*\*/)?.[1].toLowerCase()
    if (level) placements.set(Number(axis), { name, level })
  }
  return placements
}

const _rubricVersion = (file) =>
  fs.readFileSync(file, 'utf8').match(/^Rated on rubric v(\d+)/m)?.[1] ?? '1'

const [newFile, previousFile] = process.argv.slice(2)
if (!newFile || !previousFile) {
  console.error('Usage: node level-diff.mjs <new review file> <previous review file>')
  process.exit(1)
}

const current = _placements(newFile)
const previous = _placements(previousFile)
if (!current.size) {
  console.error(`No placement table found in ${newFile}.`)
  process.exit(1)
}

const rows = [...current.entries()]
  .sort(([a], [b]) => a - b)
  .map(([axis, { name, level }]) => {
    const before = previous.get(axis)?.level
    const delta = before ? _score(level) - _score(before) : null
    const change =
      delta === null || Number.isNaN(delta) ? '–' : delta > 0 ? '↑' : delta < 0 ? '↓' : '='
    return `| ${axis}. ${name} | ${before ?? 'not placed'} | ${level} | ${change} |`
  })

const newVersion = _rubricVersion(newFile)
const previousVersion = _rubricVersion(previousFile)
const versionNote =
  newVersion === previousVersion
    ? ''
    : `\nThe previous review was rated on rubric v${previousVersion}, this one on v${newVersion}. ` +
      'A drop can come from the changed bar, not from you.\n'

const section = [
  '## Level vs previous review',
  '',
  `Added by a script after placement. The grader didn't see ${path.basename(previousFile)}'s levels.`,
  versionNote,
  '| Axis | Previous | Now | Change |',
  '|---|---|---|---|',
  ...rows,
].join('\n')

// Sections are separated by `---`, so the table brings its own separator
const report = fs.readFileSync(newFile, 'utf8')
const sinceLast = report.search(/^## Since last review/m)
const updated =
  sinceLast === -1
    ? `${report.trimEnd()}\n\n---\n\n${section}\n`
    : `${report.slice(0, sinceLast)}${section}\n\n---\n\n${report.slice(sinceLast)}`
fs.writeFileSync(newFile, updated)
console.log(`Level diff added to ${newFile}.`)
