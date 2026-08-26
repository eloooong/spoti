import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8888',
      '/login': 'http://127.0.0.1:8888',
      '/callback': 'http://127.0.0.1:8888',
      '/logout': 'http://127.0.0.1:8888',
    },
  },
})
