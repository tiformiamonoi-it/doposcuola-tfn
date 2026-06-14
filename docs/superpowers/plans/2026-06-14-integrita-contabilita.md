# Integrità Contabilità — Piano di Implementazione

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. VINCOLO: NIENTE test automatici, solo checklist manuali.

**Goal:** Collegare pagamenti↔contabilità con FK e mantenerli allineati su modifica/eliminazione, secondo le regole della spec `2026-06-14-integrita-contabilita-design.md`.

**Branch:** `fix/audit-remediation` (continuiamo qui).

**Riferimenti chiave del codice esistente:**
- `accounting_entries.paymentId` esiste già (unique, onDelete set null). `createPayment` già scrive `paymentId` sulla entry.
- `payTutor` inserisce entry USCITA con `note: tutorPaymentId:...`. `payReimbursement` con `note: rimborsoId:...`.
- `reverseTransaction(entryId, motivo)` in accounting.service crea già uno storno.
- `computePackageStates(...)` in package.service ricalcola gli stati.

---

## Task 1 — Schema: FK + cascade + migrazione

**File:** `server/database/schema.ts`, poi migrazione.

- [ ] **Step 1** In `accountingEntries`, cambiare `paymentId` da `onDelete: 'set null'` a `onDelete: 'cascade'` (mantenere `.unique()`), e aggiungere due colonne dopo `paymentId`:

```typescript
  paymentId:      text('payment_id').references(() => payments.id, { onDelete: 'cascade' }).unique(),
  tutorPaymentId: text('tutor_payment_id').references(() => tutorPayments.id, { onDelete: 'cascade' }).unique(),
  reimbursementId: text('reimbursement_id').references(() => tutorReimbursements.id, { onDelete: 'cascade' }),
```

- [ ] **Step 2** Aggiungere gli indici nel blocco indici di `accountingEntries`:

```typescript
  tutorPaymentIdx:  index('acc_tutor_payment_idx').on(t.tutorPaymentId),
  reimbursementIdx: index('acc_reimbursement_idx').on(t.reimbursementId),
```

- [ ] **Step 3** Aggiornare `accountingEntriesRelations` (se presente) o crearla, aggiungendo `tutorPayment` e `reimbursement` (one). NB: verificare se esiste già una relations per accountingEntries; se non esiste, NON è obbligatorio crearla per il funzionamento (le query usate non la richiedono). Saltare se assente.

- [ ] **Step 4** Generare la migrazione:
```
npx drizzle-kit generate
```
Verificare che il file 000X contenga: ADD COLUMN tutor_payment_id, ADD COLUMN reimbursement_id, le FK con ON DELETE cascade, e l'alterazione del vincolo su payment_id (drop + re-add con cascade). Se drizzle non rigenera il vincolo paymentId, aggiungere a mano in coda al file SQL:
```sql
ALTER TABLE "accounting_entries" DROP CONSTRAINT IF EXISTS "accounting_entries_payment_id_payments_id_fk";
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
```
NON eseguire `migrate` (lo fa l'utente).

- [ ] **Step 5** Commit: `feat(db): FK tutorPaymentId/reimbursementId on accounting_entries + cascade`

**Collaudo:** lo schema compila; il file di migrazione esiste con le 2 colonne e i cascade.

---

## Task 2 — Valorizzare le FK alla creazione

**File:** `server/services/tutor.service.ts`

- [ ] **Step 1** In `payTutor`, nell'insert di `accountingEntries`, aggiungere il campo `tutorPaymentId: payment.id` (mantenere la `note`).
- [ ] **Step 2** In `payReimbursement`, nell'insert di `accountingEntries`, aggiungere `reimbursementId: reimbursementId` (mantenere la `note`).
- [ ] **Step 3** Commit: `feat(accounting): populate FK links on tutor payment/reimbursement`

**Collaudo:** registrando un compenso e un rimborso, la entry contabile ha la colonna FK valorizzata (verifica via UI contabilità dopo Task 7, oppure DB).

---

## Task 3 — Service eliminazione pagamento studente

**File:** `server/services/payment.service.ts`

- [ ] **Step 1** Aggiungere `deletePayment(paymentId: string)`:

```typescript
export async function deletePayment(paymentId: string) {
  return await db.transaction(async (tx) => {
    const [pay] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1)
    if (!pay) throw createError({ statusCode: 404, statusMessage: 'Pagamento non trovato' })

    // Ripristina il saldo del pacchetto
    await tx.update(packages)
      .set({
        importoPagato:  sql`GREATEST(0, ${packages.importoPagato} - ${pay.importo})`,
        importoResiduo: sql`${packages.importoResiduo} + ${pay.importo}`,
        updatedAt:      new Date(),
      })
      .where(eq(packages.id, pay.packageId))

    // Ricalcola stati
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

    // Elimina il pagamento → la scrittura contabile sparisce via ON DELETE CASCADE
    await tx.delete(payments).where(eq(payments.id, paymentId))
    return { ok: true }
  })
}
```
(`createError` è globale; `sql`, `eq`, `computePackageStates`, `packages`, `payments` già importati nel file — verificare e aggiungere import mancanti.)

- [ ] **Step 2** Commit: `feat(payments): deletePayment reverts package balance + cascades entry`

---

## Task 4 — Service eliminazione compenso/rimborso tutor

**File:** `server/services/tutor.service.ts`

- [ ] **Step 1** Aggiungere:

```typescript
export async function deleteTutorPayment(id: string) {
  const [row] = await db.delete(tutorPayments).where(eq(tutorPayments.id, id)).returning()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Compenso non trovato' })
  return { ok: true } // la scrittura contabile sparisce via cascade
}

export async function deleteReimbursement(id: string) {
  const [row] = await db.delete(tutorReimbursements).where(eq(tutorReimbursements.id, id)).returning()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Rimborso non trovato' })
  return { ok: true } // scritture collegate eliminate via cascade
}

// Elimina UNA scrittura parziale di rimborso: riduce l'importo pagato e ricalcola lo stato
export async function reduceReimbursementOnEntryDelete(reimbursementId: string, importoEntry: string) {
  return await db.transaction(async (tx) => {
    const [r] = await tx.select().from(tutorReimbursements).where(eq(tutorReimbursements.id, reimbursementId)).limit(1)
    if (!r) return
    const nuovoPagato = Math.max(0, parseFloat(r.importoPagato) - parseFloat(importoEntry))
    const totale = parseFloat(r.importo)
    const stato = nuovoPagato <= 0.01 ? 'DA_PAGARE' : (nuovoPagato >= totale - 0.01 ? 'PAGATO' : 'PARZIALE')
    await tx.update(tutorReimbursements)
      .set({ importoPagato: nuovoPagato.toFixed(2), stato, updatedAt: new Date() })
      .where(eq(tutorReimbursements.id, reimbursementId))
  })
}
```

- [ ] **Step 2** Commit: `feat(tutor): delete tutor payment / reimbursement services`

---

## Task 5 — Service contabilità: delete "intelligente" + update solo manuali

**File:** `server/services/accounting.service.ts`

- [ ] **Step 1** Aggiungere helper e funzioni:

```typescript
import { packages, payments, tutorReimbursements } from '../database/schema'
import { deletePayment } from './payment.service'
import { deleteTutorPayment, reduceReimbursementOnEntryDelete } from './tutor.service'

function isAutoEntry(e: { paymentId: string|null; tutorPaymentId: string|null; reimbursementId: string|null }) {
  return !!(e.paymentId || e.tutorPaymentId || e.reimbursementId)
}

// Elimina una scrittura: mode 'storno' crea reversal; mode 'delete' rimuove (e la sorgente, se automatica)
export async function deleteAccountingEntry(entryId: string, mode: 'delete' | 'storno', motivo = 'Eliminazione manuale') {
  const [entry] = await db.select().from(accountingEntries).where(eq(accountingEntries.id, entryId)).limit(1)
  if (!entry) throw createError({ statusCode: 404, statusMessage: 'Movimento non trovato' })

  if (mode === 'storno') {
    return await reverseTransaction(entryId, motivo)
  }

  // mode === 'delete'
  if (entry.paymentId) {
    return await deletePayment(entry.paymentId)
  }
  if (entry.tutorPaymentId) {
    return await deleteTutorPayment(entry.tutorPaymentId)
  }
  if (entry.reimbursementId) {
    // scrittura parziale di rimborso: riduci importoPagato poi elimina la entry
    await reduceReimbursementOnEntryDelete(entry.reimbursementId, entry.importo)
    await db.delete(accountingEntries).where(eq(accountingEntries.id, entryId))
    return { ok: true }
  }
  // manuale
  await db.delete(accountingEntries).where(eq(accountingEntries.id, entryId))
  return { ok: true }
}

// Modifica consentita SOLO sui movimenti manuali
export async function updateAccountingEntry(entryId: string, data: {
  tipo?: string; importo?: number; descrizione?: string; categoria?: string|null; metodoPagamento?: string|null; data?: string
}) {
  const [entry] = await db.select().from(accountingEntries).where(eq(accountingEntries.id, entryId)).limit(1)
  if (!entry) throw createError({ statusCode: 404, statusMessage: 'Movimento non trovato' })
  if (isAutoEntry(entry)) {
    throw createError({ statusCode: 403, statusMessage: 'Questo movimento è automatico: modificalo dal pagamento di origine (oppure eliminalo).' })
  }
  const changes: Record<string, unknown> = { updatedAt: new Date() }
  if (data.tipo !== undefined)            changes.tipo = data.tipo
  if (data.importo !== undefined)         changes.importo = String(data.importo)
  if (data.descrizione !== undefined)     changes.descrizione = data.descrizione
  if (data.categoria !== undefined)       changes.categoria = data.categoria
  if (data.metodoPagamento !== undefined) changes.metodoPagamento = data.metodoPagamento
  if (data.data !== undefined)            changes.data = new Date(data.data)
  const [updated] = await db.update(accountingEntries).set(changes).where(eq(accountingEntries.id, entryId)).returning()
  return updated
}
```
(Verificare import esistenti: `db`, `accountingEntries`, `eq`, `reverseTransaction` sono nel file; aggiungere quelli mancanti. Attenzione a import circolari: payment.service ↔ accounting non si importano a vicenda; tutor.service non importa accounting. OK.)

- [ ] **Step 2** Commit: `feat(accounting): smart delete (storno/delete) + manual-only update`

---

## Task 6 — API routes

**File (creare):**
- `server/api/payments/[id].delete.ts` → `deletePayment` (ADMIN/SUPER)
- `server/api/tutor-payments/[id].delete.ts` → `deleteTutorPayment` (ADMIN/SUPER)
- `server/api/tutors/[id]/reimbursements/[rid].delete.ts` → `deleteReimbursement` (ADMIN/SUPER)
- `server/api/accounting/entries/[id].delete.ts` → `deleteAccountingEntry` con query `?mode=delete|storno` (ADMIN)
- `server/api/accounting/entries/[id].put.ts` → `updateAccountingEntry` (ADMIN)

**File (modificare):**
- `server/utils/auth-policy.ts`: aggiungere `{ prefix: '/api/tutor-payments', roles: ADMIN_SUPER }`.
- `server/api/accounting/entries/index.get.ts`: includere nel risultato `paymentId, tutorPaymentId, reimbursementId` (o un campo calcolato `isAuto`).

- [ ] **Step 1** Creare i 5 handler. Pattern (esempio delete payment):
```typescript
import { deletePayment } from '../../services/payment.service'
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN','SUPER_TUTOR'].includes(user.role)) throw createError({ statusCode: 403, statusMessage: 'Riservato' })
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })
  return await deletePayment(id)
})
```
Per la entry contabile (mode):
```typescript
const mode = (getQuery(event).mode === 'storno') ? 'storno' : 'delete'
return await deleteAccountingEntry(id, mode)
```
Per la PUT entry: leggere body, validare minimamente, chiamare `updateAccountingEntry`.

- [ ] **Step 2** Aggiornare policy + entries GET.
- [ ] **Step 3** Commit: `feat(api): delete/update routes for payments, tutor payments, reimbursements, accounting entries`

**Collaudo:** chiamando le DELETE da loggato come ADMIN si ottiene 200; senza login 401.

---

## Task 7 — UI Contabilità: popup elimina/storno + modifica solo manuali

**File:** `app/pages/contabilita/index.vue`

- [ ] **Step 1** Nella tabella movimenti, per ogni riga aggiungere:
  - pulsante **Elimina** (icona cestino) → apre un `UModal` di conferma con tre azioni: **Elimina definitivamente**, **Crea storno**, **Annulla**.
  - pulsante **Modifica** (icona matita) visibile/abilitato SOLO se la riga è manuale (cioè `!row.original.paymentId && !row.original.tutorPaymentId && !row.original.reimbursementId`). Per le righe automatiche: nascondere il pulsante (o disabilitarlo con tooltip "Movimento automatico: modificalo dal pagamento di origine").
- [ ] **Step 2** Azioni:
  - Elimina definitivamente → `await $fetch('/api/accounting/entries/'+id, { method:'DELETE', query:{ mode:'delete' } })` poi refresh.
  - Crea storno → stessa con `query:{ mode:'storno' }`.
  - Modifica (solo manuali) → modal prefillato → `PUT /api/accounting/entries/:id` → refresh.
- [ ] **Step 3** Commit: `feat(contabilita): delete (with storno) + edit manual entries UI`

**Collaudo manuale:**
1. Movimento manuale (Credito) → Modifica funziona; Elimina mostra popup con Storno/Elimina.
2. Movimento automatico (da un pagamento) → Modifica non disponibile; Elimina mostra popup; "Elimina definitivamente" rimuove anche il pagamento di origine e aggiorna il saldo pacchetto.
3. "Crea storno" su un automatico → compare un movimento negativo, l'originale resta.

---

## Task 8 — UI Studente e Tutor: pulsanti elimina

**File:** `app/pages/studenti/[id].vue`, `app/pages/tutor/[id].vue`

- [ ] **Step 1** Studente: nella sezione pagamenti del pacchetto, aggiungere per ogni pagamento un pulsante **Elimina** → conferma "Sei sicuro? Il pagamento e il relativo movimento contabile verranno eliminati e il saldo ricalcolato." → `DELETE /api/payments/:id` → refresh pacchetto/pagamenti.
- [ ] **Step 2** Tutor: nella tab Compensi, pulsante Elimina per compenso → `DELETE /api/tutor-payments/:id` → refresh. Nella tab Rimborsi, pulsante Elimina rimborso → `DELETE /api/tutors/:id/reimbursements/:rid` → refresh.
- [ ] **Step 3** Commit: `feat(studenti/tutor): delete buttons for payments/compensi/rimborsi`

**Collaudo manuale:**
1. Studente: elimina un pagamento → sparisce, il pacchetto torna DA_PAGARE con residuo corretto, e in Contabilità il movimento è sparito.
2. Tutor: elimina un compenso → sparisce, il "pagato" del mese scende, il movimento USCITA in Contabilità è sparito.

---

## Riepilogo task

| Task | Contenuto |
|------|-----------|
| 1 | Schema FK + cascade + migrazione |
| 2 | Valorizzare FK in payTutor/payReimbursement |
| 3 | deletePayment (revert saldo) |
| 4 | deleteTutorPayment / deleteReimbursement / parziale |
| 5 | deleteAccountingEntry (storno/delete) + updateAccountingEntry (solo manuali) |
| 6 | API routes + policy + entries GET |
| 7 | UI Contabilità (popup elimina/storno, modifica solo manuali) |
| 8 | UI Studente/Tutor (pulsanti elimina) |

## Note
- `requireUserSession`/`createError`/`getRouterParam`/`getQuery` auto-importati.
- La guardia globale (`server/middleware/01.auth-guard.ts`) protegge già tutte le nuove route; i controlli per-ruolo negli handler sono difesa ridondante.
- Migrazione: l'utente esegue `npx drizzle-kit migrate` (Direct Connection 5432).
