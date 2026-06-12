import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 3105,
    proxy: {
      '/api': {
        target: 'http://localhost:8105',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3105,
  },
})
