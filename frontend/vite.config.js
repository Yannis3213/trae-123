import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '3001', 10);
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '5173', 10);

export default defineConfig({
  server: {
    port: FRONTEND_PORT,
    host: true,
    proxy: {
      "/api": {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
  plugins: [remix()],
});
