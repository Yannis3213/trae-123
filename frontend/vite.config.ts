import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  server: {
    port: 3109,
    proxy: {
      '/api': {
        target: 'http://localhost:8109',
        changeOrigin: true
      }
    }
  }
})
