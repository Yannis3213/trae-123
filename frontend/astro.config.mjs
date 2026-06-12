import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  server: {
    port: 3109,
    host: true
  },
  integrations: [react()],
  output: 'static'
});
