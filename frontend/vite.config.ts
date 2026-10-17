import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
// E2E points this at its own backend (playwright.config.ts), so a running dev server isn't touched
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8000'

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
    proxy: {
      '/api': apiProxyTarget,
      // Socket.io's default path is /socket.io/, so `ws: true` on /api wouldn't catch it.
      // Without `ws: true` the WebSocket upgrade isn't forwarded and the client stays on polling
      '/socket.io': { target: apiProxyTarget, ws: true },
    },
  },
})
