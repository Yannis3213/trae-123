import { defineConfig } from "$fresh/server.ts";

export default defineConfig({
  server: {
    port: parseInt(Deno.env.get("FRONTEND_PORT") || "8002"),
  },
});
