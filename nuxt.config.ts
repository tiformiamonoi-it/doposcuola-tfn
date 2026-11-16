const INTESTAZIONI_VERIFICA = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
}

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
      // Webapp installabile sul telefono (PWA): manifest + icone in public/
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' }, // Safari non legge le favicon SVG
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'theme-color', content: '#0063a6' },
        // iOS più vecchi che ignorano il manifest
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'tiformiamonoi.it' },
      ],
    }
  },

  modules: [
    '@nuxt/ui',
    '@nuxtjs/google-fonts',
    'nuxt-auth-utils',
  ],

  // 'indigo' (Crediti) e 'pink' (Debiti) sono usati come color= su badge e bottoni
  // in Contabilità: vanno dichiarati qui, altrimenti Nuxt UI non genera le loro
  // variabili di tema (colore assente a schermo) e TypeScript li segnala come errore.
  ui: {
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'indigo', 'pink'],
    },
  },

  runtimeConfig: {
    // Email transazionali via Brevo (https://brevo.com). Se le chiavi mancano,
    // l'invio è disattivato e l'app continua a funzionare (utile in sviluppo).
    // Override con variabili d'ambiente: NUXT_BREVO_API_KEY, NUXT_EMAIL_FROM, ecc.
    brevoApiKey:   '',
    emailFrom:     '',                    // mittente verificato su Brevo
    emailFromName: 'tiformiamonoi',
    appUrl:        '',                    // es. https://gestionale.tiformiamonoi.it (per i link nelle email)
  },

  googleFonts: {
    families: {
      Montserrat: [600, 700],
      Inter: [400, 500, 600],
    },
    display: 'swap',
    preload: true,
    // GDPR: i font vengono scaricati al build e serviti dal nostro dominio —
    // il browser del visitatore non contatta mai i server Google.
    download: true,
  },

  // LA VERIFICA DELLA CARD È PUBBLICA E IL CODICE STA NELL'INDIRIZZO: chi ha l'indirizzo
  // vede il nome dell'alunno. Quindi: nessuna copia salvata per strada né nel telefono
  // (no-store), l'indirizzo non parte verso altri siti se si tocca un link (no-referrer),
  // niente motori di ricerca, e nessun sito può mostrarla dentro una sua cornice per
  // farla sembrare sua (frame-ancestors / X-Frame-Options). Pagina e API, risposte
  // d'errore comprese (il "troppi controlli" nasce prima che l'API scriva le sue).
  routeRules: {
    '/verifica/**':          { headers: INTESTAZIONI_VERIFICA },
    '/api/verifica-card/**': { headers: INTESTAZIONI_VERIFICA },
  },

  css: ['~/assets/css/main.css'], // ~ risolve a app/ con compatibilityVersion: 4

  // Pre-compilazione delle dipendenze: evita i ricaricamenti di pagina in sviluppo
  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit', 'zod'],
    },
  },
})
