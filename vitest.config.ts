import { defineConfig } from 'vitest/config'

// Root runner: `npm test` runs every workspace's suite in one go
export default defineConfig({
  test: {
    projects: ['shared', 'frontend', 'backend'],
  },
})
