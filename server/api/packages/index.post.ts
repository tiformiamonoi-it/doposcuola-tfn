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

  // Marca da bollo (F1) sull'acconto. La spunta viaggia dentro "pagamentoIniziale"
  // ma la leggiamo qui dal corpo grezzo, perché lo schema del pacchetto è in mano a
  // un altro intervento in corso e non va toccato adesso (vedi package.service.ts).
  // Solo un "false" esplicito toglie il bollo: se il campo non c'è, vale la regola
  // di legge (sopra 77,47 € con fattura il bollo è dovuto).
  const aggiungiBollo = body?.pagamentoIniziale?.aggiungiBollo !== false

  try {
    const pkg = await createPackage(parsed.data, { aggiungiBollo })
    setResponseStatus(event, 201)
    return { data: pkg }
  } catch (err: any) {
    if (err.statusCode) throw err
    const code = err.message?.includes('non trovato') ? 404 : 400
    throw toHttpError(err, code)
  }
})
