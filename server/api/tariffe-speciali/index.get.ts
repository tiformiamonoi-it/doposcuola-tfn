import { TariffeSpecialiQuerySchema } from '#shared/schemas/tariffe-speciali.schema'
import { listTariffeSpeciali } from '../../services/tariffe-speciali.service'

// GET /api/tariffe-speciali?tutorId=…&studentId=…
// Le regole delle tariffe speciali (tutte, o solo quelle di un tutor / di un alunno).
// Solo ADMIN e SUPER_TUTOR (vedi auth-policy.ts).
export default defineEventHandler(async (event) => {
  const parsed = TariffeSpecialiQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Filtri non validi', data: { errors: parsed.error.flatten().fieldErrors } })
  }
  return { data: await listTariffeSpeciali(parsed.data) }
})
