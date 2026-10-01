import { defineConfig } from 'vitest/config'

// Root runner: `npm test` runs every workspace's suite in one go
export default defineConfig({
  test: {
    projects: ['shared', 'frontend', 'backend'],
    // a package with no tests yet shouldn't fail the whole run
    passWithNoTests: true,
  },
})
