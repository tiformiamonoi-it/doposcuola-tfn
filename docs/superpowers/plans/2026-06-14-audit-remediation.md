# Audit Remediation — Piano di Implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development per eseguire questo piano task-by-task. Gli step usano checkbox (`- [ ]`).
>
> **VINCOLO PROGETTO (CLAUDE.md):** NIENTE test automatici (no Vitest/Jest/Cypress). Ogni task ha una checklist di collaudo MANUALE.

**Goal:** Chiudere il buco di autenticazione sulle API, correggere i bug funzionali (compensi tutor, conti pacchetti), allineare RBAC e dati, e applicare ottimizzazioni DB e pulizia.

**Architecture:** Difesa a strati. Un middleware server globale (`server/middleware/`) diventa la "guardia del caveau" e impone login + ruolo su tutte le route `/api/**`. I controlli per-route esistenti restano come difesa ridondante. I fix funzionali sono chirurgici nei service. Le ottimizzazioni DB passano da nuove migrazioni Drizzle.

**Tech Stack:** Nuxt 4, nuxt-auth-utils (`requireUserSession`), Drizzle ORM, Zod v4, PostgreSQL (Supabase).

**Branch:** `fix/audit-remediation`

---

## Mappa file

| File | Azione |
|------|--------|
| `server/utils/auth-policy.ts` | Crea: mappa prefissi → ruoli ammessi + helper |
| `server/middleware/01.auth-guard.ts` | Crea: guardia globale autenticazione+ruolo per `/api/**` |
| `server/utils/portal.ts` | Crea: `getLinkedStudentIds(userId)` (sessione fresca) |
| `server/services/tutor.service.ts` | Modifica: fix tabella `tutors` inesistente + encoding € |
| `server/services/package.service.ts` | Modifica: `updatePackage` ricalcola importoResiduo + giorniResiduo |
| `server/services/booking.service.ts` | Modifica: `listBookingsForAdmin` usa `bookings.studentId` |
| `server/api/portal/students.get.ts` | Modifica: usa `getLinkedStudentIds` |
| `server/api/portal/notes.get.ts` | Modifica: usa `getLinkedStudentIds` |
| `server/api/portal/bookings.post.ts` | Modifica: usa `getLinkedStudentIds` |
| `app/pages/contabilita/index.vue` | Modifica: middleware `admin-only` |
| `server/database/schema.ts` | Modifica: indici GIN su `packages.stati` |
| `server/database/migrations/0004_*.sql` | Crea: indice GIN + pg_trgm (generato) |
| `DECISION_LOG.md` | Modifica: ADL-015 + correzione stato migrazione 0002 |

---

## Task 1 — Fase A: Guardia globale autenticazione API

**Problema:** 46/68 route `/api/**` non controllano la sessione → dati accessibili senza login.

**File:**
- Create: `server/utils/auth-policy.ts`
- Create: `server/middleware/01.auth-guard.ts`

- [ ] **Step 1: Creare `server/utils/auth-policy.ts`**

```typescript
// Mappa di policy per le route API.
// Per ogni prefisso path, i ruoli ammessi. La prima corrispondenza vince.
// Le route NON elencate ricadono nel default: solo staff interno.

type Role = 'ADMIN' | 'SUPER_TUTOR' | 'TUTOR' | 'GENITORE'

const STAFF: Role[] = ['ADMIN', 'SUPER_TUTOR', 'TUTOR']
const ADMIN_SUPER: Role[] = ['ADMIN', 'SUPER_TUTOR']
const ADMIN_ONLY: Role[] = ['ADMIN']
const GENITORE_ONLY: Role[] = ['GENITORE']

// Path pubblici: nessun login richiesto
export const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/_auth/session', // gestito da nuxt-auth-utils
]

// Regole ordinate: la PRIMA che matcha decide i ruoli ammessi
export const API_POLICY: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/api/accounting',              roles: ADMIN_ONLY },   // contabilità = solo ADMIN
  { prefix: '/api/portal',                  roles: GENITORE_ONLY },
  { prefix: '/api/admin',                   roles: ADMIN_SUPER },
  { prefix: '/api/tutors/availabilities',   roles: STAFF },        // il tutor gestisce le proprie
  { prefix: '/api/notes',                   roles: STAFF },        // il tutor scrive note
  { prefix: '/api/students',                roles: STAFF },        // lettura schede (note tutor) — mutazioni controllate sotto
  // Gestione anagrafica/economica = ADMIN/SUPER_TUTOR
  { prefix: '/api/packages',                roles: ADMIN_SUPER },
  { prefix: '/api/standard-packages',       roles: ADMIN_SUPER },
  { prefix: '/api/lessons',                 roles: ADMIN_SUPER },
  { prefix: '/api/payments',                roles: ADMIN_SUPER },
  { prefix: '/api/settings',                roles: ADMIN_SUPER },
  { prefix: '/api/matching',                roles: ADMIN_SUPER },
  { prefix: '/api/tutors',                  roles: ADMIN_SUPER },  // gestione tutor
]

const DEFAULT_ROLES: Role[] = STAFF

export function isPublicApi(path: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => path.startsWith(p))
}

export function allowedRolesFor(path: string): Role[] {
  const rule = API_POLICY.find((r) => path.startsWith(r.prefix))
  return rule?.roles ?? DEFAULT_ROLES
}
```

> **NOTA per `/api/students`:** la lettura schede serve anche ai TUTOR (note). Le mutazioni sensibili (POST/PUT/DELETE studenti) restano comunque protette anche dai controlli per-route già presenti dove esistono. Se si vuole bloccare le mutazioni studenti ai soli ADMIN/SUPER, vedere Task 1 Step 4 (opzionale).

- [ ] **Step 2: Creare `server/middleware/01.auth-guard.ts`**

Il prefisso `01.` garantisce che giri presto. Server middleware Nitro gira ad ogni richiesta: filtriamo solo `/api/`.

```typescript
import { isPublicApi, allowedRolesFor } from '../utils/auth-policy'

// Guardia globale: ogni route /api/** richiede login + ruolo ammesso.
// Eccezioni: login e endpoint di sessione (PUBLIC_API_PREFIXES).
export default defineEventHandler(async (event) => {
  const path = event.path || ''

  // Solo le API sono protette qui (le pagine hanno i middleware Nuxt lato client)
  if (!path.startsWith('/api/')) return

  // Endpoint pubblici (login, sessione)
  if (isPublicApi(path)) return

  // Richiede una sessione valida — lancia 401 se assente
  const { user } = await requireUserSession(event)

  // Controllo ruolo in base alla policy
  const allowed = allowedRolesFor(path)
  if (!allowed.includes(user.role as any)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso non consentito per il tuo ruolo' })
  }
})
```

- [ ] **Step 3: Verifica che gli handler esistenti non rompano**

I 22 handler che già chiamano `requireUserSession` continuano a funzionare (la sessione è già risolta; la doppia chiamata è sicura e idempotente). Nessuna modifica necessaria.

- [ ] **Step 4 (OPZIONALE): restringere mutazioni studenti**

Se si vuole impedire ai TUTOR di creare/modificare/cancellare studenti, aggiungere in testa a `server/api/students/index.post.ts`, `[id].put.ts`, `[id].delete.ts`:

```typescript
const { user } = await requireUserSession(event)
if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
  throw createError({ statusCode: 403, statusMessage: 'Riservato ad ADMIN/SUPER_TUTOR' })
}
```

- [ ] **Step 5: Commit**

```powershell
git add server/utils/auth-policy.ts server/middleware/01.auth-guard.ts
git commit -m "fix(security): global API auth guard with role policy (fase A)"
```

**Collaudo manuale:**
1. Avvia `npm run dev`.
2. In una scheda anonima (senza login) apri `http://localhost:3000/api/students` → deve rispondere **401** (non più la lista).
3. Apri `http://localhost:3000/api/accounting/dashboard` senza login → **401**.
4. Fai login come ADMIN, poi visita `/contabilita` → la pagina carica i dati (l'API risponde 200).
5. Fai login come TUTOR e prova ad aprire `http://localhost:3000/api/accounting/dashboard` → **403**.
6. Fai login come GENITORE e prova `http://localhost:3000/api/students` → **403**.
7. Verifica che il portale genitori (`/portale`, `/portale/note`) continui a funzionare normalmente.

---

## Task 2 — Fase B1: Fix crash Compensi tutor + FORFAIT

**Problema:** `getMonthlyCompensation` usa `db.select().from(tutors)` ma la tabella `tutors` non esiste → crash + FORFAIT mai applicato.

**File:**
- Modify: `server/services/tutor.service.ts` (riga ~288 e riga ~536)

- [ ] **Step 1: Sostituire il riferimento alla tabella inesistente**

In `getMonthlyCompensation`, sostituire:

```typescript
const [tutorRec] = await db.select().from(tutors).where(eq(tutors.id, tutorId))
```

con (usa `tutorProfiles`, già importato):

```typescript
const [tutorRec] = await db
  .select({
    modalitaPagamento: tutorProfiles.modalitaPagamento,
    importoForfait:    tutorProfiles.importoForfait,
  })
  .from(tutorProfiles)
  .where(eq(tutorProfiles.userId, tutorId))
  .limit(1)
```

Il resto della funzione (`tutorRec?.modalitaPagamento === 'FORFAIT'` ...) resta invariato.

- [ ] **Step 2: Fix encoding messaggio errore rimborso (riga ~536)**

Sostituire i `?` con `€`:

```typescript
throw new Error(`Il pagamento (€${nuovoPagamento.toFixed(2)}) eccede l'importo totale rimborsabile (€${(importoTotale - giaPagato).toFixed(2)} rimanenti)`)
```

- [ ] **Step 3: Commit**

```powershell
git add server/services/tutor.service.ts
git commit -m "fix(tutor): compensation crash (missing tutors table) + FORFAIT + euro encoding (fase B)"
```

**Collaudo manuale:**
1. Login ADMIN → `/tutor` → apri un tutor → tab **Compensi**: la tabella mensile carica senza errori (prima andava in errore).
2. Imposta un tutor in modalità **FORFAIT** con importo (es. €400) → la riga del mese mostra €400 come compenso calcolato, non la somma a ore.
3. Prova a pagare un rimborso con importo maggiore del dovuto → il messaggio d'errore mostra correttamente il simbolo **€**.

---

## Task 3 — Fase B2: Fix conti in `updatePackage`

**Problema:** modificando un pacchetto, `importoResiduo` non viene ricalcolato e `giorniResiduo` non entra nel calcolo stati (MENSILE perde ESAURITO-per-giorni).

**File:**
- Modify: `server/services/package.service.ts` (funzione `updatePackage`, righe ~272-309)

- [ ] **Step 1: Ricalcolare importoResiduo e includere giorniResiduo**

Sostituire il blocco che assegna `changes.stati` (righe ~293-301) con:

```typescript
  // Ricalcola importoResiduo se cambia il prezzo totale (importoPagato resta invariato)
  const nuovoPrezzoTotale = data.prezzoTotale !== undefined
    ? data.prezzoTotale
    : parseFloat(existing.prezzoTotale)
  const importoPagato = parseFloat(existing.importoPagato)
  const nuovoImportoResiduo = Math.max(0, nuovoPrezzoTotale - importoPagato)
  changes.importoResiduo = String(nuovoImportoResiduo)

  // Giorni residui: se cambia giorniAcquistati lo aggiorniamo, altrimenti manteniamo l'esistente
  const nuoviGiorniResiduo = data.giorniAcquistati !== undefined
    ? data.giorniAcquistati
    : existing.giorniResiduo

  // Ricalcola gli stati con TUTTI i valori aggiornati (incluso giorniResiduo per i MENSILI)
  changes.stati = computePackageStates({
    oreAcquistate:  (changes.oreAcquistate as string | undefined) ?? existing.oreAcquistate,
    oreResiduo:     existing.oreResiduo,
    importoResiduo: String(nuovoImportoResiduo),
    dataScadenza:   (changes.dataScadenza as Date | null | undefined) !== undefined
      ? (changes.dataScadenza as Date | null)
      : existing.dataScadenza,
    giorniResiduo:  nuoviGiorniResiduo,
  })
```

> **Nota:** `oreResiduo` NON viene toccato volutamente (le ore già consumate non cambiano per una modifica anagrafica). Se in futuro serve adeguare `oreResiduo` al variare di `oreAcquistate`, sarà un task separato.

- [ ] **Step 2: Commit**

```powershell
git add server/services/package.service.ts
git commit -m "fix(packages): recompute importoResiduo and keep giorniResiduo on update (fase B)"
```

**Collaudo manuale:**
1. Crea un pacchetto ORE €100, paga €40 (residuo €60, stato DA_PAGARE).
2. Modifica il pacchetto e cambia il prezzo a €120 → il residuo deve diventare **€80** e lo stato restare DA_PAGARE.
3. Cambia il prezzo a €40 → residuo **€0**, stato **PAGATO**.
4. Crea un pacchetto MENSILE con 0 giorni residui (o portalo a 0) → deve risultare ESAURITO; modifica una nota del pacchetto e salva → deve **restare ESAURITO** (prima tornava ATTIVO).

---

## Task 4 — Fase C: Contabilità solo ADMIN

**Problema:** la pagina contabilità è aperta a SUPER_TUTOR, contro la regola ADL-009.

**File:**
- Modify: `app/pages/contabilita/index.vue` (riga ~317)

- [ ] **Step 1: Cambiare il middleware**

```typescript
definePageMeta({ middleware: ['admin-only'] })
```

(L'API contabile è già ristretta ad ADMIN dal Task 1.)

- [ ] **Step 2: Commit**

```powershell
git add app/pages/contabilita/index.vue
git commit -m "fix(rbac): contabilita admin-only, exclude SUPER_TUTOR (fase C)"
```

**Collaudo manuale:**
1. Login come SUPER_TUTOR → prova ad aprire `/contabilita` → vieni reindirizzato (non vedi i conti).
2. Login come ADMIN → `/contabilita` carica normalmente.

---

## Task 5 — Fase D: Coerenza prenotazioni + migrazioni + DECISION_LOG

**Problema:** `listBookingsForAdmin` usa un workaround obsoleto via `portalUserId`; il DECISION_LOG dice (erroneamente) che la migrazione 0002 non è applicata.

**File:**
- Modify: `server/services/booking.service.ts` (`listBookingsForAdmin`)
- Modify: `DECISION_LOG.md`

- [ ] **Step 1: Verificare lo stato reale del DB (manuale, PowerShell)**

```powershell
npx drizzle-kit migrate
```

Se risponde che è tutto già applicato (o applica solo la 0004 del Task 6), la colonna `bookings.student_id` esiste. In caso di errore SSL/connessione, usare la stringa **Direct Connection** (porta 5432) in `.env`.

- [ ] **Step 2: Semplificare `listBookingsForAdmin`**

Sostituire l'intera funzione con la versione diretta:

```typescript
// Lista prenotazioni per l'admin, filtrabili per studente (usa bookings.studentId)
export async function listBookingsForAdmin(studentId?: string) {
  return await db.query.bookings.findMany({
    where: studentId ? eq(bookings.studentId, studentId) : undefined,
    orderBy: [desc(bookings.createdAt)],
    with: {
      subjects: { columns: { name: true } },
      user:     { columns: { firstName: true, lastName: true, email: true } },
      student:  { columns: { firstName: true, lastName: true } },
    },
  })
}
```

- [ ] **Step 3: Aggiornare il DECISION_LOG**

In `DECISION_LOG.md`, nella sezione ADL-014 "Pending tecnico", correggere la nota sulla migrazione 0002: indicare che è **applicata** (dimostrato dall'uso di `lessons.mezza_lezione` e `bookings.student_id`). Aggiungere un nuovo blocco **ADL-015** che riassume questo audit e le correzioni (sicurezza API, fix tutor/pacchetti, RBAC contabilità, coerenza booking).

- [ ] **Step 4: Commit**

```powershell
git add server/services/booking.service.ts DECISION_LOG.md
git commit -m "fix(bookings): use studentId directly + align DECISION_LOG (fase D)"
```

**Collaudo manuale:**
1. Login GENITORE con prenotazione attiva → invia una prenotazione.
2. Login ADMIN → scheda dello studente → la prenotazione PENDING appare con Conferma/Cancella.
3. Conferma → lo stato cambia, nessun errore 500.

---

## Task 6 — Fase E: Figli collegati sempre aggiornati

**Problema:** `linkedStudentIds` è calcolato solo al login → un figlio collegato dopo non si vede finché il genitore non riesce.

**File:**
- Create: `server/utils/portal.ts`
- Modify: `server/api/portal/students.get.ts`, `notes.get.ts`, `bookings.post.ts`

- [ ] **Step 1: Creare `server/utils/portal.ts`**

```typescript
import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { students } from '../database/schema'

// Recupera SEMPRE dal DB gli ID degli studenti collegati a un genitore.
// Evita la staleness della sessione (figli collegati dopo il login).
export async function getLinkedStudentIds(userId: string): Promise<string[]> {
  const rows = await db.query.students.findMany({
    where: eq(students.portalUserId, userId),
    columns: { id: true },
  })
  return rows.map((r) => r.id)
}
```

- [ ] **Step 2: Usarlo in `students.get.ts`**

```typescript
import { getPortalStudents } from '../../services/portal.service'
import { getLinkedStudentIds } from '../../utils/portal'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'GENITORE') return []
  const ids = await getLinkedStudentIds(user.id)
  return await getPortalStudents(ids)
})
```

- [ ] **Step 3: Usarlo in `notes.get.ts`** (stessa sostituzione: `getLinkedStudentIds(user.id)` al posto di `user.linkedStudentIds ?? []`)

- [ ] **Step 4: Usarlo in `bookings.post.ts`** (per il controllo `linkedIds.includes(studentId)`)

- [ ] **Step 5: Commit**

```powershell
git add server/utils/portal.ts server/api/portal/students.get.ts server/api/portal/notes.get.ts server/api/portal/bookings.post.ts
git commit -m "fix(portal): resolve linked students from DB, not stale session (fase E)"
```

**Collaudo manuale:**
1. Login GENITORE con 1 figlio.
2. Da un'altra sessione ADMIN, collega un secondo figlio allo stesso genitore.
3. Senza fare logout, il genitore ricarica `/portale` → deve vedere **entrambi** i figli.

---

## Task 7 — Fase F: Ottimizzazioni database (indici)

**Problema:** filtro pacchetti per stato e ricerche testuali non usano indici efficienti.

**File:**
- Modify: `server/database/schema.ts` (indice GIN su `packages.stati`)
- Create: migrazione `0004_*` (generata) + SQL pg_trgm manuale

- [ ] **Step 1: Aggiungere indice GIN su `packages.stati` nello schema**

Nella definizione di `packages`, nel blocco indici `(t) => ({ ... })`, aggiungere:

```typescript
  statiGinIdx: index('pkg_stati_gin_idx').using('gin', t.stati),
```

- [ ] **Step 2: Generare la migrazione**

```powershell
npx drizzle-kit generate
```

- [ ] **Step 3: Aggiungere (manualmente, nel file SQL generato) gli indici trigram per le ricerche**

In coda al file `0004_*.sql` generato, aggiungere:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS students_name_trgm_idx ON students USING gin ((lower(first_name || ' ' || last_name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_name_trgm_idx ON users USING gin ((lower(first_name || ' ' || last_name)) gin_trgm_ops);
```

- [ ] **Step 4: Applicare la migrazione**

```powershell
npx drizzle-kit migrate
```

- [ ] **Step 5: Commit**

```powershell
git add server/database/schema.ts server/database/migrations/
git commit -m "perf(db): GIN index on package stati + trgm indexes for search (fase F)"
```

**Collaudo manuale:**
1. La pagina `/pacchetti` con filtro per stato continua a funzionare (risultati identici a prima).
2. La ricerca studenti/tutor per nome continua a funzionare. (La differenza di velocità è visibile solo con molti record.)

---

## Task 8 — Fase G: Pulizia

**Problema:** script `fix_ts.js`/`fix_zod.js` mascherano errori reali; file di test temporaneo; documenti con caratteri corrotti.

**File:**
- Delete: `test_zod.ts` (se temporaneo), valutare `fix_ts.js`/`fix_zod.js`

- [ ] **Step 1: Ispezionare `fix_ts.js`, `fix_zod.js`, `test_zod.ts`**

Leggere i tre file. Se sono script una-tantum di refactoring già applicati, rimuoverli. NON rimuovere se ancora referenziati da `package.json` scripts (verificare prima con una lettura di `package.json`).

- [ ] **Step 2: Rimuovere i file temporanei confermati**

```powershell
Remove-Item test_zod.ts
# Solo se confermato che non servono più:
# Remove-Item fix_ts.js, fix_zod.js
```

- [ ] **Step 3: Commit**

```powershell
git add -A
git commit -m "chore: remove one-off scripts and temp test file (fase G)"
```

**Collaudo manuale:**
1. `npm run dev` parte senza errori.
2. Le pagine principali (studenti, pacchetti, tutor, contabilità, portale) caricano correttamente.

---

## Riepilogo task

| Task | Fase | Contenuto | Stato |
|------|------|-----------|-------|
| 1 | A | Guardia globale auth API + policy ruoli | ⬜ |
| 2 | B1 | Fix crash compensi tutor + FORFAIT + € | ⬜ |
| 3 | B2 | Fix conti updatePackage (importoResiduo/giorni) | ⬜ |
| 4 | C | Contabilità admin-only | ⬜ |
| 5 | D | Coerenza booking + migrazioni + DECISION_LOG | ⬜ |
| 6 | E | Figli collegati da DB (no staleness sessione) | ⬜ |
| 7 | F | Indici GIN + trigram | ⬜ |
| 8 | G | Pulizia script/temp | ⬜ |

---

## Note per l'implementatore

- **`requireUserSession`, `createError`, `defineEventHandler`, `getQuery`, `readBody`** sono auto-importati (Nitro/nuxt-auth-utils) — nessun import esplicito.
- **Server middleware Nitro** (`server/middleware/`) gira ad OGNI richiesta, incluse le pagine: per questo la guardia filtra `if (!path.startsWith('/api/')) return`.
- **`event.path`** include la query string; usare `startsWith` sui prefissi è sicuro.
- **NIENTE test automatici** — solo le checklist manuali di ogni task.
- **Ordine di esecuzione:** rispettare A→G. Il Task 1 (sicurezza) per primo.
- Dopo ogni task: il sub-agent fa commit, poi revisione spec + revisione qualità prima del task successivo.
