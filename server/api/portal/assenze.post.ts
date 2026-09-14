import { z } from 'zod'
import { segnalaAssenza } from '../../services/assenze.service'
import { getPortalStudentIds } from '../../utils/portal'
import { toHttpError } from '../../utils/http-error'

// POST /api/portal/assenze — la famiglia avvisa che l'alunno non verrà.
//
// CHI PUÒ FARLO: il GENITORE e lo STUDENTE. Il contratto è con la famiglia, ma
// l'account dello studente esiste proprio per il ragazzo che si organizza da solo
// (oggi lo usa già per prenotare), e un'assenza non è un atto legale come un
// consenso: è un'informazione. Chi l'ha scritta resta scritto nella riga
// (`segnalataDaUserId`), quindi la segreteria vede sempre se ha avvisato la
// mamma o Luca. E il genitore vede — e può disdire — anche gli avvisi del figlio.
//
// SI POSSONO INDICARE PIÙ GIORNI IN UNA VOLTA: «la settimana prossima è in gita
// da lunedì a mercoledì» è una frase sola, non tre.
//
// Due cose NON arrivano dal browser, di proposito:
//  • `origine`, qui sempre 'PORTALE';
//  • CHI segnala, preso dalla SESSIONE.
const BodySchema = z.object({
  studentId: z.string().min(1),
  // 'AAAA-MM-GG'. Il tetto di 31 non è un limite di prodotto: è per non far
  // scrivere mille righe con una richiesta sola.
  giorni:    z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida')).min(1).max(31),
  motivo:    z.string().max(200).optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['GENITORE', 'STUDENTE'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato a genitori e studenti' })
  }

  const parsed = BodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message ?? 'Dati non validi' })
  }
  const { studentId, giorni, motivo } = parsed.data

  // L'alunno dev'essere davvero suo. Senza questo controllo basterebbe scrivere a
  // mano l'identificativo di un altro ragazzo per farlo risultare assente: gli id
  // si rileggono dal database, mai dalla sessione e mai dal browser.
  const suoi = await getPortalStudentIds(user)
  if (!suoi.includes(studentId)) {
    throw createError({ statusCode: 403, statusMessage: 'Questo alunno non è collegato al tuo account' })
  }

  // I giorni si segnalano uno per uno, in ordine, e i doppioni della stessa
  // richiesta si tolgono prima: l'elenco arriva da una griglia di caselle, ma
  // niente vieta a una richiesta scritta a mano di ripetere due volte lo stesso giorno.
  const esiti: Array<{ data: string; ok: boolean; creata?: boolean; oltreIlTermine?: boolean; errore?: string }> = []

  for (const giorno of [...new Set(giorni)].sort()) {
    try {
      const esito = await segnalaAssenza({
        studentId,
        data:    giorno,
        motivo:  motivo ?? undefined,
        userId:  user.id,
        origine: 'PORTALE',
      })
      esiti.push({ data: giorno, ok: true, creata: esito.creata, oltreIlTermine: esito.oltreIlTermine })
    } catch (err: any) {
      // Un giorno rifiutato (per esempio uno già passato) NON deve buttare via gli
      // altri: la famiglia ha scelto tre date e due erano buone. Si risponde con
      // l'esito di ciascuna e la pagina spiega quali sono andate a buon fine.
      esiti.push({ data: giorno, ok: false, errore: err?.message ?? 'Non è stato possibile segnalare questo giorno' })
    }
  }

  const riusciti = esiti.filter((e) => e.ok)
  if (riusciti.length === 0) {
    // Nessuna data buona: è un errore vero, e il messaggio è quello della prima.
    throw toHttpError(new Error(esiti[0]?.errore ?? 'Non è stato possibile segnalare l\'assenza'), 400)
  }

  return {
    ok: true as const,
    segnalate:      riusciti.length,
    inRitardo:      riusciti.filter((e) => e.oltreIlTermine).length,
    giaPresenti:    riusciti.filter((e) => e.creata === false).length,
    nonRegistrate:  esiti.filter((e) => !e.ok),
  }
})
