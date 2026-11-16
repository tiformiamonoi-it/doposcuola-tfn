import type { H3Event } from 'h3'
import { tipoDataUri } from '#shared/immagini'

// Risponde con una foto salvata come data URI (comunicazioni, convenzioni, prova).
// Sono indirizzi PUBBLICI (le email li aprono senza sessione, vedi PUBLIC_API_PREFIXES):
// esce solo la foto, nient'altro. Il tipo si rimanda solo se è una foto accettata
// (JPG, PNG, WebP): mai HTML o SVG, che potrebbero contenere codice. 404 se manca.
// Cache di un'ora: abbastanza per non rileggere il database a ogni apertura, abbastanza
// poco perché una foto tolta (comunicazione eliminata, convenzione cancellata) sparisca in fretta.
export function rispondiConImmagine(event: H3Event, uri: string | null | undefined) {
  const tipo = uri ? tipoDataUri(uri) : null
  if (!uri || !tipo) throw createError({ statusCode: 404, statusMessage: 'Immagine non trovata' })
  setResponseHeaders(event, {
    'Content-Type': tipo,
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  })
  return Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64')
}
