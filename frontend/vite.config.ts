import { defineConfig, loadEnv } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { join } from "path";

export default defineConfig(({ mode }) => {
  const FRONTEND_PORT = 3108;
  const BACKEND_PORT = 8108;

  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
    dev: {
      headers: {
        "Cache-Control": "public, max-age=0",
      },
    },
    preview: {
      headers: {
        "Cache-Control": "public, max-age=600",
      },
    },
    server: {
      port: FRONTEND_PORT,
      host: true,
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://localhost:${BACKEND_PORT}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    resolve: {
      alias: {
        "~": join(__dirname, "src"),
      },
    },
    define: {
      "import.meta.env.VITE_FRONTEND_PORT": JSON.stringify(FRONTEND_PORT),
      "import.meta.env.VITE_BACKEND_PORT": JSON.stringify(BACKEND_PORT),
      "import.meta.env.VITE_BACKEND_URL": JSON.stringify(
        `http://localhost:${BACKEND_PORT}`
      ),
      "import.meta.env.VITE_FRONTEND_URL": JSON.stringify(
        `http://localhost:${FRONTEND_PORT}`
      ),
    },
  };
});
