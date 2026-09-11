import { CollegaFiglioSchema } from '#shared/schemas/contact.schema'
import { collegaFiglio } from '../../../../services/contact.service'
import { toHttpError } from '../../../../utils/http-error'

// POST /api/contacts/:id/figli/collega  body { figlioId, studentId }
// "Crea studente" su UN figlio del contatto è andato a buon fine: quel figlio si
// collega allo studente appena creato e il contatto diventa "Convertito".
// figlioId null = il figlio "di prima" di un contatto vecchio (diventa una riga vera).
// Permessi: la regola '/api/contacts' della auth-policy (solo ADMIN e SUPER_TUTOR).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID contatto mancante' })

  const body = await readBody(event)
  const parsed = CollegaFiglioSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati del collegamento non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    // L'utente serve a firmare la conferma nei Rientri: il figlio diventa alunno
    return { data: await collegaFiglio(id, parsed.data, user.id) }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovat') ? 404 : 400)
  }
})
