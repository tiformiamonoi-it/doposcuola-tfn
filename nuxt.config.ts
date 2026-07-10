export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: '2024-11-01',

  devtools: { enabled: true },

  colorMode: {
    preference: 'light',
    fallback: 'light',
    classSuffix: '',
    storageKey: 'tfn-color-mode-v2' // Cambiare chiave ignora la cache dei telefoni!
  },

  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1',
    }
  },

  modules: [
    '@nuxt/ui',
    '@nuxtjs/google-fonts',
    'nuxt-auth-utils',
  ],

  runtimeConfig: {
    // Email transazionali via Brevo (https://brevo.com). Se le chiavi mancano,
    // l'invio è disattivato e l'app continua a funzionare (utile in sviluppo).
    // Override con variabili d'ambiente: NUXT_BREVO_API_KEY, NUXT_EMAIL_FROM, ecc.
    brevoApiKey:   '',
    emailFrom:     '',                    // mittente verificato su Brevo
    emailFromName: 'Ti Formiamo Noi',
    appUrl:        '',                    // es. https://gestionale.tiformiamonoi.it (per i link nelle email)
  },

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
