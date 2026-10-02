import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { defineProject } from 'vitest/config'

// Vitest ignores `--env-file`, so read .env.test here. `config/index.ts` throws on
// missing vars at import time, and `test.env` is applied before any test file loads
const testEnv = parseEnv(readFileSync(join(import.meta.dirname, '.env.test'), 'utf8'))

export default defineProject({
  test: {
    name: 'backend',
    environment: 'node',
    env: testEnv,
    // every DB file shares one test DB, so a parallel file's wipe would delete this one's data
    fileParallelism: false,
  },
})
