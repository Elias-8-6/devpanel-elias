/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Proxying /api keeps the browser on a single origin, so the auth cookie can
// be SameSite=Strict and no CORS preflight is needed during development.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // File events from Windows bind mounts don't reach the container reliably.
    watch: process.env.VITE_USE_POLLING === 'true' ? { usePolling: true } : undefined,
    proxy: {
      // xfwd appends the real client IP to X-Forwarded-For; the backend
      // trusts only this proxy, so values sent by the client are ignored.
      '/api': { target: apiTarget, changeOrigin: true, xfwd: true },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Lets Testing Library unmount between tests automatically.
    globals: true,
  },
})
