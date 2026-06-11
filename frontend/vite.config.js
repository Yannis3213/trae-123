import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3109,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8109',
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    port: 3109,
    host: '0.0.0.0'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
});
