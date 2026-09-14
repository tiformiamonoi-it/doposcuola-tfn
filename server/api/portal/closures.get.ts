import { db } from '../../database/client'
import { closureDates } from '../../database/schema'
import { desc, gte } from 'drizzle-orm'

// GET /api/portal/closures — i giorni in cui il centro è chiuso, da oggi in poi.
//
// Serve al calendario della prenotazione (e a quello delle assenze) per
// sbiadire le date in cui non si può venire. Fino a ieri rispondeva SOLO ai
// genitori: il ragazzo che entrava col proprio account vedeva tutti i giorni
// selezionabili, sceglieva un giorno di chiusura e scopriva che era chiuso solo
// dopo aver inviato la richiesta, con un errore in faccia.
//
// Chi può leggerlo: GENITORE e STUDENTE, cioè le stesse persone che possono
// prenotare (vedi bookings.post.ts: per un account studente l'autorizzazione a
// prenotare è l'account stesso). Non è un'informazione riservata — è il
// calendario del centro, non il dato di una famiglia — ma il permesso resta
// quello e basta: agli altri ruoli si risponde con un elenco vuoto, come fanno
// gli altri endpoint del portale (students.get.ts, bookings.get.ts). I TUTOR
// sono già fuori prima di arrivare qui, per la policy di /api/portal.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  // ADMIN/SUPER_TUTOR che guardano il portale in anteprima: nessuna famiglia
  // collegata, quindi nessun calendario da riempire.
  if (!['GENITORE', 'STUDENTE'].includes(user.role)) return []

  // Prendi solo le date di chiusura da oggi in poi (giorno civile italiano)
  const today = oggiRomeStr()

  return await db
    .select()
    .from(closureDates)
    .where(gte(closureDates.date, today))
    .orderBy(desc(closureDates.date))
})
