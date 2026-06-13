# Fase 9 — Sprint 1: Modulo Tutor — Implementation Plan

> **STATO: ✅ COMPLETATO — 13 Giugno 2026** — Tutti gli 11 task implementati, revisionati e committati. Commit range: `6e95794` → `81014dc`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il placeholder `/tutor` con il modulo tutor completo: lista con KPI, creazione account tutor, gestione compensi mensili, rimborsi spese, statistiche di performance.

**Architecture:** Tre layer — Zod schemas condivisi (`#shared`), service con batch queries per performance, API routes thin wrappers, due pagine Vue (lista + dettaglio con 4 tab). Zero N+1 queries: tutto risolto con `Promise.all` e CTE SQL.

**Tech Stack:** Nuxt 4, Drizzle ORM (PostgreSQL), Zod v4, bcryptjs, Nuxt UI v4 (UTable `:data`/`-cell`, UModal, UTabs), nuxt-auth-utils (`useUserSession`)

---

## File da creare / modificare

| Azione | File |
|--------|------|
| **Crea** | `shared/schemas/tutor.schema.ts` |
| **Crea** | `server/services/tutor.service.ts` |
| **Crea** | `server/api/tutors/index.get.ts` |
| **Crea** | `server/api/tutors/index.post.ts` |
| **Crea** | `server/api/tutors/[id].get.ts` |
| **Crea** | `server/api/tutors/[id].put.ts` |
| **Crea** | `server/api/tutors/[id].delete.ts` |
| **Crea** | `server/api/tutors/[id]/compensation.get.ts` |
| **Crea** | `server/api/tutors/[id]/pay.post.ts` |
| **Crea** | `server/api/tutors/[id]/performance.get.ts` |
| **Crea** | `server/api/tutors/[id]/stats.get.ts` |
| **Crea** | `server/api/tutors/[id]/reimbursements.get.ts` |
| **Crea** | `server/api/tutors/[id]/reimbursements.post.ts` |
| **Crea** | `server/api/tutors/[id]/reimbursements/[rid]/pay.post.ts` |
| **Modifica** | `app/pages/tutor/index.vue` |
| **Crea** | `app/pages/tutor/[id].vue` |

---

## Task 1: Zod Schemas condivisi

**Files:**
- Create: `shared/schemas/tutor.schema.ts`

- [ ] **Step 1.1: Crea il file schema**

```typescript
// shared/schemas/tutor.schema.ts
import { z } from 'zod'

// ─── Crea Tutor ───────────────────────────────
export const CreateTutorSchema = z.object({
  firstName:         z.string({ message: 'Nome obbligatorio' }).min(1).max(100).trim(),
  lastName:          z.string({ message: 'Cognome obbligatorio' }).min(1).max(100).trim(),
  email:             z.string({ message: 'Email obbligatoria' }).email('Email non valida').toLowerCase().trim(),
  password:          z.string({ message: 'Password obbligatoria' }).min(8, 'Password: almeno 8 caratteri'),
  phone:             z.string().regex(/^[\d\s+\-().]{7,20}$/, 'Telefono non valido').optional().nullable(),
  modalitaPagamento: z.enum(['ORE', 'FORFAIT']).default('ORE'),
  importoForfait:    z.string().optional().nullable(),
})
export type CreateTutorInput = z.infer<typeof CreateTutorSchema>

// ─── Aggiorna Tutor ───────────────────────────
export const UpdateTutorSchema = z.object({
  firstName:         z.string().min(1).max(100).trim().optional(),
  lastName:          z.string().min(1).max(100).trim().optional(),
  email:             z.string().email('Email non valida').toLowerCase().trim().optional(),
  phone:             z.string().optional().nullable(),
  indirizzo:         z.string().optional().nullable(),
  citta:             z.string().max(100).optional().nullable(),
  cap:               z.string().max(10).optional().nullable(),
  codiceFiscale:     z.string().max(20).optional().nullable(),
  partitaIva:        z.string().max(20).optional().nullable(),
  materie:           z.array(z.string()).optional(),
  noteInterne:       z.string().optional().nullable(),
  modalitaPagamento: z.enum(['ORE', 'FORFAIT']).optional(),
  importoForfait:    z.string().optional().nullable(),
})
export type UpdateTutorInput = z.infer<typeof UpdateTutorSchema>

// ─── Filtri lista ─────────────────────────────
export const TutorQuerySchema = z.object({
  search:      z.string().optional(),
  active:      z.enum(['true', 'false']).optional(),
  daLiquidare: z.enum(['true', 'false']).optional(),
})
export type TutorQuery = z.infer<typeof TutorQuerySchema>

// ─── Liquida mese ─────────────────────────────
export const PayTutorSchema = z.object({
  mese:    z.string({ message: 'Mese obbligatorio' }),
  importo: z.string({ message: 'Importo obbligatorio' }),
  metodo:  z.enum(['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']),
  proBono: z.boolean().default(false),
  note:    z.string().optional(),
})
export type PayTutorInput = z.infer<typeof PayTutorSchema>

// ─── Rimborso spese ───────────────────────────
export const CreateReimbursementSchema = z.object({
  importo:       z.string({ message: 'Importo obbligatorio' }),
  descrizione:   z.string({ message: 'Descrizione obbligatoria' }).min(1),
  dataRichiesta: z.string().optional(),
  note:          z.string().optional(),
})
export type CreateReimbursementInput = z.infer<typeof CreateReimbursementSchema>

export const PayReimbursementSchema = z.object({
  importoPagamento: z.string({ message: 'Importo pagamento obbligatorio' }),
  metodo:           z.enum(['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']),
  note:             z.string().optional(),
})
export type PayReimbursementInput = z.infer<typeof PayReimbursementSchema>
```

- [ ] **Step 1.2: Verifica manuale che il file esiste**

Controlla che `shared/schemas/tutor.schema.ts` sia presente nella cartella.

- [ ] **Step 1.3: Commit**

```powershell
git add shared/schemas/tutor.schema.ts
git commit -m "feat: aggiunge Zod schemas per modulo tutor"
```

---

## Task 2: Service — Parte 1 (CRUD tutor)

**Files:**
- Create: `server/services/tutor.service.ts`

- [ ] **Step 2.1: Crea il service con listTutors, getTutorById, createTutor, updateTutor, deactivateTutor**

```typescript
// server/services/tutor.service.ts
import { db } from '../database/client'
import {
  users, tutorProfiles, lessons, tutorPayments, tutorReimbursements,
  accountingEntries, lessonStudents, packages,
} from '../database/schema'
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import type {
  CreateTutorInput, UpdateTutorInput, TutorQuery,
  PayTutorInput, CreateReimbursementInput, PayReimbursementInput,
} from '../../shared/schemas/tutor.schema'

// ─────────────────────────────────────────────
// LIST — GET /api/tutors
// 4 query parallele per evitare N+1
// ─────────────────────────────────────────────
export async function listTutors(query: TutorQuery) {
  const now = new Date()
  const meseStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const meseEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  // Inizio periodo arretrati: primo del mese 12 mesi fa
  const pastStart = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
  // Fine periodo arretrati: fine del mese scorso
  const pastEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  const searchWhere = query.search
    ? or(
        ilike(users.firstName, `%${query.search}%`),
        ilike(users.lastName,  `%${query.search}%`),
        ilike(users.email,     `%${query.search}%`),
      )
    : undefined

  const activeWhere = query.active !== undefined
    ? eq(users.active, query.active === 'true')
    : undefined

  const [tutorsList, lessonSums, paymentSumsMese, arrearsRows] = await Promise.all([
    // 1. Tutti i tutor con profilo
    db.select({
      id:                users.id,
      email:             users.email,
      firstName:         users.firstName,
      lastName:          users.lastName,
      phone:             users.phone,
      active:            users.active,
      modalitaPagamento: tutorProfiles.modalitaPagamento,
      importoForfait:    tutorProfiles.importoForfait,
      createdAt:         users.createdAt,
    })
    .from(users)
    .leftJoin(tutorProfiles, eq(tutorProfiles.userId, users.id))
    .where(and(eq(users.role, 'TUTOR'), activeWhere, searchWhere))
    .orderBy(asc(users.lastName), asc(users.firstName)),

    // 2. Somma compensi lezioni mese corrente per tutorId
    db.select({
      tutorId:    lessons.tutorId,
      numLezioni: sql<string>`COUNT(*)::text`,
      compenso:   sql<string>`COALESCE(SUM(${lessons.compensoTutor}::numeric), 0)::text`,
    })
    .from(lessons)
    .where(and(gte(lessons.data, meseStart), lte(lessons.data, meseEnd)))
    .groupBy(lessons.tutorId),

    // 3. Somma pagamenti mese corrente per tutorId
    db.select({
      tutorId: tutorPayments.tutorId,
      pagato:  sql<string>`COALESCE(SUM(${tutorPayments.importo}::numeric), 0)::text`,
    })
    .from(tutorPayments)
    .where(and(gte(tutorPayments.mese, meseStart), lte(tutorPayments.mese, meseEnd)))
    .groupBy(tutorPayments.tutorId),

    // 4. Arretrati: mesi passati con compenso > pagato (CTE SQL)
    db.execute(sql`
      WITH monthly_lessons AS (
        SELECT tutor_id,
               DATE_TRUNC('month', data) AS mese,
               FLOOR(COALESCE(SUM(compenso_tutor::numeric), 0)) AS compenso_calcolato
        FROM lessons
        WHERE data >= ${pastStart} AND data <= ${pastEnd}
        GROUP BY tutor_id, DATE_TRUNC('month', data)
      ),
      monthly_payments AS (
        SELECT tutor_id,
               DATE_TRUNC('month', mese) AS mese,
               COALESCE(SUM(importo::numeric), 0) AS pagato
        FROM tutor_payments
        WHERE mese >= ${pastStart} AND mese <= ${pastEnd}
        GROUP BY tutor_id, DATE_TRUNC('month', mese)
      )
      SELECT ml.tutor_id AS "tutorId",
             COUNT(*)::text AS "mesiArretrati",
             COALESCE(SUM(ml.compenso_calcolato - COALESCE(mp.pagato, 0)), 0)::text AS "totaleArretrati"
      FROM monthly_lessons ml
      LEFT JOIN monthly_payments mp ON ml.tutor_id = mp.tutor_id AND ml.mese = mp.mese
      WHERE ml.compenso_calcolato > COALESCE(mp.pagato, 0)
      GROUP BY ml.tutor_id
    `),
  ])

  // Mappe per lookup O(1)
  const lessonMap  = new Map((lessonSums).map(r => [r.tutorId, r]))
  const payMap     = new Map((paymentSumsMese).map(r => [r.tutorId, r]))
  const arrearsMap = new Map((arrearsRows as any[]).map(r => [r.tutorId as string, r]))

  // KPI aggregati
  let tutoriAttivi   = 0
  let daLiquidare    = 0
  let totaleDovuto   = 0
  let sumLiquidazioni = 0
  let countLiquidati  = 0

  const tutors = tutorsList.map(tutor => {
    const ls = lessonMap.get(tutor.id)
    const ps = payMap.get(tutor.id)
    const ar = arrearsMap.get(tutor.id)

    const compensoCalcolato = Math.floor(parseFloat(ls?.compenso ?? '0'))
    const pagato            = parseFloat(ps?.pagato ?? '0')
    const compensoResiduo   = Math.max(0, compensoCalcolato - pagato)
    const mesiArretrati     = parseInt(ar?.mesiArretrati ?? '0')
    const totaleArretrati   = parseFloat(ar?.totaleArretrati ?? '0')

    if (tutor.active) tutoriAttivi++
    if (compensoResiduo > 0.01) { daLiquidare++; totaleDovuto += compensoResiduo }
    if (compensoCalcolato > 0) { sumLiquidazioni += compensoCalcolato; countLiquidati++ }

    return {
      ...tutor,
      numLezioniMese: parseInt(ls?.numLezioni ?? '0'),
      compensoCalcolato,
      compensoResiduo: Number(compensoResiduo.toFixed(2)),
      mesiArretrati,
      totaleArretrati: Number(totaleArretrati.toFixed(2)),
    }
  })

  const filtered = query.daLiquidare === 'true'
    ? tutors.filter(t => t.compensoResiduo > 0.01)
    : tutors

  return {
    data: filtered,
    kpi: {
      tutoriAttivi,
      daLiquidare,
      totaleDovuto:       Number(totaleDovuto.toFixed(2)),
      mediaLiquidazione:  countLiquidati > 0 ? Number((sumLiquidazioni / countLiquidati).toFixed(2)) : 0,
    },
  }
}

// ─────────────────────────────────────────────
// GET ONE — GET /api/tutors/:id
// ─────────────────────────────────────────────
export async function getTutorById(id: string) {
  const [tutor] = await db
    .select({
      id:                users.id,
      email:             users.email,
      firstName:         users.firstName,
      lastName:          users.lastName,
      phone:             users.phone,
      active:            users.active,
      role:              users.role,
      createdAt:         users.createdAt,
      profileId:         tutorProfiles.id,
      indirizzo:         tutorProfiles.indirizzo,
      citta:             tutorProfiles.citta,
      cap:               tutorProfiles.cap,
      codiceFiscale:     tutorProfiles.codiceFiscale,
      partitaIva:        tutorProfiles.partitaIva,
      materie:           tutorProfiles.materie,
      noteInterne:       tutorProfiles.noteInterne,
      modalitaPagamento: tutorProfiles.modalitaPagamento,
      importoForfait:    tutorProfiles.importoForfait,
    })
    .from(users)
    .leftJoin(tutorProfiles, eq(tutorProfiles.userId, users.id))
    .where(and(eq(users.id, id), eq(users.role, 'TUTOR')))
    .limit(1)

  return tutor ?? null
}

// ─────────────────────────────────────────────
// CREATE — POST /api/tutors
// Transazione: users INSERT + tutorProfiles INSERT
// ─────────────────────────────────────────────
export async function createTutor(data: CreateTutorInput) {
  const hashed = await bcrypt.hash(data.password, 10)

  return db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email:     data.email,
      password:  hashed,
      firstName: data.firstName,
      lastName:  data.lastName,
      role:      'TUTOR',
      phone:     data.phone ?? null,
    }).returning()

    const [profile] = await tx.insert(tutorProfiles).values({
      userId:            user!.id,
      modalitaPagamento: data.modalitaPagamento ?? 'ORE',
      importoForfait:    data.importoForfait ?? null,
    }).returning()

    const { password: _, ...safeUser } = user!
    return { user: safeUser, profile }
  })
}

// ─────────────────────────────────────────────
// UPDATE — PUT /api/tutors/:id
// ─────────────────────────────────────────────
export async function updateTutor(id: string, data: UpdateTutorInput) {
  const userChanges: Record<string, unknown>    = { updatedAt: new Date() }
  const profileChanges: Record<string, unknown> = { updatedAt: new Date() }

  const userFields    = ['firstName', 'lastName', 'email', 'phone']
  const profileFields = ['indirizzo', 'citta', 'cap', 'codiceFiscale', 'partitaIva',
                         'materie', 'noteInterne', 'modalitaPagamento', 'importoForfait']

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue
    if (userFields.includes(key))    userChanges[key]    = val
    if (profileFields.includes(key)) profileChanges[key] = val
  }

  return db.transaction(async (tx) => {
    const [user] = await tx.update(users)
      .set(userChanges as Parameters<typeof tx.update>[0])
      .where(and(eq(users.id, id), eq(users.role, 'TUTOR')))
      .returning()

    const [profile] = await tx.update(tutorProfiles)
      .set(profileChanges as Parameters<typeof tx.update>[0])
      .where(eq(tutorProfiles.userId, id))
      .returning()

    if (!user) return null
    const { password: _, ...safeUser } = user
    return { user: safeUser, profile }
  })
}

// ─────────────────────────────────────────────
// DEACTIVATE — DELETE /api/tutors/:id  (soft)
// ─────────────────────────────────────────────
export async function deactivateTutor(id: string) {
  const [updated] = await db.update(users)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.role, 'TUTOR')))
    .returning()

  return updated ?? null
}
```

- [ ] **Step 2.2: Commit**

```powershell
git add server/services/tutor.service.ts
git commit -m "feat: tutor service parte 1 — listTutors batch, CRUD"
```

---

## Task 3: API Routes — CRUD base (5 routes)

**Files:**
- Create: `server/api/tutors/index.get.ts`
- Create: `server/api/tutors/index.post.ts`
- Create: `server/api/tutors/[id].get.ts`
- Create: `server/api/tutors/[id].put.ts`
- Create: `server/api/tutors/[id].delete.ts`

- [ ] **Step 3.1: Crea `server/api/tutors/index.get.ts`**

```typescript
// server/api/tutors/index.get.ts
import { TutorQuerySchema } from '../../../shared/schemas/tutor.schema'
import { listTutors } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const rawQuery = getQuery(event)
  const parsed = TutorQuerySchema.safeParse(rawQuery)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Parametri non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  return listTutors(parsed.data)
})
```

- [ ] **Step 3.2: Crea `server/api/tutors/index.post.ts`**

```typescript
// server/api/tutors/index.post.ts
import { CreateTutorSchema } from '../../../shared/schemas/tutor.schema'
import { createTutor } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = CreateTutorSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    return createTutor(parsed.data)
  } catch (err: any) {
    if (err.message?.includes('unique') || err.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Email già in uso' })
    }
    throw err
  }
})
```

- [ ] **Step 3.3: Crea `server/api/tutors/[id].get.ts`**

```typescript
// server/api/tutors/[id].get.ts
import { getTutorById } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const tutor = await getTutorById(id)

  if (!tutor) {
    throw createError({ statusCode: 404, statusMessage: 'Tutor non trovato' })
  }

  return tutor
})
```

- [ ] **Step 3.4: Crea `server/api/tutors/[id].put.ts`**

```typescript
// server/api/tutors/[id].put.ts
import { UpdateTutorSchema } from '../../../shared/schemas/tutor.schema'
import { updateTutor } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = UpdateTutorSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const result = await updateTutor(id, parsed.data)
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Tutor non trovato' })

  return result
})
```

- [ ] **Step 3.5: Crea `server/api/tutors/[id].delete.ts`**

```typescript
// server/api/tutors/[id].delete.ts
import { deactivateTutor } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const result = await deactivateTutor(id)

  if (!result) throw createError({ statusCode: 404, statusMessage: 'Tutor non trovato' })

  return { ok: true }
})
```

- [ ] **Step 3.6: Commit**

```powershell
git add server/api/tutors/
git commit -m "feat: API routes tutor CRUD base (5 endpoint)"
```

---

## Task 4: Service — Parte 2 (Compensi mensili)

**Files:**
- Modify: `server/services/tutor.service.ts` (aggiunge funzioni in fondo)

- [ ] **Step 4.1: Aggiungi `getMonthlyCompensation` e `payTutor` in fondo al service**

```typescript
// ─────────────────────────────────────────────
// COMPENSI MENSILI — GET /api/tutors/:id/compensation
// Storico ultimi N mesi con stato pagamento
// ─────────────────────────────────────────────
export async function getMonthlyCompensation(tutorId: string, months = 12) {
  const now       = new Date()
  const pastStart = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)

  const [lessonRows, paymentRows] = await Promise.all([
    db.execute(sql`
      SELECT DATE_TRUNC('month', data) AS mese,
             COUNT(*)::text AS num_lezioni,
             COALESCE(SUM(compenso_tutor::numeric), 0)::text AS compenso_grezzo
      FROM lessons
      WHERE tutor_id = ${tutorId} AND data >= ${pastStart}
      GROUP BY DATE_TRUNC('month', data)
      ORDER BY mese DESC
    `),
    db.select()
      .from(tutorPayments)
      .where(and(
        eq(tutorPayments.tutorId, tutorId),
        gte(tutorPayments.mese, pastStart),
      ))
      .orderBy(desc(tutorPayments.mese)),
  ])

  // Mappa pagamenti per chiave YYYY-MM
  const payByMonth = new Map<string, { totale: number; proBono: boolean }>()
  for (const p of paymentRows) {
    const key = new Date(p.mese).toISOString().substring(0, 7)
    const cur = payByMonth.get(key) ?? { totale: 0, proBono: false }
    payByMonth.set(key, {
      totale:  cur.totale + parseFloat(p.importo),
      proBono: cur.proBono || p.status === 'PRO_BONO',
    })
  }

  const nowKey = now.toISOString().substring(0, 7)

  return (lessonRows as any[]).map(row => {
    const meseDate         = new Date(row.mese)
    const meseKey          = meseDate.toISOString().substring(0, 7)
    const compensoGrezzo   = parseFloat(row.compenso_grezzo)
    const compensoCalcolato = Math.floor(compensoGrezzo)
    const pay              = payByMonth.get(meseKey)
    const pagato           = pay?.totale ?? 0
    const residuo          = Math.max(0, compensoCalcolato - pagato)
    const isMeseCorrente   = meseKey === nowKey

    let stato: string
    if (pay?.proBono)                           stato = 'PRO_BONO'
    else if (residuo <= 0.01 && pagato > 0)     stato = 'PAGATO'
    else if (pagato > 0.01 && residuo > 0.01)   stato = 'PARZIALE'
    else if (isMeseCorrente)                    stato = 'DA_PAGARE'
    else if (compensoCalcolato === 0)           stato = 'DA_PAGARE'
    else                                        stato = 'DA_PAGARE'

    return {
      mese:             meseKey,
      meseLabel:        meseDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
      numLezioni:       parseInt(row.num_lezioni),
      compensoGrezzo:   Number(compensoGrezzo.toFixed(2)),
      compensoCalcolato,
      pagato:           Number(pagato.toFixed(2)),
      residuo:          Number(residuo.toFixed(2)),
      stato,
      isMeseCorrente,
    }
  })
}

// ─────────────────────────────────────────────
// LIQUIDA — POST /api/tutors/:id/pay
// Crea tutorPayment + accountingEntry USCITA in transazione
// PRO_BONO: importo=0, nessun accounting
// ─────────────────────────────────────────────
export async function payTutor(tutorId: string, data: PayTutorInput) {
  const meseDate = new Date(data.mese)
  const importo  = data.proBono ? 0 : parseFloat(data.importo)
  const status   = data.proBono ? 'PRO_BONO' : 'PAGATO'

  return db.transaction(async (tx) => {
    const [payment] = await tx.insert(tutorPayments).values({
      tutorId,
      mese:    meseDate,
      importo: importo.toFixed(2),
      metodo:  data.metodo,
      status,
      note:    data.note ?? null,
    }).returning()

    if (!data.proBono && importo > 0) {
      await tx.insert(accountingEntries).values({
        tipo:            'USCITA',
        importo:         importo.toFixed(2),
        descrizione:     `Compenso tutor — ${meseDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`,
        categoria:       'compenso_tutor',
        metodoPagamento: data.metodo,
        note:            `tutorPaymentId:${payment!.id} tutorId:${tutorId}`,
      })
    }

    return payment
  })
}
```

- [ ] **Step 4.2: Commit**

```powershell
git add server/services/tutor.service.ts
git commit -m "feat: tutor service parte 2 — compensi mensili e liquidazione"
```

---

## Task 5: API Routes — Compensi (2 route)

**Files:**
- Create: `server/api/tutors/[id]/compensation.get.ts`
- Create: `server/api/tutors/[id]/pay.post.ts`

> **NOTA:** La cartella `server/api/tutors/[id]/` va creata come sottocartella.

- [ ] **Step 5.1: Crea `server/api/tutors/[id]/compensation.get.ts`**

```typescript
// server/api/tutors/[id]/compensation.get.ts
import { getMonthlyCompensation } from '../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id     = getRouterParam(event, 'id')!
  const query  = getQuery(event)
  const months = query.months ? parseInt(String(query.months)) : 12

  return getMonthlyCompensation(id, isNaN(months) ? 12 : Math.min(months, 24))
})
```

- [ ] **Step 5.2: Crea `server/api/tutors/[id]/pay.post.ts`**

```typescript
// server/api/tutors/[id]/pay.post.ts
import { PayTutorSchema } from '../../../../shared/schemas/tutor.schema'
import { payTutor } from '../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id     = getRouterParam(event, 'id')!
  const body   = await readBody(event)
  const parsed = PayTutorSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati liquidazione non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  return payTutor(id, parsed.data)
})
```

- [ ] **Step 5.3: Commit**

```powershell
git add server/api/tutors/
git commit -m "feat: API routes compensi tutor (compensation + pay)"
```

---

## Task 6: Service — Parte 3 (Performance e Statistiche)

**Files:**
- Modify: `server/services/tutor.service.ts` (aggiunge funzioni in fondo)

- [ ] **Step 6.1: Aggiungi `getMonthlyPerformance` e `getDetailedStats` in fondo al service**

```typescript
// ─────────────────────────────────────────────
// PERFORMANCE — GET /api/tutors/:id/performance
// Ricavo generato vs compenso vs margine per mese
// JOIN: lessons → lesson_students → packages
// ─────────────────────────────────────────────
export async function getMonthlyPerformance(tutorId: string, months = 6) {
  const now       = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)

  const rows = await db.execute(sql`
    SELECT
      DATE_TRUNC('month', l.data) AS mese,
      COUNT(DISTINCT l.id)::text  AS num_lezioni,
      COUNT(ls.id)::text          AS num_studenti_slot,
      COALESCE(SUM(l.compenso_tutor::numeric), 0)::text AS compenso_totale,
      COALESCE(SUM(
        CASE WHEN ls.mezza_lezione THEN 0.5 ELSE 1.0 END
        * COALESCE(
            p.tariffa_oraria::numeric,
            NULLIF(p.ore_acquistate::numeric, 0) IS NOT NULL
              AND NULLIF(p.prezzo_totale::numeric, 0) IS NOT NULL
              ? p.prezzo_totale::numeric / NULLIF(p.ore_acquistate::numeric, 0)
              : 25.0,
            25.0
          )
      ), 0)::text AS ricavo_totale
    FROM lessons l
    JOIN lesson_students ls ON ls.lesson_id = l.id
    LEFT JOIN packages p ON p.id = ls.package_id
    WHERE l.tutor_id = ${tutorId} AND l.data >= ${startDate}
    GROUP BY DATE_TRUNC('month', l.data)
    ORDER BY mese DESC
  `)

  return (rows as any[]).map(row => {
    const ricavo   = parseFloat(row.ricavo_totale)
    const compenso = parseFloat(row.compenso_totale)
    const margine  = ricavo - compenso
    const meseDate = new Date(row.mese)

    return {
      mese:           meseDate.toISOString().substring(0, 7),
      meseLabel:      meseDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
      numLezioni:     parseInt(row.num_lezioni),
      numStudenti:    parseInt(row.num_studenti_slot),
      ricavo:         Number(ricavo.toFixed(2)),
      compenso:       Number(compenso.toFixed(2)),
      margine:        Number(margine.toFixed(2)),
      marginePerc:    ricavo > 0 ? Math.round((margine / ricavo) * 100) : 0,
    }
  })
}

// ─────────────────────────────────────────────
// STATISTICHE DETTAGLIATE — GET /api/tutors/:id/stats
// Distribuzione per tipo lezione + top 5 alunni
// ─────────────────────────────────────────────
export async function getDetailedStats(tutorId: string, months = 6) {
  const now       = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)

  const [tipoRows, topStudentRows] = await Promise.all([
    db.execute(sql`
      SELECT l.tipo,
             COUNT(DISTINCT l.id)::text AS num_lezioni,
             COALESCE(SUM(CASE WHEN ls.mezza_lezione THEN 0.5 ELSE 1.0 END), 0)::text AS ore_totali
      FROM lessons l
      JOIN lesson_students ls ON ls.lesson_id = l.id
      WHERE l.tutor_id = ${tutorId} AND l.data >= ${startDate}
      GROUP BY l.tipo
    `),

    db.execute(sql`
      SELECT s.id,
             s.first_name AS "firstName",
             s.last_name  AS "lastName",
             COUNT(DISTINCT l.id)::text AS num_lezioni,
             COALESCE(SUM(CASE WHEN ls.mezza_lezione THEN 0.5 ELSE 1.0 END), 0)::text AS ore_totali
      FROM lessons l
      JOIN lesson_students ls ON ls.lesson_id = l.id
      JOIN students s ON s.id = ls.student_id
      WHERE l.tutor_id = ${tutorId} AND l.data >= ${startDate}
      GROUP BY s.id, s.first_name, s.last_name
      ORDER BY ore_totali::numeric DESC
      LIMIT 5
    `),
  ])

  const tipoData = (tipoRows as any[]).map(r => ({
    tipo:       r.tipo as string,
    numLezioni: parseInt(r.num_lezioni),
    oreTotali:  parseFloat(r.ore_totali),
  }))

  const totalOre = tipoData.reduce((s, r) => s + r.oreTotali, 0)

  return {
    distribuzioneTipo: tipoData.map(r => ({
      ...r,
      percentuale: totalOre > 0 ? Math.round((r.oreTotali / totalOre) * 100) : 0,
    })),
    topStudenti: (topStudentRows as any[]).map(r => ({
      id:         r.id as string,
      firstName:  r.firstName as string,
      lastName:   r.lastName as string,
      numLezioni: parseInt(r.num_lezioni),
      oreTotali:  parseFloat(r.ore_totali),
    })),
  }
}
```

- [ ] **Step 6.2: Commit**

```powershell
git add server/services/tutor.service.ts
git commit -m "feat: tutor service parte 3 — performance mensile e statistiche"
```

---

## Task 7: API Routes — Performance e Stats (2 route)

**Files:**
- Create: `server/api/tutors/[id]/performance.get.ts`
- Create: `server/api/tutors/[id]/stats.get.ts`

- [ ] **Step 7.1: Crea `server/api/tutors/[id]/performance.get.ts`**

```typescript
// server/api/tutors/[id]/performance.get.ts
import { getMonthlyPerformance } from '../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id     = getRouterParam(event, 'id')!
  const query  = getQuery(event)
  const months = query.months ? parseInt(String(query.months)) : 6

  return getMonthlyPerformance(id, isNaN(months) ? 6 : Math.min(months, 12))
})
```

- [ ] **Step 7.2: Crea `server/api/tutors/[id]/stats.get.ts`**

```typescript
// server/api/tutors/[id]/stats.get.ts
import { getDetailedStats } from '../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id     = getRouterParam(event, 'id')!
  const query  = getQuery(event)
  const months = query.months ? parseInt(String(query.months)) : 6

  return getDetailedStats(id, isNaN(months) ? 6 : Math.min(months, 12))
})
```

- [ ] **Step 7.3: Commit**

```powershell
git add server/api/tutors/
git commit -m "feat: API routes performance e statistiche tutor"
```

---

## Task 8: Service — Parte 4 (Rimborsi spese)

**Files:**
- Modify: `server/services/tutor.service.ts` (aggiunge funzioni in fondo)

- [ ] **Step 8.1: Aggiungi `listReimbursements`, `createReimbursement`, `payReimbursement` in fondo al service**

```typescript
// ─────────────────────────────────────────────
// RIMBORSI — GET /api/tutors/:id/reimbursements
// ─────────────────────────────────────────────
export async function listReimbursements(tutorId: string) {
  return db.select()
    .from(tutorReimbursements)
    .where(eq(tutorReimbursements.tutorId, tutorId))
    .orderBy(desc(tutorReimbursements.dataRichiesta))
}

// ─────────────────────────────────────────────
// CREA RIMBORSO — POST /api/tutors/:id/reimbursements
// ─────────────────────────────────────────────
export async function createReimbursement(tutorId: string, data: CreateReimbursementInput) {
  const [created] = await db.insert(tutorReimbursements).values({
    tutorId,
    importo:       data.importo,
    descrizione:   data.descrizione,
    dataRichiesta: data.dataRichiesta ? new Date(data.dataRichiesta) : new Date(),
    stato:         'DA_PAGARE',
    note:          data.note ?? null,
  }).returning()

  return created
}

// ─────────────────────────────────────────────
// PAGA RIMBORSO — POST /api/tutors/:id/reimbursements/:rid/pay
// Aggiorna importoPagato + stato + crea accounting USCITA
// Parziale: importoPagato < importo → stato PARZIALE
// Totale:   importoPagato >= importo → stato PAGATO
// ─────────────────────────────────────────────
export async function payReimbursement(reimbursementId: string, data: PayReimbursementInput) {
  const [current] = await db.select()
    .from(tutorReimbursements)
    .where(eq(tutorReimbursements.id, reimbursementId))
    .limit(1)

  if (!current) throw new Error('Rimborso non trovato')

  const importoTotale = parseFloat(current.importo)
  const giaPagato     = parseFloat(current.importoPagato)
  const nuovoPagamento = parseFloat(data.importoPagamento)
  const nuovoPagato   = giaPagato + nuovoPagamento
  const nuovoStato: 'PARZIALE' | 'PAGATO' = nuovoPagato >= importoTotale ? 'PAGATO' : 'PARZIALE'

  return db.transaction(async (tx) => {
    const [updated] = await tx.update(tutorReimbursements)
      .set({
        importoPagato: nuovoPagato.toFixed(2),
        stato:         nuovoStato,
        dataPagamento: nuovoStato === 'PAGATO' ? new Date() : current.dataPagamento,
        metodo:        data.metodo,
        note:          data.note ?? current.note,
        updatedAt:     new Date(),
      })
      .where(eq(tutorReimbursements.id, reimbursementId))
      .returning()

    await tx.insert(accountingEntries).values({
      tipo:            'USCITA',
      importo:         nuovoPagamento.toFixed(2),
      descrizione:     `Rimborso spese: ${current.descrizione}`,
      categoria:       'rimborso_tutor',
      metodoPagamento: data.metodo,
      note:            `rimborsoId:${reimbursementId} tutorId:${current.tutorId}`,
    })

    return updated
  })
}
```

- [ ] **Step 8.2: Commit**

```powershell
git add server/services/tutor.service.ts
git commit -m "feat: tutor service parte 4 — rimborsi spese"
```

---

## Task 9: API Routes — Rimborsi (3 route)

**Files:**
- Create: `server/api/tutors/[id]/reimbursements.get.ts`
- Create: `server/api/tutors/[id]/reimbursements.post.ts`
- Create: `server/api/tutors/[id]/reimbursements/[rid]/pay.post.ts`

- [ ] **Step 9.1: Crea `server/api/tutors/[id]/reimbursements.get.ts`**

```typescript
// server/api/tutors/[id]/reimbursements.get.ts
import { listReimbursements } from '../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  return listReimbursements(id)
})
```

- [ ] **Step 9.2: Crea `server/api/tutors/[id]/reimbursements.post.ts`**

```typescript
// server/api/tutors/[id]/reimbursements.post.ts
import { CreateReimbursementSchema } from '../../../../shared/schemas/tutor.schema'
import { createReimbursement } from '../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id     = getRouterParam(event, 'id')!
  const body   = await readBody(event)
  const parsed = CreateReimbursementSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati rimborso non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  return createReimbursement(id, parsed.data)
})
```

- [ ] **Step 9.3: Crea `server/api/tutors/[id]/reimbursements/[rid]/pay.post.ts`**

```typescript
// server/api/tutors/[id]/reimbursements/[rid]/pay.post.ts
import { PayReimbursementSchema } from '../../../../../../shared/schemas/tutor.schema'
import { payReimbursement } from '../../../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const rid    = getRouterParam(event, 'rid')!
  const body   = await readBody(event)
  const parsed = PayReimbursementSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati pagamento non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    return payReimbursement(rid, parsed.data)
  } catch (err: any) {
    if (err.message === 'Rimborso non trovato') {
      throw createError({ statusCode: 404, statusMessage: 'Rimborso non trovato' })
    }
    throw err
  }
})
```

- [ ] **Step 9.4: Commit**

```powershell
git add server/api/tutors/
git commit -m "feat: API routes rimborsi tutor (list, crea, paga)"
```

---

## Task 10: Pagina Lista Tutor (`/tutor`)

**Files:**
- Modify: `app/pages/tutor/index.vue`

- [ ] **Step 10.1: Sostituisci `app/pages/tutor/index.vue` con la pagina completa**

```vue
<template>
  <div class="space-y-6">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">Tutor</h2>
        <p class="text-sm text-slate-500 mt-0.5">Gestione del personale docente</p>
      </div>
      <UButton icon="i-heroicons-plus" @click="modalCreaAperto = true">
        Nuovo Tutor
      </UButton>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <UCard>
        <div class="text-2xl font-bold text-slate-900">{{ kpi.tutoriAttivi }}</div>
        <div class="text-xs text-slate-500 mt-0.5">Tutor attivi</div>
      </UCard>
      <UCard>
        <div class="text-2xl font-bold" :class="kpi.daLiquidare > 0 ? 'text-warning-600' : 'text-slate-900'">
          {{ kpi.daLiquidare }}
        </div>
        <div class="text-xs text-slate-500 mt-0.5">Da liquidare</div>
      </UCard>
      <UCard>
        <div class="text-2xl font-bold" :class="kpi.totaleDovuto > 0 ? 'text-error-600' : 'text-slate-900'">
          € {{ kpi.totaleDovuto.toFixed(2) }}
        </div>
        <div class="text-xs text-slate-500 mt-0.5">Totale dovuto</div>
      </UCard>
      <UCard>
        <div class="text-2xl font-bold text-slate-900">€ {{ kpi.mediaLiquidazione.toFixed(2) }}</div>
        <div class="text-xs text-slate-500 mt-0.5">Media mensile</div>
      </UCard>
    </div>

    <!-- Filtri -->
    <div class="flex flex-wrap gap-3 items-center">
      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        placeholder="Cerca per nome o email..."
        class="w-72"
        @input="onSearch"
      />
      <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
        <UToggle v-model="soloLiquidare" @update:model-value="caricaTutor" />
        Solo da liquidare
      </label>
    </div>

    <!-- Tabella -->
    <UCard :ui="{ body: 'p-0' }">
      <UTable :data="tutors" :columns="colonne" :loading="pending">

        <template #nome-cell="{ row }">
          <NuxtLink
            :to="`/tutor/${row.original.id}`"
            class="font-medium text-slate-900 hover:text-tfn-600"
          >
            {{ row.original.lastName }} {{ row.original.firstName }}
          </NuxtLink>
        </template>

        <template #contatti-cell="{ row }">
          <div class="text-sm">
            <div class="text-slate-700">{{ row.original.email }}</div>
            <div class="text-slate-400 text-xs">{{ row.original.phone ?? '—' }}</div>
          </div>
        </template>

        <template #oreMese-cell="{ row }">
          <span class="text-slate-700">{{ row.original.numLezioniMese }} lez.</span>
        </template>

        <template #compenso-cell="{ row }">
          <span class="font-medium">€ {{ row.original.compensoCalcolato }}</span>
        </template>

        <template #daLiquidare-cell="{ row }">
          <UBadge
            v-if="row.original.compensoResiduo > 0.01"
            color="error"
            variant="subtle"
          >
            € {{ row.original.compensoResiduo.toFixed(2) }}
          </UBadge>
          <span v-else class="text-slate-400 text-sm">—</span>
        </template>

        <template #arretrati-cell="{ row }">
          <UBadge
            v-if="row.original.mesiArretrati > 0"
            color="warning"
            variant="subtle"
          >
            {{ row.original.mesiArretrati }} mes{{ row.original.mesiArretrati === 1 ? 'e' : 'i' }}
          </UBadge>
          <span v-else class="text-slate-400 text-sm">—</span>
        </template>

        <template #stato-cell="{ row }">
          <UBadge :color="row.original.active ? 'success' : 'neutral'" variant="subtle">
            {{ row.original.active ? 'Attivo' : 'Inattivo' }}
          </UBadge>
        </template>

        <template #azioni-cell="{ row }">
          <UDropdownMenu :items="azioniTutor(row.original)">
            <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" size="xs" @click.stop />
          </UDropdownMenu>
        </template>

      </UTable>

      <div v-if="!pending && tutors.length === 0" class="py-12 text-center">
        <UIcon name="i-heroicons-academic-cap" class="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p class="text-slate-500 text-sm">Nessun tutor trovato</p>
      </div>
    </UCard>

    <!-- Modal Crea Tutor -->
    <UModal v-model:open="modalCreaAperto" title="Nuovo Tutor" :ui="{ width: 'max-w-lg' }">
      <template #body>
        <UForm :state="nuovoTutor" class="space-y-4" @submit="creaTutor">
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="firstName" label="Nome" required>
              <UInput v-model="nuovoTutor.firstName" placeholder="Marco" class="w-full" />
            </UFormField>
            <UFormField name="lastName" label="Cognome" required>
              <UInput v-model="nuovoTutor.lastName" placeholder="Rossi" class="w-full" />
            </UFormField>
          </div>
          <UFormField name="email" label="Email (per il login)" required>
            <UInput v-model="nuovoTutor.email" type="email" placeholder="marco@email.it" class="w-full" />
          </UFormField>
          <UFormField name="password" label="Password iniziale" required>
            <UInput v-model="nuovoTutor.password" type="password" placeholder="min. 8 caratteri" class="w-full" />
          </UFormField>
          <UFormField name="phone" label="Telefono">
            <UInput v-model="nuovoTutor.phone" placeholder="+39 333 1234567" class="w-full" />
          </UFormField>
          <UFormField name="modalitaPagamento" label="Modalità compenso">
            <USelect
              v-model="nuovoTutor.modalitaPagamento"
              :items="[{ label: 'A ore (tariffa oraria)', value: 'ORE' }, { label: 'Forfait mensile', value: 'FORFAIT' }]"
              class="w-full"
            />
          </UFormField>
          <UFormField v-if="nuovoTutor.modalitaPagamento === 'FORFAIT'" name="importoForfait" label="Importo forfait (€)">
            <UInput v-model="nuovoTutor.importoForfait" type="number" placeholder="500" class="w-full" />
          </UFormField>

          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalCreaAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvando">Crea Tutor</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal Liquida Mese -->
    <UModal v-model:open="modalLiquidaAperto" title="Liquida mese" :ui="{ width: 'max-w-md' }">
      <template #body>
        <UForm :state="datiLiquida" class="space-y-4" @submit="liquidaTutor">
          <div class="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
            Tutor: <span class="font-semibold">{{ tutorSelezionato?.lastName }} {{ tutorSelezionato?.firstName }}</span>
          </div>
          <UFormField name="mese" label="Mese di riferimento">
            <UInput v-model="datiLiquida.mese" type="month" class="w-full" />
          </UFormField>
          <UFormField name="importo" label="Importo (€)">
            <UInput v-model="datiLiquida.importo" type="number" step="0.01" class="w-full" />
          </UFormField>
          <UFormField name="metodo" label="Metodo pagamento">
            <USelect
              v-model="datiLiquida.metodo"
              :items="metodiPagamento"
              class="w-full"
            />
          </UFormField>
          <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <UCheckbox v-model="datiLiquida.proBono" />
            Pro Bono (nessun pagamento, nessuna registrazione contabile)
          </label>
          <UFormField name="note" label="Note">
            <UTextarea v-model="datiLiquida.note" class="w-full" rows="2" />
          </UFormField>
          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalLiquidaAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvando">Conferma Liquidazione</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['admin-or-super'] })

const toast = useToast()

// ─── Filtri ───────────────────────────────────
const search      = ref('')
const soloLiquidare = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const filterQuery = computed(() => ({
  search:      search.value || undefined,
  daLiquidare: soloLiquidare.value ? 'true' : undefined,
}))

// ─── Fetch ────────────────────────────────────
const { data, pending, refresh } = await useFetch('/api/tutors', {
  query: filterQuery,
  default: () => ({ data: [], kpi: { tutoriAttivi: 0, daLiquidare: 0, totaleDovuto: 0, mediaLiquidazione: 0 } }),
})

const tutors = computed(() => data.value?.data ?? [])
const kpi    = computed(() => data.value?.kpi ?? { tutoriAttivi: 0, daLiquidare: 0, totaleDovuto: 0, mediaLiquidazione: 0 })

function onSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => caricaTutor(), 300)
}
function caricaTutor() { refresh() }

// ─── Colonne UTable v4 ────────────────────────
const colonne = [
  { id: 'nome',        header: 'Tutor' },
  { id: 'contatti',    header: 'Contatti' },
  { id: 'oreMese',     header: 'Lez. mese' },
  { id: 'compenso',    header: 'Compenso' },
  { id: 'daLiquidare', header: 'Da liquidare' },
  { id: 'arretrati',   header: 'Arretrati' },
  { id: 'stato',       header: 'Stato' },
  { id: 'azioni',      header: '' },
]

// ─── Metodi pagamento ─────────────────────────
const metodiPagamento = [
  { label: 'Contanti',  value: 'CONTANTI' },
  { label: 'Bonifico',  value: 'BONIFICO' },
  { label: 'POS',       value: 'POS' },
  { label: 'Assegno',   value: 'ASSEGNO' },
  { label: 'Altro',     value: 'ALTRO' },
]

// ─── Modal Crea Tutor ─────────────────────────
const modalCreaAperto = ref(false)
const salvando = ref(false)
const nuovoTutor = reactive({
  firstName:         '',
  lastName:          '',
  email:             '',
  password:          '',
  phone:             '',
  modalitaPagamento: 'ORE',
  importoForfait:    '',
})

async function creaTutor() {
  if (!nuovoTutor.firstName || !nuovoTutor.lastName || !nuovoTutor.email || !nuovoTutor.password) {
    toast.add({ title: 'Campi obbligatori mancanti', color: 'error' })
    return
  }
  salvando.value = true
  try {
    await $fetch('/api/tutors', {
      method: 'POST',
      body: {
        ...nuovoTutor,
        phone:          nuovoTutor.phone || null,
        importoForfait: nuovoTutor.importoForfait || null,
      },
    })
    toast.add({ title: 'Tutor creato con successo', color: 'success' })
    modalCreaAperto.value = false
    Object.assign(nuovoTutor, {
      firstName: '', lastName: '', email: '', password: '',
      phone: '', modalitaPagamento: 'ORE', importoForfait: '',
    })
    refresh()
  } catch (err: any) {
    const msg = err.data?.statusMessage ?? 'Errore nella creazione'
    toast.add({ title: msg, color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Modal Liquida ────────────────────────────
const modalLiquidaAperto = ref(false)
const tutorSelezionato = ref<any>(null)

const now = new Date()
const datiLiquida = reactive({
  mese:    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  importo: '',
  metodo:  'BONIFICO',
  proBono: false,
  note:    '',
})

function apriLiquida(tutor: any) {
  tutorSelezionato.value = tutor
  datiLiquida.importo = String(tutor.compensoResiduo > 0 ? tutor.compensoResiduo : tutor.compensoCalcolato)
  modalLiquidaAperto.value = true
}

async function liquidaTutor() {
  if (!tutorSelezionato.value) return
  salvando.value = true
  try {
    // mese input è "YYYY-MM", convertiamo a primo del mese ISO
    const [anno, mese] = datiLiquida.mese.split('-').map(Number)
    const meseISO = new Date(anno!, mese! - 1, 1).toISOString()

    await $fetch(`/api/tutors/${tutorSelezionato.value.id}/pay`, {
      method: 'POST',
      body: {
        mese:    meseISO,
        importo: datiLiquida.proBono ? '0' : datiLiquida.importo,
        metodo:  datiLiquida.metodo,
        proBono: datiLiquida.proBono,
        note:    datiLiquida.note || undefined,
      },
    })
    toast.add({ title: 'Liquidazione registrata', color: 'success' })
    modalLiquidaAperto.value = false
    refresh()
  } catch (err: any) {
    toast.add({ title: err.data?.statusMessage ?? 'Errore', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Azioni dropdown ─────────────────────────
function azioniTutor(tutor: any) {
  return [
    [{
      label: 'Vedi dettaglio',
      icon: 'i-heroicons-arrow-right',
      to: `/tutor/${tutor.id}`,
    }],
    [{
      label: 'Liquida mese',
      icon: 'i-heroicons-banknotes',
      onSelect: () => apriLiquida(tutor),
    }],
    [{
      label: tutor.active ? 'Disattiva' : 'Attiva',
      icon: tutor.active ? 'i-heroicons-pause-circle' : 'i-heroicons-play-circle',
      onSelect: () => toggleAttivo(tutor),
    }],
  ]
}

async function toggleAttivo(tutor: any) {
  if (tutor.active) {
    await $fetch(`/api/tutors/${tutor.id}`, { method: 'DELETE' })
    toast.add({ title: 'Tutor disattivato', color: 'info' })
  } else {
    await $fetch(`/api/tutors/${tutor.id}`, { method: 'PUT', body: { active: true } })
    toast.add({ title: 'Tutor riattivato', color: 'success' })
  }
  refresh()
}
</script>
```

- [ ] **Step 10.2: Verifica manuale che la pagina si avvia**

```powershell
npm run dev
```

Apri il browser su `http://localhost:3000/tutor`. Verifica che:
- La pagina non mostra più "Sezione in arrivo"
- Le 4 KPI cards sono visibili (anche se a zero)
- Il bottone "Nuovo Tutor" apre il modal
- La tabella è vuota ma senza errori

- [ ] **Step 10.3: Commit**

```powershell
git add app/pages/tutor/index.vue
git commit -m "feat: pagina lista tutor con KPI, tabella e modal crea/liquida"
```

---

## Task 11: Pagina Dettaglio Tutor (`/tutor/[id]`)

**Files:**
- Create: `app/pages/tutor/[id].vue`

- [ ] **Step 11.1: Crea `app/pages/tutor/[id].vue`**

```vue
<template>
  <div class="space-y-6">

    <!-- Loading stato -->
    <div v-if="pendingTutor" class="py-20 text-center">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-slate-300 mx-auto animate-spin" />
    </div>

    <template v-else-if="tutor">

      <!-- Header profilo -->
      <div>
        <div class="flex items-start justify-between">
          <div>
            <NuxtLink to="/tutor" class="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
              <UIcon name="i-heroicons-arrow-left" class="w-3 h-3" /> Tutor
            </NuxtLink>
            <h2 class="text-xl font-semibold text-slate-900">
              {{ tutor.lastName }} {{ tutor.firstName }}
            </h2>
            <div class="flex items-center gap-4 mt-1 text-sm text-slate-500">
              <span v-if="tutor.email">{{ tutor.email }}</span>
              <span v-if="tutor.phone">{{ tutor.phone }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UBadge :color="tutor.active ? 'success' : 'neutral'" variant="subtle">
              {{ tutor.active ? 'Attivo' : 'Inattivo' }}
            </UBadge>
            <UButton size="sm" variant="outline" icon="i-heroicons-pencil" @click="modalModificaAperto = true">
              Modifica
            </UButton>
            <UButton size="sm" icon="i-heroicons-banknotes" @click="apriLiquidaDettaglio">
              Liquida
            </UButton>
            <UDropdownMenu :items="menuAzioni">
              <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" size="sm" />
            </UDropdownMenu>
          </div>
        </div>

        <!-- Alert arretrati -->
        <UAlert
          v-if="arretratiTotali > 0.01"
          color="error"
          variant="soft"
          icon="i-heroicons-exclamation-triangle"
          class="mt-3"
        >
          <template #title>{{ mesiArretrati }} mes{{ mesiArretrati === 1 ? 'e' : 'i' }} non pagat{{ mesiArretrati === 1 ? 'o' : 'i' }} — € {{ arretratiTotali.toFixed(2) }} da liquidare</template>
        </UAlert>
      </div>

      <!-- Tab -->
      <UTabs :items="tabs" class="w-full">

        <!-- ─── Tab ANAGRAFICA ─── -->
        <template #anagrafica>
          <div class="space-y-6 pt-4">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UCard>
                <div class="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">Dati personali</div>
                <dl class="space-y-2 text-sm">
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">Nome</dt><dd>{{ tutor.firstName }}</dd></div>
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">Cognome</dt><dd>{{ tutor.lastName }}</dd></div>
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">Email</dt><dd>{{ tutor.email }}</dd></div>
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">Telefono</dt><dd>{{ tutor.phone ?? '—' }}</dd></div>
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">Cod. Fiscale</dt><dd>{{ tutor.codiceFiscale ?? '—' }}</dd></div>
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">P.IVA</dt><dd>{{ tutor.partitaIva ?? '—' }}</dd></div>
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">Indirizzo</dt><dd>{{ [tutor.indirizzo, tutor.citta, tutor.cap].filter(Boolean).join(', ') || '—' }}</dd></div>
                </dl>
              </UCard>
              <UCard>
                <div class="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">Compenso</div>
                <dl class="space-y-2 text-sm">
                  <div class="flex gap-2">
                    <dt class="text-slate-400 w-32 shrink-0">Modalità</dt>
                    <dd>{{ tutor.modalitaPagamento === 'ORE' ? 'A ore' : 'Forfait mensile' }}</dd>
                  </div>
                  <div v-if="tutor.modalitaPagamento === 'FORFAIT'" class="flex gap-2">
                    <dt class="text-slate-400 w-32 shrink-0">Importo</dt>
                    <dd>€ {{ tutor.importoForfait }}</dd>
                  </div>
                </dl>
                <div v-if="tutor.noteInterne" class="mt-4">
                  <div class="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Note interne</div>
                  <p class="text-sm text-slate-600 whitespace-pre-wrap">{{ tutor.noteInterne }}</p>
                </div>
              </UCard>
            </div>

            <!-- Materie -->
            <UCard>
              <div class="flex items-center justify-between mb-3">
                <div class="text-xs text-slate-400 font-medium uppercase tracking-wide">Materie insegnate</div>
                <UButton size="xs" variant="ghost" icon="i-heroicons-pencil" @click="modalMaterieAperto = true">
                  Gestisci
                </UButton>
              </div>
              <div v-if="tutor.materie && tutor.materie.length > 0" class="flex flex-wrap gap-2">
                <UBadge v-for="m in tutor.materie" :key="m" variant="subtle" color="primary">{{ m }}</UBadge>
              </div>
              <p v-else class="text-sm text-slate-400">Nessuna materia registrata</p>
            </UCard>
          </div>
        </template>

        <!-- ─── Tab COMPENSI ─── -->
        <template #compensi>
          <div class="space-y-4 pt-4">
            <div v-if="pendingComp" class="py-8 text-center">
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-slate-300 mx-auto animate-spin" />
            </div>
            <template v-else>
              <!-- Cards riepilogo -->
              <div class="grid grid-cols-3 gap-4">
                <UCard>
                  <div class="text-xl font-bold text-slate-900">€ {{ totaleCompensoPagato.toFixed(2) }}</div>
                  <div class="text-xs text-slate-500 mt-0.5">Totale liquidato</div>
                </UCard>
                <UCard>
                  <div class="text-xl font-bold" :class="compensoMeseCorrente > 0 ? 'text-warning-600' : 'text-slate-900'">
                    € {{ compensoMeseCorrente.toFixed(2) }}
                  </div>
                  <div class="text-xs text-slate-500 mt-0.5">Da liquidare (mese)</div>
                </UCard>
                <UCard>
                  <div class="text-xl font-bold" :class="mesiArretrati > 0 ? 'text-error-600' : 'text-slate-900'">
                    {{ mesiArretrati }}
                  </div>
                  <div class="text-xs text-slate-500 mt-0.5">Mesi con arretrati</div>
                </UCard>
              </div>

              <!-- Tabella mesi -->
              <UCard :ui="{ body: 'p-0' }">
                <UTable :data="compensation" :columns="colonneComp">
                  <template #meseLabel-cell="{ row }">
                    <span class="font-medium text-slate-700 capitalize">{{ row.original.meseLabel }}</span>
                    <UBadge v-if="row.original.isMeseCorrente" size="xs" variant="subtle" color="info" class="ml-2">mese corrente</UBadge>
                  </template>
                  <template #compensoCalcolato-cell="{ row }">
                    <div class="text-sm">
                      <div class="font-medium">€ {{ row.original.compensoCalcolato }}</div>
                      <div class="text-slate-400 text-xs">grezzo: € {{ row.original.compensoGrezzo.toFixed(2) }}</div>
                    </div>
                  </template>
                  <template #pagato-cell="{ row }">
                    <span>€ {{ row.original.pagato.toFixed(2) }}</span>
                  </template>
                  <template #residuo-cell="{ row }">
                    <span :class="row.original.residuo > 0.01 ? 'text-error-600 font-medium' : 'text-slate-400'">
                      € {{ row.original.residuo.toFixed(2) }}
                    </span>
                  </template>
                  <template #stato-cell="{ row }">
                    <UBadge :color="coloreStatoPagamento(row.original.stato)" variant="subtle" size="xs">
                      {{ row.original.stato }}
                    </UBadge>
                  </template>
                  <template #azioni-cell="{ row }">
                    <UButton
                      v-if="row.original.residuo > 0.01 || row.original.isMeseCorrente"
                      size="xs"
                      variant="ghost"
                      @click="apriLiquidaMese(row.original)"
                    >
                      Liquida
                    </UButton>
                  </template>
                </UTable>
              </UCard>
            </template>
          </div>
        </template>

        <!-- ─── Tab RIMBORSI ─── -->
        <template #rimborsi>
          <div class="space-y-4 pt-4">
            <div class="flex justify-end">
              <UButton size="sm" icon="i-heroicons-plus" @click="modalNuovoRimborsoAperto = true">
                Nuovo rimborso
              </UButton>
            </div>
            <div v-if="pendingReimb" class="py-8 text-center">
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-slate-300 mx-auto animate-spin" />
            </div>
            <template v-else>
              <!-- Cards -->
              <div class="grid grid-cols-2 gap-4">
                <UCard>
                  <div class="text-xl font-bold text-slate-900">€ {{ totaleRimborsato.toFixed(2) }}</div>
                  <div class="text-xs text-slate-500 mt-0.5">Totale rimborsato</div>
                </UCard>
                <UCard>
                  <div class="text-xl font-bold" :class="rimborsiDaPagare > 0 ? 'text-warning-600' : 'text-slate-900'">
                    € {{ rimborsiDaPagare.toFixed(2) }}
                  </div>
                  <div class="text-xs text-slate-500 mt-0.5">Da rimborsare</div>
                </UCard>
              </div>

              <!-- Tabella rimborsi -->
              <UCard :ui="{ body: 'p-0' }">
                <UTable :data="reimbursements" :columns="colonneReimb">
                  <template #dataRichiesta-cell="{ row }">
                    {{ new Date(row.original.dataRichiesta).toLocaleDateString('it-IT') }}
                  </template>
                  <template #importo-cell="{ row }">€ {{ parseFloat(row.original.importo).toFixed(2) }}</template>
                  <template #importoPagato-cell="{ row }">€ {{ parseFloat(row.original.importoPagato).toFixed(2) }}</template>
                  <template #residuoReimb-cell="{ row }">
                    <span :class="(parseFloat(row.original.importo) - parseFloat(row.original.importoPagato)) > 0.01 ? 'text-error-600' : 'text-slate-400'">
                      € {{ (parseFloat(row.original.importo) - parseFloat(row.original.importoPagato)).toFixed(2) }}
                    </span>
                  </template>
                  <template #stato-cell="{ row }">
                    <UBadge :color="coloreStatoRimborso(row.original.stato)" variant="subtle" size="xs">
                      {{ row.original.stato }}
                    </UBadge>
                  </template>
                  <template #azioni-cell="{ row }">
                    <UButton
                      v-if="row.original.stato !== 'PAGATO'"
                      size="xs"
                      variant="ghost"
                      @click="apriPagaRimborso(row.original)"
                    >
                      Paga
                    </UButton>
                  </template>
                </UTable>
                <div v-if="reimbursements.length === 0" class="py-8 text-center text-sm text-slate-400">
                  Nessun rimborso registrato
                </div>
              </UCard>
            </template>
          </div>
        </template>

        <!-- ─── Tab STATISTICHE ─── -->
        <template #statistiche>
          <div class="space-y-4 pt-4">
            <div v-if="pendingPerf" class="py-8 text-center">
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-slate-300 mx-auto animate-spin" />
            </div>
            <template v-else>
              <!-- Performance mensile -->
              <UCard :ui="{ body: 'p-0' }">
                <div class="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">
                  Performance ultimi 6 mesi
                </div>
                <UTable :data="performance" :columns="colonnePerf">
                  <template #meseLabel-cell="{ row }">
                    <span class="capitalize">{{ row.original.meseLabel }}</span>
                  </template>
                  <template #ricavo-cell="{ row }">€ {{ row.original.ricavo.toFixed(2) }}</template>
                  <template #compenso-cell="{ row }">€ {{ row.original.compenso.toFixed(2) }}</template>
                  <template #margine-cell="{ row }">
                    <span :class="row.original.margine >= 0 ? 'text-success-600' : 'text-error-600'">
                      € {{ row.original.margine.toFixed(2) }}
                    </span>
                  </template>
                  <template #marginePerc-cell="{ row }">
                    <span :class="row.original.marginePerc >= 0 ? 'text-success-600' : 'text-error-600'">
                      {{ row.original.marginePerc }}%
                    </span>
                  </template>
                </UTable>
              </UCard>

              <!-- Distribuzione tipo -->
              <UCard v-if="stats">
                <div class="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">Distribuzione lezioni per tipo</div>
                <div class="space-y-3">
                  <div v-for="t in stats.distribuzioneTipo" :key="t.tipo">
                    <div class="flex justify-between text-sm mb-1">
                      <span class="font-medium">{{ t.tipo }}</span>
                      <span class="text-slate-500">{{ t.percentuale }}% ({{ t.oreTotali.toFixed(1) }} ore)</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-2">
                      <div class="bg-tfn-500 h-2 rounded-full" :style="{ width: `${t.percentuale}%` }" />
                    </div>
                  </div>
                  <div v-if="stats.distribuzioneTipo.length === 0" class="text-sm text-slate-400">Nessun dato</div>
                </div>
              </UCard>

              <!-- Top 5 studenti -->
              <UCard v-if="stats && stats.topStudenti.length > 0">
                <div class="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">Top 5 alunni seguiti</div>
                <div class="space-y-2">
                  <div v-for="s in stats.topStudenti" :key="s.id" class="flex items-center justify-between text-sm">
                    <NuxtLink :to="`/studenti/${s.id}`" class="text-slate-700 hover:text-tfn-600">
                      {{ s.lastName }} {{ s.firstName }}
                    </NuxtLink>
                    <div class="text-slate-500">
                      {{ s.numLezioni }} lezioni · {{ s.oreTotali.toFixed(1) }} ore
                    </div>
                  </div>
                </div>
              </UCard>
            </template>
          </div>
        </template>

      </UTabs>

    </template>

    <div v-else class="py-20 text-center text-slate-400">Tutor non trovato</div>

    <!-- ─── Modal Modifica Anagrafica ─── -->
    <UModal v-model:open="modalModificaAperto" title="Modifica tutor" :ui="{ width: 'max-w-xl' }">
      <template #body>
        <UForm :state="datiModifica" class="space-y-4" @submit="salvaTutor">
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="firstName" label="Nome"><UInput v-model="datiModifica.firstName" class="w-full" /></UFormField>
            <UFormField name="lastName" label="Cognome"><UInput v-model="datiModifica.lastName" class="w-full" /></UFormField>
          </div>
          <UFormField name="email" label="Email"><UInput v-model="datiModifica.email" type="email" class="w-full" /></UFormField>
          <UFormField name="phone" label="Telefono"><UInput v-model="datiModifica.phone" class="w-full" /></UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="codiceFiscale" label="Cod. Fiscale"><UInput v-model="datiModifica.codiceFiscale" class="w-full" /></UFormField>
            <UFormField name="partitaIva" label="P.IVA"><UInput v-model="datiModifica.partitaIva" class="w-full" /></UFormField>
          </div>
          <UFormField name="indirizzo" label="Indirizzo"><UInput v-model="datiModifica.indirizzo" class="w-full" /></UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="citta" label="Città"><UInput v-model="datiModifica.citta" class="w-full" /></UFormField>
            <UFormField name="cap" label="CAP"><UInput v-model="datiModifica.cap" class="w-full" /></UFormField>
          </div>
          <UFormField name="modalitaPagamento" label="Modalità compenso">
            <USelect
              v-model="datiModifica.modalitaPagamento"
              :items="[{ label: 'A ore', value: 'ORE' }, { label: 'Forfait mensile', value: 'FORFAIT' }]"
              class="w-full"
            />
          </UFormField>
          <UFormField v-if="datiModifica.modalitaPagamento === 'FORFAIT'" name="importoForfait" label="Importo forfait (€)">
            <UInput v-model="datiModifica.importoForfait" type="number" class="w-full" />
          </UFormField>
          <UFormField name="noteInterne" label="Note interne">
            <UTextarea v-model="datiModifica.noteInterne" rows="3" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalModificaAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvando">Salva</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- ─── Modal Gestisci Materie ─── -->
    <UModal v-model:open="modalMaterieAperto" title="Gestisci materie" :ui="{ width: 'max-w-md' }">
      <template #body>
        <div class="space-y-4">
          <div class="flex gap-2">
            <UInput v-model="nuovaMateria" placeholder="Es. Matematica (Superiori)" class="flex-1" @keydown.enter.prevent="aggiungiMateria" />
            <UButton @click="aggiungiMateria">Aggiungi</UButton>
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(m, i) in materieLocali"
              :key="i"
              class="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-sm px-3 py-1 rounded-full"
            >
              {{ m }}
              <button class="text-slate-400 hover:text-error-500" @click="rimuoviMateria(i)">×</button>
            </span>
            <span v-if="materieLocali.length === 0" class="text-sm text-slate-400">Nessuna materia</span>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalMaterieAperto = false">Annulla</UButton>
            <UButton :loading="salvando" @click="salvaMaterie">Salva materie</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- ─── Modal Liquida Mese (dettaglio) ─── -->
    <UModal v-model:open="modalLiquidaDettaglioAperto" title="Liquida mese" :ui="{ width: 'max-w-md' }">
      <template #body>
        <UForm :state="datiLiquidaDettaglio" class="space-y-4" @submit="confermaLiquidaDettaglio">
          <UFormField name="mese" label="Mese">
            <UInput v-model="datiLiquidaDettaglio.mese" type="month" class="w-full" />
          </UFormField>
          <UFormField name="importo" label="Importo (€)">
            <UInput v-model="datiLiquidaDettaglio.importo" type="number" step="0.01" class="w-full" />
          </UFormField>
          <UFormField name="metodo" label="Metodo">
            <USelect v-model="datiLiquidaDettaglio.metodo" :items="metodiPagamento" class="w-full" />
          </UFormField>
          <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <UCheckbox v-model="datiLiquidaDettaglio.proBono" />
            Pro Bono
          </label>
          <UFormField name="note" label="Note">
            <UTextarea v-model="datiLiquidaDettaglio.note" rows="2" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalLiquidaDettaglioAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvando">Conferma</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- ─── Modal Nuovo Rimborso ─── -->
    <UModal v-model:open="modalNuovoRimborsoAperto" title="Nuovo rimborso spese" :ui="{ width: 'max-w-md' }">
      <template #body>
        <UForm :state="datiNuovoRimborso" class="space-y-4" @submit="creaNuovoRimborso">
          <UFormField name="importo" label="Importo (€)" required>
            <UInput v-model="datiNuovoRimborso.importo" type="number" step="0.01" class="w-full" />
          </UFormField>
          <UFormField name="descrizione" label="Descrizione" required>
            <UInput v-model="datiNuovoRimborso.descrizione" placeholder="Es. Carburante, materiali..." class="w-full" />
          </UFormField>
          <UFormField name="dataRichiesta" label="Data richiesta">
            <UInput v-model="datiNuovoRimborso.dataRichiesta" type="date" class="w-full" />
          </UFormField>
          <UFormField name="note" label="Note">
            <UTextarea v-model="datiNuovoRimborso.note" rows="2" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalNuovoRimborsoAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvando">Registra rimborso</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- ─── Modal Paga Rimborso ─── -->
    <UModal v-model:open="modalPagaRimborsoAperto" title="Paga rimborso" :ui="{ width: 'max-w-sm' }">
      <template #body>
        <UForm :state="datiPagaRimborso" class="space-y-4" @submit="confermaPagaRimborso">
          <div v-if="rimborsoSelezionato" class="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
            {{ rimborsoSelezionato.descrizione }} —
            residuo: € {{ (parseFloat(rimborsoSelezionato.importo) - parseFloat(rimborsoSelezionato.importoPagato)).toFixed(2) }}
          </div>
          <UFormField name="importoPagamento" label="Importo pagato (€)">
            <UInput v-model="datiPagaRimborso.importoPagamento" type="number" step="0.01" class="w-full" />
          </UFormField>
          <UFormField name="metodo" label="Metodo">
            <USelect v-model="datiPagaRimborso.metodo" :items="metodiPagamento" class="w-full" />
          </UFormField>
          <UFormField name="note" label="Note">
            <UTextarea v-model="datiPagaRimborso.note" rows="2" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalPagaRimborsoAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvando">Conferma pagamento</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['staff-only'] })

const route = useRoute()
const toast = useToast()
const { user: sessionUser } = useUserSession()

const id = route.params.id as string

// Protezione TUTOR: vede solo sé stesso
if (sessionUser.value?.role === 'TUTOR' && sessionUser.value?.id !== id) {
  await navigateTo('/')
}

// ─── Fetch dati principali ─────────────────────
const { data: tutor, pending: pendingTutor, refresh: refreshTutor } = await useFetch(`/api/tutors/${id}`, {
  default: () => null,
})
const { data: compensation, pending: pendingComp, refresh: refreshComp } = await useFetch(`/api/tutors/${id}/compensation`, {
  default: () => [] as any[],
})
const { data: reimbursements, pending: pendingReimb, refresh: refreshReimb } = await useFetch(`/api/tutors/${id}/reimbursements`, {
  default: () => [] as any[],
})
const { data: performance, pending: pendingPerf } = await useFetch(`/api/tutors/${id}/performance`, {
  default: () => [] as any[],
})
const { data: stats } = await useFetch(`/api/tutors/${id}/stats`, {
  default: () => null as any,
})

// ─── Computed KPI ──────────────────────────────
const arretratiTotali = computed(() =>
  (compensation.value ?? []).reduce((s: number, m: any) => s + (m.residuo > 0.01 && !m.isMeseCorrente ? m.residuo : 0), 0)
)
const mesiArretrati = computed(() =>
  (compensation.value ?? []).filter((m: any) => m.residuo > 0.01 && !m.isMeseCorrente).length
)
const totaleCompensoPagato = computed(() =>
  (compensation.value ?? []).reduce((s: number, m: any) => s + m.pagato, 0)
)
const compensoMeseCorrente = computed(() =>
  (compensation.value ?? []).find((m: any) => m.isMeseCorrente)?.residuo ?? 0
)
const totaleRimborsato = computed(() =>
  (reimbursements.value ?? []).reduce((s: number, r: any) => s + parseFloat(r.importoPagato), 0)
)
const rimborsiDaPagare = computed(() =>
  (reimbursements.value ?? []).reduce((s: number, r: any) =>
    s + Math.max(0, parseFloat(r.importo) - parseFloat(r.importoPagato)), 0)
)

// ─── Tab ──────────────────────────────────────
const tabs = [
  { label: 'Anagrafica', slot: 'anagrafica' },
  { label: 'Compensi',   slot: 'compensi' },
  { label: 'Rimborsi',   slot: 'rimborsi' },
  { label: 'Statistiche', slot: 'statistiche' },
]

// ─── Colonne tabelle ──────────────────────────
const colonneComp = [
  { id: 'meseLabel',         header: 'Mese' },
  { id: 'numLezioni',        header: 'Lezioni' },
  { id: 'compensoCalcolato', header: 'Compenso' },
  { id: 'pagato',            header: 'Liquidato' },
  { id: 'residuo',           header: 'Residuo' },
  { id: 'stato',             header: 'Stato' },
  { id: 'azioni',            header: '' },
]
const colonneReimb = [
  { id: 'dataRichiesta',  header: 'Data' },
  { id: 'descrizione',    header: 'Descrizione' },
  { id: 'importo',        header: 'Importo' },
  { id: 'importoPagato',  header: 'Pagato' },
  { id: 'residuoReimb',   header: 'Residuo' },
  { id: 'stato',          header: 'Stato' },
  { id: 'azioni',         header: '' },
]
const colonnePerf = [
  { id: 'meseLabel',   header: 'Mese' },
  { id: 'numLezioni',  header: 'Lezioni' },
  { id: 'numStudenti', header: 'Studenti' },
  { id: 'ricavo',      header: 'Ricavo generato' },
  { id: 'compenso',    header: 'Compenso' },
  { id: 'margine',     header: 'Margine' },
  { id: 'marginePerc', header: '%' },
]

// ─── Helper colori badge ──────────────────────
function coloreStatoPagamento(stato: string) {
  if (stato === 'PAGATO')   return 'success'
  if (stato === 'PARZIALE') return 'warning'
  if (stato === 'PRO_BONO') return 'neutral'
  return 'error'
}
function coloreStatoRimborso(stato: string) {
  if (stato === 'PAGATO')   return 'success'
  if (stato === 'PARZIALE') return 'warning'
  return 'error'
}

// ─── Metodi pagamento ─────────────────────────
const metodiPagamento = [
  { label: 'Contanti', value: 'CONTANTI' },
  { label: 'Bonifico', value: 'BONIFICO' },
  { label: 'POS',      value: 'POS' },
  { label: 'Assegno',  value: 'ASSEGNO' },
  { label: 'Altro',    value: 'ALTRO' },
]

// ─── Modal Modifica ───────────────────────────
const modalModificaAperto = ref(false)
const salvando = ref(false)
const datiModifica = reactive({
  firstName: tutor.value?.firstName ?? '',
  lastName: tutor.value?.lastName ?? '',
  email: tutor.value?.email ?? '',
  phone: tutor.value?.phone ?? '',
  codiceFiscale: tutor.value?.codiceFiscale ?? '',
  partitaIva: tutor.value?.partitaIva ?? '',
  indirizzo: tutor.value?.indirizzo ?? '',
  citta: tutor.value?.citta ?? '',
  cap: tutor.value?.cap ?? '',
  modalitaPagamento: tutor.value?.modalitaPagamento ?? 'ORE',
  importoForfait: tutor.value?.importoForfait ?? '',
  noteInterne: tutor.value?.noteInterne ?? '',
})

watch(tutor, (t) => {
  if (!t) return
  Object.assign(datiModifica, {
    firstName: t.firstName ?? '',
    lastName: t.lastName ?? '',
    email: t.email ?? '',
    phone: t.phone ?? '',
    codiceFiscale: t.codiceFiscale ?? '',
    partitaIva: t.partitaIva ?? '',
    indirizzo: t.indirizzo ?? '',
    citta: t.citta ?? '',
    cap: t.cap ?? '',
    modalitaPagamento: t.modalitaPagamento ?? 'ORE',
    importoForfait: t.importoForfait ?? '',
    noteInterne: t.noteInterne ?? '',
  })
})

async function salvaTutor() {
  salvando.value = true
  try {
    await $fetch(`/api/tutors/${id}`, {
      method: 'PUT',
      body: {
        ...datiModifica,
        phone: datiModifica.phone || null,
        codiceFiscale: datiModifica.codiceFiscale || null,
        partitaIva: datiModifica.partitaIva || null,
        indirizzo: datiModifica.indirizzo || null,
        citta: datiModifica.citta || null,
        cap: datiModifica.cap || null,
        importoForfait: datiModifica.importoForfait || null,
        noteInterne: datiModifica.noteInterne || null,
      },
    })
    toast.add({ title: 'Tutor aggiornato', color: 'success' })
    modalModificaAperto.value = false
    refreshTutor()
  } catch {
    toast.add({ title: 'Errore nel salvataggio', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Modal Materie ────────────────────────────
const modalMaterieAperto = ref(false)
const nuovaMateria = ref('')
const materieLocali = ref<string[]>([...((tutor.value?.materie as string[]) ?? [])])

watch(tutor, (t) => {
  materieLocali.value = [...((t?.materie as string[]) ?? [])]
})

function aggiungiMateria() {
  const m = nuovaMateria.value.trim()
  if (m && !materieLocali.value.includes(m)) {
    materieLocali.value.push(m)
    nuovaMateria.value = ''
  }
}
function rimuoviMateria(i: number) {
  materieLocali.value.splice(i, 1)
}
async function salvaMaterie() {
  salvando.value = true
  try {
    await $fetch(`/api/tutors/${id}`, {
      method: 'PUT',
      body: { materie: materieLocali.value },
    })
    toast.add({ title: 'Materie aggiornate', color: 'success' })
    modalMaterieAperto.value = false
    refreshTutor()
  } catch {
    toast.add({ title: 'Errore nel salvataggio', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Modal Liquida (dettaglio e lista compensi) ─
const modalLiquidaDettaglioAperto = ref(false)
const now = new Date()
const datiLiquidaDettaglio = reactive({
  mese:    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  importo: '',
  metodo:  'BONIFICO',
  proBono: false,
  note:    '',
})

function apriLiquidaDettaglio() {
  const meseCorr = (compensation.value ?? []).find((m: any) => m.isMeseCorrente)
  if (meseCorr) datiLiquidaDettaglio.importo = String(meseCorr.residuo)
  modalLiquidaDettaglioAperto.value = true
}

function apriLiquidaMese(mese: any) {
  datiLiquidaDettaglio.mese = mese.mese
  datiLiquidaDettaglio.importo = String(mese.residuo)
  modalLiquidaDettaglioAperto.value = true
}

async function confermaLiquidaDettaglio() {
  salvando.value = true
  try {
    const [anno, meseNum] = datiLiquidaDettaglio.mese.split('-').map(Number)
    const meseISO = new Date(anno!, meseNum! - 1, 1).toISOString()
    await $fetch(`/api/tutors/${id}/pay`, {
      method: 'POST',
      body: {
        mese:    meseISO,
        importo: datiLiquidaDettaglio.proBono ? '0' : datiLiquidaDettaglio.importo,
        metodo:  datiLiquidaDettaglio.metodo,
        proBono: datiLiquidaDettaglio.proBono,
        note:    datiLiquidaDettaglio.note || undefined,
      },
    })
    toast.add({ title: 'Liquidazione registrata', color: 'success' })
    modalLiquidaDettaglioAperto.value = false
    refreshComp()
    refreshTutor()
  } catch {
    toast.add({ title: 'Errore nella liquidazione', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Modal Nuovo Rimborso ─────────────────────
const modalNuovoRimborsoAperto = ref(false)
const datiNuovoRimborso = reactive({
  importo:       '',
  descrizione:   '',
  dataRichiesta: new Date().toISOString().substring(0, 10),
  note:          '',
})

async function creaNuovoRimborso() {
  if (!datiNuovoRimborso.importo || !datiNuovoRimborso.descrizione) {
    toast.add({ title: 'Importo e descrizione obbligatori', color: 'error' })
    return
  }
  salvando.value = true
  try {
    await $fetch(`/api/tutors/${id}/reimbursements`, {
      method: 'POST',
      body: { ...datiNuovoRimborso },
    })
    toast.add({ title: 'Rimborso registrato', color: 'success' })
    modalNuovoRimborsoAperto.value = false
    Object.assign(datiNuovoRimborso, { importo: '', descrizione: '', dataRichiesta: new Date().toISOString().substring(0, 10), note: '' })
    refreshReimb()
  } catch {
    toast.add({ title: 'Errore nel salvataggio', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Modal Paga Rimborso ──────────────────────
const modalPagaRimborsoAperto = ref(false)
const rimborsoSelezionato = ref<any>(null)
const datiPagaRimborso = reactive({ importoPagamento: '', metodo: 'BONIFICO', note: '' })

function apriPagaRimborso(r: any) {
  rimborsoSelezionato.value = r
  const residuo = parseFloat(r.importo) - parseFloat(r.importoPagato)
  datiPagaRimborso.importoPagamento = residuo.toFixed(2)
  datiPagaRimborso.note = ''
  modalPagaRimborsoAperto.value = true
}

async function confermaPagaRimborso() {
  if (!rimborsoSelezionato.value) return
  salvando.value = true
  try {
    await $fetch(`/api/tutors/${id}/reimbursements/${rimborsoSelezionato.value.id}/pay`, {
      method: 'POST',
      body: { ...datiPagaRimborso },
    })
    toast.add({ title: 'Rimborso pagato', color: 'success' })
    modalPagaRimborsoAperto.value = false
    refreshReimb()
  } catch {
    toast.add({ title: 'Errore nel pagamento', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Menu azioni header ───────────────────────
const menuAzioni = computed(() => [[
  {
    label: tutor.value?.active ? 'Disattiva tutor' : 'Riattiva tutor',
    icon: tutor.value?.active ? 'i-heroicons-pause-circle' : 'i-heroicons-play-circle',
    onSelect: () => toggleAttivo(),
  },
]])

async function toggleAttivo() {
  if (tutor.value?.active) {
    await $fetch(`/api/tutors/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Tutor disattivato', color: 'info' })
  } else {
    await $fetch(`/api/tutors/${id}`, { method: 'PUT', body: { active: true } })
    toast.add({ title: 'Tutor riattivato', color: 'success' })
  }
  refreshTutor()
}
</script>
```

- [ ] **Step 11.2: Avvia il dev server e verifica manualmente**

```powershell
npm run dev
```

**Checklist verifica manuale — esegui questi passi nel browser:**

1. Vai su `http://localhost:3000/tutor`
   - [ ] La pagina non mostra errori JavaScript nella console
   - [ ] Le 4 KPI cards sono visibili (possono mostrare 0)
   - [ ] La tabella è visibile (anche vuota)
   - [ ] Il bottone "Nuovo Tutor" apre il modal

2. Crea un tutor di test:
   - [ ] Clicca "Nuovo Tutor"
   - [ ] Compila: Nome=Mario, Cognome=Bianchi, Email=mario.bianchi@test.it, Password=password123
   - [ ] Clicca "Crea Tutor"
   - [ ] Il tutor appare nella lista
   - [ ] Il toast di successo è visibile

3. Verifica la pagina dettaglio:
   - [ ] Clicca sul nome del tutor nella lista
   - [ ] La pagina `/tutor/[id]` si apre senza errori
   - [ ] L'header mostra Nome e Cognome
   - [ ] I 4 tab (Anagrafica, Compensi, Rimborsi, Statistiche) sono visibili
   - [ ] Il tab Anagrafica mostra i dati del tutor

4. Verifica Tab Anagrafica:
   - [ ] Il bottone "Modifica" apre il modal con i dati precompilati
   - [ ] Modifica il telefono e salva → il dato si aggiorna
   - [ ] Il bottone "Gestisci" materie apre il modal
   - [ ] Aggiungi una materia (es. "Matematica (Superiori)") e salva → la materia appare come chip

5. Verifica Tab Compensi:
   - [ ] Il tab mostra le 3 KPI cards (possono essere a zero)
   - [ ] La tabella mesi è visibile (vuota se nessuna lezione registrata)

6. Verifica Tab Rimborsi:
   - [ ] Clicca "Nuovo rimborso"
   - [ ] Compila: Importo=50, Descrizione=Carburante
   - [ ] Salva → il rimborso appare nella tabella con stato DA_PAGARE
   - [ ] Clicca "Paga" sul rimborso
   - [ ] Inserisci importo=50, metodo=CONTANTI
   - [ ] Salva → lo stato diventa PAGATO

7. Verifica Tab Statistiche:
   - [ ] Il tab non genera errori (può essere vuoto se nessuna lezione)

8. Verifica ricerca nella lista:
   - [ ] Nella lista `/tutor`, digita "Mario" nel campo ricerca
   - [ ] La lista si filtra correttamente dopo 300ms

- [ ] **Step 11.3: Commit finale**

```powershell
git add app/pages/tutor/
git commit -m "feat: pagina dettaglio tutor con tab Anagrafica/Compensi/Rimborsi/Statistiche"
```

---

## Riepilogo commit previsti

```
feat: aggiunge Zod schemas per modulo tutor
feat: tutor service parte 1 — listTutors batch, CRUD
feat: API routes tutor CRUD base (5 endpoint)
feat: tutor service parte 2 — compensi mensili e liquidazione
feat: API routes compensi tutor (compensation + pay)
feat: tutor service parte 3 — performance mensile e statistiche
feat: API routes performance e statistiche tutor
feat: tutor service parte 4 — rimborsi spese
feat: API routes rimborsi tutor (list, crea, paga)
feat: pagina lista tutor con KPI, tabella e modal crea/liquida
feat: pagina dettaglio tutor con tab Anagrafica/Compensi/Rimborsi/Statistiche
```

---

## Note tecniche importanti

- **`#shared` alias**: Tutti gli import degli schema usano `#shared/schemas/tutor.schema`, non `~/shared/...`
- **UTable v4**: Usare `:data`, `id`+`header` nelle colonne, slot con suffisso `-cell`, `row.original` per accedere ai dati
- **Drizzle `sql` tag**: Le query aggregate e le CTE usano il template literal `sql\`...\`` importato da `'drizzle-orm'`
- **Compenso floor**: `Math.floor()` sempre — mai `Math.round()` o `Math.ceil()`
- **PRO_BONO**: Nessun `accountingEntry` creato, importo=0
- **Password**: Hashata con `bcrypt.hash(password, 10)` — mai salvata in chiaro
- **Transazioni Drizzle**: `db.transaction(async (tx) => { ... })` per operazioni atomiche
