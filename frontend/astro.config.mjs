import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  server: {
    port: 3002,
    host: true,
  },
  vite: {
    define: {
      'import.meta.env.API_URL': JSON.stringify('http://localhost:8002'),
    },
  },
});
