import { defineConfig } from '@tanstack/start/config'

export default defineConfig({
  server: {
    port: 3106,
  },
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8106',
          changeOrigin: true,
        },
      },
    },
  },
})
