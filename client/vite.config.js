import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // same-origin requests in dev, so the server doesn't need CORS
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
