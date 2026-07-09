import { UpgradePackageSchema } from '../../../../shared/schemas/package.schema'
import { getPackageById } from '../../../services/package.service'
import { db } from '../../../database/client'
import { packages, payments, accountingEntries, lessonStudents, lessons } from '../../../database/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { computePackageStates } from '../../../services/package.service'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID pacchetto mancante' })

  const existing = await getPackageById(id)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Pacchetto non trovato' })

  // Anche se CHIUSO, potrebbe essere modificato se si aggiungono ore.
  // Tuttavia, per ora consentiamo la modifica.

  try {
    const body = await readBody(event)
    const parsed = UpgradePackageSchema.safeParse(body)
    if (!parsed.success) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Dati non validi',
        data: { errors: parsed.error.flatten().fieldErrors },
      })
    }

    const data = parsed.data

    return await db.transaction(async (tx) => {
      const importoPagato = parseFloat(existing.importoPagato)

      // Validazione Prezzo Totale
      if (data.nuovoPrezzoTotale < importoPagato) {
        throw createError({
          statusCode: 400,
          statusMessage: `Il nuovo prezzo totale (€ ${data.nuovoPrezzoTotale}) non può essere inferiore all'importo già pagato (€ ${importoPagato})`,
        })
      }

      // Validazione Data Scadenza (Mai indietro rispetto all'ultima lezione)
      if (data.nuovaDataScadenza) {
        const lastLesson = await tx
          .select({ data: lessons.data })
          .from(lessonStudents)
          .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
          .where(eq(lessonStudents.packageId, id))
          .orderBy(desc(lessons.data))
          .limit(1)

        const [lastLessonRow] = lastLesson
        if (lastLessonRow) {
          const lastLessonDate = new Date(lastLessonRow.data)
          const newScadenza = new Date(data.nuovaDataScadenza)
          lastLessonDate.setHours(0, 0, 0, 0)
          newScadenza.setHours(0, 0, 0, 0)
          
          if (newScadenza < lastLessonDate) {
            throw createError({
              statusCode: 400,
              statusMessage: `La scadenza non può essere precedente all'ultima lezione svolta (${lastLessonDate.toLocaleDateString('it-IT')}).`,
            })
          }
        }
      }

      // Validazione Sovrapposizione MENSILI (solo se stiamo estendendo la data)
      if (existing.tipo === 'MENSILE' && data.nuovaDataScadenza) {
        const newScadenza = new Date(data.nuovaDataScadenza)
        const oldScadenza = existing.dataScadenza ? new Date(existing.dataScadenza) : new Date(existing.dataInizio)

        if (newScadenza > oldScadenza) {
          const newScadenzaStr = newScadenza.toISOString()
          const overlapping = await tx.select({ nome: packages.nome })
            .from(packages)
            .where(
              and(
                eq(packages.studentId, existing.studentId),
                eq(packages.tipo, 'MENSILE'),
                sql`${packages.id} != ${id}`,
                sql`${packages.dataInizio} < ${newScadenzaStr}::timestamp`,
                sql`${packages.dataScadenza} > ${oldScadenza.toISOString()}::timestamp`
              )
            ).limit(1)

          const [firstOverlap] = overlapping
          if (firstOverlap) {
            throw createError({
              statusCode: 409,
              statusMessage: `La nuova scadenza si sovrappone a un altro pacchetto MENSILE già presente ("${firstOverlap.nome}"). Verifica le date degli altri pacchetti.`,
            })
          }
        }
      }

      // Calcolo nuove ore/giorni
      let diffOre = data.nuoveOreAcquistate !== undefined ? data.nuoveOreAcquistate - parseFloat(existing.oreAcquistate) : 0
      const diffGiorni = data.nuoviGiorniAcquistati !== undefined ? data.nuoviGiorniAcquistati - (existing.giorniAcquistati ?? 0) : 0

      // MENSILE: il modal invia solo i giorni, ma le lezioni scalano SEMPRE le ore.
      // Senza questo, i giorni aggiunti restano inutilizzabili (createLesson blocca su oreResiduo).
      if (existing.tipo === 'MENSILE' && diffGiorni !== 0 && data.nuoveOreAcquistate === undefined) {
        const giorniEsistenti = Number(existing.giorniAcquistati ?? 0)
        const orePerGiorno = Number(existing.orarioGiornaliero ?? 0)
          || (giorniEsistenti > 0 ? parseFloat(existing.oreAcquistate) / giorniEsistenti : 0)
        diffOre = diffGiorni * orePerGiorno
      }

      const nuovaOreAcquistate = parseFloat(existing.oreAcquistate) + diffOre

      // Calcolo nuovi importi
      const importoIntegrazione = data.pagamentoIntegrazione?.importo ?? 0
      const nuovoImportoPagato = importoPagato + importoIntegrazione
      const nuovoImportoResiduo = Math.max(0, data.nuovoPrezzoTotale - nuovoImportoPagato)

      const nuovaOreResiduo = parseFloat(existing.oreResiduo) + diffOre
      const nuoviGiorniResiduo = (existing.giorniResiduo ?? 0) + diffGiorni

      if (nuovaOreResiduo < 0) {
        throw createError({ statusCode: 400, statusMessage: 'Le ore residue non possono diventare negative' })
      }

      // Registra Pagamento Contestuale
      let paymentId: string | null = null
      if (data.pagamentoIntegrazione && importoIntegrazione > 0) {
        const pag = data.pagamentoIntegrazione

        let calcTipo = 'ACCONTO'
        const isFull = nuovoImportoResiduo <= 0.01
        const wasFullyPaid = existing.stati.includes('PAGATO') || importoPagato >= parseFloat(existing.prezzoTotale)

        if (isFull) {
          calcTipo = 'SALDO'
        } else if (importoPagato === 0) {
          calcTipo = 'ACCONTO'
        } else if (wasFullyPaid) {
          calcTipo = 'INTEGRAZIONE'
        } else {
          calcTipo = 'RATA'
        }

        const [payment] = await tx.insert(payments).values({
          packageId: id as string,
          importo: String(pag.importo),
          tipoPagamento: calcTipo as 'ACCONTO' | 'SALDO' | 'RATA' | 'INTEGRAZIONE',
          metodoPagamento: pag.metodoPagamento as 'CONTANTI' | 'BONIFICO' | 'POS' | 'ASSEGNO',
          richiedeFattura: pag.richiedeFattura ?? false,
          dataPagamento: pag.dataPagamento ?? new Date(),
          riferimento: pag.riferimento ?? null,
          note: pag.note ?? null,
        }).returning()

        paymentId = payment!.id

        await tx.insert(accountingEntries).values({
          tipo: 'ENTRATA',
          importo: String(pag.importo),
          descrizione: `Integrazione pacchetto: ${existing.nome}`,
          categoria: 'pacchetti',
          packageId: id as string,
          paymentId: paymentId,
          metodoPagamento: pag.metodoPagamento as 'CONTANTI' | 'BONIFICO' | 'POS' | 'ASSEGNO',
          data: pag.dataPagamento ?? new Date(),
        })
      }

      // Ricalcola gli stati
      const nuoviStati = computePackageStates({
        oreAcquistate: String(nuovaOreAcquistate),
        oreResiduo: String(nuovaOreResiduo),
        importoResiduo: String(nuovoImportoResiduo),
        dataScadenza: data.nuovaDataScadenza !== undefined ? data.nuovaDataScadenza : existing.dataScadenza,
        giorniResiduo: existing.tipo === 'MENSILE' ? nuoviGiorniResiduo : null,
        sospeso: existing.sospeso,
      })

      // Aggiorna il pacchetto
      const [updated] = await tx.update(packages).set({
        oreAcquistate: String(nuovaOreAcquistate),
        oreResiduo: String(nuovaOreResiduo),
        giorniAcquistati: data.nuoviGiorniAcquistati,
        giorniResiduo: existing.tipo === 'MENSILE' ? nuoviGiorniResiduo : null,
        dataScadenza: data.nuovaDataScadenza !== undefined ? data.nuovaDataScadenza : existing.dataScadenza,
        prezzoTotale: String(data.nuovoPrezzoTotale),
        importoPagato: String(nuovoImportoPagato),
        importoResiduo: String(nuovoImportoResiduo),
        stati: nuoviStati,
        updatedAt: new Date(),
      }).where(eq(packages.id, id)).returning()

      return { data: updated }
    })
  } catch (err: any) {
    // I dettagli interni (stack, messaggi driver) restano nei log server, mai nella risposta
    console.error('ERRORE UPGRADE PACCHETTO:', err)
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || 'Errore interno del server',
    })
  }
})
