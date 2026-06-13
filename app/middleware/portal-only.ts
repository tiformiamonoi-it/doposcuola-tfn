// Portale famiglie: accessibile a GENITORE (uso reale) e ADMIN/SUPER_TUTOR (preview).
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) return navigateTo('/login')
  const allowed = ['GENITORE', 'ADMIN', 'SUPER_TUTOR']
  if (!allowed.includes(user.value?.role ?? '')) return navigateTo('/')
})
