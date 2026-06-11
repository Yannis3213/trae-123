import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 3108,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8108',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 3108,
    strictPort: true
  }
})
