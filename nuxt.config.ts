export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: '2024-11-01',

  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@nuxtjs/google-fonts',
  ],

  googleFonts: {
    families: {
      Montserrat: [600, 700],
      Inter: [400, 500, 600],
    },
    display: 'swap',
    preload: true,
  },

  css: ['~/assets/css/main.css'], // ~ risolve a app/ con compatibilityVersion: 4
})
