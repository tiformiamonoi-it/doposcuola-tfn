import { DisattivaNonRientratiSchema } from '#shared/schemas/confirmation.schema'
import { disattivaNonRientrati, getAnnoCorrente } from '../../services/confirmation.service'
import { toHttpError } from '../../utils/http-error'

// POST /api/confirmations/disattiva-non-rientrati
// Fine appello: chi ha detto "non torna" esce dagli alunni attivi. Non tocca
// nient'altro (pacchetti, utenti e storici restano) ed è sempre reversibile
// dalla scheda dell'alunno.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  // Il corpo può anche essere vuoto: allora vale l'anno corrente
  const body = await readBody(event).catch(() => ({}))
  const parsed = DisattivaNonRientratiSchema.safeParse(body ?? {})
  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Anno scolastico non valido',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    const anno = parsed.data.anno ?? (await getAnnoCorrente()).anno
    return await disattivaNonRientrati(anno)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
