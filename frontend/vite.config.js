import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3106,
    proxy: {
      '/api': {
        target: 'http://localhost:8106',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
  },
});
