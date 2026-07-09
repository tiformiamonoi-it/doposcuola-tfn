import { getPoolStudentiOggi } from '../../services/lesson.service'

// GET /api/tutors/today-pool
// Pool di studenti selezionabili da un tutor per registrare una lezione: tutte le materie
// prenotate per OGGI (qualunque tutor assegnato, o anche non assegnate), collegate a
// un'anagrafica studente reale. Ignora qualunque parametro: la data è sempre oggi,
// calcolata lato server (Europe/Rome).
export default defineEventHandler(async () => {
  return getPoolStudentiOggi()
})
