// Verifica che l'utente sia autenticato (qualsiasi ruolo).
// Usare su tutte le pagine che richiedono login.
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
