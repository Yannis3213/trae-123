import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

const BACKEND_PORT = 8001;
const FRONTEND_PORT = 3001;

export default defineConfig({
  plugins: [preact()],
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
  preview: {
    port: FRONTEND_PORT
  }
});
