import { PayReimbursementSchema } from '#shared/schemas/tutor.schema'
import { payReimbursement } from '../../../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  // Pagare un rimborso muove soldi: come per l'eliminazione, solo ADMIN/SUPER_TUTOR
  // (la policy di /api/tutors lo dice già, ma il controllo qui non dipende da come si scrive il percorso).
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Riservato ad ADMIN/SUPER_TUTOR' })
  }
  const rid    = getRouterParam(event, 'rid')!
  const body   = await readBody(event)
  const parsed = PayReimbursementSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati pagamento non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    return await payReimbursement(rid, parsed.data)
  } catch (err: any) {
    if (err.message === 'Rimborso non trovato') {
      throw createError({ statusCode: 404, statusMessage: 'Rimborso non trovato' })
    }
    throw err
  }
})
