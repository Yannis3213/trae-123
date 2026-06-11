import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig(({ mode }) => ({
  plugins: [angular()],
  server: {
    port: 3003,
    host: '0.0.0.0',
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
  build: {
    outDir: 'dist',
  },
  resolve: {
    mainFields: ['module'],
  },
  define: {
    'process.env': {},
  },
  css: {
    preprocessorOptions: {
      scss: {
        includePaths: ['src'],
      },
    },
  },
}));
