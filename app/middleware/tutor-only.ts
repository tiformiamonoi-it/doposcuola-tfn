// Solo TUTOR — pagina personale del tutor (calendario lezioni, note).
// Dentro l'app anche il SUPER_TUTOR (D2): quali pagine, lo decide il gate globale.
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) return navigateTo('/login')
  if (!useVesteTutor()) return navigateTo(homeDiRuolo(user.value?.role))
})
