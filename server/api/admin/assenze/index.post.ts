import { z } from 'zod'
import { segnalaAssenza } from '../../../services/assenze.service'
import { toHttpError } from '../../../utils/http-error'

// POST /api/admin/assenze — «la mamma ha chiamato».
//
// È la stessa assenza del portale, registrata da chi ha risposto al telefono.
// Cambia solo `origine`: 'GESTIONALE' invece di 'PORTALE'. Serve a leggere
// l'elenco della mattina con l'occhio giusto — «questa me l'ha detta al telefono
// Maria alle 8:10» è un'informazione diversa da «l'ha scritta il portale» — e a
// non far suonare il campanellino per un ritardo che sta già raccontando a voce
// la persona che il campanellino lo guarderebbe.
//
// Come nel portale, `origine` e CHI registra non arrivano dal browser.
const BodySchema = z.object({
  studentId: z.string().min(1),
  giorni:    z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida')).min(1).max(31),
  motivo:    z.string().max(200).optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  // Seconda chiusura, come in /api/admin/students/:id/consensi.
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato alla segreteria' })
  }

  const parsed = BodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message ?? 'Dati non validi' })
  }
  const { studentId, giorni, motivo } = parsed.data

  const esiti: Array<{ data: string; ok: boolean; creata?: boolean; errore?: string }> = []

  for (const giorno of [...new Set(giorni)].sort()) {
    try {
      const esito = await segnalaAssenza({
        studentId,
        data:    giorno,
        motivo:  motivo ?? undefined,
        userId:  user.id,
        origine: 'GESTIONALE',
      })
      esiti.push({ data: giorno, ok: true, creata: esito.creata })
    } catch (err: any) {
      esiti.push({ data: giorno, ok: false, errore: err?.message ?? 'Giorno non registrato' })
    }
  }

  const riusciti = esiti.filter((e) => e.ok)
  if (riusciti.length === 0) {
    throw toHttpError(new Error(esiti[0]?.errore ?? 'Non è stato possibile registrare l\'assenza'), 400)
  }

  return {
    ok: true as const,
    segnalate:     riusciti.length,
    giaPresenti:   riusciti.filter((e) => e.creata === false).length,
    nonRegistrate: esiti.filter((e) => !e.ok),
  }
})
