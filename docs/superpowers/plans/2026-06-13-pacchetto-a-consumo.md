# Pacchetto "A Consumo" (crediti ricaricabili) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Aggiungere un terzo tipo di pacchetto `A_CONSUMO`: prepagato, ricaricabile, con tariffa oraria e storico ricariche.

**Architecture:** Riuso della tabella `packages` esistente (le colonne ore/prezzo crescono ad ogni ricarica) + nuova colonna `tariffaOraria` + nuova tabella `package_recharges` (il "libretto"). Creazione e ricarica avvengono in transazioni atomiche nel `package.service`. UI su 3 pagine già esistenti.

**Tech Stack:** Nuxt 4, Drizzle ORM (PostgreSQL/Supabase), Zod v4, Nuxt UI v4.

> **NOTA TEST:** Il file `CLAUDE.md` di progetto VIETA i test automatici. Ogni task usa **verifiche manuali** (clic nell'interfaccia o query SQL), NON test Vitest/Jest. Non creare file di test.

> **Comandi:** sono per **Windows PowerShell**. Eseguire dalla cartella di progetto `c:\Users\Alessandro\Desktop\CLAUDE\tiformiamonoi_gestionale`.

---

## File coinvolti (mappa)

| Responsabilità | File | Azione |
|---|---|---|
| Schema DB + nuova tabella | `server/database/schema.ts` | Modifica |
| Migrazione SQL generata | `server/database/migrations/*.sql` | Create (auto) |
| Validazione | `shared/schemas/package.schema.ts` | Modifica |
| Logica creazione + ricarica | `server/services/package.service.ts` | Modifica |
| Endpoint ricarica | `server/api/packages/[id]/recharge.post.ts` | Create |
| Endpoint libretto | `server/api/packages/[id]/recharges.get.ts` | Create |
| Endpoint singolo pacchetto | `server/api/packages/[id].get.ts` | Modifica |
| Template standard (validazione) | `server/api/standard-packages/index.post.ts` | Modifica |
| UI template a consumo | `app/pages/impostazioni/index.vue` | Modifica |
| UI creazione + ricarica | `app/pages/pacchetti/index.vue` | Modifica |
| UI libretto in scheda studente | `app/pages/studenti/[id].vue` | Modifica |

---

## Task 1: Schema DB — enum, colonne, tabella ricariche

**Files:**
- Modify: `server/database/schema.ts`
- Create (auto): `server/database/migrations/<timestamp>_*.sql`

- [x] **Step 1: Aggiungere `A_CONSUMO` all'enum dei tipi**

In `server/database/schema.ts`, sostituire la riga dell'enum (≈ riga 39):

```ts
export const packageTypeEnum = pgEnum('package_type', ['ORE', 'MENSILE', 'A_CONSUMO'])
```

- [x] **Step 2: Aggiungere `tariffaOraria` a `standardPackages`**

Nella tabella `standardPackages` (≈ riga 196-213), aggiungere la colonna subito dopo `prezzoStandard`:

```ts
  prezzoStandard:    numeric('prezzo_standard', { precision: 10, scale: 2 }).notNull(),

  // Tariffa oraria — usata SOLO per i template di tipo A_CONSUMO
  tariffaOraria:     numeric('tariffa_oraria', { precision: 10, scale: 2 }),
```

- [x] **Step 3: Aggiungere `tariffaOraria` a `packages`**

Nella tabella `packages` (≈ riga 227-263), aggiungere la colonna subito dopo `orarioGiornaliero`:

```ts
  orarioGiornaliero: numeric('orario_giornaliero', { precision: 10, scale: 2 }),

  // Tariffa oraria — usata SOLO per i pacchetti A_CONSUMO (copiata dal template, modificabile)
  tariffaOraria:     numeric('tariffa_oraria', { precision: 10, scale: 2 }),
```

- [x] **Step 4: Aggiungere la tabella `package_recharges`**

In `server/database/schema.ts`, subito DOPO la chiusura della tabella `packages` (dopo la riga `}))` dell'indice `tipoCreatedIdx`, ≈ riga 263) e PRIMA della tabella `payments`, inserire:

```ts
// ─────────────────────────────────────────────
// TABELLA: package_recharges  (il "libretto" delle ricariche dei pacchetti A_CONSUMO)
// Ogni riga = un rifornimento di ore con relativo costo.
// ─────────────────────────────────────────────
export const packageRecharges = pgTable('package_recharges', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  packageId: text('package_id').notNull().references(() => packages.id, { onDelete: 'cascade' }),

  ore:           numeric('ore', { precision: 10, scale: 2 }).notNull(),           // ore aggiunte
  tariffaOraria: numeric('tariffa_oraria', { precision: 10, scale: 2 }).notNull(), // snapshot tariffa
  importo:       numeric('importo', { precision: 10, scale: 2 }).notNull(),        // totale ricarica

  data:      timestamp('data').notNull().defaultNow(),
  paymentId: text('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  note:      text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  packageDataIdx: index('recharges_package_data_idx').on(t.packageId, t.data),
}))
```

- [x] **Step 5: Aggiungere le relazioni Drizzle**

Nella sezione RELAZIONI, dentro `packagesRelations` (≈ riga 571-577), aggiungere `recharges`:

```ts
export const packagesRelations = relations(packages, ({ one, many }) => ({
  student:         one(students, { fields: [packages.studentId], references: [students.id] }),
  standardPackage: one(standardPackages, { fields: [packages.standardPackageId], references: [standardPackages.id] }),
  payments:        many(payments),
  lessonStudents:  many(lessonStudents),
  accountingEntries: many(accountingEntries),
  recharges:       many(packageRecharges),
}))
```

E subito dopo `packagesRelations`, aggiungere la relazione inversa:

```ts
export const packageRechargesRelations = relations(packageRecharges, ({ one }) => ({
  package: one(packages, { fields: [packageRecharges.packageId], references: [packages.id] }),
  payment: one(payments, { fields: [packageRecharges.paymentId], references: [payments.id] }),
}))
```

- [x] **Step 6: Generare la migrazione**

Run (PowerShell):
```powershell
npm run db:generate
```
Expected: drizzle-kit crea un nuovo file in `server/database/migrations/` con `ALTER TYPE ... ADD VALUE 'A_CONSUMO'`, `ALTER TABLE ... ADD COLUMN tariffa_oraria`, e `CREATE TABLE package_recharges`. Output termina con "Your SQL migration file ➜ ...".

- [x] **Step 7: Applicare la migrazione al database**

Run (PowerShell):
```powershell
npm run db:migrate
```
Expected: output senza errori, le modifiche vengono applicate su Supabase.

> ⚠️ Se PostgreSQL rifiuta `ADD VALUE` dentro una transazione (errore "ALTER TYPE ... ADD VALUE cannot run inside a transaction block"), aprire il file SQL generato e spostare la riga `ALTER TYPE "public"."package_type" ADD VALUE 'A_CONSUMO';` in cima al file, su una riga isolata (drizzle-kit di solito lo gestisce già; intervenire solo se l'errore compare).

- [x] **Step 8: Verifica manuale**

Run (PowerShell):
```powershell
npm run dev
```
Expected: il server parte senza errori di schema. Aprire `http://localhost:3000/pacchetti` → la pagina carica senza errori in console relativi a colonne mancanti. Fermare con `Ctrl+C`.

- [x] **Step 9: Commit**

```powershell
git add server/database/schema.ts server/database/migrations
git commit -m "feat(db): tipo A_CONSUMO, colonna tariffa_oraria, tabella package_recharges"
```

---

## Task 2: Validazione Zod — tipo, tariffa, scadenza, ricarica

**Files:**
- Modify: `shared/schemas/package.schema.ts`

- [x] **Step 1: Aggiungere `A_CONSUMO` a `PackageTypeEnum`**

In `shared/schemas/package.schema.ts` (≈ riga 19-21), sostituire:

```ts
export const PackageTypeEnum = z.enum(['ORE', 'MENSILE', 'A_CONSUMO'], {
  errorMap: () => ({ message: 'Il tipo di pacchetto deve essere ORE, MENSILE o A_CONSUMO' }),
})
```

- [x] **Step 2: Aggiungere `tariffaOraria` e `dataScadenza` a `CreatePackageSchema`**

In `CreatePackageSchema`, dentro l'oggetto `.object({ ... })`, aggiungere questi due campi subito dopo `dataInizio` (≈ riga 92):

```ts
    dataScadenza: z.coerce.date({ invalid_type_error: 'Data di scadenza non valida' }).optional().nullable(),

    tariffaOraria: z
      .number()
      .positive('La tariffa oraria deve essere maggiore di zero')
      .max(9999, 'La tariffa oraria non può superare € 9999')
      .optional(),
```

- [x] **Step 3: Rendere `tariffaOraria` obbligatoria per i pacchetti A_CONSUMO**

Dentro il blocco `.superRefine((data, ctx) => { ... })` di `CreatePackageSchema`, aggiungere all'inizio del corpo (subito dopo `{`):

```ts
    // Regola: la tariffa oraria è obbligatoria per i pacchetti A_CONSUMO
    if (data.tipo === 'A_CONSUMO' && !data.tariffaOraria) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tariffaOraria'],
        message: 'Per un pacchetto a consumo, la tariffa oraria è obbligatoria',
      })
    }
```

- [x] **Step 4: Aggiungere lo schema della ricarica**

In fondo al file, PRIMA della sezione "TIPI TypeScript" (≈ riga 201), aggiungere:

```ts
// ─────────────────────────────────────────────
// SCHEMA RICARICA PACCHETTO A_CONSUMO (POST /api/packages/:id/recharge)
// ─────────────────────────────────────────────

export const RechargePackageSchema = z.object({
  ore: z
    .number({ required_error: 'Le ore da aggiungere sono obbligatorie' })
    .positive('Le ore devono essere maggiori di zero')
    .max(9999, 'Le ore non possono superare 9999'),

  importo: z
    .number({ required_error: "L'importo è obbligatorio" })
    .nonnegative("L'importo non può essere negativo")
    .max(99999, "L'importo non può superare € 99.999"),

  // Snapshot opzionale: se assente, si usa la tariffa del pacchetto
  tariffaOraria: z.number().positive().max(9999).optional(),

  data: z.coerce.date({ invalid_type_error: 'Data non valida' }).default(() => new Date()),

  // Se presente, la ricarica viene pagata subito; altrimenti resta DA_PAGARE
  metodoPagamento: PaymentMethodEnum.optional(),
  richiedeFattura: z.boolean().default(false),
  note:            z.string().max(500, 'Le note non possono superare 500 caratteri').optional(),
})
```

- [x] **Step 5: Esportare il tipo TypeScript della ricarica**

Nella sezione "TIPI TypeScript" in fondo al file, aggiungere:

```ts
export type RechargePackageInput = z.infer<typeof RechargePackageSchema>
```

- [x] **Step 6: Verifica manuale (type-check)**

Run (PowerShell):
```powershell
npx nuxi typecheck
```
Expected: nessun errore relativo a `package.schema.ts`. (Se `nuxi typecheck` non è configurato e fallisce per altri motivi, in alternativa verificare che `npm run dev` parta senza errori TypeScript su questo file.)

- [x] **Step 7: Commit**

```powershell
git add shared/schemas/package.schema.ts
git commit -m "feat(schema): validazione A_CONSUMO, dataScadenza, RechargePackageSchema"
```

---

## Task 3: Service — creazione pacchetto A_CONSUMO + prima ricarica

**Files:**
- Modify: `server/services/package.service.ts`

- [x] **Step 1: Importare la tabella `packageRecharges`**

In cima a `server/services/package.service.ts` (riga 2), aggiungere `packageRecharges` all'import:

```ts
import { accountingEntries, packages, packageRecharges, payments } from '../database/schema'
```

- [x] **Step 2: Riscrivere `createPackage` per gestire scadenza esplicita, tariffa e prima ricarica**

Sostituire l'INTERA funzione `createPackage` (≈ riga 170-239) con:

```ts
export async function createPackage(data: CreatePackageInput) {
  return await db.transaction(async (tx) => {
    const importoPagato  = data.pagamentoIniziale?.importo ?? 0
    const importoResiduo = data.prezzoTotale - importoPagato

    // Data di scadenza:
    //  - MENSILE: calcolata da dataInizio + giorni (se non fornita esplicitamente)
    //  - ORE / A_CONSUMO: usa quella inviata dal frontend (es. 15/06)
    let dataScadenza: Date | null = data.dataScadenza ?? null
    if (!dataScadenza && data.tipo === 'MENSILE' && data.giorniAcquistati) {
      dataScadenza = new Date(data.dataInizio)
      dataScadenza.setDate(dataScadenza.getDate() + data.giorniAcquistati)
    }

    // Calcola gli stati iniziali
    const stati = computePackageStates({
      oreAcquistate:  String(data.oreAcquistate),
      oreResiduo:     String(data.oreAcquistate),  // All'inizio residuo = acquistato
      importoResiduo: String(importoResiduo),
      dataScadenza,
    })

    // Inserisce il pacchetto
    const [pkg] = await tx.insert(packages).values({
      studentId:         data.studentId,
      standardPackageId: data.standardPackageId ?? null,
      nome:              data.nome,
      tipo:              data.tipo,
      oreAcquistate:     String(data.oreAcquistate),
      oreResiduo:        String(data.oreAcquistate),
      orePerse:          '0',
      giorniAcquistati:  data.giorniAcquistati  ?? null,
      giorniResiduo:     data.giorniAcquistati  ?? null,
      orarioGiornaliero: data.orarioGiornaliero ? String(data.orarioGiornaliero) : null,
      tariffaOraria:     data.tariffaOraria ? String(data.tariffaOraria) : null,
      prezzoTotale:      String(data.prezzoTotale),
      importoPagato:     String(importoPagato),
      importoResiduo:    String(importoResiduo),
      dataInizio:        data.dataInizio,
      dataScadenza,
      stati,
      note: data.note ?? null,
    }).returning()

    // Se c'è un pagamento iniziale, lo registra + crea movimento contabile
    let initialPaymentId: string | null = null
    if (data.pagamentoIniziale && importoPagato > 0) {
      const pag = data.pagamentoIniziale

      const [payment] = await tx.insert(payments).values({
        packageId:       pkg.id,
        importo:         String(pag.importo),
        tipoPagamento:   pag.tipoPagamento   ?? 'ACCONTO',
        metodoPagamento: pag.metodoPagamento,
        richiedeFattura: pag.richiedeFattura ?? false,
        dataPagamento:   pag.dataPagamento   ?? new Date(),
        riferimento:     pag.riferimento     ?? null,
        note:            pag.note            ?? null,
      }).returning()

      initialPaymentId = payment.id

      await tx.insert(accountingEntries).values({
        tipo:            'ENTRATA',
        importo:         String(pag.importo),
        descrizione:     `Pagamento pacchetto: ${data.nome}`,
        categoria:       'pacchetti',
        packageId:       pkg.id,
        paymentId:       payment.id,
        metodoPagamento: pag.metodoPagamento,
      })
    }

    // Per i pacchetti A_CONSUMO la creazione è la PRIMA ricarica: la registriamo nel libretto
    if (data.tipo === 'A_CONSUMO' && data.tariffaOraria) {
      await tx.insert(packageRecharges).values({
        packageId:     pkg.id,
        ore:           String(data.oreAcquistate),
        tariffaOraria: String(data.tariffaOraria),
        importo:       String(data.prezzoTotale),
        data:          data.dataInizio,
        paymentId:     initialPaymentId,
        note:          'Ricarica iniziale (creazione pacchetto)',
      })
    }

    return pkg
  })
}
```

- [x] **Step 3: Verifica manuale (creazione via UI esistente)**

Run (PowerShell):
```powershell
npm run dev
```
Aprire `http://localhost:3000/pacchetti` → "Nuovo Pacchetto" con un pacchetto **ORE** normale (il flusso esistente non deve rompersi). Salvare. Expected: il pacchetto si crea senza errori 422/500, e la sua **data di scadenza** ora viene salvata (verificabile riaprendo la lista: la colonna "Scadenza" mostra la data invece di "—"). Fermare con `Ctrl+C`.

- [x] **Step 4: Commit**

```powershell
git add server/services/package.service.ts
git commit -m "feat(service): createPackage salva dataScadenza, tariffa e prima ricarica A_CONSUMO"
```

---

## Task 4: Service — funzione `rechargePackage`

**Files:**
- Modify: `server/services/package.service.ts`

- [x] **Step 1: Importare il tipo `RechargePackageInput`**

In `server/services/package.service.ts` (riga 4), aggiungere `RechargePackageInput` all'import dei tipi:

```ts
import type { CreatePackageInput, PackageQuery, RechargePackageInput, UpdatePackageInput } from '../../shared/schemas/package.schema'
```

- [x] **Step 2: Aggiungere la funzione `rechargePackage`**

In fondo a `server/services/package.service.ts`, aggiungere:

```ts
// ─────────────────────────────────────────────
// RICARICA — POST /api/packages/:id/recharge
// Aggiunge ore a un pacchetto A_CONSUMO + costo + (opzionale) pagamento.
// Tutto in una transazione atomica. Aggiorna il libretto e ricalcola gli stati.
// ─────────────────────────────────────────────

export async function rechargePackage(id: string, data: RechargePackageInput) {
  return await db.transaction(async (tx) => {
    const [pkg] = await tx.select().from(packages).where(eq(packages.id, id)).limit(1)
    if (!pkg) throw new Error('Pacchetto non trovato')
    if (pkg.tipo !== 'A_CONSUMO') throw new Error('Solo i pacchetti a consumo possono essere ricaricati')
    if (pkg.stati.includes('CHIUSO')) throw new Error('Impossibile ricaricare un pacchetto CHIUSO')

    const tariffa = data.tariffaOraria ?? parseFloat(pkg.tariffaOraria ?? '0')
    const importo = data.importo
    const paga    = !!data.metodoPagamento
    const pagatoAggiunto = paga ? importo : 0

    // Nuovi totali
    const nuovaOreAcquistate = parseFloat(pkg.oreAcquistate) + data.ore
    const nuovaOreResiduo    = parseFloat(pkg.oreResiduo)    + data.ore
    const nuovoPrezzoTotale  = parseFloat(pkg.prezzoTotale)  + importo
    const nuovoImportoPagato = parseFloat(pkg.importoPagato) + pagatoAggiunto
    const nuovoImportoResiduo = nuovoPrezzoTotale - nuovoImportoPagato

    // Pagamento opzionale + movimento contabile
    let paymentId: string | null = null
    if (paga) {
      const [payment] = await tx.insert(payments).values({
        packageId:       pkg.id,
        importo:         String(importo),
        tipoPagamento:   'INTEGRAZIONE',
        metodoPagamento: data.metodoPagamento!,
        richiedeFattura: data.richiedeFattura,
        dataPagamento:   data.data,
        note:            data.note ?? null,
      }).returning()
      paymentId = payment.id

      await tx.insert(accountingEntries).values({
        tipo:            'ENTRATA',
        importo:         String(importo),
        descrizione:     `Ricarica pacchetto: ${pkg.nome}`,
        categoria:       'pacchetti',
        packageId:       pkg.id,
        paymentId:       payment.id,
        metodoPagamento: data.metodoPagamento!,
      })
    }

    // Riga nel libretto delle ricariche
    await tx.insert(packageRecharges).values({
      packageId:     pkg.id,
      ore:           String(data.ore),
      tariffaOraria: String(tariffa),
      importo:       String(importo),
      data:          data.data,
      paymentId,
      note:          data.note ?? null,
    })

    // Ricalcola gli stati con i nuovi valori
    const nuoviStati = computePackageStates({
      oreAcquistate:  String(nuovaOreAcquistate),
      oreResiduo:     String(nuovaOreResiduo),
      importoResiduo: String(nuovoImportoResiduo),
      dataScadenza:   pkg.dataScadenza,
    })

    // Aggiorna il pacchetto
    const [updated] = await tx.update(packages).set({
      oreAcquistate:  String(nuovaOreAcquistate),
      oreResiduo:     String(nuovaOreResiduo),
      prezzoTotale:   String(nuovoPrezzoTotale),
      importoPagato:  String(nuovoImportoPagato),
      importoResiduo: String(nuovoImportoResiduo),
      stati:          nuoviStati,
      updatedAt:      new Date(),
    }).where(eq(packages.id, pkg.id)).returning()

    return updated
  })
}
```

- [x] **Step 3: Aggiungere la funzione `getPackageRecharges` (per il libretto)**

In fondo a `server/services/package.service.ts`, aggiungere:

```ts
// Restituisce lo storico ricariche di un pacchetto (più recenti in cima)
export async function getPackageRecharges(packageId: string) {
  return await db
    .select()
    .from(packageRecharges)
    .where(eq(packageRecharges.packageId, packageId))
    .orderBy(desc(packageRecharges.data))
}
```

- [x] **Step 4: Verifica manuale (compilazione)**

Run (PowerShell):
```powershell
npm run dev
```
Expected: il server parte senza errori TypeScript. Fermare con `Ctrl+C`. (La verifica funzionale avviene nel Task 5 quando esiste l'endpoint.)

- [x] **Step 5: Commit**

```powershell
git add server/services/package.service.ts
git commit -m "feat(service): rechargePackage e getPackageRecharges"
```

---

## Task 5: API — endpoint ricarica + libretto + include nel GET

**Files:**
- Create: `server/api/packages/[id]/recharge.post.ts`
- Create: `server/api/packages/[id]/recharges.get.ts`
- Modify: `server/api/packages/[id].get.ts`

- [x] **Step 1: Creare l'endpoint di ricarica**

Creare `server/api/packages/[id]/recharge.post.ts`:

```ts
import { RechargePackageSchema } from '../../../../shared/schemas/package.schema'
import { rechargePackage } from '../../../services/package.service'

// POST /api/packages/:id/recharge — aggiunge una ricarica a un pacchetto A_CONSUMO
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID pacchetto mancante' })
  }

  const body = await readBody(event)
  const parsed = RechargePackageSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati ricarica non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    const pkg = await rechargePackage(id, parsed.data)
    return { data: pkg }
  } catch (err: any) {
    throw createError({ statusCode: 400, statusMessage: err?.message ?? 'Impossibile ricaricare il pacchetto' })
  }
})
```

- [x] **Step 2: Creare l'endpoint del libretto**

Creare `server/api/packages/[id]/recharges.get.ts`:

```ts
import { getPackageRecharges } from '../../../services/package.service'

// GET /api/packages/:id/recharges — storico ricariche del pacchetto
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID pacchetto mancante' })
  }

  const recharges = await getPackageRecharges(id)
  return { data: recharges }
})
```

- [x] **Step 3: Verifica manuale (ricarica end-to-end via API)**

Run (PowerShell):
```powershell
npm run dev
```
Then, in un secondo terminale PowerShell, creare prima un pacchetto A_CONSUMO via UI non è ancora possibile (UI nel Task 8). Per ora verificare l'endpoint con un pacchetto A_CONSUMO creato manualmente: saltare questa verifica funzionale completa al Task 8. Qui basta verificare che il server **parta senza errori** e che la rotta sia registrata: aprire `http://localhost:3000/api/packages/xxx/recharges` nel browser → deve rispondere con JSON `{"data":[]}` (non un 404 di rotta). Fermare con `Ctrl+C`.

- [x] **Step 4: Includere le ricariche nel GET singolo pacchetto**

In `server/api/packages/[id].get.ts`, sostituire l'intero contenuto con:

```ts
import { getPackageById, getPackageRecharges } from '../../services/package.service'

// GET /api/packages/:id
// Restituisce un singolo pacchetto con stati attuali e, per gli A_CONSUMO, il libretto ricariche
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID pacchetto mancante' })
  }

  const pkg = await getPackageById(id)

  if (!pkg) {
    throw createError({ statusCode: 404, statusMessage: 'Pacchetto non trovato' })
  }

  const recharges = pkg.tipo === 'A_CONSUMO' ? await getPackageRecharges(id) : []

  return { data: { ...pkg, recharges } }
})
```

- [x] **Step 5: Commit**

```powershell
git add server/api/packages
git commit -m "feat(api): endpoint recharge + recharges + libretto nel GET pacchetto"
```

---

## Task 6: API — template standard con tariffa oraria

**Files:**
- Modify: `server/api/standard-packages/index.post.ts`

- [x] **Step 1: Aggiungere `tariffaOraria` allo schema e all'insert**

In `server/api/standard-packages/index.post.ts`, sostituire l'intero contenuto con:

```ts
import { db } from '../../database/client'
import { standardPackages } from '../../database/schema'
import { z } from 'zod'

const CreateStandardPackageSchema = z.object({
  nome:        z.string().min(1).max(200).trim(),
  descrizione: z.string().max(500).optional().nullable(),
  tipo:        z.enum(['ORE', 'MENSILE', 'A_CONSUMO']),
  categoria:   z.string().min(1).max(100).trim(),
  oreIncluse:        z.number().nonnegative().max(9999),
  giorniInclusi:     z.number().int().positive().max(365).optional().nullable(),
  orarioGiornaliero: z.number().positive().max(24).optional().nullable(),
  prezzoStandard:    z.number().nonnegative().max(99999),
  tariffaOraria:     z.number().positive().max(9999).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.tipo === 'A_CONSUMO' && !data.tariffaOraria) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tariffaOraria'],
      message: 'Per un template a consumo, la tariffa oraria è obbligatoria',
    })
  }
})

// POST /api/standard-packages — crea nuovo template
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const parsed = CreateStandardPackageSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi: ' + parsed.error.issues[0]?.message })
  }

  const d = parsed.data

  const [created] = await db.insert(standardPackages).values({
    nome:              d.nome,
    descrizione:       d.descrizione ?? null,
    tipo:              d.tipo,
    categoria:         d.categoria,
    oreIncluse:        String(d.oreIncluse),
    giorniInclusi:     d.giorniInclusi ?? null,
    orarioGiornaliero: d.orarioGiornaliero ? String(d.orarioGiornaliero) : null,
    prezzoStandard:    String(d.prezzoStandard),
    tariffaOraria:     d.tariffaOraria ? String(d.tariffaOraria) : null,
  }).returning()

  return created
})
```

> Nota: `oreIncluse` passa da `.positive()` a `.nonnegative()` perché per i template A_CONSUMO le ore incluse possono essere 0 (conta solo la tariffa).

- [x] **Step 2: Verifica manuale (rinviata al Task 7)**

La verifica funzionale del template A_CONSUMO avviene tramite UI nel Task 7. Qui basta che `npm run dev` parta senza errori.

- [x] **Step 3: Commit**

```powershell
git add server/api/standard-packages/index.post.ts
git commit -m "feat(api): template standard accetta tariffaOraria per A_CONSUMO"
```

---

## Task 7: UI Impostazioni — template a consumo

**Files:**
- Modify: `app/pages/impostazioni/index.vue`

- [x] **Step 1: Aggiungere `A_CONSUMO` al dropdown Tipo del form template**

In `app/pages/impostazioni/index.vue`, nel form template, sostituire il blocco `<USelect ... :items="[{ label: 'ORE'...">` del Tipo con:

```vue
            <UFormField label="Tipo" required>
              <USelect
                v-model="nuovo.tipo"
                :items="[
                  { label: 'ORE', value: 'ORE' },
                  { label: 'MENSILE', value: 'MENSILE' },
                  { label: 'A consumo', value: 'A_CONSUMO' },
                ]"
                class="w-full"
              />
            </UFormField>
```

- [x] **Step 2: Aggiungere il blocco campi per A_CONSUMO**

Subito DOPO il blocco `<template v-else>` del MENSILE (la chiusura `</template>` che segue il grid di "Ore totali incluse" + "Prezzo standard"), aggiungere un nuovo blocco condizionale per A_CONSUMO. Per chiarezza, sostituire la struttura condizionale ore/prezzo con tre rami espliciti. Individuare il blocco che inizia con `<!-- ORE: ore inserite direttamente -->` e termina con la chiusura del `<template v-else>` del MENSILE, e sostituirlo INTERAMENTE con:

```vue
          <!-- ORE: ore inserite direttamente -->
          <div v-if="nuovo.tipo === 'ORE'" class="grid grid-cols-2 gap-4">
            <UFormField label="Ore incluse" required>
              <UInputNumber v-model="nuovo.oreIncluse" :min="0.5" :step="0.5" class="w-full" />
            </UFormField>
            <UFormField label="Prezzo standard (€)" required>
              <UInputNumber v-model="nuovo.prezzoStandard" :min="0" :step="10" class="w-full" />
            </UFormField>
          </div>

          <!-- A_CONSUMO: solo la tariffa oraria -->
          <div v-else-if="nuovo.tipo === 'A_CONSUMO'" class="grid grid-cols-2 gap-4">
            <UFormField label="Tariffa oraria (€/ora)" required>
              <UInputNumber v-model="nuovo.tariffaOraria" :min="0.5" :step="0.5" class="w-full" />
            </UFormField>
          </div>

          <!-- MENSILE: giorni × ore/giorno → ore totali calcolate automaticamente -->
          <template v-else>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Giorni inclusi" required>
                <UInputNumber v-model="nuovo.giorniInclusi" :min="1" :step="1" class="w-full" />
              </UFormField>
              <UFormField label="Ore al giorno (max)" required>
                <UInputNumber v-model="nuovo.orarioGiornaliero" :min="0.5" :step="0.5" class="w-full" />
              </UFormField>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Ore totali incluse">
                <UInputNumber :model-value="nuovo.oreIncluse" disabled class="w-full" />
                <template #description>
                  <span class="text-xs text-slate-400">{{ nuovo.giorniInclusi || 0 }} × {{ nuovo.orarioGiornaliero || 0 }} = <strong>{{ nuovo.oreIncluse }} ore</strong></span>
                </template>
              </UFormField>
              <UFormField label="Prezzo standard (€)" required>
                <UInputNumber v-model="nuovo.prezzoStandard" :min="0" :step="10" class="w-full" />
              </UFormField>
            </div>
          </template>
```

- [x] **Step 3: Aggiungere `tariffaOraria` allo stato reattivo e al reset**

Nel `<script setup>`, nell'oggetto `reactive({ ... })` di `nuovo`, aggiungere il campo dopo `prezzoStandard`:

```ts
  prezzoStandard:    150,
  tariffaOraria:     15,
```

E in `apriModalCrea`, dentro `Object.assign(nuovo, { ... })`, aggiungere `tariffaOraria: 15` all'elenco dei reset.

- [x] **Step 4: Inviare `tariffaOraria` alla creazione del template**

In `creaTemplate`, nella costruzione di `body`, dopo il blocco `if (nuovo.tipo === 'MENSILE') { ... }`, aggiungere:

```ts
    if (nuovo.tipo === 'A_CONSUMO') {
      body.tariffaOraria = nuovo.tariffaOraria
    }
```

- [x] **Step 5: Mostrare la tariffa nella lista template**

Nel template della lista, nella riga descrittiva sotto il nome (`<p class="text-xs text-slate-500 mt-0.5">`), aggiungere la visualizzazione della tariffa per A_CONSUMO. Sostituire il paragrafo con:

```vue
            <p class="text-xs text-slate-500 mt-0.5">
              <template v-if="t.tipo === 'A_CONSUMO'">
                Tariffa: € {{ parseFloat(t.tariffaOraria).toFixed(2) }}/ora
              </template>
              <template v-else>
                {{ t.oreIncluse }} ore
                <template v-if="t.tipo === 'MENSILE' && t.giorniInclusi"> · {{ t.giorniInclusi }} giorni · {{ t.orarioGiornaliero }}h/giorno</template>
                · € {{ parseFloat(t.prezzoStandard).toFixed(2) }}
              </template>
              <span v-if="t.descrizione" class="ml-2 text-slate-400">— {{ t.descrizione }}</span>
            </p>
```

- [x] **Step 6: Verifica manuale**

Run (PowerShell):
```powershell
npm run dev
```
Aprire `http://localhost:3000/impostazioni` → "Aggiungi template" → Tipo "A consumo" → compare solo il campo **Tariffa oraria**. Inserire nome "A consumo Medie", categoria "Medie", tariffa 15 → Salva. Expected: il template appare in lista con testo "Tariffa: € 15.00/ora". Fermare con `Ctrl+C`.

- [x] **Step 7: Commit**

```powershell
git add app/pages/impostazioni/index.vue
git commit -m "feat(ui): template a consumo con tariffa oraria in Impostazioni"
```

---

## Task 8: UI Nuovo Pacchetto — tipo A_CONSUMO

**Files:**
- Modify: `app/pages/pacchetti/index.vue`

- [x] **Step 1: Aggiungere "A consumo" al dropdown Tipo**

In `app/pages/pacchetti/index.vue`, nel form Nuovo Pacchetto, sostituire il blocco `<UFormField label="Tipo" required>` con:

```vue
          <UFormField label="Tipo" required>
            <USelect
              v-model="nuovo.tipo"
              :items="[
                { label: 'Pacchetto ORE', value: 'ORE' },
                { label: 'Pacchetto MENSILE', value: 'MENSILE' },
                { label: 'A consumo (crediti)', value: 'A_CONSUMO' },
              ]"
              class="w-full"
              @change="aggiornaDatiScadenza"
            />
          </UFormField>
```

- [x] **Step 2: Aggiungere il blocco campi A_CONSUMO**

Subito DOPO il blocco `<UFormField v-if="nuovo.tipo === 'ORE'" label="Ore acquistate" ...>` (e prima del `<template v-else>` del MENSILE), aggiungere. Per chiarezza dei rami, individuare il commento `<!-- ORE: ore inserite direttamente -->` e il successivo `<!-- MENSILE: ... -->` con il suo `<template v-else>`, e sostituire entrambi i rami con questa struttura a tre rami:

```vue
          <!-- ORE: ore inserite direttamente -->
          <UFormField v-if="nuovo.tipo === 'ORE'" label="Ore acquistate" required>
            <UInputNumber v-model="nuovo.oreAcquistate" :min="0.5" :step="0.5" class="w-full" />
          </UFormField>

          <!-- A_CONSUMO: tariffa + ore iniziali → totale automatico -->
          <template v-else-if="nuovo.tipo === 'A_CONSUMO'">
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Tariffa oraria (€/ora)" required>
                <UInputNumber v-model="nuovo.tariffaOraria" :min="0.5" :step="0.5" class="w-full" />
              </UFormField>
              <UFormField label="Ore iniziali" required>
                <UInputNumber v-model="nuovo.oreAcquistate" :min="0.5" :step="0.5" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Totale iniziale (€)">
              <UInputNumber v-model="nuovo.prezzoTotale" :min="0" :step="10" class="w-full" />
              <template #description>
                <span class="text-xs text-slate-400">
                  Suggerito: {{ nuovo.oreAcquistate || 0 }} ore × {{ nuovo.tariffaOraria || 0 }} € = <strong>{{ ((nuovo.oreAcquistate || 0) * (nuovo.tariffaOraria || 0)).toFixed(2) }} €</strong> (modificabile)
                </span>
              </template>
            </UFormField>
          </template>

          <!-- MENSILE: giorni × ore/giorno → ore totali calcolate automaticamente -->
          <template v-else>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Giorni acquistati" required>
                <UInputNumber v-model="nuovo.giorniAcquistati" :min="1" :step="1" class="w-full" />
              </UFormField>
              <UFormField label="Ore al giorno (max)" required>
                <UInputNumber v-model="nuovo.orarioGiornaliero" :min="0.5" :step="0.5" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Ore totali incluse">
              <UInputNumber :model-value="nuovo.oreAcquistate" disabled class="w-full" />
              <template #description>
                <span class="text-xs text-slate-400">
                  Calcolato automaticamente: {{ nuovo.giorniAcquistati || 0 }} giorni × {{ nuovo.orarioGiornaliero || 0 }} ore = <strong>{{ nuovo.oreAcquistate }} ore</strong>
                </span>
              </template>
            </UFormField>
          </template>
```

- [x] **Step 3: Nascondere il campo "Prezzo totale" generico per A_CONSUMO**

Più in basso nel form c'è il grid con `<UFormField label="Prezzo totale (€)" required>` e `<UFormField label="Data inizio" required>`. Per A_CONSUMO il prezzo è già gestito sopra (Totale iniziale). Sostituire quel grid con una versione che mostra il prezzo solo per ORE/MENSILE:

```vue
          <div class="grid grid-cols-2 gap-4">
            <UFormField v-if="nuovo.tipo !== 'A_CONSUMO'" label="Prezzo totale (€)" required>
              <UInputNumber v-model="nuovo.prezzoTotale" :min="0" :step="10" class="w-full" />
            </UFormField>
            <UFormField label="Data inizio" required>
              <UInput v-model="nuovo.dataInizio" type="date" class="w-full" />
            </UFormField>
          </div>
```

- [x] **Step 4: Aggiungere `tariffaOraria` allo stato e gestire la scadenza A_CONSUMO**

Nel `<script setup>`, nell'oggetto `reactive` di `nuovo`, aggiungere dopo `orarioGiornaliero`:

```ts
  orarioGiornaliero: 3,
  tariffaOraria:     15,
```

E in `apriModalCrea`, dentro `Object.assign(nuovo, { ... })`, aggiungere `tariffaOraria: 15` all'elenco dei reset.

- [x] **Step 5: Estendere `calcolaDataScadenza` per A_CONSUMO (stessa logica di ORE)**

Nella funzione `calcolaDataScadenza`, il ramo ORE va usato anche per A_CONSUMO. Sostituire la firma e la prima riga:

```ts
function calcolaDataScadenza(tipo: 'ORE' | 'MENSILE' | 'A_CONSUMO'): string {
  if (tipo === 'ORE' || tipo === 'A_CONSUMO') {
```

- [x] **Step 6: Calcolare il totale suggerito quando cambiano ore/tariffa (A_CONSUMO)**

Subito dopo il `watch` esistente che ricalcola le ore per il MENSILE, aggiungere un secondo `watch` per il totale suggerito A_CONSUMO:

```ts
// Per A_CONSUMO: il totale segue ore × tariffa, ma resta modificabile a mano.
// Aggiorniamo il totale solo quando cambiano ore o tariffa (non quando l'utente edita il totale).
watch(
  () => [nuovo.tipo, nuovo.oreAcquistate, nuovo.tariffaOraria],
  () => {
    if (nuovo.tipo === 'A_CONSUMO') {
      nuovo.prezzoTotale = (nuovo.oreAcquistate || 0) * (nuovo.tariffaOraria || 0)
    }
  },
)
```

- [x] **Step 7: Inviare `tariffaOraria` e `dataScadenza` alla creazione**

In `creaPacchetto`, nella costruzione di `body`, dopo `if (nuovo.dataScadenza) body.dataScadenza = nuovo.dataScadenza`, aggiungere:

```ts
    if (nuovo.tipo === 'A_CONSUMO') {
      body.tariffaOraria = nuovo.tariffaOraria
    }
```

- [x] **Step 8: Far funzionare il selettore template anche per gli A_CONSUMO**

In `applicaTemplate`, dopo le righe che impostano `oreAcquistate`/`prezzoTotale`, gestire il caso A_CONSUMO leggendo la tariffa dal template. Sostituire la funzione `applicaTemplate` con:

```ts
function applicaTemplate(templateId: string) {
  const opt = templateOptions.value.find((t: any) => t.value === templateId)
  if (!opt?.raw) return
  const t = opt.raw
  nuovo.nome = t.nome
  nuovo.tipo = t.tipo
  if (t.tipo === 'A_CONSUMO') {
    nuovo.tariffaOraria = parseFloat(t.tariffaOraria ?? '0')
    // ore iniziali e totale restano a discrezione dell'operatore (il watch ricalcola il totale)
  } else {
    nuovo.oreAcquistate = parseFloat(t.oreIncluse)
    nuovo.prezzoTotale  = parseFloat(t.prezzoStandard)
    if (t.giorniInclusi)     nuovo.giorniAcquistati  = t.giorniInclusi
    if (t.orarioGiornaliero) nuovo.orarioGiornaliero = parseFloat(t.orarioGiornaliero)
  }
  nuovo.dataScadenza = calcolaDataScadenza(t.tipo)
}
```

- [x] **Step 9: Aggiornare l'etichetta del template nel selettore (mostra la tariffa per A_CONSUMO)**

Sostituire il `computed` `templateOptions` con:

```ts
const templateOptions = computed(() =>
  (templatesData.value ?? []).map((t: any) => ({
    label: t.tipo === 'A_CONSUMO'
      ? `${t.nome} — A consumo, €${parseFloat(t.tariffaOraria ?? '0').toFixed(0)}/ora`
      : `${t.nome} — ${t.tipo}, ${t.oreIncluse} ore, €${parseFloat(t.prezzoStandard).toFixed(0)}`,
    value: t.id,
    raw: t,
  }))
)
```

- [x] **Step 10: Verifica manuale (creazione A_CONSUMO)**

Run (PowerShell):
```powershell
npm run dev
```
Aprire `http://localhost:3000/pacchetti` → "Nuovo Pacchetto":
1. Scegli template "A consumo Medie" → tipo diventa A_CONSUMO, tariffa = 15.
2. Cambia tariffa a 13, ore iniziali 10 → "Totale iniziale" suggerisce 130 €.
3. Seleziona uno studente → Salva.

Expected: il pacchetto si crea senza errori. Riaprendo la lista, compare un pacchetto con scadenza 15/06. Fermare con `Ctrl+C`.

- [x] **Step 11: Commit**

```powershell
git add app/pages/pacchetti/index.vue
git commit -m "feat(ui): creazione pacchetto A_CONSUMO con tariffa e totale automatico"
```

---

## Task 9: UI Ricarica + libretto nella scheda studente

**Files:**
- Modify: `app/pages/pacchetti/index.vue` (azione + modale Ricarica)
- Modify: `app/pages/studenti/[id].vue` (libretto)

- [x] **Step 1: Aggiungere l'azione "Ricarica" nel menu dei pacchetti A_CONSUMO**

In `app/pages/pacchetti/index.vue`, sostituire la funzione `azioniPacchetto` con:

```ts
function azioniPacchetto(row: any) {
  const azioni: any[] = [
    { label: 'Registra pagamento', icon: 'i-heroicons-banknotes', onSelect: () => aprirePagamento(row) },
  ]
  if (row.tipo === 'A_CONSUMO') {
    azioni.unshift({ label: 'Ricarica ore', icon: 'i-heroicons-bolt', onSelect: () => aprireRicarica(row) })
  }
  return [azioni]
}
```

> Nota: in Nuxt UI v4 `UDropdownMenu` usa `onSelect` (non `click`) per le voci. Questo corregge anche l'azione pagamento esistente.

- [x] **Step 2: Aggiungere la modale di ricarica nel template**

In `app/pages/pacchetti/index.vue`, subito DOPO la `</UModal>` della modale pagamento, aggiungere:

```vue
    <!-- ─── MODAL RICARICA (solo A_CONSUMO) ─── -->
    <UModal v-model:open="modalRicaricaAperto" title="Ricarica pacchetto">
      <template #body>
        <div class="space-y-4">
          <UAlert v-if="pacchettoRicarica" color="info" variant="subtle"
            :title="pacchettoRicarica.nome"
            :description="`Tariffa: € ${parseFloat(pacchettoRicarica.tariffaOraria ?? '0').toFixed(2)}/ora · Ore attuali: ${parseFloat(pacchettoRicarica.oreResiduo).toFixed(1)}`"
          />

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Ore da aggiungere" required>
              <UInputNumber v-model="ricarica.ore" :min="0.5" :step="0.5" class="w-full" />
            </UFormField>
            <UFormField label="Totale (€)" required>
              <UInputNumber v-model="ricarica.importo" :min="0" :step="10" class="w-full" />
              <template #description>
                <span class="text-xs text-slate-400">Suggerito: {{ totaleRicaricaSuggerito.toFixed(2) }} €</span>
              </template>
            </UFormField>
          </div>

          <UFormField label="Data" required>
            <UInput v-model="ricarica.data" type="date" class="w-full" />
          </UFormField>

          <USeparator label="Pagamento (opzionale)" />

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Metodo pagamento">
              <USelect
                v-model="ricarica.metodo"
                :items="[
                  { label: 'Non pagato ora', value: 'NESSUNO' },
                  { label: 'Contanti', value: 'CONTANTI' },
                  { label: 'Bonifico', value: 'BONIFICO' },
                  { label: 'POS', value: 'POS' },
                  { label: 'Assegno', value: 'ASSEGNO' },
                ]"
                class="w-full"
              />
            </UFormField>
            <UFormField label="">
              <div class="flex items-center gap-2 mt-6">
                <UCheckbox v-model="ricarica.fattura" label="Richiede fattura" />
              </div>
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="modalRicaricaAperto = false">Annulla</UButton>
          <UButton :loading="salvandoRicarica" @click="salvaRicarica">Ricarica</UButton>
        </div>
      </template>
    </UModal>
```

- [x] **Step 3: Aggiungere lo stato e le funzioni della ricarica nello script**

In `app/pages/pacchetti/index.vue`, subito dopo le funzioni della modale pagamento (`salvaPagamento`), aggiungere:

```ts
// ─── Modal ricarica (A_CONSUMO) ───
const modalRicaricaAperto = ref(false)
const salvandoRicarica    = ref(false)
const pacchettoRicarica   = ref<any>(null)

const ricarica = reactive({
  ore:     10,
  importo: 0,
  data:    new Date().toISOString().slice(0, 10),
  metodo:  'NESSUNO' as string,
  fattura: false,
})

const totaleRicaricaSuggerito = computed(() => {
  const tariffa = parseFloat(pacchettoRicarica.value?.tariffaOraria ?? '0')
  return (ricarica.ore || 0) * tariffa
})

// Il totale segue ore × tariffa finché l'utente non lo modifica a mano
watch(() => ricarica.ore, () => {
  ricarica.importo = totaleRicaricaSuggerito.value
})

function aprireRicarica(row: any) {
  pacchettoRicarica.value = row
  ricarica.ore     = 10
  ricarica.importo = (10) * parseFloat(row.tariffaOraria ?? '0')
  ricarica.data    = new Date().toISOString().slice(0, 10)
  ricarica.metodo  = 'NESSUNO'
  ricarica.fattura = false
  modalRicaricaAperto.value = true
}

async function salvaRicarica() {
  if (!pacchettoRicarica.value) return
  salvandoRicarica.value = true
  try {
    const body: any = {
      ore:             ricarica.ore,
      importo:         ricarica.importo,
      data:            ricarica.data,
      richiedeFattura: ricarica.fattura,
    }
    if (ricarica.metodo !== 'NESSUNO') body.metodoPagamento = ricarica.metodo

    await $fetch(`/api/packages/${pacchettoRicarica.value.id}/recharge`, { method: 'POST', body })
    toast.add({ title: 'Ricarica registrata', color: 'success', icon: 'i-heroicons-check-circle' })
    modalRicaricaAperto.value = false
    refresh()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile ricaricare', color: 'error' })
  } finally {
    salvandoRicarica.value = false
  }
}
```

- [x] **Step 4: Verifica manuale (ricarica)**

Run (PowerShell):
```powershell
npm run dev
```
Aprire `http://localhost:3000/pacchetti` → sul pacchetto A_CONSUMO creato, menu "⋮" → "Ricarica ore" → aggiungi 10 ore (totale 130 €), metodo Contanti → "Ricarica". Expected: toast verde, e nella lista le ore residue del pacchetto salgono di 10. Fermare con `Ctrl+C`.

- [x] **Step 5: Mostrare il libretto ricariche nella scheda studente**

In `app/pages/studenti/[id].vue`, dentro il ciclo `v-for="pkg in pacchetti"` della sezione pacchetti, subito dopo il blocco `<div class="text-xs text-slate-400 text-right ...">` (la colonna date) e prima della chiusura del `<div>` riga, NON basta: serve un'area espandibile sotto. Sostituire l'INTERO blocco `<div v-for="pkg in pacchetti" ...> ... </div>` con:

```vue
          <div
            v-for="pkg in pacchetti"
            :key="pkg.id"
            class="rounded-lg border border-slate-100"
          >
            <div class="flex items-center justify-between p-3 hover:bg-slate-50">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium text-sm text-slate-800">{{ pkg.nome }}</span>
                  <UBadge color="neutral" variant="outline" size="xs">{{ pkg.tipo }}</UBadge>
                  <StatoBadge v-for="s in pkg.stati" :key="s" :stato="s" />
                </div>
                <div class="text-xs text-slate-500 mt-0.5">
                  {{ pkg.tipo === 'ORE' || pkg.tipo === 'A_CONSUMO'
                    ? `${pkg.oreResiduo} / ${pkg.oreAcquistate} ore`
                    : `${pkg.giorniResiduo} / ${pkg.giorniAcquistati} giorni` }}
                  <span v-if="pkg.tipo === 'A_CONSUMO' && pkg.tariffaOraria" class="text-slate-400 ml-2">
                    · € {{ parseFloat(pkg.tariffaOraria).toFixed(2) }}/ora
                  </span>
                  <span v-if="pkg.importoResiduo && parseFloat(pkg.importoResiduo) > 0" class="text-orange-500 font-medium ml-2">
                    Residuo € {{ parseFloat(pkg.importoResiduo).toFixed(2) }}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-3 ml-4 shrink-0">
                <div class="text-xs text-slate-400 text-right">
                  <div>Inizio: {{ formatData(pkg.dataInizio) }}</div>
                  <div v-if="pkg.dataScadenza">Scade: {{ formatData(pkg.dataScadenza) }}</div>
                </div>
                <UButton
                  v-if="pkg.tipo === 'A_CONSUMO'"
                  size="xs"
                  variant="outline"
                  icon="i-heroicons-list-bullet"
                  @click="toggleLibretto(pkg.id)"
                >
                  Libretto
                </UButton>
              </div>
            </div>

            <!-- Libretto ricariche (espandibile, solo A_CONSUMO) -->
            <div v-if="librettoAperto === pkg.id" class="border-t border-slate-100 bg-slate-50 px-3 py-2">
              <p v-if="librettoLoading" class="text-xs text-slate-400 py-2">Caricamento…</p>
              <p v-else-if="librettoRighe.length === 0" class="text-xs text-slate-400 py-2">Nessuna ricarica registrata.</p>
              <table v-else class="w-full text-xs">
                <thead>
                  <tr class="text-slate-400 text-left">
                    <th class="py-1 font-medium">Data</th>
                    <th class="py-1 font-medium">Ore</th>
                    <th class="py-1 font-medium">Tariffa</th>
                    <th class="py-1 font-medium text-right">Totale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in librettoRighe" :key="r.id" class="text-slate-600 border-t border-slate-100">
                    <td class="py-1">{{ formatData(r.data) }}</td>
                    <td class="py-1">+{{ parseFloat(r.ore).toFixed(1) }}</td>
                    <td class="py-1">€ {{ parseFloat(r.tariffaOraria).toFixed(2) }}/ora</td>
                    <td class="py-1 text-right font-medium">€ {{ parseFloat(r.importo).toFixed(2) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
```

- [x] **Step 6: Aggiungere la logica del libretto nello script**

In `app/pages/studenti/[id].vue`, nel `<script setup>`, dopo la dichiarazione di `pacchetti` (il `computed`), aggiungere:

```ts
// ─── Libretto ricariche (A_CONSUMO) ───
const librettoAperto  = ref<string | null>(null)
const librettoRighe   = ref<any[]>([])
const librettoLoading = ref(false)

async function toggleLibretto(packageId: string) {
  if (librettoAperto.value === packageId) {
    librettoAperto.value = null
    return
  }
  librettoAperto.value = packageId
  librettoLoading.value = true
  librettoRighe.value = []
  try {
    const res = await $fetch<{ data: any[] }>(`/api/packages/${packageId}/recharges`)
    librettoRighe.value = res.data ?? []
  } catch {
    librettoRighe.value = []
  } finally {
    librettoLoading.value = false
  }
}
```

- [x] **Step 7: Verifica manuale (libretto)**

Run (PowerShell):
```powershell
npm run dev
```
Aprire la scheda dello studente che ha il pacchetto A_CONSUMO (`/studenti/<id>`):
1. Il pacchetto mostra "X / Y ore" e "€ 13.00/ora".
2. Clic su "Libretto" → si espande una tabella con le righe: la ricarica iniziale e quella aggiunta nel Task 9, con data/ore/tariffa/totale.
3. Clic di nuovo su "Libretto" → si richiude.

Expected: lo storico è corretto e coerente con le ricariche fatte. Fermare con `Ctrl+C`.

- [x] **Step 8: Commit**

```powershell
git add app/pages/pacchetti/index.vue app/pages/studenti/[id].vue
git commit -m "feat(ui): azione Ricarica + libretto ricariche nella scheda studente"
```

---

## Verifica finale end-to-end (checklist manuale completa)

Eseguire `npm run dev` e seguire in ordine:

1. **Impostazioni** → crea template "A consumo Medie", tariffa 15 €/ora → appare con "Tariffa: € 15.00/ora".
2. **Nuovo Pacchetto** → scegli quel template → tipo A_CONSUMO, tariffa 15 → cambiala a 13 → ore iniziali 10 → totale suggerito 130 € → scegli studente → Salva.
3. **Lista pacchetti** → il pacchetto compare con scadenza 15/06 e badge stato.
4. **Menu ⋮ → Ricarica ore** → +10 ore, Contanti → ore residue salgono a 20.
5. **Scheda studente** → il pacchetto mostra "20 / 20 ore · € 13.00/ora" → "Libretto" mostra 2 righe (iniziale 10, ricarica 10).
6. **Registra una lezione** per quell'alunno (pagina lezioni/flusso esistente) → ore residue scendono a 19 (consumo identico a ORE).
7. **Porta le ore a 0** (più lezioni o test) → stato "Esaurito".

Se tutti i punti passano, la funzionalità è completa.

---

## Self-Review (copertura spec)

| Requisito spec | Task |
|---|---|
| Enum `A_CONSUMO` | Task 1 (DB), Task 2 (Zod) |
| `tariffaOraria` su standardPackages e packages | Task 1, Task 6, Task 7 |
| Tabella `package_recharges` + relazioni | Task 1 |
| Tariffa da template, modificabile per alunno | Task 7 (template), Task 8 (override) |
| Ricarica: ore → totale automatico, modificabile | Task 8 (creazione), Task 9 (ricarica) |
| Pagamento condizionale (prepagato default) | Task 4 (service), Task 9 (UI metodo opzionale) |
| Libretto ricariche (Approccio B) | Task 1, Task 4, Task 5, Task 9 |
| Scadenza fissa 15/06 | Task 2 (schema dataScadenza), Task 3 (service), Task 8 (calcolo) |
| Consumo lezioni invariato | Nessuna modifica necessaria (verifica al punto 6 finale) |
| Stati invariati | `computePackageStates` riusato in Task 3/4 |
| API: POST recharge, GET recharges, GET :id con libretto | Task 5 |
| UI: Impostazioni, Nuovo Pacchetto, Scheda studente | Task 7, 8, 9 |
