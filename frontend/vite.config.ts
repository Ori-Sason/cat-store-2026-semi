import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      // lets any partial write `@use 'setup' as *` regardless of folder depth
      scss: { loadPaths: [fileURLToPath(new URL('./src/assets/scss', import.meta.url))] },
    },
  },
  server: {
    host: true,
    strictPort: true,
    // E2E points this at its own backend (playwright.config.ts), so a running dev server isn't touched
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:8000' },
  },
})
