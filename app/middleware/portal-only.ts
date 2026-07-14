// Portale famiglie: GENITORE e STUDENTE (uso reale), ADMIN/SUPER_TUTOR (preview).
export default defineNuxtRouteMiddleware(async () => {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) {
    return await navigateTo('/login', { replace: true })
  }
  const allowed = ['GENITORE', 'STUDENTE', 'ADMIN', 'SUPER_TUTOR']
  if (!allowed.includes(user.value?.role ?? '')) {
    return await navigateTo(homeDiRuolo(user.value?.role), { replace: true })
  }
})
