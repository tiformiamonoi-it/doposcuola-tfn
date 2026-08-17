import { PayTutorSchema } from '#shared/schemas/tutor.schema'
import { payTutor } from '../../../services/tutor.service'
import { toHttpError } from '../../../utils/http-error'

export default defineEventHandler(async (event) => {
  const id     = getRouterParam(event, 'id')!
  const body   = await readBody(event)
  const parsed = PayTutorSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati liquidazione non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    // await obbligatorio: senza, l'errore sfugge al catch e il client riceve un 500 muto
    return await payTutor(id, parsed.data)
  } catch (err: any) {
    const code = err.message?.includes('identico') ? 409 : err.message?.includes('zero') ? 400 : 400
    throw toHttpError(err, code)
  }
})
