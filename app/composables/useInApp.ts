// Siamo dentro l'app per telefono (il guscio in mobile/)? Il guscio aggiunge "tfn-app"
// al nome del browser (user agent). Serve SOLO a scegliere cosa mostrare: chiunque può
// scriversi quel nome nel browser, quindi non deve MAI aprire niente sul server (i
// permessi restano quelli di server/utils/auth-policy.ts, uguali dentro e fuori l'app).
// Il server lo legge dalla richiesta e lo salva in useState: il telefono, quando riprende
// la pagina, riusa la stessa risposta, così la pagina del server e quella del telefono
// combaciano (niente lampo dell'altra veste, niente "hydration mismatch").
export function useInApp(): boolean {
  return useState('in-app', () => {
    const ua = import.meta.server ? useRequestHeaders(['user-agent'])['user-agent'] : navigator.userAgent
    return /tfn-app/.test(ua ?? '')
  }).value
}

// Chi vede l'area tutor nella veste nuova: il TUTOR sempre, il SUPER_TUTOR solo
// dentro l'app (D2). Nel browser il super tutor resta sul gestionale di sempre.
export function useVesteTutor(): boolean {
  const { user } = useUserSession()
  return user.value?.role === 'TUTOR' || (user.value?.role === 'SUPER_TUTOR' && useInApp())
}
