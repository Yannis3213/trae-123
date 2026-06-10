import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

const frontendPort = parseInt(process.env.FRONTEND_PORT || '4321', 10);
const backendPort = parseInt(process.env.BACKEND_PORT || '8000', 10);

export default defineConfig({
  integrations: [react()],
  server: {
    port: frontendPort,
    host: true,
  },
  vite: {
    define: {
      'import.meta.env.VITE_BACKEND_PORT': JSON.stringify(String(backendPort)),
    },
  },
});
