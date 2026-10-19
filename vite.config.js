import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Separate pages: landing (index.html), contact (contact.html), about (about.html) community (community.html) cohort (cohort.html) and market push (market.html).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        contact: resolve(import.meta.dirname, 'contact.html'),
        about: resolve(import.meta.dirname, 'about.html'),
        community: resolve(import.meta.dirname, 'community.html'),
        cohort: resolve(import.meta.dirname, 'cohort.html'),
        market: resolve(import.meta.dirname, 'market.html'),
      },
    },
  },
})
