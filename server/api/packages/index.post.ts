import { CreatePackageSchema } from '#shared/schemas/package.schema'
import { createPackage } from '../../services/package.service'
import { toHttpError } from '../../utils/http-error'

// POST /api/packages
// Crea un nuovo pacchetto per uno studente.
// Se viene inviato "pagamentoIniziale", registra anche il pagamento e il movimento contabile.
// Tutto in un'unica transazione atomica (nessun dato parziale in caso di errore).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const parsed = CreatePackageSchema.safeParse(body)

  if (!parsed.success) {
    console.error('Validation errors:', parsed.error.flatten().fieldErrors)
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati pacchetto non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    const pkg = await createPackage(parsed.data)
    setResponseStatus(event, 201)
    return { data: pkg }
  } catch (err: any) {
    if (err.statusCode) throw err
    const code = err.message?.includes('non trovato') ? 404 : 400
    throw toHttpError(err, code)
  }
})
