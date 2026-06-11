// app.config.ts
import { defineConfig } from "@tanstack/start/config";
var app_config_default = defineConfig({
  server: {
    port: 3106
  },
  vite: {
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8106",
          changeOrigin: true
        }
      }
    }
  }
});
export {
  app_config_default as default
};
