export default defineNuxtConfig({
  devtools: { enabled: true },
  typescript: {
    strict: true,
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE || 'http://localhost:8110/api',
    },
  },
  devServer: {
    port: 3109,
  },
  vite: {
    server: {
      port: 3109,
    },
  },
  nitro: {
    devProxy: {
      '/api': {
        target: 'http://localhost:8110',
        changeOrigin: true,
      },
    },
  },
})
