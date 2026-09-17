import { RispostaFamigliaSchema } from '#shared/schemas/confirmation.schema'
import { rispondiRientroDalPortale } from '../../services/confirmation.service'
import { getLinkedStudentIds } from '../../utils/portal'
import { toHttpError } from '../../utils/http-error'

// POST /api/portal/rientri — il genitore risponde «torna / non lo so ancora / non torna».
//
// Due cose NON arrivano dal browser, di proposito:
//  • CHI risponde, preso dalla SESSIONE: resta scritto nel quaderno, ed è ciò che
//    fa comparire «dal portale» nella pagina Rientri;
//  • l'ANNO, sempre quello corrente delle impostazioni.
// Le regole (interruttore acceso, alunno attivo, risposta non già segnata dalla
// segreteria) stanno nel service.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Questa risposta la dà il genitore' })
  }

  const parsed = RispostaFamigliaSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message ?? 'Dati non validi' })
  }
  const { studentId, stato, nota } = parsed.data

  // Il figlio dev'essere davvero suo: senza questo controllo basterebbe scrivere
  // a mano l'identificativo di un altro alunno per rispondere al posto della sua
  // famiglia. Gli id si rileggono dal database, non dalla sessione.
  const suoi = await getLinkedStudentIds(user.id)
  if (!suoi.includes(studentId)) {
    throw createError({ statusCode: 403, statusMessage: 'Questo alunno non è collegato al tuo account' })
  }

  try {
    return {
      data: await rispondiRientroDalPortale({
        studentId, stato, nota,
        genitore: { id: user.id, firstName: user.firstName, lastName: user.lastName },
      }),
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovat') ? 404 : 400)
  }
})
