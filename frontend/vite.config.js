import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No basicSsl — the Vite dev proxy forwards /api/* to the backend over plain HTTP
// internally, so there is no mixed-content issue. SSL termination belongs at a
// reverse proxy (Nginx/Caddy) in production, not in the dev server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})


