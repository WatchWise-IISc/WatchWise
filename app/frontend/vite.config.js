import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const frontendPort = Number(process.env.VITE_FRONTEND_PORT || process.env.WATCHWISE_FRONTEND_PORT || 18791)
const backendPort = process.env.WATCHWISE_BACKEND_PORT || 18790
const apiTarget = process.env.VITE_API_TARGET || `http://localhost:${backendPort}`

export default defineConfig({
  plugins: [react()],
  server: {
    port: frontendPort,
    proxy: {
      '/api': apiTarget,
    },
  },
})
