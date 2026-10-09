import { markNotesSeen } from '../../services/portal.service'
import { segnaComunicazioniLette } from '../../services/comunicazioni.service'

// POST /api/portal/notes-seen — la famiglia ha aperto la pagina Comunicazioni: azzera il badge.
// Vale per le note sui figli e per gli avvisi della segreteria a tutte le famiglie,
// che stanno nella stessa pagina.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') return { ok: true } // no-op per preview admin e account studente
  await segnaComunicazioniLette(user.id)
  return await markNotesSeen(user.id)
})
