import { z } from 'zod'
import { cercaAlunniSimili } from '../../../services/doppioni.service'
import { toHttpError } from '../../../utils/http-error'

// GET /api/admin/students/possibili-doppioni?firstName=Luca&lastName=Rossi&telefono=333…&email=…
// "Questo ragazzo è già in archivio?" (D3): lo chiede il wizard Nuovo Studente
// prima di creare davvero, e risponde con gli alunni che gli somigliano e il
// perché di ciascuno. Non decide niente e non scrive niente: la scelta (collegare,
// creare comunque, annullare) resta alla segreteria.
//
// Sotto /api/admin apposta: la risposta contiene telefoni ed email delle famiglie,
// che sono dati della segreteria (/api/students in lettura è aperto anche ai tutor).
const QuerySchema = z.object({
  firstName: z.string().max(100).optional().default(''),
  lastName:  z.string().max(100).optional().default(''),
  telefono:  z.string().max(30).optional().default(''),
  email:     z.string().max(200).optional().default(''),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  // Doppia chiusura: la policy di /api/admin lo fa già, ma se un giorno cambiasse
  // questi recapiti non devono diventare visibili ai tutor per effetto collaterale.
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const parsed = QuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Ricerca non valida' })
  }

  try {
    // Se non arriva né un nome completo né un recapito il servizio risponde con
    // un elenco vuoto senza interrogare il database: nessuna ricerca a vuoto.
    return await cercaAlunniSimili({
      firstName: parsed.data.firstName,
      lastName:  parsed.data.lastName,
      telefoni:  [parsed.data.telefono],
      emails:    [parsed.data.email],
    })
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
