import { countPendingNotes } from '../../services/note.service'

// GET /api/notes/pending-count — badge in nav per ADMIN/SUPER_TUTOR.
// Per gli altri ruoli risponde 0 (nessun errore: la nav lo chiama per tutti).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) return { count: 0 }
  return { count: await countPendingNotes() }
})
