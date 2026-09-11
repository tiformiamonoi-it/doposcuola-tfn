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
  const whitelist = ['/login', '/cambio-password', '/imposta-password', '/portale/accetta-termini', '/termini', '/privacy', '/privacy-studente', '/cookie', '/prenota']
  if (whitelist.includes(to.path)) return

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
})
