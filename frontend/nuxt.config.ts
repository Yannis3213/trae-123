// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  devServer: {
    port: 3108,
    host: '0.0.0.0'
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:8108/api'
    }
  },
  css: [],
  modules: []
})
