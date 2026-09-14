import { runNoteDigest } from '../../services/note-digest.service'
import { oraRome } from '../../utils/tutor-time-window'

// GET /api/_cron/note-digest — il riepilogo serale delle note (A3, decisione Q23).
//
// L'ORARIO E IL FUSO — la parte che si sbaglia sempre, risolta una volta per tutte.
//
// I cron di Vercel vanno a ORA UTC, che non è la nostra: d'estate l'Italia è avanti
// di due ore (ora legale), d'inverno di una. Con un orario solo, il riepilogo che a
// settembre parte alle 20:00 italiane si ritroverebbe a partire alle 19:00 da fine
// ottobre, e nessuno se ne ricorderebbe fino a quando qualcuno non se ne accorge.
//
// In vercel.json il job è schedulato alle "0 18 * * *", cioè le 18:00 UTC: le 20:00
// italiane con l'ora legale, le 19:00 con quella solare. Da fine ottobre a fine
// marzo, quindi, il riepilogo parte un'ora prima del previsto. Non si perde niente:
// una nota approvata dopo la partenza entra nel riepilogo della sera dopo, perché il
// servizio guarda indietro due giorni.
//
// PERCHÉ NON DUE ORARI (che darebbero le 20:00 spaccate tutto l'anno): il piano
// gratuito di Vercel accetta un solo avvio al giorno per ogni job, e il doppio
// orario ha fatto FALLIRE la pubblicazione del 14/09/2026. Se un domani si passa a
// un piano superiore, basta rimettere "0 18,19 * * *" e stringere la guardia qui
// sotto alla sola ora 20.
//
// Per provarlo a mano fuori orario c'è ?forza=1 (serve comunque la parola d'ordine):
// senza, una prova fatta alle 10 del mattino sembrerebbe "non funziona".
//
// Il path /api/_* è pubblico nella auth-guard, quindi qui serve una protezione
// propria: Vercel invia automaticamente "Authorization: Bearer $CRON_SECRET" alle
// invocazioni cron. In sviluppo il controllo è disattivato, così la si può provare
// dal browser senza inventarsi header.
// Le due ore italiane in cui puo' cadere l'unica chiamata delle 18:00 UTC: le 20
// con l'ora legale, le 19 con quella solare. Si accettano tutte e due, altrimenti
// d'inverno la guardia bloccherebbe l'unica occasione e il riepilogo non partirebbe
// mai piu'. (Il doppio orario, che avrebbe dato le 20 spaccate tutto l'anno, il
// piano gratuito di Vercel non lo accetta: i job possono partire una volta al giorno.)
const ORE_INVIO_AMMESSE = [19, 20]

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    const secret = process.env.CRON_SECRET
    const auth = getHeader(event, 'authorization')
    if (!secret || auth !== `Bearer ${secret}`) {
      throw createError({ statusCode: 401, statusMessage: 'Non autorizzato' })
    }
  }

  const { ora } = oraRome()
  const forzato = getQuery(event).forza === '1'

  if (!ORE_INVIO_AMMESSE.includes(ora) && !forzato) {
    // Non è un errore: è una chiamata arrivata fuori orario (una prova, un
    // riavvio). Si risponde e basta, così nel registro di Vercel resta scritto
    // che il giro è avvenuto e non sembra un guasto.
    const saltato = { saltato: true, oraItaliana: ora, motivo: "Il riepilogo parte la sera, alle 20 (alle 19 con l'ora solare)" }
    console.log('[note-digest]', JSON.stringify(saltato))
    return saltato
  }

  const esito = await runNoteDigest()

  // Una riga nel log del server per ogni giro: quando una famiglia dice "non mi
  // è arrivato niente", questa riga dice se l'email era partita davvero.
  console.log('[note-digest]', JSON.stringify({ ...esito, oraItaliana: ora, forzato }))

  return esito
})
