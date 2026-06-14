import { db } from '../database/client'
import { accountingEntries, packages, payments } from '../database/schema'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { computePackageStates } from './package.service'
import type { CreatePaymentInput, PaymentQuery } from '../../shared/schemas/payment.schema'

// ─────────────────────────────────────────────
// CREATE — POST /api/payments
// Transazione atomica: pagamento + aggiornamento pacchetto + stati + contabilità
//
// MAPPATURA CAMPO (ADL-008 Opzione A):
//   data.fatturaRichiesta  →  payments.richiedeFattura  (nome colonna DB)
//   fatturaEmessa          →  accounting_entries.fatturaEmessa (non in payments)
// ─────────────────────────────────────────────

export async function createPayment(data: CreatePaymentInput) {
  return await db.transaction(async (tx) => {
    // Carica il pacchetto e verifica che sia modificabile
    const [pkg] = await tx
      .select()
      .from(packages)
      .where(eq(packages.id, data.packageId))
      .limit(1)

    if (!pkg) throw new Error('Pacchetto non trovato')
    if (pkg.stati.includes('CHIUSO')) {
      throw new Error('Impossibile aggiungere un pagamento a un pacchetto CHIUSO')
    }

    // Verifica che il pagamento non superi l'importo residuo
    const residuo = parseFloat(pkg.importoResiduo)
    if (data.importo > residuo + 0.01) {
      throw new Error(
        `Il pagamento (€ ${data.importo.toFixed(2)}) supera l'importo residuo del pacchetto (€ ${residuo.toFixed(2)})`
      )
    }

    // Inserisce il pagamento
    // fatturaRichiesta (schema) → richiedeFattura (DB)
    const [payment] = await tx
      .insert(payments)
      .values({
        packageId:       data.packageId,
        importo:         String(data.importo),
        tipoPagamento:   data.tipoPagamento,
        metodoPagamento: data.metodoPagamento,
        richiedeFattura: data.fatturaRichiesta,
        dataPagamento:   data.dataPagamento,
        riferimento:     data.riferimento ?? null,
        note:            data.note ?? null,
      })
      .returning()

    // Aggiorna i totali del pacchetto atomicamente (previene race conditions)
    await tx
      .update(packages)
      .set({
        importoPagato:  sql`${packages.importoPagato} + ${String(data.importo)}`,
        importoResiduo: sql`GREATEST(0, ${packages.importoResiduo} - ${String(data.importo)})`,
        updatedAt:      new Date(),
      })
      .where(eq(packages.id, data.packageId))

    // Ricalcola stati del pacchetto (legge i valori aggiornati dentro la transazione)
    const [updatedPkg] = await tx
      .select()
      .from(packages)
      .where(eq(packages.id, data.packageId))
      .limit(1)

    if (updatedPkg) {
      const newStati = computePackageStates({
        oreAcquistate:  updatedPkg.oreAcquistate,
        oreResiduo:     updatedPkg.oreResiduo,
        importoResiduo: updatedPkg.importoResiduo,
        dataScadenza:   updatedPkg.dataScadenza,
      })
      await tx
        .update(packages)
        .set({ stati: newStati, updatedAt: new Date() })
        .where(eq(packages.id, data.packageId))
    }

    // Crea il movimento contabile ENTRATA (fatturaEmessa inizialmente false)
    const [entry] = await tx
      .insert(accountingEntries)
      .values({
        tipo:            'ENTRATA',
        importo:         String(data.importo),
        descrizione:     `Pagamento ${data.tipoPagamento} — ${pkg.nome}`,
        categoria:       'pacchetti',
        packageId:       data.packageId,
        paymentId:       payment!.id,
        metodoPagamento: data.metodoPagamento,
        fatturaEmessa:   false,
      })
      .returning()

    return { payment, entry }
  })
}

// ─────────────────────────────────────────────
// TOGGLE INVOICE STATUS — PUT /api/payments/:id/invoice
// Segna se la fattura è stata emessa o no.
// Aggiorna accounting_entries.fatturaEmessa (non la tabella payments).
// Questo è il progetto "Penna Indelebile": i pagamenti non si modificano,
// si aggiorna solo il movimento contabile collegato.
// ─────────────────────────────────────────────

export async function toggleInvoiceStatus(paymentId: string, fatturaEmessa: boolean) {
  // Trova il movimento contabile collegato a questo pagamento (relazione 1:1)
  const [entry] = await db
    .select()
    .from(accountingEntries)
    .where(eq(accountingEntries.paymentId, paymentId))
    .limit(1)

  if (!entry) return null

  const [updated] = await db
    .update(accountingEntries)
    .set({ fatturaEmessa, updatedAt: new Date() })
    .where(eq(accountingEntries.id, entry.id))
    .returning()

  return updated ?? null
}

// ─────────────────────────────────────────────
// LIST — GET /api/payments (uso futuro)
// ─────────────────────────────────────────────

export async function listPayments(query: PaymentQuery) {
  const conditions: ReturnType<typeof eq>[] = []

  if (query.packageId) {
    conditions.push(eq(payments.packageId, query.packageId) as any)
  }
  if (query.metodoPagamento) {
    conditions.push(eq(payments.metodoPagamento, query.metodoPagamento) as any)
  }
  if (query.fatturaRichiesta !== undefined) {
    const valore = query.fatturaRichiesta === 'true'
    conditions.push(eq(payments.richiedeFattura, valore) as any)
  }

  const where = conditions.length > 0
    ? and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]))
    : undefined

  const [rows, [countRow]] = await Promise.all([
    db
      .select()
      .from(payments)
      .where(where)
      .orderBy(desc(payments.dataPagamento))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit),
    db.select({ total: count() }).from(payments).where(where),
  ])

  return {
    data: rows,
    meta: {
      page:       query.page,
      limit:      query.limit,
      total:      countRow!.total,
      totalPages: Math.ceil(countRow!.total / query.limit),
    },
  }
}

// ─────────────────────────────────────────────
// DELETE — elimina un pagamento studente
// Ripristina il saldo del pacchetto (importoPagato/importoResiduo + stati)
// e poi elimina il pagamento: la scrittura contabile collegata sparisce
// automaticamente via ON DELETE CASCADE su accounting_entries.paymentId.
// ─────────────────────────────────────────────

export async function deletePayment(paymentId: string) {
  return await db.transaction(async (tx) => {
    const [pay] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1)
    if (!pay) throw createError({ statusCode: 404, statusMessage: 'Pagamento non trovato' })

    // Ripristina il saldo del pacchetto (atomico)
    await tx
      .update(packages)
      .set({
        importoPagato:  sql`GREATEST(0, ${packages.importoPagato} - ${pay.importo})`,
        importoResiduo: sql`${packages.importoResiduo} + ${pay.importo}`,
        updatedAt:      new Date(),
      })
      .where(eq(packages.id, pay.packageId))

    // Ricalcola gli stati con i valori aggiornati
    const [pkg] = await tx.select().from(packages).where(eq(packages.id, pay.packageId)).limit(1)
    if (pkg) {
      const stati = computePackageStates({
        oreAcquistate:  pkg.oreAcquistate,
        oreResiduo:     pkg.oreResiduo,
        importoResiduo: pkg.importoResiduo,
        dataScadenza:   pkg.dataScadenza,
        giorniResiduo:  pkg.giorniResiduo,
      })
      await tx.update(packages).set({ stati, updatedAt: new Date() }).where(eq(packages.id, pkg.id))
    }

    // Elimina il pagamento → la scrittura contabile sparisce via CASCADE
    await tx.delete(payments).where(eq(payments.id, paymentId))

    return { ok: true }
  })
}
