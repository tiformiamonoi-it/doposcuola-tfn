import { getPagamentiPortale } from '../../services/pagamenti-portale.service'
import { getLinkedStudentIds } from '../../utils/portal'

// GET /api/portal/pagamenti — quanto resta da saldare e i dati del bonifico.
// Solo GENITORE: allo STUDENTE (e all'admin in anteprima) la stessa risposta di
// "sezione chiusa", così da fuori non si distingue nemmeno se l'interruttore è acceso.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'GENITORE') return { attivi: false as const }

  return await getPagamentiPortale(await getLinkedStudentIds(user.id))
})
