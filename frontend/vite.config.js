import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3105,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8105',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
