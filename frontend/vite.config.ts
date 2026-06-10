import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  plugins: [remix()],
  server: {
    port: Number(process.env.FRONTEND_PORT) || 3000,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.BACKEND_PORT || 8000}`,
        changeOrigin: true,
      },
    },
  },
});
