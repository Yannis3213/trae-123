import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  server: {
    port: 3003,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8003',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3003,
  },
  resolve: {
    mainFields: ['module'],
  },
  build: {
    target: 'es2020',
  },
});
