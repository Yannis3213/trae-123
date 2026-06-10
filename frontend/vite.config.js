import { defineConfig, loadEnv } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const FRONTEND_PORT = parseInt(env.FRONTEND_PORT || '5173')
  const BACKEND_PORT = parseInt(env.BACKEND_PORT || '8000')

  return {
    plugins: [solidPlugin()],
    server: {
      port: FRONTEND_PORT,
      host: true,
      proxy: {
        '/api': {
          target: `http://localhost:${BACKEND_PORT}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      target: 'esnext',
    },
    define: {
      'import.meta.env.VITE_BACKEND_PORT': JSON.stringify(BACKEND_PORT),
      'import.meta.env.VITE_FRONTEND_PORT': JSON.stringify(FRONTEND_PORT),
    },
  }
})
