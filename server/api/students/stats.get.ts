import { getStudentsStats } from '../../services/student.service'
import { isTutorRole } from '../../utils/package-privacy'

// GET /api/students/stats
// Conteggi per le tessere di riepilogo della pagina Studenti.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const stats = await getStudentsStats()

  // Il TUTOR non vede dati economici: niente conteggio "Da pagare"
  // (undefined non viene serializzato, il campo non arriva proprio)
  return isTutorRole(user.role) ? { ...stats, daPagare: undefined } : stats
})
