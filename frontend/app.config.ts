import { defineConfig } from '@solidjs/start/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    port: 3107,
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      port: 3107,
    },
  },
});
