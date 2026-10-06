import { defineConfig, devices } from '@playwright/test'

// E2E gets its own ports, so it runs next to `npm run dev` without reusing (or hitting) the dev DB
const BACKEND_PORT = 8001
const FRONTEND_PORT = 5174

export default defineConfig({
  testDir: './e2e',
  // Every spec shares catsTest, the same DB the backend Vitest suite wipes - don't run both at once
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'backend',
      cwd: '../backend',
      // Re-seed catsTest before each run, so specs start from the known seed data
      command: 'node --env-file=.env.test scripts/seed.ts && node --env-file=.env.test server.ts',
      url: `http://localhost:${BACKEND_PORT}/api/cats`,
      // process env beats --env-file, so this wins over any PORT in .env.test
      env: { PORT: String(BACKEND_PORT) },
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    },
    {
      name: 'frontend',
      command: `npx vite --port ${FRONTEND_PORT}`,
      url: `http://localhost:${FRONTEND_PORT}`,
      env: { API_PROXY_TARGET: `http://localhost:${BACKEND_PORT}` },
    },
  ],
})
