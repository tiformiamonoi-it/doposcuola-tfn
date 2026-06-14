// Solo ADMIN e SUPER_TUTOR.
// Usare per operazioni avanzate: gestione utenti, visualizzazione contabilità, ecc.
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) return navigateTo('/login')
  const allowed: string[] = ['ADMIN', 'SUPER_TUTOR']
  if (!allowed.includes(user.value?.role ?? '')) return navigateTo('/')
})
