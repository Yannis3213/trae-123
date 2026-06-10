import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const FRONTEND_PORT = Number(env.FRONTEND_PORT || 5173)
  const BACKEND_PORT = Number(env.BACKEND_PORT || 5000)

  return {
    plugins: [react()],
    server: {
      port: FRONTEND_PORT,
      host: true,
      proxy: {
        '/api': {
          target: `http://localhost:${BACKEND_PORT}`,
          changeOrigin: true
        }
      }
    },
    define: {
      'import.meta.env.VITE_BACKEND_PORT': JSON.stringify(String(BACKEND_PORT)),
      'import.meta.env.VITE_FRONTEND_PORT': JSON.stringify(String(FRONTEND_PORT))
    }
  }
})
