// Solo personale interno: ADMIN, SUPER_TUTOR, TUTOR.
// Blocca i GENITORE — usare su tutte le pagine del gestionale admin.
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) return navigateTo('/login')
  const allowed: string[] = ['ADMIN', 'SUPER_TUTOR', 'TUTOR']
  if (!allowed.includes(user.value?.role ?? '')) return navigateTo('/portale')
})
