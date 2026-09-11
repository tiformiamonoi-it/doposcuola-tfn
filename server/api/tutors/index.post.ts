import { CreateTutorSchema } from '#shared/schemas/tutor.schema'
import { createTutor } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = CreateTutorSchema.safeParse(body)

  if (!parsed.success) {
    console.error('[Tutor Create] Validation Error:', parsed.error.flatten().fieldErrors)
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const { user } = await requireUserSession(event)
  const targetRole = parsed.data.role ?? 'TUTOR'

  // Solo l'ADMIN può creare account con ruoli elevati
  if (targetRole !== 'TUTOR' && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Solo l\'Admin può creare account Super Tutor o Admin' })
  }

  try {
    // `await` indispensabile: senza, l'errore arriverebbe DOPO l'uscita dal try e
    // "Email già in uso" non comparirebbe mai (capita col "Crea tutor" dai Contatti,
    // quando il candidato ha già un account da genitore).
    return await createTutor(parsed.data)
  } catch (err: any) {
    // Il driver mette il codice Postgres a volte sull'errore, a volte in err.cause
    const codice = err?.code ?? err?.cause?.code
    if (codice === '23505' || err.message?.includes('unique')) {
      throw createError({ statusCode: 409, statusMessage: 'Email già in uso' })
    }
    throw err
  }
})
