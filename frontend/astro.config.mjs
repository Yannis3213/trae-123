import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  server: {
    port: 3001,
    host: true,
  },
  vite: {
    define: {
      'import.meta.env.API_BASE_URL': JSON.stringify('http://localhost:8001/api'),
    },
  },
});
