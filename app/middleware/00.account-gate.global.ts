// Gate globale post-login:
// 1) password temporanea → forza /cambio-password
// 2) genitore che non ha accettato termini & privacy → forza /portale/accetta-termini
// Le sessioni create prima del deploy non hanno i nuovi campi (undefined):
// non vengono gateate qui — il gate scatta dal login successivo.
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value || !user.value) return

  // I documenti legali devono restare raggiungibili SEMPRE: chi non ha ancora accettato
  // i termini deve poterli leggere (compresa la cookie policy, che prima veniva rimbalzata).
  // '/imposta-password' è pubblica ma va lasciata passare anche a chi è già
  // collegato: capita che un genitore apra il link dal telefono dove ha ancora
  // la sessione aperta, e il gate lo rimbalzerebbe altrove.
  // Il regolamento della card è un documento da leggere come gli altri; la pagina del
  // negozio (/verifica/<codice>) è pubblica e chi la apre non va mai dirottato altrove.
  const whitelist = ['/login', '/cambio-password', '/imposta-password', '/portale/accetta-termini', '/termini', '/privacy', '/privacy-studente', '/cookie', '/prenota', '/regolamento-card']
  if (whitelist.includes(to.path) || to.path.startsWith('/verifica/')) return

  if (user.value.mustChangePassword) {
    return navigateTo('/cambio-password')
  }
  if (['GENITORE', 'STUDENTE'].includes(user.value.role) && user.value.termsAccepted === false) {
    return navigateTo('/portale/accetta-termini')
  }
  // Genitore di un alunno sotto i 14 anni che non ha ancora firmato la
  // dichiarazione di autorizzazione: stessa schermata dei documenti legali.
  // Scatta SOLO se non ha mai risposto — chi l'ha data e poi revocata dal Profilo
  // non viene richiuso fuori, altrimenti la revoca non sarebbe libera.
  if (user.value.role === 'GENITORE' && (user.value.dichiarazioniMinori?.length ?? 0) > 0) {
    return navigateTo('/portale/accetta-termini')
  }
  // DENTRO L'APP (D1, D2): la segreteria vede solo "Il gestionale si usa dal computer",
  // il super tutor solo l'area tutor. Basta questo controllo, perché ogni pagina passa di
  // qui: anche "/" dove i middleware delle pagine rimandano chi non è a casa sua.
  // Cambia solo cosa si vede: le API restano protette dai ruoli come nel browser.
  if (useInApp()) {
    if (user.value.role === 'ADMIN' && to.path !== '/solo-computer') return navigateTo('/solo-computer')
    if (user.value.role === 'SUPER_TUTOR' && !PAGINE_SUPER_TUTOR_APP.includes(to.path)) return navigateTo('/area-tutor')
  }
})

// Le pagine dell'area tutor che funzionano anche per il super tutor. Mancano Card e
// Convenzioni: le loro API (/api/tutor/...) sono solo del TUTOR e il super tutor la card non ce l'ha.
const PAGINE_SUPER_TUTOR_APP = ['/area-tutor', '/area-tutor/profilo', '/area-tutor/disponibilita', '/area-tutor/note', '/tutor-calendario', '/stampe/tutor-lezioni']
