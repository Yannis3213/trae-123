import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  server: {
    port: 3004,
    host: true
  },
  vite: {
    server: {
      port: 3004,
      proxy: {
        '/api': {
          target: 'http://localhost:8004',
          changeOrigin: true
        }
      }
    }
  }
});
