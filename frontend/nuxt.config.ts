const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '3000', 10)
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '3001', 10)

export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@pinia/nuxt'],
  devServer: {
    port: FRONTEND_PORT,
    host: '0.0.0.0',
  },
  runtimeConfig: {
    public: {
      apiBase: `http://localhost:${BACKEND_PORT}`,
      frontendPort: FRONTEND_PORT,
      backendPort: BACKEND_PORT,
    },
  },
  compatibilityDate: '2025-01-01',
  typescript: {
    strict: true,
    shim: false,
  },
})
