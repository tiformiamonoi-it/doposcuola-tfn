import { z } from 'zod'
import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm'
import { db } from '../../database/client'
import { emailLog } from '../../database/schema'
import { ETICHETTA_TIPO_EMAIL, type TipoEmail } from '#shared/email'

// GET /api/email-log — il registro delle email (Impostazioni → Email).
// Solo ADMIN (regola in server/utils/auth-policy.ts). Dal più recente, 50 alla volta.
const PER_PAGINA = 50

const tipi = Object.keys(ETICHETTA_TIPO_EMAIL) as [TipoEmail, ...TipoEmail[]]

const QuerySchema = z.object({
  tipo:   z.enum(tipi).optional(),
  esito:  z.enum(['INVIATA', 'NON_PARTITA', 'DISATTIVATA']).optional(),
  cerca:  z.string().trim().max(100).optional(),
  invio:  z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).max(10000).default(1),
})

// '%', '_' e '\' sono caratteri speciali di LIKE: vanno neutralizzati
function escapeLike(testo: string) {
  return testo.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export default defineEventHandler(async (event) => {
  // La policy blocca già gli altri ruoli: qui si ripete, come in test-email
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN') throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })

  const parsed = QuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Filtri del registro non validi' })
  }
  const q = parsed.data

  const filtri: Array<SQL | undefined> = []
  if (q.tipo)  filtri.push(eq(emailLog.tipo, q.tipo))
  if (q.esito) filtri.push(eq(emailLog.esito, q.esito))
  if (q.invio) filtri.push(eq(emailLog.invioId, q.invio))
  if (q.cerca) {
    const testo = `%${escapeLike(q.cerca)}%`
    filtri.push(or(ilike(emailLog.destinatario, testo), ilike(emailLog.nomeDestinatario, testo)))
  }

  // Uno in più del necessario: se arriva, esiste una pagina successiva
  // (più economico di un count(*) su un registro che cresce sempre).
  const righe = await db.select({
    id:               emailLog.id,
    createdAt:        emailLog.createdAt,
    tipo:             emailLog.tipo,
    destinatario:     emailLog.destinatario,
    nomeDestinatario: emailLog.nomeDestinatario,
    oggetto:          emailLog.oggetto,
    esito:            emailLog.esito,
    motivo:           emailLog.motivo,
    dettaglio:        emailLog.dettaglio,
  })
    .from(emailLog)
    .where(and(...filtri))
    .orderBy(desc(emailLog.createdAt))
    .limit(PER_PAGINA + 1)
    .offset((q.pagina - 1) * PER_PAGINA)

  return {
    righe:       righe.slice(0, PER_PAGINA),
    altrePagine: righe.length > PER_PAGINA,
  }
})
