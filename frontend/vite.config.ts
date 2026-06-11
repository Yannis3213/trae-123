import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tanstackStart({
      srcDirectory: 'app',
      tsr: {
        disableLogging: true,
      },
    }),
    react(),
  ],
  server: {
    port: 3106,
    proxy: {
      '/api': {
        target: 'http://localhost:8106',
        changeOrigin: true,
      },
    },
  },
})
