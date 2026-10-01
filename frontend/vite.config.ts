import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    strictPort: true,
    proxy: { '/api': 'http://localhost:8000' },
    /* FIX - add `ws: true` to include WebSockets in the proxy. I had a conversation with Claude about it in Sep, 24 (Backend setup with TypeScript). Get back to it */
  },
})
