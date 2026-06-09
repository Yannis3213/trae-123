export default defineNuxtConfig({
  devtools: { enabled: true },
  devServer: {
    port: 3004,
    host: '0.0.0.0',
  },
  modules: ['@pinia/nuxt'],
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:8004',
    },
  },
  nitro: {
    devProxy: {
      '/api': {
        target: 'http://localhost:8004',
        changeOrigin: true,
      },
    },
  },
  css: ['~/assets/main.css'],
  typescript: {
    strict: true,
  },
  app: {
    head: {
      title: '养老护理院 - 月底集中处理护理计划单系统',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
})
