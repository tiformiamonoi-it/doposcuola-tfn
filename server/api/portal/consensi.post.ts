import { z } from 'zod'
import { impostaConsenso } from '../../services/consensi.service'
import { getPortalStudentIds } from '../../utils/portal'
import { toHttpError } from '../../utils/http-error'
import {
  CONSENSO_IMMAGINI_VERSION, CONSENSO_MARKETING_VERSION, CONSENSO_MINORE14_VERSION,
} from '#shared/legal'

// POST /api/portal/consensi — la famiglia mette o toglie una spunta.
//
// Tre cose NON arrivano dal browser, di proposito:
//  • `origine`, qui sempre 'PORTALE' (ed è ciò che fa suonare il campanellino in
//    segreteria: un cambiamento deciso dalla famiglia è una notizia);
//  • `attoreUserId` e il titolare del consenso, presi dalla SESSIONE: nessun
//    genitore può mettere o togliere una spunta a nome di un altro;
//  • la VERSIONE del testo, presa da shared/legal.ts: è la prova di che cosa la
//    persona aveva davanti quando ha risposto, e non può dirlo il browser.
const BodySchema = z.object({
  tipo:      z.enum(['MINORE_14', 'IMMAGINI', 'MARKETING']),
  studentId: z.string().min(1).optional(),
  valore:    z.boolean(),
})

const VERSIONE = {
  MINORE_14: CONSENSO_MINORE14_VERSION,
  IMMAGINI:  CONSENSO_IMMAGINI_VERSION,
  MARKETING: CONSENSO_MARKETING_VERSION,
} as const

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Questi consensi li dà il genitore' })
  }

  const parsed = BodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi' })
  }
  const { tipo, valore } = parsed.data

  try {
    if (tipo === 'MARKETING') {
      // Nessun figlio di mezzo: è una scelta della persona che è entrata
      return await impostaConsenso({
        tipo, valore,
        userId:        user.id,
        testoVersione: VERSIONE.MARKETING,
        origine:       'PORTALE',
        attoreUserId:  user.id,
      })
    }

    const studentId = parsed.data.studentId
    if (!studentId) {
      throw createError({ statusCode: 422, statusMessage: 'Manca l\'alunno a cui si riferisce il consenso' })
    }

    // Il figlio dev'essere davvero suo: senza questo controllo basterebbe
    // scrivere a mano l'identificativo di un altro alunno per firmare al posto
    // della sua famiglia. Gli id si rileggono dal database, non dalla sessione.
    const suoi = await getPortalStudentIds(user)
    if (!suoi.includes(studentId)) {
      throw createError({ statusCode: 403, statusMessage: 'Questo alunno non è collegato al tuo account' })
    }

    return await impostaConsenso({
      tipo, valore, studentId,
      userId:        user.id,
      testoVersione: VERSIONE[tipo],
      origine:       'PORTALE',
      attoreUserId:  user.id,
    })
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, 400)
  }
})
