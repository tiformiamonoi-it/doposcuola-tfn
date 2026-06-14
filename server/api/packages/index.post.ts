import { CreatePackageSchema } from '../../../shared/schemas/package.schema'
import { createPackage } from '../../services/package.service'

// POST /api/packages
// Crea un nuovo pacchetto per uno studente.
// Se viene inviato "pagamentoIniziale", registra anche il pagamento e il movimento contabile.
// Tutto in un'unica transazione atomica (nessun dato parziale in caso di errore).
export default defineEventHandler(async (event) => {
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

  const pkg = await createPackage(parsed.data)

  setResponseStatus(event, 201)
  return { data: pkg }
})
