// Solo ADMIN.
// Usare per operazioni distruttive: cancellazione note altrui, gestione system_configs, ecc.
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) return navigateTo('/login')
  if (user.value?.role !== 'ADMIN') return navigateTo(homeDiRuolo(user.value?.role))
})
