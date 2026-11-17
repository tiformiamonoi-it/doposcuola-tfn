import type { CapacitorConfig } from '@capacitor/cli'

// Indirizzo che l'app apre. Di serie è il sito vero, sul NOSTRO dominio (mai *.vercel.app):
// così un domani si può cambiare casa (VPS) senza ripubblicare l'app.
// TFN_SERVER_URL serve solo per le prove: es. http://10.0.2.2:3000/login, che dall'emulatore
// Android raggiunge il server di sviluppo acceso sul PC.
const override = process.env.TFN_SERVER_URL
const serverUrl = override || 'https://app.tiformiamonoi.it/login'

const config: CapacitorConfig = {
  appId: 'it.tiformiamonoi.app',
  appName: 'tiformiamonoi.it',
  webDir: 'www',
  // Firma aggiunta al "nome del browser": il sito la cerca per capire che è dentro l'app.
  // Non cambiarla senza cambiare anche il sito.
  appendUserAgent: 'tfn-app',
  server: {
    url: serverUrl,
    // Il traffico non cifrato (http) resta spento nell'app vera: si accende solo
    // quando si punta a un server di prova in http.
    cleartext: !!override && override.startsWith('http:'),
    // Pagina locale mostrata quando il sito non si carica (niente internet).
    // Le passiamo l'indirizzo a cui tornare con "Riprova": la pagina offline vive
    // su un indirizzo interno dell'app e da sola non saprebbe dove tornare.
    errorPath: `offline.html?torna=${serverUrl}`,
  },
  plugins: {
    // Android 15+ disegna l'app sotto le barre di sistema. Il sito non ha margini per
    // la tacca, quindi lasciamo a Capacitor il compito di spostare la pagina fra le
    // due barre (comportamento di serie). 'DARK' = icone chiare, adatte alla barra blu.
    SystemBars: {
      style: 'DARK',
    },
  },
}

export default config
