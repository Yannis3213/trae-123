import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

const BACKEND_PORT = 8106;
const FRONTEND_PORT = 3106;

export default defineConfig(({ mode }) => ({
  plugins: [angular()],
  server: {
    port: FRONTEND_PORT,
    host: true,
    cors: true,
    proxy: {
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: FRONTEND_PORT,
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
}));
