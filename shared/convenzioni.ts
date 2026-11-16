// LE CONVENZIONI (Impostazioni → Sconti) come le ricevono il portale e la pagina
// Impostazioni. Stanno nella tabella `convenzioni` (migrazione 0039); prima erano un
// JSON in system_configs. I campi facoltativi vuoti arrivano null e non si mostrano.
//
// La foto NON viaggia qui dentro: `foto` è l'indirizzo da cui scaricarla
// (/api/immagini/convenzioni/<id>), null se non c'è. Così un elenco lungo non si porta
// dietro tutte le foto. Vive in shared/ perché la stessa forma serve a server e browser.
export type Convenzione = {
  id: string
  nome: string
  descrizione: string
  foto: string | null
  categoria: string | null
  citta: string | null
  sconto: string | null        // l'etichetta corta, es. "−10%"
  indirizzo: string | null
  orari: string | null
  telefono: string | null
  validaFino: string | null    // giorno civile 'AAAA-MM-GG', l'ultimo giorno valido
}

// Ancora valida OGGI? Vale tutto il giorno scritto, come la scadenza dei pacchetti.
// `oggi` è il giorno civile italiano ('AAAA-MM-GG') di chi chiama: confronto fra stringhe.
export function convenzioneValida(c: { validaFino: string | null }, oggi: string): boolean {
  return !c.validaFino || c.validaFino >= oggi
}

// "Apri in Mappe": un collegamento di ricerca costruito dall'indirizzo. Nessuna chiave,
// nessun costo; sul telefono apre l'app delle mappe. La città aiuta quando l'indirizzo
// è solo "Via Roma 1".
export function linkMappe(c: { indirizzo: string | null; citta: string | null }): string | null {
  if (!c.indirizzo?.trim()) return null
  const dove = [c.indirizzo, c.citta].map((s) => s?.trim()).filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dove)}`
}
