# Fase 11 — Portale Famiglie: Piano di Implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire il Portale Famiglie — area riservata ai genitori per visualizzare note didattiche, richiedere prenotazioni e gestire il proprio account — più il pannello admin nella scheda studente e il form pubblico per nuove famiglie.

**Architecture:** Backend in tre layer: Zod schemas in `shared/schemas/`, business logic in `server/services/`, HTTP handlers in `server/api/`. Frontend porta: pagine in `app/pages/portale/` con layout `portal.vue` esistente e middleware `portal-only.ts` già presente. Gestionale: pannello aggiunto in fondo a `studenti/[id].vue`. Form pubblico `/prenota` senza layout.

**Tech Stack:** Nuxt 4 + @nuxt/ui v4, nuxt-auth-utils (`requireUserSession`/`useUserSession`), Drizzle ORM, Zod v4, bcryptjs, drizzle-kit per migrazione

---

## Mappa file

| File | Azione |
|------|--------|
| `server/database/schema.ts` | Modifica: aggiunge `studentId` nullable a `bookings` |
| `server/database/migrations/0002_*.sql` | Crea: migrazione ALTER TABLE |
| `shared/schemas/booking.schema.ts` | Crea: CreateBookingSchema, UpdateBookingStatusSchema |
| `shared/schemas/portal-user.schema.ts` | Crea: CreatePortalAccessSchema, ResetPortalPasswordSchema |
| `shared/schemas/contact.schema.ts` | Crea: PublicContactSchema (client-only) |
| `server/services/portal.service.ts` | Crea: getPortalStudents, getPortalNotes, checkPrenotazioneAbilitata |
| `server/services/booking.service.ts` | Crea: createBooking, listBookingsForAdmin, updateBookingStatus |
| `server/services/portal-user.service.ts` | Crea: createPortalAccount, resetPortalPassword, getPortalAccess |
| `server/api/portal/students.get.ts` | Crea: GET studenti collegati al GENITORE |
| `server/api/portal/notes.get.ts` | Crea: GET note FAMIGLIA |
| `server/api/portal/bookings.get.ts` | Crea: GET prenotazioni del GENITORE |
| `server/api/portal/bookings.post.ts` | Crea: POST nuova prenotazione |
| `server/api/portal/profile.put.ts` | Crea: PUT aggiorna profilo + cambio password |
| `server/api/admin/students/[id]/portal-access.get.ts` | Crea: GET stato account portale (admin) |
| `server/api/admin/students/[id]/portal-access.post.ts` | Crea: POST crea account GENITORE |
| `server/api/admin/students/[id]/portal-access.put.ts` | Crea: PUT aggiorna flag / reset password |
| `server/api/admin/bookings/index.get.ts` | Crea: GET lista prenotazioni admin |
| `server/api/admin/bookings/[id]/status.put.ts` | Crea: PUT conferma/cancella prenotazione |
| `app/pages/portale/index.vue` | Modifica: aggiunge middleware + placeholder corretto |
| `app/pages/portale/note.vue` | Crea: feed note FAMIGLIA |
| `app/pages/portale/prenota.vue` | Crea: wizard 3-step |
| `app/pages/portale/profilo.vue` | Crea: profilo + cambio password |
| `app/layouts/portal.vue` | Modifica: prenota nav condizionale |
| `app/pages/studenti/[id].vue` | Modifica: aggiunge pannello "Accesso Portale" |
| `app/pages/prenota.vue` | Crea: form pubblico client-only |

---

## Task 1 — Schema DB + Migrazione + Zod Schemas

**File:**
- Modify: `server/database/schema.ts` (tabella `bookings`, relazione `bookingsRelations`)
- Create: `shared/schemas/booking.schema.ts`
- Create: `shared/schemas/portal-user.schema.ts`
- Create: `shared/schemas/contact.schema.ts`

- [ ] **Step 1: Aggiungere `studentId` alla tabella `bookings` in schema.ts**

Aprire `server/database/schema.ts`. Trovare la tabella `bookings` (intorno alla riga 455) e aggiungere il campo `studentId` dopo il campo `userId`:

```typescript
// Nella tabella bookings, DOPO la riga con userId:
studentId: text('student_id').references(() => students.id, { onDelete: 'set null' }),
```

La tabella completa deve diventare:

```typescript
export const bookings = pgTable('bookings', {
  id:             text('id').primaryKey().$defaultFn(cuid),
  userId: text('user_id').notNull().references(() => users.id),
  studentId: text('student_id').references(() => students.id, { onDelete: 'set null' }),

  studentName:    varchar('student_name', { length: 100 }).notNull(),
  studentSurname: varchar('student_surname', { length: 100 }).notNull(),
  studentPhone:   varchar('student_phone', { length: 20 }).notNull(),

  requestedDate: timestamp('requested_date').notNull(),
  notes:         text('notes'),

  status: bookingStatusEnum('status').notNull().default('PENDING'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  statusDateIdx: index('bookings_status_date_idx').on(t.status, t.requestedDate),
  userIdx:       index('bookings_user_idx').on(t.userId),
  studentIdx:    index('bookings_student_idx').on(t.studentId),
}))
```

Aggiornare anche `bookingsRelations` (intorno alla riga 624):

```typescript
export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  subjects: many(bookingSubjects),
  user:     one(users, { fields: [bookings.userId], references: [users.id] }),
  student:  one(students, { fields: [bookings.studentId], references: [students.id] }),
}))
```

- [ ] **Step 2: Generare la migrazione con drizzle-kit**

Aprire PowerShell nella cartella del progetto ed eseguire:

```powershell
npx drizzle-kit generate
```

Questo creerà un nuovo file SQL in `server/database/migrations/`. Verificare che contenga un `ALTER TABLE "bookings" ADD COLUMN "student_id" text REFERENCES "students"("id") ON DELETE set null`.

- [ ] **Step 3: Applicare la migrazione su Supabase**

```powershell
npx drizzle-kit migrate
```

Attendi il messaggio di conferma. Se esce un errore SSL, assicurarsi che il file `.env` contenga `DATABASE_URL` con la stringa Supabase corretta.

- [ ] **Step 4: Creare `shared/schemas/booking.schema.ts`**

```typescript
import { z } from 'zod'

export const CreateBookingSchema = z.object({
  studentId:     z.string().min(1),
  dataDesiderata: z.string().datetime(),
  materie:       z.array(z.string().min(1)).min(1, { message: 'Seleziona almeno una materia' }),
  noteOrario:    z.string().max(500).optional(),
})

export const UpdateBookingStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED']),
  note:   z.string().max(500).optional(),
})

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>
```

- [ ] **Step 5: Creare `shared/schemas/portal-user.schema.ts`**

```typescript
import { z } from 'zod'

export const CreatePortalAccessSchema = z.object({
  studentId: z.string().min(1),
  email:     z.string().email({ message: 'Email non valida' }),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
})

export const ResetPortalPasswordSchema = z.object({
  userId: z.string().min(1),
})

export const UpdatePortalFlagSchema = z.object({
  abilitatoPrenotazioneOnline: z.boolean(),
})

export type CreatePortalAccessInput = z.infer<typeof CreatePortalAccessSchema>
export type ResetPortalPasswordInput = z.infer<typeof ResetPortalPasswordSchema>
export type UpdatePortalFlagInput = z.infer<typeof UpdatePortalFlagSchema>
```

- [ ] **Step 6: Creare `shared/schemas/contact.schema.ts`**

```typescript
import { z } from 'zod'

// Usato solo lato client — nessun endpoint backend
export const PublicContactSchema = z.object({
  nomeStudente:  z.string().min(1, { message: 'Nome studente obbligatorio' }).max(200),
  classeScuola:  z.string().max(200).optional(),
  materie:       z.string().min(1, { message: 'Specifica almeno una materia' }).max(500),
  contatto:      z.string().min(1, { message: 'Telefono o email obbligatorio' }).max(200),
  note:          z.string().max(1000).optional(),
})

export type PublicContactInput = z.infer<typeof PublicContactSchema>
```

- [ ] **Step 7: Commit**

```powershell
git add server/database/schema.ts server/database/migrations/ shared/schemas/booking.schema.ts shared/schemas/portal-user.schema.ts shared/schemas/contact.schema.ts
git commit -m "feat: add studentId to bookings + Zod schemas for portal (fase 11)"
```

**Verifica manuale:** Aprire Supabase → Table Editor → tabella `bookings` → confermare che la colonna `student_id` esiste (nullable).

---

## Task 2 — `server/services/portal.service.ts`

**File:**
- Create: `server/services/portal.service.ts`

- [ ] **Step 1: Creare `server/services/portal.service.ts`**

```typescript
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../database/client'
import { students, packages, studentNotes } from '../database/schema'

// Carica tutti gli studenti collegati a un GENITORE
export async function getPortalStudents(linkedStudentIds: string[]) {
  if (linkedStudentIds.length === 0) return []

  const result = await db.query.students.findMany({
    where: (s, { inArray }) => inArray(s.id, linkedStudentIds),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      classe: true,
      scuola: true,
      abilitatoPrenotazioneOnline: true,
    },
    with: {
      packages: {
        columns: {
          id: true,
          nome: true,
          tipo: true,
          oreResiduo: true,
          stati: true,
          dataScadenza: true,
        },
        where: (p, { not, arrayContains }) =>
          not(arrayContains(p.stati, ['CHIUSO'])),
        orderBy: (p, { desc }) => [desc(p.createdAt)],
        limit: 1,
      }
    }
  })

  return result
}

// Note con visibilità FAMIGLIA per gli studenti collegati al GENITORE
export async function getPortalNotes(linkedStudentIds: string[]) {
  if (linkedStudentIds.length === 0) return []

  const result = await db.query.studentNotes.findMany({
    where: (n, { inArray, and, eq }) =>
      and(
        inArray(n.studentId, linkedStudentIds),
        eq(n.visibilita, 'FAMIGLIA')
      ),
    orderBy: [desc(studentNotes.createdAt)],
    with: {
      author: {
        columns: { firstName: true, lastName: true, role: true }
      },
      student: {
        columns: { firstName: true, lastName: true }
      }
    }
  })

  return result
}

// Controlla se almeno uno studente collegato è abilitato alla prenotazione online
// e ha un pacchetto attivo
export async function checkPrenotazioneAbilitata(linkedStudentIds: string[]): Promise<boolean> {
  if (linkedStudentIds.length === 0) return false

  for (const studentId of linkedStudentIds) {
    const student = await db.query.students.findFirst({
      where: eq(students.id, studentId),
      columns: { abilitatoPrenotazioneOnline: true },
      with: {
        packages: {
          columns: { stati: true },
          limit: 1,
          where: (p, { arrayContains }) => arrayContains(p.stati, ['ATTIVO']),
        }
      }
    })

    if (student?.abilitatoPrenotazioneOnline && (student.packages?.length ?? 0) > 0) {
      return true
    }
  }

  return false
}
```

- [ ] **Step 2: Commit**

```powershell
git add server/services/portal.service.ts
git commit -m "feat: portal.service.ts — getPortalStudents, getPortalNotes, checkPrenotazioneAbilitata"
```

**Verifica manuale:** Il file è presente in `server/services/`. Non ci sono errori TypeScript visibili (nessun simbolo rosso in VS Code).

---

## Task 3 — `booking.service.ts` + `portal-user.service.ts`

**File:**
- Create: `server/services/booking.service.ts`
- Create: `server/services/portal-user.service.ts`

- [ ] **Step 1: Creare `server/services/booking.service.ts`**

```typescript
import { eq, desc, inArray } from 'drizzle-orm'
import { db } from '../database/client'
import { bookings, bookingSubjects, students } from '../database/schema'
import type { CreateBookingInput, UpdateBookingStatusInput } from '#shared/schemas/booking.schema'

// Crea una prenotazione dal portale famiglie
export async function createBooking(input: CreateBookingInput, userId: string) {
  const student = await db.query.students.findFirst({
    where: eq(students.id, input.studentId),
    columns: { firstName: true, lastName: true, studentPhone: true }
  })

  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Studente non trovato' })
  }

  return await db.transaction(async (tx) => {
    const [booking] = await tx.insert(bookings).values({
      userId,
      studentId: input.studentId,
      studentName:    student.firstName,
      studentSurname: student.lastName,
      studentPhone:   student.studentPhone ?? '',
      requestedDate:  new Date(input.dataDesiderata),
      notes:          input.noteOrario ?? null,
      status:         'PENDING',
    }).returning()

    if (input.materie.length > 0) {
      await tx.insert(bookingSubjects).values(
        input.materie.map((m) => ({
          name:      m,
          bookingId: booking.id,
        }))
      )
    }

    return booking
  })
}

// Lista prenotazioni per un GENITORE
export async function listBookingsForPortal(userId: string) {
  return await db.query.bookings.findMany({
    where: eq(bookings.userId, userId),
    orderBy: [desc(bookings.createdAt)],
    with: {
      subjects: { columns: { name: true, assignedSlot: true } },
      student:  { columns: { firstName: true, lastName: true } },
    }
  })
}

// Lista tutte le prenotazioni PENDING per l'admin (filtrabili per studente)
export async function listBookingsForAdmin(studentId?: string) {
  const rows = await db.query.bookings.findMany({
    where: studentId ? eq(bookings.studentId, studentId) : undefined,
    orderBy: [desc(bookings.createdAt)],
    with: {
      subjects: { columns: { name: true } },
      user:     { columns: { firstName: true, lastName: true, email: true } },
      student:  { columns: { firstName: true, lastName: true } },
    }
  })
  return rows
}

// Conferma o cancella una prenotazione (solo ADMIN)
export async function updateBookingStatus(id: string, input: UpdateBookingStatusInput) {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, id),
  })

  if (!booking) {
    throw createError({ statusCode: 404, statusMessage: 'Prenotazione non trovata' })
  }

  const [updated] = await db.update(bookings)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(bookings.id, id))
    .returning()

  return updated
}
```

- [ ] **Step 2: Creare `server/services/portal-user.service.ts`**

```typescript
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../database/client'
import { users, students } from '../database/schema'
import type { CreatePortalAccessInput } from '#shared/schemas/portal-user.schema'

function generateTempPassword(length = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Controlla se uno studente ha già un account portale
export async function getPortalAccess(studentId: string) {
  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
    columns: { id: true, portalUserId: true, abilitatoPrenotazioneOnline: true },
    with: {
      portalUser: {
        columns: { id: true, email: true, firstName: true, lastName: true, active: true }
      }
    }
  })

  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Studente non trovato' })
  }

  return student
}

// Crea un nuovo account GENITORE e lo collega allo studente
export async function createPortalAccount(input: CreatePortalAccessInput) {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email già in uso da un altro account' })
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  return await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email:     input.email.toLowerCase(),
      password:  hashedPassword,
      firstName: input.firstName,
      lastName:  input.lastName,
      role:      'GENITORE',
      active:    true,
    }).returning()

    await tx.update(students)
      .set({ portalUserId: user.id, updatedAt: new Date() })
      .where(eq(students.id, input.studentId))

    return { user, tempPassword }
  })
}

// Genera e imposta una nuova password temporanea
export async function resetPortalPassword(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Account non trovato' })
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  await db.update(users)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, userId))

  return { tempPassword }
}

// Aggiorna il flag abilitatoPrenotazioneOnline
export async function updatePrenotazioneFlag(studentId: string, abilitato: boolean) {
  const [updated] = await db.update(students)
    .set({ abilitatoPrenotazioneOnline: abilitato, updatedAt: new Date() })
    .where(eq(students.id, studentId))
    .returning()
  return updated
}
```

- [ ] **Step 3: Commit**

```powershell
git add server/services/booking.service.ts server/services/portal-user.service.ts
git commit -m "feat: booking.service.ts + portal-user.service.ts (fase 11)"
```

---

## Task 4 — API Routes: Portale (GENITORE)

**File:**
- Create: `server/api/portal/students.get.ts`
- Create: `server/api/portal/notes.get.ts`
- Create: `server/api/portal/bookings.get.ts`
- Create: `server/api/portal/bookings.post.ts`
- Create: `server/api/portal/profile.put.ts`

- [ ] **Step 1: `server/api/portal/students.get.ts`**

```typescript
import { getPortalStudents } from '../../services/portal.service'

// GET /api/portal/students
// Restituisce gli studenti collegati al GENITORE loggato
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato ai genitori' })
  }

  return await getPortalStudents(user.linkedStudentIds ?? [])
})
```

- [ ] **Step 2: `server/api/portal/notes.get.ts`**

```typescript
import { getPortalNotes } from '../../services/portal.service'

// GET /api/portal/notes
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato ai genitori' })
  }

  return await getPortalNotes(user.linkedStudentIds ?? [])
})
```

- [ ] **Step 3: `server/api/portal/bookings.get.ts`**

```typescript
import { listBookingsForPortal } from '../../services/booking.service'

// GET /api/portal/bookings
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato ai genitori' })
  }

  return await listBookingsForPortal(user.id)
})
```

- [ ] **Step 4: `server/api/portal/bookings.post.ts`**

```typescript
import { CreateBookingSchema } from '#shared/schemas/booking.schema'
import { createBooking } from '../../services/booking.service'

// POST /api/portal/bookings
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato ai genitori' })
  }

  const body = await readBody(event)
  const result = CreateBookingSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  // Verifica che lo studentId appartenga a questo genitore
  const linkedIds = user.linkedStudentIds ?? []
  if (!linkedIds.includes(result.data.studentId)) {
    throw createError({ statusCode: 403, statusMessage: 'Non puoi prenotare per questo studente' })
  }

  return await createBooking(result.data, user.id)
})
```

- [ ] **Step 5: `server/api/portal/profile.put.ts`**

```typescript
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../../database/client'
import { users } from '../../database/schema'

const UpdateProfileSchema = z.object({
  firstName:      z.string().min(1).max(100).optional(),
  lastName:       z.string().min(1).max(100).optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword:    z.string().min(8).max(100).optional(),
})

// PUT /api/portal/profile
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato ai genitori' })
  }

  const body = await readBody(event)
  const result = UpdateProfileSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  const data = result.data
  const updates: Record<string, any> = { updatedAt: new Date() }

  if (data.firstName) updates.firstName = data.firstName
  if (data.lastName) updates.lastName = data.lastName

  if (data.newPassword) {
    if (!data.currentPassword) {
      throw createError({ statusCode: 400, statusMessage: 'Inserisci la password attuale per cambiarla' })
    }
    const dbUser = await db.query.users.findFirst({ where: eq(users.id, user.id) })
    if (!dbUser) throw createError({ statusCode: 404, statusMessage: 'Account non trovato' })

    const valid = await bcrypt.compare(data.currentPassword, dbUser.password)
    if (!valid) throw createError({ statusCode: 401, statusMessage: 'Password attuale non corretta' })

    updates.password = await bcrypt.hash(data.newPassword, 10)
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, user.id)).returning()
  return { ok: true, firstName: updated.firstName, lastName: updated.lastName }
})
```

- [ ] **Step 6: Commit**

```powershell
git add server/api/portal/
git commit -m "feat: API routes portale GENITORE (students, notes, bookings, profile)"
```

---

## Task 5 — API Routes: Admin

**File:**
- Create: `server/api/admin/students/[id]/portal-access.get.ts`
- Create: `server/api/admin/students/[id]/portal-access.post.ts`
- Create: `server/api/admin/students/[id]/portal-access.put.ts`
- Create: `server/api/admin/bookings/index.get.ts`
- Create: `server/api/admin/bookings/[id]/status.put.ts`

- [ ] **Step 1: `server/api/admin/students/[id]/portal-access.get.ts`**

```typescript
import { getPortalAccess } from '../../../../services/portal-user.service'

// GET /api/admin/students/:id/portal-access
// Restituisce lo stato dell'account portale collegato allo studente
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  return await getPortalAccess(studentId)
})
```

- [ ] **Step 3: `server/api/admin/students/[id]/portal-access.post.ts`**

```typescript
import { CreatePortalAccessSchema } from '#shared/schemas/portal-user.schema'
import { createPortalAccount } from '../../../../services/portal-user.service'

// POST /api/admin/students/:id/portal-access
// Crea un account GENITORE e lo collega allo studente
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  const body = await readBody(event)
  const result = CreatePortalAccessSchema.safeParse({ ...body, studentId })
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  const { user: newUser, tempPassword } = await createPortalAccount(result.data)

  return {
    ok: true,
    userId: newUser.id,
    email: newUser.email,
    tempPassword,
  }
})
```

- [ ] **Step 4: `server/api/admin/students/[id]/portal-access.put.ts`**

```typescript
import { z } from 'zod'
import { ResetPortalPasswordSchema } from '#shared/schemas/portal-user.schema'
import { resetPortalPassword, updatePrenotazioneFlag } from '../../../../services/portal-user.service'

const PutSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reset-password'), userId: z.string().min(1) }),
  z.object({ action: z.literal('toggle-prenotazione'), abilitato: z.boolean() }),
])

// PUT /api/admin/students/:id/portal-access
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  const body = await readBody(event)
  const result = PutSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  if (result.data.action === 'reset-password') {
    const { tempPassword } = await resetPortalPassword(result.data.userId)
    return { ok: true, tempPassword }
  }

  if (result.data.action === 'toggle-prenotazione') {
    await updatePrenotazioneFlag(studentId, result.data.abilitato)
    return { ok: true }
  }
})
```

- [ ] **Step 5: `server/api/admin/bookings/index.get.ts`**

```typescript
import { listBookingsForAdmin } from '../../../services/booking.service'

// GET /api/admin/bookings?studentId=...
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const query = getQuery(event)
  const studentId = typeof query.studentId === 'string' ? query.studentId : undefined

  return await listBookingsForAdmin(studentId)
})
```

- [ ] **Step 7: `server/api/admin/bookings/[id]/status.put.ts`**

```typescript
import { UpdateBookingStatusSchema } from '#shared/schemas/booking.schema'
import { updateBookingStatus } from '../../../../services/booking.service'

// PUT /api/admin/bookings/:id/status
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID prenotazione mancante' })

  const body = await readBody(event)
  const result = UpdateBookingStatusSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  return await updateBookingStatus(id, result.data)
})
```

- [ ] **Step 6: Commit**

```powershell
git add server/api/admin/
git commit -m "feat: API routes admin (portal-access, bookings) — fase 11"
```

---

## Task 6 — Aggiornare `portale/index.vue` (placeholder definitivo)

**File:**
- Modify: `app/pages/portale/index.vue`

- [ ] **Step 1: Riscrivere `portale/index.vue`**

Il file esiste già con un placeholder basilare. Sostituirlo con la versione definitiva che include il middleware e un messaggio di benvenuto accogliente:

```vue
<template>
  <div class="space-y-6">
    <div class="text-center py-10 space-y-4">
      <div class="w-16 h-16 rounded-full bg-tfn-100 flex items-center justify-center mx-auto">
        <UIcon name="i-heroicons-home" class="w-8 h-8 text-tfn-600" />
      </div>
      <div>
        <h1 class="font-heading text-2xl font-bold text-slate-900">
          Benvenuto, {{ user?.firstName }}
        </h1>
        <p class="text-slate-500 mt-1">
          Usa il menu in basso per navigare nel portale.
        </p>
      </div>
    </div>

    <!-- Dashboard coming soon -->
    <UCard class="border border-dashed border-slate-300 bg-slate-50">
      <div class="text-center py-6 space-y-2">
        <UIcon name="i-heroicons-chart-bar" class="w-8 h-8 text-slate-400 mx-auto" />
        <p class="text-sm font-medium text-slate-600">Riepilogo in arrivo</p>
        <p class="text-xs text-slate-400">
          Il pannello con ore residue e ultime lezioni sarà disponibile prossimamente.
        </p>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Home — Portale Famiglie' })

const { user } = useUserSession()
</script>
```

- [ ] **Step 2: Commit**

```powershell
git add app/pages/portale/index.vue
git commit -m "feat: portale/index.vue — placeholder definitivo con middleware"
```

**Verifica manuale:**
1. Avvia il server: `npm run dev`
2. Vai a `http://localhost:3000/portale` nel browser
3. Se non sei loggato → devi essere reindirizzato a `/login`
4. Accedi come ADMIN o TUTOR → devi essere reindirizzato a `/` (homepage gestionale)
5. Accedi come GENITORE → devi vedere la pagina con il messaggio di benvenuto e la card "Riepilogo in arrivo"

---

## Task 7 — `portale/note.vue`

**File:**
- Create: `app/pages/portale/note.vue`

- [ ] **Step 1: Creare `app/pages/portale/note.vue`**

```vue
<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="font-heading text-xl font-bold text-slate-900">Note del tutor</h2>
      <UBadge v-if="notes.length > 0" color="neutral" variant="subtle">
        {{ notes.length }} note
      </UBadge>
    </div>

    <!-- Caricamento -->
    <template v-if="pending">
      <div v-for="i in 3" :key="i" class="space-y-2">
        <USkeleton class="h-24 w-full rounded-xl" />
      </div>
    </template>

    <!-- Nessuna nota -->
    <template v-else-if="notes.length === 0">
      <UCard>
        <div class="text-center py-8 space-y-2">
          <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-slate-300 mx-auto" />
          <p class="text-sm text-slate-500">Nessuna nota condivisa al momento</p>
          <p class="text-xs text-slate-400">
            Qui appariranno i commenti del tutor sulle sessioni di tuo figlio.
          </p>
        </div>
      </UCard>
    </template>

    <!-- Feed note -->
    <template v-else>
      <UCard
        v-for="nota in notes"
        :key="nota.id"
        class="space-y-2"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-full bg-tfn-100 flex items-center justify-center">
                <span class="text-xs font-semibold text-tfn-700">
                  {{ nota.author.firstName[0] }}{{ nota.author.lastName[0] }}
                </span>
              </div>
              <div>
                <span class="text-sm font-medium text-slate-800">
                  {{ nota.author.firstName }} {{ nota.author.lastName }}
                </span>
                <span class="text-xs text-slate-400 ml-1">(Tutor)</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="nota.student" class="text-xs text-slate-500">
                {{ nota.student.firstName }} {{ nota.student.lastName }}
              </span>
              <span class="text-xs text-slate-400">
                {{ formatDate(nota.createdAt) }}
              </span>
            </div>
          </div>
        </template>

        <p class="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
          {{ nota.contenuto }}
        </p>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Note — Portale Famiglie' })

const { data, pending } = await useFetch('/api/portal/notes')
const notes = computed(() => (data.value as any[]) ?? [])

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
</script>
```

- [ ] **Step 2: Commit**

```powershell
git add app/pages/portale/note.vue
git commit -m "feat: portale/note.vue — feed note FAMIGLIA"
```

**Verifica manuale:**
1. Accedi come GENITORE
2. Vai su `/portale/note`
3. Se non ci sono note FAMIGLIA per questo studente → vedi il messaggio "Nessuna nota condivisa"
4. Dal gestionale, aggiungi una nota con visibilità "FAMIGLIA" per lo studente collegato
5. Ricarica la pagina → la nota deve apparire nel feed

---

## Task 8 — `portale/prenota.vue` (wizard 3 step)

**File:**
- Create: `app/pages/portale/prenota.vue`

- [ ] **Step 1: Creare `app/pages/portale/prenota.vue`**

```vue
<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <h2 class="font-heading text-xl font-bold text-slate-900">Richiedi una lezione</h2>
    </div>

    <!-- Stepper visuale -->
    <div class="flex items-center gap-2">
      <div
        v-for="(label, idx) in steps"
        :key="idx"
        class="flex items-center gap-2"
      >
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
          :class="step > idx + 1
            ? 'bg-success-500 text-white'
            : step === idx + 1
              ? 'bg-tfn-500 text-white'
              : 'bg-slate-100 text-slate-400'"
        >
          <UIcon v-if="step > idx + 1" name="i-heroicons-check" class="w-4 h-4" />
          <span v-else>{{ idx + 1 }}</span>
        </div>
        <span class="text-xs text-slate-500 hidden sm:inline">{{ label }}</span>
        <div v-if="idx < steps.length - 1" class="w-6 h-px bg-slate-200" />
      </div>
    </div>

    <!-- STEP 1: Selezione studente (solo se multi-figlio) + Data -->
    <UCard v-if="step === 1">
      <template #header>
        <span class="font-medium text-slate-800">Quando vorresti la lezione?</span>
      </template>

      <!-- Selettore figlio (solo se più figli) -->
      <div v-if="students.length > 1" class="mb-4">
        <label class="block text-sm font-medium text-slate-700 mb-1">Per quale figlio?</label>
        <USelect
          v-model="form.studentId"
          :options="students.map(s => ({ label: `${s.firstName} ${s.lastName}`, value: s.id }))"
          placeholder="Seleziona figlio..."
        />
      </div>

      <div class="space-y-3">
        <label class="block text-sm font-medium text-slate-700">Data desiderata</label>
        <UInput
          v-model="form.dataDesiderata"
          type="date"
          :min="minDate"
          class="w-full"
        />
        <p class="text-xs text-slate-400">Non puoi selezionare date passate. La segreteria assegnerà l'orario esatto.</p>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton
            :disabled="!form.dataDesiderata || !form.studentId"
            @click="step = 2"
          >
            Avanti
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- STEP 2: Materie -->
    <UCard v-if="step === 2">
      <template #header>
        <span class="font-medium text-slate-800">Quali materie vuoi studiare?</span>
      </template>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button
          v-for="materia in MATERIE"
          :key="materia"
          class="px-3 py-2 text-sm rounded-lg border transition-colors text-left"
          :class="form.materie.includes(materia)
            ? 'border-tfn-500 bg-tfn-50 text-tfn-700 font-medium'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'"
          @click="toggleMateria(materia)"
        >
          {{ materia }}
        </button>
      </div>

      <p v-if="form.materie.length === 0" class="text-xs text-error-500 mt-2">
        Seleziona almeno una materia
      </p>

      <template #footer>
        <div class="flex justify-between">
          <UButton variant="ghost" @click="step = 1">Indietro</UButton>
          <UButton :disabled="form.materie.length === 0" @click="step = 3">Avanti</UButton>
        </div>
      </template>
    </UCard>

    <!-- STEP 3: Nota + Conferma -->
    <UCard v-if="step === 3">
      <template #header>
        <span class="font-medium text-slate-800">Aggiungi una nota (opzionale)</span>
      </template>

      <div class="space-y-4">
        <UTextarea
          v-model="form.noteOrario"
          placeholder="Es. preferisco dopo le 17, o il giovedì pomeriggio"
          :rows="3"
          class="w-full"
        />

        <!-- Riepilogo -->
        <div class="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-slate-500">Studente</span>
            <span class="font-medium text-slate-800">{{ studentSelezionato }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Data richiesta</span>
            <span class="font-medium text-slate-800">{{ formatDate(form.dataDesiderata) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Materie</span>
            <span class="font-medium text-slate-800">{{ form.materie.join(', ') }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between">
          <UButton variant="ghost" @click="step = 2">Indietro</UButton>
          <UButton
            color="primary"
            :loading="loading"
            @click="inviaPrenotazione"
          >
            Conferma richiesta
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- STEP 4: Successo -->
    <UCard v-if="step === 4">
      <div class="text-center py-8 space-y-4">
        <div class="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto">
          <UIcon name="i-heroicons-check" class="w-8 h-8 text-success-600" />
        </div>
        <div>
          <h3 class="font-heading text-lg font-bold text-slate-900">Richiesta inviata!</h3>
          <p class="text-sm text-slate-500 mt-1">
            La segreteria ti contatterà per confermare orario e tutor.
          </p>
        </div>
        <UButton to="/portale" variant="ghost">Torna alla home</UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Prenota — Portale Famiglie' })

const MATERIE = [
  'Matematica', 'Fisica', 'Chimica', 'Italiano', 'Inglese',
  'Storia', 'Geografia', 'Latino', 'Greco', 'Scienze', 'Informatica',
]

const toast = useToast()
const step = ref(1)
const loading = ref(false)
const steps = ['Data', 'Materie', 'Conferma']

const { data: studentsData } = await useFetch('/api/portal/students')
const students = computed(() => (studentsData.value as any[]) ?? [])

const form = reactive({
  studentId:     students.value[0]?.id ?? '',
  dataDesiderata: '',
  materie:       [] as string[],
  noteOrario:    '',
})

// Se c'è un solo figlio, preselezionarlo
watchEffect(() => {
  if (students.value.length === 1 && !form.studentId) {
    form.studentId = students.value[0].id
  }
})

const minDate = computed(() => {
  const today = new Date()
  today.setDate(today.getDate() + 1)
  return today.toISOString().split('T')[0]
})

const studentSelezionato = computed(() => {
  const s = students.value.find((s: any) => s.id === form.studentId)
  return s ? `${s.firstName} ${s.lastName}` : ''
})

function toggleMateria(m: string) {
  const idx = form.materie.indexOf(m)
  if (idx === -1) form.materie.push(m)
  else form.materie.splice(idx, 1)
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

async function inviaPrenotazione() {
  loading.value = true
  try {
    await $fetch('/api/portal/bookings', {
      method: 'POST',
      body: {
        studentId:      form.studentId,
        dataDesiderata: new Date(form.dataDesiderata).toISOString(),
        materie:        form.materie,
        noteOrario:     form.noteOrario || undefined,
      },
    })
    step.value = 4
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile inviare la richiesta. Riprova.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>
```

- [ ] **Step 2: Commit**

```powershell
git add app/pages/portale/prenota.vue
git commit -m "feat: portale/prenota.vue — wizard 3-step prenotazione lezione"
```

**Verifica manuale:**
1. Accedi come GENITORE con almeno uno studente collegato
2. Vai su `/portale/prenota`
3. Step 1: Scegli una data futura → clicca "Avanti"
4. Step 2: Seleziona 2-3 materie → clicca "Avanti"
5. Step 3: Aggiungi una nota opzionale → controlla il riepilogo → clicca "Conferma"
6. Deve apparire la schermata di successo con il checkmark verde
7. Nel gestionale, vai sulla scheda dello studente → verifica che la prenotazione appare con stato PENDING

---

## Task 9 — `portale/profilo.vue`

**File:**
- Create: `app/pages/portale/profilo.vue`

- [ ] **Step 1: Creare `app/pages/portale/profilo.vue`**

```vue
<template>
  <div class="space-y-6">
    <h2 class="font-heading text-xl font-bold text-slate-900">Il mio account</h2>

    <!-- Info account -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-user-circle" class="w-4 h-4 text-tfn-500" />
          <span class="font-medium text-slate-800">Dati account</span>
        </div>
      </template>

      <dl class="space-y-2 text-sm">
        <div class="flex justify-between py-1 border-b border-slate-100">
          <span class="text-slate-500">Nome</span>
          <span class="font-medium text-slate-800">{{ user?.firstName }} {{ user?.lastName }}</span>
        </div>
        <div class="flex justify-between py-1">
          <span class="text-slate-500">Email</span>
          <span class="font-medium text-slate-800">{{ user?.email }}</span>
        </div>
      </dl>
    </UCard>

    <!-- Studenti collegati -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-academic-cap" class="w-4 h-4 text-tfn-500" />
          <span class="font-medium text-slate-800">Figli collegati</span>
        </div>
      </template>

      <template v-if="pendingStudents">
        <USkeleton class="h-8 w-full" />
      </template>
      <template v-else-if="students.length === 0">
        <p class="text-sm text-slate-500">Nessuno studente collegato.</p>
      </template>
      <ul v-else class="space-y-1">
        <li
          v-for="s in students"
          :key="s.id"
          class="flex items-center gap-2 text-sm py-1"
        >
          <UIcon name="i-heroicons-user" class="w-4 h-4 text-slate-400" />
          <span class="text-slate-800">{{ s.firstName }} {{ s.lastName }}</span>
          <span v-if="s.classe" class="text-slate-400">— {{ s.classe }}</span>
        </li>
      </ul>
    </UCard>

    <!-- Cambio password -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-lock-closed" class="w-4 h-4 text-tfn-500" />
          <span class="font-medium text-slate-800">Cambia password</span>
        </div>
      </template>

      <div class="space-y-3">
        <UFormField label="Password attuale">
          <UInput v-model="pwForm.currentPassword" type="password" class="w-full" />
        </UFormField>
        <UFormField label="Nuova password (minimo 8 caratteri)">
          <UInput v-model="pwForm.newPassword" type="password" class="w-full" />
        </UFormField>
        <UFormField label="Ripeti nuova password">
          <UInput v-model="pwForm.confirmPassword" type="password" class="w-full" />
        </UFormField>
        <p v-if="pwError" class="text-xs text-error-500">{{ pwError }}</p>
      </div>

      <template #footer>
        <UButton
          color="primary"
          :loading="savingPw"
          @click="cambiaPassword"
        >
          Aggiorna password
        </UButton>
      </template>
    </UCard>

    <!-- Logout -->
    <UButton
      block
      variant="outline"
      color="error"
      icon="i-heroicons-arrow-right-on-rectangle"
      :loading="loggingOut"
      @click="esciDalPortale"
    >
      Esci dall'account
    </UButton>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Profilo — Portale Famiglie' })

const toast = useToast()
const { user } = useUserSession()

const { data: studentsData, pending: pendingStudents } = await useFetch('/api/portal/students')
const students = computed(() => (studentsData.value as any[]) ?? [])

const pwForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const pwError = ref('')
const savingPw = ref(false)
const loggingOut = ref(false)

async function cambiaPassword() {
  pwError.value = ''
  if (pwForm.newPassword.length < 8) {
    pwError.value = 'La nuova password deve essere di almeno 8 caratteri'
    return
  }
  if (pwForm.newPassword !== pwForm.confirmPassword) {
    pwError.value = 'Le password non coincidono'
    return
  }

  savingPw.value = true
  try {
    await $fetch('/api/portal/profile', {
      method: 'PUT',
      body: {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      },
    })
    toast.add({ title: 'Password aggiornata', color: 'success' })
    pwForm.currentPassword = ''
    pwForm.newPassword = ''
    pwForm.confirmPassword = ''
  } catch (e: any) {
    pwError.value = e?.data?.statusMessage ?? 'Errore durante il cambio password'
  } finally {
    savingPw.value = false
  }
}

async function esciDalPortale() {
  loggingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await navigateTo('/login')
  } catch {
    loggingOut.value = false
  }
}
</script>
```

- [ ] **Step 2: Commit**

```powershell
git add app/pages/portale/profilo.vue
git commit -m "feat: portale/profilo.vue — account, studenti collegati, cambio password, logout"
```

**Verifica manuale:**
1. Accedi come GENITORE
2. Vai su `/portale/profilo`
3. Verifica che nome ed email siano corretti
4. Verifica che lo studente collegato appaia nella lista
5. Prova cambio password: inserisci password sbagliata → deve uscire errore
6. Prova con password corretta + nuova password → deve apparire toast verde
7. Clicca "Esci" → deve tornare alla pagina di login

---

## Task 10 — Modifica `portal.vue` (prenota nav condizionale)

**File:**
- Modify: `app/layouts/portal.vue`

Il layout deve mostrare la voce "Prenota" nel menu solo se il genitore ha almeno uno studente abilitato alla prenotazione online.

- [ ] **Step 1: Riscrivere `app/layouts/portal.vue`**

```vue
<template>
  <div class="min-h-screen bg-white">

    <!-- ═══ HEADER ═══ -->
    <header class="fixed top-0 left-0 right-0 h-16 bg-tfn-500 flex items-center justify-between px-4 z-40">
      <div class="w-8" />
      <span class="font-heading font-semibold text-white text-base tracking-tight">
        Ti Formiamo Noi
      </span>
      <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
        <span class="text-white text-xs font-semibold">
          {{ user?.firstName?.[0] ?? 'G' }}
        </span>
      </div>
    </header>

    <!-- ═══ DESKTOP NAV (md+) ═══ -->
    <nav class="hidden md:flex fixed top-16 left-0 right-0 bg-white border-b border-slate-200 justify-center gap-8 h-12 items-center z-30">
      <NuxtLink
        v-for="item in visibleNavItems"
        :key="item.route"
        :to="item.route"
        class="flex items-center gap-1.5 text-sm font-medium transition-colors"
        :class="isActive(item.route)
          ? 'text-tfn-600'
          : 'text-slate-500 hover:text-slate-900'"
      >
        <UIcon :name="item.icon" class="w-4 h-4" />
        {{ item.label }}
      </NuxtLink>
    </nav>

    <!-- ═══ CONTENUTO ═══ -->
    <main class="pt-16 pb-16 md:pt-28 md:pb-0 min-h-screen">
      <div class="max-w-[680px] mx-auto px-4 md:px-6 py-6">
        <slot />
      </div>
    </main>

    <!-- ═══ BOTTOM NAV (mobile) ═══ -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-40 h-16">
      <NuxtLink
        v-for="item in visibleNavItems"
        :key="item.route"
        :to="item.route"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
        :class="isActive(item.route) ? 'text-tfn-600' : 'text-slate-400'"
      >
        <UIcon :name="item.icon" class="w-6 h-6" />
        <span class="text-[10px] font-medium">{{ item.label }}</span>
      </NuxtLink>
    </nav>

  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { user } = useUserSession()

const { data: studentsData } = await useFetch('/api/portal/students')
const students = computed(() => (studentsData.value as any[]) ?? [])

const prenotazioneAbilitata = computed(() =>
  students.value.some((s: any) => s.abilitatoPrenotazioneOnline)
)

const allNavItems = [
  { icon: 'i-heroicons-home',          label: 'Home',    route: '/portale',          always: true },
  { icon: 'i-heroicons-calendar-days', label: 'Prenota', route: '/portale/prenota',  always: false },
  { icon: 'i-heroicons-document-text', label: 'Note',    route: '/portale/note',     always: true },
  { icon: 'i-heroicons-user',          label: 'Profilo', route: '/portale/profilo',  always: true },
]

const visibleNavItems = computed(() =>
  allNavItems.filter(item => item.always || prenotazioneAbilitata.value)
)

function isActive(path: string) {
  if (path === '/portale') return route.path === '/portale'
  return route.path.startsWith(path)
}
</script>
```

- [ ] **Step 2: Commit**

```powershell
git add app/layouts/portal.vue
git commit -m "feat: portal.vue — voce Prenota condizionale (solo se abilitato)"
```

**Verifica manuale:**
1. Accedi come GENITORE il cui studente ha `abilitatoPrenotazioneOnline = false`
2. Il menu del portale non deve mostrare "Prenota"
3. Dal gestionale, vai sulla scheda studente → attiva il toggle prenotazione (dopo Task 11)
4. Ricarica il portale → il menu deve mostrare "Prenota"

---

## Task 11 — Pannello "Accesso Portale" in `studenti/[id].vue`

**File:**
- Modify: `app/pages/studenti/[id].vue`

- [ ] **Step 1: Leggere la fine del file per trovare dove aggiungere il pannello**

Il file `studenti/[id].vue` è lungo. Il pannello va aggiunto in fondo alla sezione principale (dopo il componente `NoteFeed`). Leggere le ultime 50 righe per trovare il punto di inserimento.

- [ ] **Step 2: Aggiungere il recupero dati portale nello `<script setup>`**

Trovare il blocco `<script setup lang="ts">` nel file `studenti/[id].vue` e aggiungere DOPO le variabili esistenti:

```typescript
// Portale famiglie — solo ADMIN/SUPER_TUTOR
const { user: sessionUser } = useUserSession()
const isAdmin = computed(() =>
  ['ADMIN', 'SUPER_TUTOR'].includes(sessionUser.value?.role ?? '')
)

// Recupero stato accesso portale
const { data: portalAccess, refresh: refreshPortal } = await useFetch(
  () => `/api/admin/students/${id}/portal-access`,
  { lazy: true }
)

// Prenotazioni pending per questo studente
const { data: pendingBookings, refresh: refreshBookings } = await useFetch(
  () => `/api/admin/bookings?studentId=${id}`,
  { lazy: true }
)
const bookingsPending = computed(() =>
  ((pendingBookings.value as any[]) ?? []).filter((b: any) => b.status === 'PENDING')
)

// Modali portale
const mostraModalCreaAccesso = ref(false)
const datiCreaAccesso = reactive({ email: '', firstName: '', lastName: '' })
const credenziali = ref<{ email: string; tempPassword: string } | null>(null)
const creandoAccesso = ref(false)
const resetPassword = ref<string | null>(null)
const togglando = ref(false)

async function creaAccessoPortale() {
  creandoAccesso.value = true
  try {
    const res = await $fetch(`/api/admin/students/${id}/portal-access`, {
      method: 'POST',
      body: datiCreaAccesso,
    }) as any
    credenziali.value = { email: res.email, tempPassword: res.tempPassword }
    await refreshPortal()
    toast.add({ title: 'Account portale creato', color: 'success' })
    mostraModalCreaAccesso.value = false
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile creare account',
      color: 'error',
    })
  } finally {
    creandoAccesso.value = false
  }
}

async function reimpostaPassword() {
  const acc = portalAccess.value as any
  if (!acc?.portalUser?.id) return
  try {
    const res = await $fetch(`/api/admin/students/${id}/portal-access`, {
      method: 'PUT',
      body: { action: 'reset-password', userId: acc.portalUser.id },
    }) as any
    resetPassword.value = res.tempPassword
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile reimpostare password',
      color: 'error',
    })
  }
}

async function togglePrenotazione(value: boolean) {
  togglando.value = true
  try {
    await $fetch(`/api/admin/students/${id}/portal-access`, {
      method: 'PUT',
      body: { action: 'toggle-prenotazione', abilitato: value },
    })
    await refreshPortal()
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile aggiornare',
      color: 'error',
    })
  } finally {
    togglando.value = false
  }
}

async function confermaBooking(bookingId: string) {
  try {
    await $fetch(`/api/admin/bookings/${bookingId}/status`, {
      method: 'PUT',
      body: { status: 'CONFIRMED' },
    })
    await refreshBookings()
    toast.add({ title: 'Prenotazione confermata', color: 'success' })
  } catch {
    toast.add({ title: 'Errore', color: 'error' })
  }
}

async function cancellaBooking(bookingId: string) {
  try {
    await $fetch(`/api/admin/bookings/${bookingId}/status`, {
      method: 'PUT',
      body: { status: 'CANCELLED' },
    })
    await refreshBookings()
    toast.add({ title: 'Prenotazione cancellata', color: 'neutral' })
  } catch {
    toast.add({ title: 'Errore', color: 'error' })
  }
}
```

- [ ] **Step 3: Aggiungere il pannello nel template (in fondo, dentro `<template v-else>`)**

Trovare il commento o il tag di chiusura del blocco `<template v-else>` (quello principale che mostra il contenuto dello studente). Aggiungere PRIMA della chiusura di `</template>` (quello principale):

```vue
<!-- ═══ ACCESSO PORTALE (solo ADMIN) ═══ -->
<UCard v-if="isAdmin" class="mt-2">
  <template #header>
    <div class="flex items-center gap-2">
      <UIcon name="i-heroicons-globe-alt" class="w-4 h-4 text-tfn-500" />
      <span class="font-medium text-slate-800">Accesso Portale Famiglie</span>
    </div>
  </template>

  <!-- Nessun account portale -->
  <template v-if="!(portalAccess as any)?.portalUser">
    <p class="text-sm text-slate-500 mb-4">
      Questo studente non ha ancora un account portale.
      Crea un accesso per il genitore per consentirgli di visualizzare note e richiedere lezioni.
    </p>
    <UButton
      icon="i-heroicons-plus"
      @click="mostraModalCreaAccesso = true"
    >
      Crea accesso portale
    </UButton>
  </template>

  <!-- Account portale esistente -->
  <template v-else>
    <dl class="space-y-2 text-sm mb-4">
      <div class="flex justify-between py-1 border-b border-slate-100">
        <span class="text-slate-500">Email genitore</span>
        <span class="font-medium">{{ (portalAccess as any).portalUser?.email }}</span>
      </div>
      <div class="flex justify-between py-1 border-b border-slate-100">
        <span class="text-slate-500">Nome</span>
        <span class="font-medium">
          {{ (portalAccess as any).portalUser?.firstName }}
          {{ (portalAccess as any).portalUser?.lastName }}
        </span>
      </div>
      <div class="flex items-center justify-between py-1 border-b border-slate-100">
        <span class="text-slate-500">Prenotazione online</span>
        <USwitch
          :model-value="(portalAccess as any).abilitatoPrenotazioneOnline"
          :loading="togglando"
          @update:model-value="togglePrenotazione"
        />
      </div>
    </dl>

    <!-- Password temporanea dopo reset -->
    <UAlert
      v-if="resetPassword"
      color="warning"
      icon="i-heroicons-key"
      title="Nuova password temporanea"
      :description="`Comunica questa password al genitore: ${resetPassword} (mostrata una sola volta)`"
      class="mb-4"
      :close-button="{ icon: 'i-heroicons-x-mark' }"
      @close="resetPassword = null"
    />

    <!-- Credenziali dopo creazione account -->
    <UAlert
      v-if="credenziali"
      color="info"
      icon="i-heroicons-key"
      title="Account creato — comunicare al genitore:"
      :description="`Email: ${credenziali.email} | Password: ${credenziali.tempPassword}`"
      class="mb-4"
      :close-button="{ icon: 'i-heroicons-x-mark' }"
      @close="credenziali = null"
    />

    <UButton variant="outline" size="sm" @click="reimpostaPassword">
      Reimposta password
    </UButton>
  </template>

  <!-- Prenotazioni PENDING -->
  <template v-if="bookingsPending.length > 0">
    <div class="mt-4 pt-4 border-t border-slate-100">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-sm font-medium text-slate-800">Prenotazioni in attesa</span>
        <UBadge color="warning" variant="subtle">{{ bookingsPending.length }}</UBadge>
      </div>
      <div class="space-y-2">
        <div
          v-for="b in bookingsPending"
          :key="b.id"
          class="flex items-start justify-between bg-amber-50 border border-amber-200 rounded-lg p-3"
        >
          <div class="text-sm space-y-0.5">
            <p class="font-medium text-slate-800">
              {{ formatDateBooking(b.requestedDate) }}
            </p>
            <p class="text-slate-500">
              {{ b.subjects?.map((s: any) => s.name).join(', ') }}
            </p>
            <p v-if="b.notes" class="text-slate-400 text-xs">{{ b.notes }}</p>
          </div>
          <div class="flex gap-2 ml-3">
            <UButton size="xs" color="success" @click="confermaBooking(b.id)">Conferma</UButton>
            <UButton size="xs" color="error" variant="outline" @click="cancellaBooking(b.id)">Cancella</UButton>
          </div>
        </div>
      </div>
    </div>
  </template>
</UCard>

<!-- ═══ MODAL CREA ACCESSO ═══ -->
<UModal v-model:open="mostraModalCreaAccesso" title="Crea accesso portale">
  <template #body>
    <div class="space-y-4 p-4">
      <p class="text-sm text-slate-500">
        Inserisci i dati del genitore. Verrà generata una password temporanea da comunicare manualmente.
      </p>
      <UFormField label="Email genitore">
        <UInput v-model="datiCreaAccesso.email" type="email" class="w-full" placeholder="genitore@email.it" />
      </UFormField>
      <UFormField label="Nome">
        <UInput v-model="datiCreaAccesso.firstName" class="w-full" placeholder="Mario" />
      </UFormField>
      <UFormField label="Cognome">
        <UInput v-model="datiCreaAccesso.lastName" class="w-full" placeholder="Rossi" />
      </UFormField>
    </div>
  </template>
  <template #footer>
    <div class="flex justify-end gap-2 px-4 pb-4">
      <UButton variant="ghost" @click="mostraModalCreaAccesso = false">Annulla</UButton>
      <UButton
        color="primary"
        :loading="creandoAccesso"
        :disabled="!datiCreaAccesso.email || !datiCreaAccesso.firstName || !datiCreaAccesso.lastName"
        @click="creaAccessoPortale"
      >
        Crea account
      </UButton>
    </div>
  </template>
</UModal>
```

Aggiungere la funzione `formatDateBooking` nello script (dopo le altre funzioni):

```typescript
function formatDateBooking(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}
```

- [ ] **Step 4: Commit**

```powershell
git add app/pages/studenti/
git commit -m "feat: studenti/[id].vue — pannello Accesso Portale con gestione account e prenotazioni"
```

**Verifica manuale:**
1. Vai su un qualsiasi `/studenti/[id]` come ADMIN
2. Scorri in fondo alla pagina → deve apparire il pannello "Accesso Portale Famiglie"
3. Clicca "Crea accesso portale" → compila nome, cognome, email → conferma
4. Deve apparire un alert giallo con le credenziali temporanee
5. Il pannello ora mostra l'email e il toggle prenotazione
6. Attiva il toggle → ricarica → deve restare attivo
7. Dal portale (come GENITORE) invia una prenotazione → torna nel gestionale sulla scheda studente → la prenotazione PENDING deve apparire con i bottoni Conferma/Cancella

---

## Task 12 — `prenota.vue` (form pubblico per nuove famiglie)

**File:**
- Create: `app/pages/prenota.vue`

- [ ] **Step 1: Creare `app/pages/prenota.vue`**

```vue
<template>
  <div class="min-h-screen bg-gradient-to-br from-tfn-50 to-white flex items-center justify-center p-4">
    <div class="w-full max-w-md space-y-6">

      <!-- Logo/Header -->
      <div class="text-center space-y-2">
        <div class="w-14 h-14 rounded-2xl bg-tfn-500 flex items-center justify-center mx-auto">
          <UIcon name="i-heroicons-academic-cap" class="w-8 h-8 text-white" />
        </div>
        <h1 class="font-heading text-2xl font-bold text-slate-900">Ti Formiamo Noi</h1>
        <p class="text-sm text-slate-500">Richiedi informazioni per il tuo figlio</p>
      </div>

      <!-- Successo -->
      <UCard v-if="inviato" class="text-center">
        <div class="py-8 space-y-4">
          <div class="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto">
            <UIcon name="i-heroicons-check" class="w-8 h-8 text-success-600" />
          </div>
          <div>
            <h2 class="font-heading text-xl font-bold text-slate-900">Grazie!</h2>
            <p class="text-sm text-slate-500 mt-1">
              Abbiamo ricevuto la tua richiesta. Ti contatteremo presto per fornirti tutte le informazioni.
            </p>
          </div>
        </div>
      </UCard>

      <!-- Form -->
      <UCard v-else>
        <template #header>
          <span class="font-medium text-slate-800">Compila il modulo</span>
        </template>

        <div class="space-y-4">
          <UFormField label="Nome e cognome del figlio" required>
            <UInput v-model="form.nomeStudente" class="w-full" placeholder="Es. Marco Rossi" />
            <p v-if="errors.nomeStudente" class="text-xs text-error-500 mt-1">{{ errors.nomeStudente }}</p>
          </UFormField>

          <UFormField label="Classe e scuola">
            <UInput v-model="form.classeScuola" class="w-full" placeholder="Es. 3a Liceo Scientifico Fermi" />
          </UFormField>

          <UFormField label="Materie di interesse" required>
            <UInput
              v-model="form.materie"
              class="w-full"
              placeholder="Es. Matematica, Fisica, Inglese"
            />
            <p class="text-xs text-slate-400 mt-1">Puoi elencare più materie separate da virgola</p>
            <p v-if="errors.materie" class="text-xs text-error-500 mt-1">{{ errors.materie }}</p>
          </UFormField>

          <UFormField label="Telefono o email di contatto" required>
            <UInput v-model="form.contatto" class="w-full" placeholder="Es. 333 1234567 o nome@email.it" />
            <p v-if="errors.contatto" class="text-xs text-error-500 mt-1">{{ errors.contatto }}</p>
          </UFormField>

          <UFormField label="Note aggiuntive">
            <UTextarea
              v-model="form.note"
              class="w-full"
              placeholder="Orari preferiti, domande, esigenze particolari..."
              :rows="3"
            />
          </UFormField>
        </div>

        <template #footer>
          <UButton
            block
            color="primary"
            :loading="inviando"
            @click="inviaRichiesta"
          >
            Invia richiesta
          </UButton>
        </template>
      </UCard>

      <p class="text-center text-xs text-slate-400">
        Hai già un account?
        <NuxtLink to="/login" class="text-tfn-600 hover:underline">Accedi al portale</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PublicContactSchema } from '#shared/schemas/contact.schema'

definePageMeta({ layout: false })
useHead({ title: 'Richiedi informazioni — Ti Formiamo Noi' })

const form = reactive({
  nomeStudente: '',
  classeScuola: '',
  materie: '',
  contatto: '',
  note: '',
})

const errors = reactive<Record<string, string>>({})
const inviando = ref(false)
const inviato = ref(false)

function inviaRichiesta() {
  // Reset errori
  Object.keys(errors).forEach(k => delete errors[k])

  const result = PublicContactSchema.safeParse(form)
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    Object.entries(fieldErrors).forEach(([field, msgs]) => {
      if (msgs?.[0]) errors[field] = msgs[0]
    })
    return
  }

  // Nessuna chiamata backend — solo lato client
  inviando.value = true
  setTimeout(() => {
    inviando.value = false
    inviato.value = true
  }, 800)
}
</script>
```

- [ ] **Step 2: Commit**

```powershell
git add app/pages/prenota.vue
git commit -m "feat: prenota.vue — form pubblico richiesta contatto (client-only)"
```

**Verifica manuale:**
1. Vai su `http://localhost:3000/prenota` **senza essere loggato**
2. La pagina deve apparire senza la barra di navigazione del gestionale (layout: false)
3. Prova a cliccare "Invia" con i campi obbligatori vuoti → devono apparire i messaggi di errore
4. Compila tutti i campi obbligatori → clicca "Invia"
5. Deve apparire la schermata di successo "Grazie!" con il checkmark verde
6. Non deve apparire nessuna chiamata API nel Network tab del browser

---

## Riepilogo task

| Task | File/i principali | Stato |
|------|------------------|-------|
| 1 | schema.ts, migrations, 3 Zod schemas | ⬜ |
| 2 | portal.service.ts | ⬜ |
| 3 | booking.service.ts, portal-user.service.ts | ⬜ |
| 4 | server/api/portal/ (5 route) | ⬜ |
| 5 | server/api/admin/ (4 route) | ⬜ |
| 6 | portale/index.vue (update) | ⬜ |
| 7 | portale/note.vue | ⬜ |
| 8 | portale/prenota.vue | ⬜ |
| 9 | portale/profilo.vue | ⬜ |
| 10 | layouts/portal.vue (update) | ⬜ |
| 11 | studenti/[id].vue (update) | ⬜ |
| 12 | prenota.vue (form pubblico) | ⬜ |

---

## Note per l'implementatore

- **`requireUserSession(event)`** è importato automaticamente da `nuxt-auth-utils` — non serve import esplicito
- **`#shared/schemas/...`** è l'alias Nuxt per importare da `shared/schemas/`
- **`createError`** è globale in Nitro — non serve import
- **Nessun test automatico** — usare esclusivamente le checklist manuali in ogni task
- **USwitch** (non UToggle) per i toggle — il linter corregge automaticamente
- **`user.id`** nella session è di tipo `string` (non `number`) per il ruolo GENITORE
- **`students.abilitatoPrenotazioneOnline`** è `boolean` in Drizzle/TypeScript
- La tabella `bookings` ora ha `studentName`, `studentSurname`, `studentPhone` come `notNull()` — il service li popola dal record studente
