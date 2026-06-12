import { defineConfig } from '@tanstack/react-start/config'

export default defineConfig({
  server: {
    preset: 'node-server',
    port: 3106,
  },
  vite: {
    define: {
      __API_BASE__: JSON.stringify('http://localhost:8106'),
    },
    server: {
      port: 3106,
      hmr: {
        port: 3107,
      },
    },
  },
})
