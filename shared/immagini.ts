// LE FOTO CARICATE DALLA SEGRETERIA (convenzioni e comunicazioni), regole in un posto solo.
//
// Si salvano come "data URI" (il file dentro il testo, in base64) e si rimpiccioliscono
// nel BROWSER prima di partire (app/utils/immagini.ts): 1200 pixel sul lato lungo bastano
// allo schermo di un telefono ad alta densità (390 px × 2) e tengono leggero il database.
// Il server ricontrolla il peso, perché il browser non è un posto di cui fidarsi.

/** Il file scelto può arrivare fino a 10 MB: sono le foto del telefono, prima della riduzione. */
export const PESO_MAX_ORIGINALE = 10 * 1024 * 1024

/** Dopo la riduzione: una foto di 1200 px in JPEG sta ben sotto; oltre, non è stata ridotta. */
export const PESO_MAX_SALVATA = 400 * 1024

export const LATO_LUNGO_MAX = 1200

// Solo questi formati, e solo in base64. È anche una difesa: l'endpoint pubblico delle
// foto delle comunicazioni rimanda il tipo scritto qui, e "text/html" o "image/svg+xml"
// (che può contenere codice) non devono mai poter passare.
const FORMA_DATA_URI = /^data:(image\/(?:jpeg|png|webp));base64,[A-Za-z0-9+/]+=*$/

/** Il tipo (es. 'image/jpeg') se è una foto accettabile, altrimenti null. */
export function tipoDataUri(uri: string): string | null {
  return FORMA_DATA_URI.exec(uri)?.[1] ?? null
}

/** Byte veri della foto: il base64 ne usa 4 caratteri ogni 3. */
export function pesoDataUri(uri: string): number {
  return Math.floor((uri.length - uri.indexOf(',') - 1) * 3 / 4)
}

/** Messaggio da mostrare se la foto non va bene; null se va bene (o se non c'è). */
export function problemaImmagine(uri: string | null | undefined): string | null {
  if (!uri) return null
  if (!tipoDataUri(uri)) return 'la foto non è in un formato valido (serve JPG, PNG o WebP)'
  const kb = Math.round(pesoDataUri(uri) / 1024)
  if (kb > PESO_MAX_SALVATA / 1024) return `la foto pesa ${kb} KB, il massimo è ${PESO_MAX_SALVATA / 1024} KB: ricaricala dal modulo, viene ridotta da sola`
  return null
}
