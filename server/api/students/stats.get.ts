import { getStudentsStats } from '../../services/student.service'

// GET /api/students/stats
// Conteggi per le tessere di riepilogo della pagina Studenti.
export default defineEventHandler(async () => {
  return getStudentsStats()
})
