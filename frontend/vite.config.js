import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// basicSsl makes Vite serve HTTPS on localhost:5173.
// The browser connects to Vite over HTTPS; Vite's dev proxy then forwards
// /api/* to the backend over plain HTTP *internally* — browsers never see
// that internal hop, so there is no mixed-content issue.
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    port: 5173,
    https: true,
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


