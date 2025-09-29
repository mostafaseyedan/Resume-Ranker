import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
const localEnvDir = fs.existsSync(path.resolve(__dirname, '.env'))
  ? __dirname
  : path.resolve(__dirname, '..')

export default defineConfig({
  plugins: [react()],
  envDir: localEnvDir,
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist'
  }
})
