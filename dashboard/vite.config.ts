import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The dashboard calls the API on its own origin. In development Vite forwards /api to Django.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:8000' },
  },
})
