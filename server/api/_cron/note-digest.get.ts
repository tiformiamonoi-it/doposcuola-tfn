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
// Quindi in vercel.json il job è schedulato DUE volte, "0 18,19 * * *": le 18:00 e
// le 19:00 UTC. Una delle due, a seconda del periodo dell'anno, sono le 20:00
// italiane; l'altra no. Ed è qui che si decide: si manda solo quando l'orologio
// ITALIANO segna le 20. L'altra chiamata si ferma sulla porta e non manda niente.
//
// Metafora: sono due sveglie, una per l'ora legale e una per quella solare. Suonano
// tutte e due, ma si alza solo quella che guarda l'orologio giusto. Nessuno deve
// ricordarsi di spostare le lancette a ottobre e a marzo.
//
// Per provarlo a mano fuori orario c'è ?forza=1 (serve comunque la parola d'ordine):
// senza, una prova fatta alle 10 del mattino sembrerebbe "non funziona".
//
// Il path /api/_* è pubblico nella auth-guard, quindi qui serve una protezione
// propria: Vercel invia automaticamente "Authorization: Bearer $CRON_SECRET" alle
// invocazioni cron. In sviluppo il controllo è disattivato, così la si può provare
// dal browser senza inventarsi header.
const ORA_INVIO = 20

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

  if (ora !== ORA_INVIO && !forzato) {
    // Non è un errore: è la sveglia sbagliata delle due. Si risponde e basta,
    // così nel registro di Vercel resta scritto che il giro è avvenuto.
    const saltato = { saltato: true, oraItaliana: ora, motivo: `Il riepilogo parte alle ${ORA_INVIO}:00 italiane` }
    console.log('[note-digest]', JSON.stringify(saltato))
    return saltato
  }

  const esito = await runNoteDigest()

  // Una riga nel log del server per ogni giro: quando una famiglia dice "non mi
  // è arrivato niente", questa riga dice se l'email era partita davvero.
  console.log('[note-digest]', JSON.stringify({ ...esito, oraItaliana: ora, forzato }))

  return esito
})
