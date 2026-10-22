#!/usr/bin/env node
// Prints the body of the active output style, so the forked review subagent can write in
// it. A subagent builds its own system prompt, so the main session's style never reaches
// it. Prints nothing for a built-in style (e.g. Default), which has no file.
//
// Copies Claude Code's lookup from the files on disk. A style passed with the `--settings`
// CLI flag isn't on disk, so it's missed.
//
// Usage: node output-style.mjs

import fs from 'fs'
import os from 'os'
import path from 'path'

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
const userDir = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude')

// Highest precedence first: managed policy, then local project, project, user.
const settingsFiles = [
  '/etc/claude-code/managed-settings.json',
  path.join(projectDir, '.claude/settings.local.json'),
  path.join(projectDir, '.claude/settings.json'),
  path.join(userDir, 'settings.json'),
]

// A project style shadows a user style with the same name.
const styleDirs = [
  path.join(projectDir, '.claude/output-styles'),
  path.join(userDir, 'output-styles'),
]

const styleName = settingsFiles.map(_readOutputStyle).find(Boolean)
if (!styleName) process.exit(0)

for (const dir of styleDirs) {
  const style = _findStyle(dir, styleName)
  if (style) {
    console.log(style.body)
    process.exit(0)
  }
}

function _readOutputStyle(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).outputStyle
  } catch {
    // Missing or unparsable: fall through to the next file, as Claude Code does.
    return undefined
  }
}

// The frontmatter `name` is the style's name. The file name is the fallback.
function _findStyle(dir, name) {
  let files
  try {
    files = fs.readdirSync(dir).filter((file) => file.endsWith('.md'))
  } catch {
    return undefined
  }
  return files
    .map((file) => _parseStyle(path.join(dir, file)))
    .find((style) => style.name.toLowerCase() === name.toLowerCase())
}

function _parseStyle(file) {
  const text = fs.readFileSync(file, 'utf8')
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/)
  const frontmatterName = match?.[1].match(/^name:\s*(.+?)\s*$/m)?.[1]
  return {
    name: frontmatterName ?? path.basename(file, '.md'),
    body: (match ? text.slice(match[0].length) : text).trim(),
  }
}
