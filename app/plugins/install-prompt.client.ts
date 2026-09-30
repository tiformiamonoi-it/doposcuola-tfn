// Cattura l'invito di installazione della PWA (beforeinstallprompt) all'avvio dell'app.
// Chrome lo lancia UNA volta sola, presto, al primo caricamento completo (di solito /login):
// se lo ascoltasse solo InstallBanner (montato nel layout portale, raggiunto con navigazione
// client) andrebbe perso. Lo teniamo in useState: lato client non viene mai serializzato.
export default defineNuxtPlugin(() => {
  const prompt = useState<any>('installPrompt', () => null)
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault() // niente mini-infobar di Chrome: mostriamo noi il bottone
    prompt.value = markRaw(e) // oggetto nativo del browser: niente proxy reattivo
  })
  window.addEventListener('appinstalled', () => { prompt.value = null })
})
