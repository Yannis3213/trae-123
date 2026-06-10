import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3002,
    open: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
