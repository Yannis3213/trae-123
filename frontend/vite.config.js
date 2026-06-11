import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

const BACKEND_PORT = 3001;
const FRONTEND_PORT = 5173;

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
