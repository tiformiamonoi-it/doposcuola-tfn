import { PublicContactSchema } from '#shared/schemas/contact.schema'
import { db } from '../../database/client'
import { contactRequests } from '../../database/schema'

// POST /api/contact
// Endpoint pubblico per la ricezione dei contatti dal form /prenota
export default defineEventHandler(async (event) => {
  // Limita le richieste per IP (Rate limiting basilare) per evitare spam
  // In un ambiente reale si potrebbe usare un modulo rate-limit
  
  const body = await readBody(event)
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
