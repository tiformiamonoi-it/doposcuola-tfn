import { UpdatePackageSchema } from '../../../shared/schemas/package.schema'
import { getPackageById, updatePackage } from '../../services/package.service'

// PUT /api/packages/:id
// Aggiorna un pacchetto e ricalcola automaticamente gli stati (macchina a stati).
// Restituisce 409 se il pacchetto è CHIUSO (stato finale non modificabile).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID pacchetto mancante' })
  }

  const existing = await getPackageById(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Pacchetto non trovato' })
  }

  if (existing.stati.includes('CHIUSO')) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Impossibile modificare un pacchetto CHIUSO',
    })
  }

  const body = await readBody(event)
  const parsed = UpdatePackageSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati aggiornamento non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    const updated = await updatePackage(id, parsed.data)
    return { data: updated }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore durante l\'aggiornamento'
    throw createError({ statusCode: 400, statusMessage: message })
  }
})
