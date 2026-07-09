// Portale famiglie: accessibile a GENITORE (uso reale) e ADMIN/SUPER_TUTOR (preview).
export default defineNuxtRouteMiddleware(async () => {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) {
    return await navigateTo('/login', { replace: true })
  }
  const allowed = ['GENITORE', 'ADMIN', 'SUPER_TUTOR']
  if (!allowed.includes(user.value?.role ?? '')) {
    return await navigateTo('/', { replace: true })
  }
})
