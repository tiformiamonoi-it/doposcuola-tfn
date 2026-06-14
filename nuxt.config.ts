export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: '2024-11-01',

  devtools: { enabled: true },

  colorMode: {
    preference: 'light',
    fallback: 'light'
  },

  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
    }
  },

  modules: [
    '@nuxt/ui',
    '@nuxtjs/google-fonts',
    'nuxt-auth-utils',
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

  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit'],
    },
  },
})
