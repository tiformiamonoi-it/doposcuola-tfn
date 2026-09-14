import { runNoteDigest } from '../../services/note-digest.service'

// GET /api/_cron/note-digest — il riepilogo serale delle note (A3, decisione Q23).
//
// L'ORARIO E IL FUSO — la parte che si sbaglia sempre.
// In vercel.json il job è schedulato alle "0 18 * * *". I cron di Vercel vanno a
// ORA UTC, che non è la nostra: d'estate l'Italia è avanti di due ore (ora
// legale), d'inverno di una. Quindi le 18:00 UTC sono:
//   • le 20:00 italiane da fine marzo all'ultima domenica di ottobre — il periodo
//     scolastico da settembre a ottobre, ed è l'orario deciso (Q23);
//   • le 19:00 italiane dall'ultima domenica di ottobre in poi, quando torna
//     l'ora solare. Da novembre a marzo, quindi, il riepilogo parte un'ora PRIMA.
// Non è un problema, ed è voluto non inseguire il cambio d'ora con due job: una
// nota approvata dopo la partenza del riepilogo non si perde, entra in quello
// della sera dopo (il servizio guarda indietro di due giorni). Se un giorno
// Alessandro volesse le 20:00 spaccate anche d'inverno, si cambia lo schedule in
// "0 19 * * *" a fine ottobre e si rimette "0 18 * * *" a fine marzo.
//
// Il path /api/_* è pubblico nella auth-guard, quindi qui serve una protezione
// propria: Vercel invia automaticamente "Authorization: Bearer $CRON_SECRET"
// alle invocazioni cron. In sviluppo il controllo è disattivato, così la si può
// provare dal browser senza inventarsi header.
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    const secret = process.env.CRON_SECRET
    const auth = getHeader(event, 'authorization')
    if (!secret || auth !== `Bearer ${secret}`) {
      throw createError({ statusCode: 401, statusMessage: 'Non autorizzato' })
    }
  }

  const esito = await runNoteDigest()

  // Una riga nel log del server per ogni giro: quando una famiglia dice "non mi
  // è arrivato niente", questa riga dice se l'email era partita davvero.
  console.log('[note-digest]', JSON.stringify(esito))

  return esito
})
