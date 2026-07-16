import { db } from '../database/client'
import { accountingEntries, packages, payments, students } from '../database/schema'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { computePackageStates } from './package.service'
import { conFattura, rimuoviSuffissoFattura } from '#shared/fattura'
import type { CreatePaymentInput, PaymentQuery, UpdatePaymentInput } from '#shared/schemas/payment.schema'

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
      .select({
        id: packages.id,
        nome: packages.nome,
        stati: packages.stati,
        sospeso: packages.sospeso,
        importoResiduo: packages.importoResiduo,
        oreAcquistate: packages.oreAcquistate,
        oreResiduo: packages.oreResiduo,
        dataScadenza: packages.dataScadenza,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
      })
      .from(packages)
      .innerJoin(students, eq(packages.studentId, students.id))
      .where(eq(packages.id, data.packageId))
      .limit(1)

    if (!pkg) throw new Error('Pacchetto non trovato')

    // Un pacchetto chiuso o sospeso non accetta più pagamenti
    if (pkg.stati.includes('CHIUSO')) {
      throw new Error('Impossibile aggiungere un pagamento a un pacchetto CHIUSO')
    }
    if (pkg.sospeso) {
      throw new Error('Impossibile aggiungere un pagamento a un pacchetto SOSPESO')
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
        giorniResiduo:  updatedPkg.giorniResiduo,
        sospeso:        updatedPkg.sospeso,
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
        descrizione:     `Pagamento ${data.tipoPagamento} — ${pkg.studentLastName} ${pkg.studentFirstName} (${pkg.nome})`,
        categoria:       'pacchetti',
        packageId:       data.packageId,
        paymentId:       payment!.id,
        metodoPagamento: data.metodoPagamento,
        fatturaEmessa:   false,
        data:            data.dataPagamento,
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

export async function toggleInvoiceStatus(
  paymentId: string,
  data: { fatturaEmessa?: boolean; richiedeFattura?: boolean; numeroFattura?: string; dataFattura?: string },
) {
  // Trova il movimento contabile collegato a questo pagamento (relazione 1:1)
  const [entry] = await db
    .select()
    .from(accountingEntries)
    .where(eq(accountingEntries.paymentId, paymentId))
    .limit(1)

  if (!entry) return null

  // Eccezione alla "Penna Indelebile": richiedeFattura è un flag amministrativo,
  // non tocca importi né date del pagamento.
  if (data.richiedeFattura !== undefined) {
    await db
      .update(payments)
      .set({ richiedeFattura: data.richiedeFattura, updatedAt: new Date() })
      .where(eq(payments.id, paymentId))
  }

  if (data.fatturaEmessa === undefined) return entry

  // Numero+data fattura: accodati alla descrizione se emessa, rimossi se annullata
  const changes: Record<string, unknown> = { fatturaEmessa: data.fatturaEmessa, updatedAt: new Date() }
  if (data.fatturaEmessa && data.numeroFattura) {
    changes.descrizione = conFattura(entry.descrizione, data.numeroFattura, data.dataFattura ?? new Date().toISOString().slice(0, 10))
  } else if (!data.fatturaEmessa) {
    changes.descrizione = rimuoviSuffissoFattura(entry.descrizione)
  }

  const [updated] = await db
    .update(accountingEntries)
    .set(changes as any)
    .where(eq(accountingEntries.id, entry.id))
    .returning()

  return updated ?? null
}

// ─────────────────────────────────────────────
// UPDATE — PUT /api/payments/:id
// Modifica un pagamento esistente e aggiorna di conseguenza il pacchetto
// (importoPagato/importoResiduo/stati) e il movimento contabile collegato.
// ─────────────────────────────────────────────

export async function updatePayment(paymentId: string, data: UpdatePaymentInput) {
  return await db.transaction(async (tx) => {
    const [pay] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1)
    if (!pay) throw new Error('Pagamento non trovato')

    const [entry] = await tx.select().from(accountingEntries).where(eq(accountingEntries.paymentId, paymentId)).limit(1)
    if (entry && entry.fatturaEmessa) {
      throw new Error('Impossibile modificare un pagamento con fattura già emessa')
    }

    const [pkg] = await tx
      .select({
        id: packages.id,
        nome: packages.nome,
        prezzoTotale: packages.prezzoTotale,
        importoPagato: packages.importoPagato,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
      })
      .from(packages)
      .innerJoin(students, eq(packages.studentId, students.id))
      .where(eq(packages.id, pay.packageId))
      .limit(1)

    if (!pkg) throw new Error('Pacchetto non trovato')

    const nuovoImportoPagato = parseFloat(pkg.importoPagato) - parseFloat(pay.importo) + data.importo
    const nuovoResiduo       = parseFloat(pkg.prezzoTotale) - nuovoImportoPagato

    if (nuovoResiduo < -0.01) {
      throw new Error(`Questo importo supera il prezzo totale del pacchetto (€ ${parseFloat(pkg.prezzoTotale).toFixed(2)})`)
    }

    const [updated] = await tx
      .update(payments)
      .set({
        importo:         String(data.importo),
        tipoPagamento:   data.tipoPagamento,
        metodoPagamento: data.metodoPagamento,
        dataPagamento:   data.dataPagamento,
        riferimento:     data.riferimento ?? null,
        note:            data.note ?? null,
      })
      .where(eq(payments.id, paymentId))
      .returning()

    await tx
      .update(packages)
      .set({
        importoPagato:  String(Math.max(0, nuovoImportoPagato)),
        importoResiduo: String(Math.max(0, nuovoResiduo)),
        updatedAt:      new Date(),
      })
      .where(eq(packages.id, pkg.id))

    const [pkgAggiornato] = await tx.select().from(packages).where(eq(packages.id, pkg.id)).limit(1)
    if (pkgAggiornato) {
      const nuoviStati = computePackageStates({
        oreAcquistate:  pkgAggiornato.oreAcquistate,
        oreResiduo:     pkgAggiornato.oreResiduo,
        importoResiduo: pkgAggiornato.importoResiduo,
        dataScadenza:   pkgAggiornato.dataScadenza,
        giorniResiduo:  pkgAggiornato.giorniResiduo,
        sospeso:        pkgAggiornato.sospeso,
      })
      await tx.update(packages).set({ stati: nuoviStati, updatedAt: new Date() }).where(eq(packages.id, pkg.id))
    }

    // Riflette la modifica sul movimento contabile collegato (relazione 1:1)
    await tx
      .update(accountingEntries)
      .set({
        importo:         String(data.importo),
        metodoPagamento: data.metodoPagamento,
        descrizione:     `Pagamento ${data.tipoPagamento} — ${pkg.studentLastName} ${pkg.studentFirstName} (${pkg.nome})`,
        data:            data.dataPagamento,
        updatedAt:       new Date(),
      })
      .where(eq(accountingEntries.paymentId, paymentId))

    return updated
  })
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

  const [rawRows, [countRow]] = await Promise.all([
    db
      .select({
        payment: payments,
        fatturaEmessa: accountingEntries.fatturaEmessa
      })
      .from(payments)
      .leftJoin(accountingEntries, eq(payments.id, accountingEntries.paymentId))
      .where(where)
      .orderBy(desc(payments.dataPagamento))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit),
    db.select({ total: count() }).from(payments).where(where),
  ])

  const rows = rawRows.map(r => ({
    ...r.payment,
    fatturaEmessa: r.fatturaEmessa ?? false
  }))

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
    if (!pay) throw new Error('Pagamento non trovato')

    const [entry] = await tx.select().from(accountingEntries).where(eq(accountingEntries.paymentId, paymentId)).limit(1)
    if (entry && entry.fatturaEmessa) {
      throw new Error('Impossibile eliminare un pagamento con fattura già emessa')
    }

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
        sospeso:        pkg.sospeso,
      })
      await tx.update(packages).set({ stati, updatedAt: new Date() }).where(eq(packages.id, pkg.id))
    }

    // Elimina il pagamento → la scrittura contabile sparisce via CASCADE
    await tx.delete(payments).where(eq(payments.id, paymentId))

    return { ok: true }
  })
}
