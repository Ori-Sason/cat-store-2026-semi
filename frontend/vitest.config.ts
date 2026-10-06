import { defineProject, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Reuses vite.config.ts so tests get the same plugins and SCSS load paths as the app
export default mergeConfig(
  viteConfig,
  defineProject({
    test: {
      name: 'frontend',
      environment: 'jsdom',
      // Only unit tests - Playwright specs in e2e/ run with `npm run test:e2e`
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test-setup.ts'],
    },
  }),
)
