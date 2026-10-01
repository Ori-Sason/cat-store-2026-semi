import { defineProject, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Reuses vite.config.ts so tests get the same plugins and SCSS load paths as the app
export default mergeConfig(
  viteConfig,
  defineProject({
    test: {
      name: 'frontend',
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
    },
  }),
)
