import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe'
  },
  build: {
    outDir: 'dist'
  }
})