import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glsl from 'vite-plugin-glsl'

// BASE_PATH is set by the GitHub Pages workflow. A project repo is served from
// /<repo>/, a user site from /. Everything that references an asset by URL must
// go through import.meta.env.BASE_URL so both cases work.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), glsl({ minify: false })],
  build: {
    target: 'es2022',
    // three + drei + postprocessing is legitimately ~250kB gzipped and is
    // already split into its own lazily-loaded chunk; the default 500kB warning
    // has nothing left to tell us.
    chunkSizeWarningLimit: 1200,
  },
})
