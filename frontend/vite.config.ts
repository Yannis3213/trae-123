import { defineConfig, loadEnv } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const frontendPort = parseInt(env.FRONTEND_PORT || '5173');
  const backendPort = parseInt(env.BACKEND_PORT || '3000');

  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
    server: {
      port: frontendPort,
      strictPort: true,
      host: true,
    },
    preview: {
      port: frontendPort,
      strictPort: true,
      host: true,
    },
    define: {
      'import.meta.env.VITE_FRONTEND_PORT': JSON.stringify(frontendPort),
      'import.meta.env.VITE_BACKEND_PORT': JSON.stringify(backendPort),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(`http://localhost:${backendPort}`),
    },
    devtools: { enabled: true },
  };
});
