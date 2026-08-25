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
  const whitelist = ['/login', '/cambio-password', '/portale/accetta-termini', '/termini', '/privacy', '/privacy-studente', '/cookie', '/prenota']
  if (whitelist.includes(to.path)) return

  if (user.value.mustChangePassword) {
    return navigateTo('/cambio-password')
  }
  if (['GENITORE', 'STUDENTE'].includes(user.value.role) && user.value.termsAccepted === false) {
    return navigateTo('/portale/accetta-termini')
  }
})
