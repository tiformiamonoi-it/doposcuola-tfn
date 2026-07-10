import { PublicContactSchema } from '#shared/schemas/contact.schema'
import { db } from '../../database/client'
import { contactRequests } from '../../database/schema'
import { rateLimitExceeded } from '../../utils/rate-limit'

// POST /api/contact
// Endpoint pubblico per la ricezione dei contatti dal form /prenota
export default defineEventHandler(async (event) => {
  // Anti-spam: max 3 invii ogni 10 minuti per IP
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'sconosciuto'
  if (rateLimitExceeded(`contact:${ip}`)) {
    throw createError({ statusCode: 429, statusMessage: 'Troppi invii: riprova tra qualche minuto' })
  }

  const body = await readBody(event)

  // Honeypot: campo invisibile agli umani — se è compilato è un bot (fingiamo successo)
  if (body?.sitoWeb) {
    setResponseStatus(event, 201)
    return { success: true }
  }

  const parsed = PublicContactSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati di contatto non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const { nomeStudente, classeScuola, materie, contatto, note } = parsed.data

  const messageStr = `Classe/Scuola: ${classeScuola || 'N/D'}\nMaterie: ${materie}\nNote: ${note || 'N/D'}`

  // Salva a DB
  const [newRequest] = await db.insert(contactRequests).values({
    name: nomeStudente,
    email: contatto, // Salviamo il recapito fornito qui, che sia email o telefono
    message: messageStr,
    status: 'PENDING',
  }).returning()

  // Se è necessario, qui si può integrare l'invio email tramite Resend/Postmark ecc.
  // ...

  setResponseStatus(event, 201)
  return { success: true, data: newRequest }
})
