import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When deploying to GitHub Pages the app lives at /<repo-name>/
// Set VITE_BASE_PATH in your repo's Actions secrets/variables if needed,
// or change the string below to match your repository name.
// For Netlify / Vercel leave it as '/' (the default).
const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
