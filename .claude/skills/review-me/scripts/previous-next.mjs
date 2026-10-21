#!/usr/bin/env node
// Prints only the `## Next` section of a previous review, so the grader can follow up on
// its actions without seeing its placements. A grader that reads the old file, even
// "after rating", carries its levels in context and tends to copy them.
//
// Usage: node previous-next.mjs <previous review file>

import fs from 'fs'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node previous-next.mjs <previous review file>')
  process.exit(1)
}

const lines = fs.readFileSync(file, 'utf8').split('\n')
const start = lines.findIndex((line) => /^## Next\s*$/.test(line))
if (start === -1) {
  console.log(`_No "## Next" section in ${file}._`)
  process.exit(0)
}

// The section runs until the next `## ` heading, or to the end of the file. A `---`
// before that heading separates sections, so it's dropped.
const end = lines.findIndex((line, index) => index > start && /^## /.test(line))
console.log(
  lines
    .slice(start, end === -1 ? undefined : end)
    .join('\n')
    .trim()
    .replace(/\n+---$/, ''),
)
