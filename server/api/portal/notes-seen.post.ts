import { markNotesSeen } from '../../services/portal.service'

// POST /api/portal/notes-seen — la famiglia ha aperto la pagina Note: azzera il badge.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') return { ok: true } // no-op per preview admin e account studente
  return await markNotesSeen(user.id)
})
