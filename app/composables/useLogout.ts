// Uscita dal gestionale: usata dalla barra laterale/menu del telefono (layout)
// e dal bottone "Esci" nella pagina "Il mio profilo", così la logica è una sola.
export function useLogout() {
  const { clear } = useUserSession()
  const toast = useToast()
  const uscendo = ref(false)

  async function logout() {
    uscendo.value = true
    try {
      // Chiamata esplicita al backend per invalidare la sessione server-side
      await $fetch('/api/auth/logout', { method: 'POST' })
      await clear()
      await navigateTo('/login', { external: true })
    } catch {
      toast.add({ title: 'Errore durante il logout', color: 'error' })
    } finally {
      uscendo.value = false
    }
  }

  return { uscendo, logout }
}
