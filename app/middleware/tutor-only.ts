// Solo TUTOR — pagina personale del tutor (calendario lezioni, note).
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) return navigateTo('/login')
  if (user.value?.role !== 'TUTOR') return navigateTo('/')
})
