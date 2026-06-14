# Registro Decisioni Architetturali (ADL)

Questo log documenta tutte le decisioni tecnologiche chiave adottate durante la ricostruzione di **tiformiamonoi_gestionale**.

> **Regola:** Nessuna decisione tecnica entra in produzione senza essere documentata qui prima.

---

## Stato Attuale del Progetto — 13 Giugno 2026

| Fase | Stato |
|------|-------|
| Reverse engineering `.old/` | ✅ Completato |
| `DOCUMENTAZIONE_PROGETTO.md` (Bibbia) | ✅ Creata e approvata |
| `DECISION_LOG.md` | ✅ Aggiornato |
| Stack tecnologico scelto | ✅ Definitivo (vedi ADL-003, ADL-004) |
| Schema database (`server/database/schema.ts`) | ✅ Scritto con Drizzle |
| Schemi validazione Zod (`shared/schemas/`) | ✅ Scritti — Student, Package, Lesson, Payment, Tutor, Portal, Booking, Contact |
| Services: `student.service.ts`, `package.service.ts` | ✅ Scritti — vedi ADL-007 |
| API Routes: Studenti (5) + Pacchetti (4) | ✅ Scritte — vedi ADL-007 |
| Services: `lesson.service.ts`, `payment.service.ts`, `accounting.service.ts` | ✅ Scritti — vedi ADL-008 |
| API Routes: Lezioni (3) + Pagamenti (2) + Contabilità (1) | ✅ Scritte — vedi ADL-008 |
| Design Document: Evoluzione Piattaforma | ✅ Approvato — vedi ADL-009 |
| **Fase 7** — Nuxt 4 + Layout Admin + Portale Famiglie + Design System | ✅ Completata — vedi ADL-010 |
| **Fase 8** — Auth & RBAC + migrazioni DB evoluzione | ✅ Completata — schema + migrazione Supabase + middleware + auth API + login |
| **Fase 9** — Pagine Vue gestionale interno | ✅ Sprint 1 (Tutor) completato — vedi ADL-012 |
| **Fase 10** — Note Didattiche (service + API + UI) | ✅ Completata — vedi ADL-013 |
| **Fase 11** — Portale Famiglie | ✅ Completata — vedi ADL-014 |
| **Fase 12** — Funzionalità Aggiuntive (Bollettino, Briefing, Calendario, FORFAIT) | ⏳ Dopo Fase 11 |

---

## [ADL-001] Protocollo di Sessione e Vincoli di Esecuzione

### Stato
**Approvato**

### Contesto
All'avvio di ogni sessione è necessario stabilire protocolli di esecuzione che rispettino le linee guida del progetto e i vincoli del CLAUDE.md.

### Decisione
1. **Lettura skills limitata**: Ispezionare solo nomi e struttura di `.agent/skills/`. Lettura completa di `SKILL.md` solo se esplicitamente richiesta da un task.
2. **Isolamento legacy**: La cartella `.old/` contiene il codice originale. Esplorarla solo con query mirate (`grep` o lettura di file specifici), mai in modo ricorsivo.
3. **Processo spec-first**: Tutte le modifiche architetturali devono essere documentate qui prima di essere eseguite.
4. **Handoff Protocol**: Ogni interazione termina con un blocco "Handoff State" per garantire continuità tra sessioni.

### Conseguenze
- Consumo di memoria ridotto e avvio più rapido.
- Sicurezza architetturale tramite decisioni documentate.
- Alta tracciabilità dei flussi di reverse engineering.

---

## [ADL-002] Analisi Legacy e Reverse Engineering

### Stato
**Approvato** — completato nella sessione del 12 Giugno 2026

### Contesto
Fase 1 completata: analisi di `.old/` per mappare i flussi logici, identificare il debito tecnico e scoprire difetti critici. Trovate le seguenti entità core:

- **18 tabelle**: users, tutor_profiles, students, student_referrals, standard_packages, packages, payments, time_slots, lessons, lesson_students, accounting_entries, system_configs, tutor_payments, tutor_reimbursements, bookings, booking_subjects, tutor_availabilities, closure_dates
- **Bug critico trovato**: race condition sullo scalamento ore dei pacchetti (due richieste simultanee possono leggere lo stesso valore prima che una scriva → ore scalate male)
- **Macchina a stati**: logica a 7 stati per i pacchetti ore (ATTIVO, DA_RINNOVARE, SCADUTO, ESAURITO, DA_PAGARE, PAGATO, CHIUSO)
- **Tariffe tutor**: SINGOLA €5/h, GRUPPO €8/h, MAXI €8.50/h

### Decisione
1. **Integrità dati**: La gestione stati dei pacchetti passa da calcolo runtime a macchina a stati documentata con regole cristallizzate in `DOCUMENTAZIONE_PROGETTO.md` §4.
2. **Separazione layer**: Architettura a 3 livelli (`API Routes → Services → Database`) per disaccoppiare logica di business e routing.
3. **Validazione centralizzata**: Tutti gli input API validati con Zod prima di raggiungere i service.
4. **Fix race condition**: Ogni operazione che modifica `oreResiduo` deve usare una transazione atomica del database (risolto nella nuova architettura Drizzle).

### Conseguenze
- Eliminazione del bug di concorrenza sullo scalamento ore.
- Consistenza garantita degli stati pacchetto a livello di database.
- Eliminazione degli errori silenziosi da input non validati.

---

## [ADL-003] Stack Tecnologico — Decisione Definitiva

### Stato
**Approvato e Finalizzato** — 12 Giugno 2026

### Contesto
Valutati due scenari architetturali: Scenario A (Nuxt monolite full-stack) vs Scenario B (Vue 3 + backend Go/Python separato).

### Decisione
Adottare ufficialmente **Scenario A — Nuxt 4 Full-Stack TypeScript**.

| Componente | Scelta | Motivazione |
|-----------|--------|-------------|
| **Framework** | Nuxt 4 | API server + frontend in un unico progetto |
| **Linguaggio** | TypeScript ovunque | Tipi condivisi tra frontend e backend |
| **Validazione** | Zod (condiviso) | Un solo schema usato sia dal browser che dal server |
| **Database** | PostgreSQL (Supabase) | Serverless-first, scalabile, relazionale |
| **ORM** | Drizzle | Edge-compatible, zero cold start, SQL trasparente |
| **UI Components** | Nuxt UI **v4** (Tailwind CSS v4) | Integrazione nativa Nuxt 4, accessibilità WCAG inclusa |
| **Icone** | Heroicons via @iconify | Già usate nel frontend legacy |

---

## [ADL-004] ORM: Drizzle (NON Prisma)

### Stato
**Approvato** — 12 Giugno 2026

### Decisione
**Drizzle ORM** per tutta la data access layer.

**Motivazioni:**
- **Zero cold start** — TypeScript puro, nessun binario. Avvio < 10ms.
- **Edge-first** — Compatibile nativamente con Cloudflare Workers, Vercel Edge.
- **SQL leggibile** — Le query generano SQL esatto e ottimizzabile.
- **Type-safe** — Lo schema è TypeScript puro verificato a compile-time.
- **Bundle size** — Drizzle ~30KB vs Prisma Client ~300KB.

---

## [ADL-005] Validazione: Schemi Zod Condivisi

### Stato
**Approvato e Implementato** — 12 Giugno 2026

### Decisione
Tutti i dati in ingresso (form → API → database) passano attraverso schemi Zod definiti in `shared/schemas/` e condivisi tra browser e server.

### File implementati
| File | Cosa valida |
|------|-------------|
| `shared/schemas/student.schema.ts` | Anagrafica studente, dati genitore, CF/CAP italiani |
| `shared/schemas/package.schema.ts` | Pacchetti ORE/MENSILE/A_CONSUMO, pagamenti, regole incrociate |
| `shared/schemas/lesson.schema.ts` | Lezioni, studenti (con dedup), slot, calendario |
| `shared/schemas/tutor.schema.ts` | Tutor, compensi, rimborsi |
| `shared/schemas/booking.schema.ts` | Prenotazioni portale, aggiornamento stato |
| `shared/schemas/portal-user.schema.ts` | Creazione account GENITORE, reset password, flag prenotazione |
| `shared/schemas/contact.schema.ts` | Form pubblico contatto (client-only, nessun backend) |

---

## [ADL-006] Documentazione: DOCUMENTAZIONE_PROGETTO.md come "Bibbia"

### Stato
**Approvato** — 12 Giugno 2026

### Decisione
Il file `DOCUMENTAZIONE_PROGETTO.md` è la fonte di verità primaria del progetto. Contiene architettura completa, macchina a stati pacchetti, design system, manuale di collaudo visuale.

---

## [ADL-007] Fase 5 — Services e API Routes: Studenti e Pacchetti

### Stato
**Implementato** — 12 Giugno 2026

### Decisione
Architettura a 3 livelli implementata per le entità Studente e Pacchetto.

**Services (`server/services/`)**
| File | Funzioni esportate |
|------|--------------------|
| `student.service.ts` | `listStudents`, `getStudentById`, `createStudent`, `updateStudent`, `deactivateStudent` |
| `package.service.ts` | `listPackages`, `getPackageById`, `createPackage`, `updatePackage`, `computePackageStates`, `recomputeAndSavePackageStates` |

**API Routes**
| Route | Verbo | Funzione |
|-------|-------|----------|
| `/api/students` | GET | Lista paginata con filtri |
| `/api/students` | POST | Crea studente — validazione Zod → 201 Created |
| `/api/students/:id` | GET | Singolo studente — 404 se non trovato |
| `/api/students/:id` | PUT | Aggiornamento parziale |
| `/api/students/:id` | DELETE | Soft-delete (active=false) |
| `/api/packages` | GET | Lista con filtri |
| `/api/packages` | POST | Crea pacchetto + eventuale pagamento iniziale |
| `/api/packages/:id` | GET | Singolo pacchetto |
| `/api/packages/:id` | PUT | Aggiornamento + ricalcolo stati |

---

## [ADL-008] Fase 6 — Services e API Routes: Lezioni, Pagamenti, Contabilità

### Stato
**Implementato** — 12 Giugno 2026

### Garanzie architetturali implementate
1. **Race condition ore**: `SET ore_residuo = ore_residuo - X` — mai read-modify-write in memoria
2. **MENSILE**: giorno scalato solo alla prima lezione dello studente per quella data
3. **Penna Indelebile**: `reverseTransaction` crea uno STORNO (importo negativo) — nessun DELETE su accounting_entries
4. **Separazione Cassa/Banca**: `getCashFlow()` aggrega per metodoPagamento con SUM separato

---

## [ADL-009] Design Document — Evoluzione Piattaforma

### Stato
**Approvato** — 12 Giugno 2026

### Decisioni chiave

**Autenticazione:** `nuxt-auth-utils` con sessioni server cifrate in cookie HttpOnly.

**4 Ruoli operativi:**
| Ruolo | Accesso |
|-------|---------|
| `ADMIN` | Tutto — inclusa contabilità, cancellazione note, gestione utenti |
| `SUPER_TUTOR` | Operativo completo — NO contabilità |
| `TUTOR` | Solo proprie ore, disponibilità, note propri alunni |
| `GENITORE` | Solo portale famiglie |

**5 Middleware Nuxt 4:** `auth`, `staff-only`, `admin-or-super`, `admin-only`, `portal-only`.

**Evoluzione database:**
| Modifica | Tabella | Dettaglio |
|----------|---------|-----------|
| Aggiunta valore enum | `users.role` | `SUPER_TUTOR` |
| Nuova colonna FK nullable | `students.portalUserId` | Uno-a-molti: un GENITORE → più studenti (fratelli) |
| Nuova colonna booleana | `students.abilitatoPrenotazioneOnline` | Flag admin |
| Nuova colonna obbligatoria | `bookings.userId` | Solo prenotazioni autenticate |
| Nuova tabella | `student_notes` | Note INTERNA/FAMIGLIA con autore |

---

## [ADL-010] Fase 7 — Nuxt 4 + Layout Admin + Design System

### Stato
**Completato** — 13 Giugno 2026

### Decisioni chiave

**1. Nuxt UI v4 (non v3)**
Al momento dell'installazione è stata installata la versione v4, con configurazione diversa da v3:

| Aspetto | Nuxt UI v4 |
|---------|-----------|
| Colori in `app.config.ts` | `ui.colors.primary: 'tfn'` |
| Gray in `app.config.ts` | `ui.colors.neutral: 'slate'` |
| Wrapper obbligatorio | `<UApp>` richiesto in `app.vue` |

**2. CSS obbligatorio:** `@import 'tailwindcss'` e `@import '@nuxt/ui'` in `app/assets/css/main.css`.

**3. DB lazy init via Proxy:** `server/database/client.ts` usa Proxy JavaScript per connettere al DB solo alla prima query.

**4. SSR-safe sidebar:** `useCookie('sidebar-collapsed')` invece di `localStorage`.

---

## [ADL-011] Modulo Pacchetti a Consumo

### Stato
**Completato** — 13 Giugno 2026

### Decisioni chiave

**1. Architettura Data Model:** nuova tabella `package_recharges` per il libretto ricariche. La tabella `packages` accumula ore e costi nei totali storici.

**2. Transazioni Atomiche:** creazione pacchetto e ricarica (`rechargePackage`) usano singola transazione Drizzle che: aggiunge ore, inserisce record nel libretto, registra in payments, aggiorna accounting_entries, ricalcola stati.

**3. Correzione Zod v4:** migrazione massiva da `required_error` a `message` in tutti gli schemi.

**4. Macchina a Stati - ESAURITO per Giorni:** pacchetto MENSILE → ESAURITO anche se i giorni residui arrivano a zero (non solo le ore).

---

## [ADL-012] Fase 9 Sprint 1 — Modulo Tutor

### Stato
**Completato** — 13 Giugno 2026

### Decisioni chiave

**1. Architettura a batch query (no N+1):** `listTutors` esegue 4 query in parallelo via `Promise.all`.

**2. CTE SQL per arretrati in PostgreSQL:** alias CTE in snake_case senza virgolette.

**3. Campi monetari come `z.string()` (deliberata):** i service usano `parseFloat()` internamente.

**4. PRO_BONO:** nessuna registrazione contabile per pagamenti pro bono.

**5. Rimborsi parziali con accumulo:** `DA_PAGARE` → `PARZIALE` → `PAGATO`.

**6. `USwitch` invece di `UToggle` in Nuxt UI v4.**

---

## [ADL-013] Fase 10 — Note Didattiche

### Stato
**Completato** — 13 Giugno 2026

### Decisioni chiave

Note con visibilità INTERNA/FAMIGLIA. ADMIN e SUPER_TUTOR possono cancellare tutte le note. TUTOR solo le proprie. Componente `StudentNoteFeed` estratto come componente separato per riuso sia nel gestionale che nel portale.

---

## [ADL-014] Fase 11 — Portale Famiglie

### Stato
**Completato** — 13 Giugno 2026

### Contesto
Costruzione del Portale Famiglie: area riservata ai GENITORE per visualizzare note didattiche, richiedere prenotazioni e gestire il proprio account. Più pannello admin nella scheda studente e form pubblico `/prenota` per nuove famiglie.

### File implementati

| File | Descrizione |
|------|-------------|
| `shared/schemas/booking.schema.ts` | CreateBookingSchema, UpdateBookingStatusSchema |
| `shared/schemas/portal-user.schema.ts` | CreatePortalAccessSchema, ResetPortalPasswordSchema, UpdatePortalFlagSchema |
| `shared/schemas/contact.schema.ts` | PublicContactSchema (client-only, nessun backend) |
| `server/services/portal.service.ts` | getPortalStudents, getPortalNotes, checkPrenotazioneAbilitata |
| `server/services/booking.service.ts` | createBooking, listBookingsForPortal, listBookingsForAdmin, updateBookingStatus |
| `server/services/portal-user.service.ts` | createPortalAccount (con logica force), getPortalAccess, resetPortalPassword, updatePrenotazioneFlag |
| `server/api/portal/students.get.ts` | GET studenti collegati al GENITORE |
| `server/api/portal/notes.get.ts` | GET note FAMIGLIA |
| `server/api/portal/bookings.get.ts` | GET prenotazioni del GENITORE |
| `server/api/portal/bookings.post.ts` | POST nuova prenotazione |
| `server/api/portal/profile.put.ts` | PUT aggiorna profilo + cambio password |
| `server/api/admin/students/[id]/portal-access.get.ts` | GET stato account portale (admin) |
| `server/api/admin/students/[id]/portal-access.post.ts` | POST crea/collega account GENITORE |
| `server/api/admin/students/[id]/portal-access.put.ts` | PUT reset password / toggle prenotazione |
| `server/api/admin/bookings/index.get.ts` | GET lista prenotazioni admin |
| `server/api/admin/bookings/[id]/status.put.ts` | PUT conferma/cancella prenotazione |
| `app/pages/portale/index.vue` | Dashboard GENITORE con benvenuto |
| `app/pages/portale/note.vue` | Feed note FAMIGLIA |
| `app/pages/portale/prenota.vue` | Wizard 3-step prenotazione lezione |
| `app/pages/portale/profilo.vue` | Account + figli collegati + cambio password + logout |
| `app/layouts/portal.vue` | Voce Prenota condizionale (solo se abilitato) |
| `app/pages/studenti/[id].vue` | Pannello "Accesso Portale" + prenotazioni PENDING |
| `app/pages/prenota.vue` | Form pubblico richiesta contatto (client-only, nessun backend) |

### Decisioni architetturali prese in implementazione (deviazioni dal piano originale)

**1. Genitore con più figli — flow in due step con conferma**

Il piano originale prevedeva un errore 409 se l'email era già in uso. L'implementazione reale usa un flow in due step:
- Prima chiamata senza `force`: se l'email esiste come GENITORE, il backend restituisce `{ requiresConfirmation: true, existingUser: {...} }` (non un errore HTTP)
- Il frontend mostra un banner arancione di conferma con nome e email del genitore già registrato
- Seconda chiamata con `force: true`: collega lo studente all'account esistente **senza modificare la password**

**Motivazione:** Un genitore con due figli nello stesso centro deve poter usare le stesse credenziali senza che il secondo collegamento resetti la password del primo figlio.

**2. `bookings.userId` invece di `bookings.studentId` per filtrare prenotazioni admin**

La migrazione `0002_mushy_raider.sql` (che aggiunge `student_id` a `bookings`) non è ancora stata applicata a Supabase perché richiede la porta Direct Connection (5432). Per evitare errori 500, `listBookingsForAdmin` risolve `student.portalUserId` e filtra per `bookings.userId` — funziona con le colonne già esistenti.

**3. `portal-only` middleware espanso per ADMIN/SUPER_TUTOR**

Il piano prevedeva il middleware solo per GENITORE. Implementazione: ADMIN e SUPER_TUTOR possono accedere a `/portale` in modalità "preview" per testare l'esperienza genitore. Le API portal restituiscono `[]` (lista vuota) invece di 403 per questi ruoli, evitando crash SSR.

**4. Campi opzionali in `UpdateStudentSchema` con `.refine()` Zod v4**

I campi email, telefono, CAP, CF dello studente e genitore erano marcati obbligatori nel vecchio schema. Con Zod v4, il pattern per campi opzionali che accettano stringa vuota è:
```typescript
z.string().refine(v => !v || /regex/.test(v), 'messaggio').optional().nullable()
```

**5. `|| null` invece di `|| undefined` nei body PUT studente**

`undefined` è omesso dalla serializzazione JSON — il campo non arriva al server. `null` invece è incluso — Drizzle imposta il campo a NULL nel DB. Questo era il motivo per cui le modifiche ai campi facoltativi non venivano salvate.

**6. Auto-prefill modal creazione accesso portale**

Il modal si apre con email, nome e cognome pre-compilati da `studente.parentEmail` e `studente.parentName`. L'admin non deve riscrivere dati già presenti nella scheda studente.

**7. Shortcut portale nella sidebar gestionale**

Aggiunte icone in fondo alla sidebar `default.vue` per accedere rapidamente a `/portale` e `/prenota`. Visibili solo ad ADMIN e SUPER_TUTOR.

### Pending tecnico

- **Migrazione `0002_mushy_raider.sql`**: ✅ APPLICATA. La nota precedente (che la indicava come non applicata) era errata. La migrazione è in produzione, come dimostrato dall'uso effettivo di `lessons.mezza_lezione` e `bookings.student_id` (entrambe introdotte dalla 0002) in tutto il codice. Nessun pending su questa migrazione.

### Conseguenze
- Il gestionale è ora una piattaforma multi-ruolo con accesso esterno per le famiglie.
- Il caso fratelli (stesso genitore, più figli) è gestito nativamente con flow di conferma.
- Il flag `abilitatoPrenotazioneOnline` dà controllo totale all'admin senza logiche hardcodate.
- Il form pubblico `/prenota` è client-only: nessun dato viene inviato al backend (riduce spam e carico).

---

## [2026-06-13] Logica "Mezza Lezione"

**Decisione:**
La spunta "Mezza Lezione" è applicata globalmente all'intera lezione (non al singolo studente).

**Regole di Business (CRITICHE):**
1. **Studenti:** scalano **SEMPRE** 1.0 ora dal proprio pacchetto (mai 0.5).
2. **Tutor:** pagato per **0.5 ore** se la lezione è "Mezza Lezione".

---

## [2026-06-13] Fix Compatibilità Nuxt UI v4 e Zod CUID2

**Decisioni:**
1. **Nuxt UI v4 Object Binding:** In Nuxt UI v4, `USelectMenu` con array di oggetti non usa `value-attribute`. Il componente associa l'intero oggetto al `v-model`. La primitiva viene estratta con `item?.value` prima di inviare all'API.
2. **CUID2 vs CUID1 in Zod:** Migrazione massiva da `.cuid()` a `.cuid2()` in tutti i file `shared/schemas/*.ts`.
3. **Drizzle Relational Queries:** `listLessons` migrato a `db.query.lessons.findMany({ with: { lessonStudents: true, ... } })` per evitare "0 studenti" nel calendario.

---

## [2026-06-13] Completamento Ricariche "A Consumo" ed UX Pacchetti

**Decisioni:**
1. **Pagamento Parziale Ricarica:** `RechargePackageSchema` accetta oggetto nidificato `pagamentoIniziale`.
2. **Estrazione Componenti UI:** `ModalRicaricaPacchetto.vue`, `ModalLibrettoRicariche.vue`, `ModalPagamentoPacchetto.vue` come componenti globali.
3. **Fix Dropdown Nuxt UI v4:** evento corretto per `UDropdownMenu` items è `onSelect` (non `click`).
4. **Badge "DA_PAGARE":** colore neutro (grigio) se il pacchetto ha ancora > 90% del tempo disponibile.

---

## [2026-06-14] Ottimizzazione Performance Navigazione e Bugfix Zod

**Decisioni:**
1. **Navigazione Istantanea SSR (Nuxt 4 / Vue 3 Suspense):** Tutte le chiamate API all'interno di <script setup> nelle pagine (pp/pages/**/*.vue) sono state migrate da wait useFetch a useLazyFetch (senza wait). L'uso di wait bloccava la transizione della rotta lato client finch� il server non rispondeva, causando la percezione di un'app "lentissima". Ora la navigazione � immediata e le pagine gestiscono lo stato pending con gli Skeleton di Nuxt UI.
2. **Validazione Zod Campi Vuoti:** Negli schemi condivisi (es. StudentSchema), i campi opzionali che prevedono un formato specifico (Regex per CF, CAP, Telefono, Email) usano il pattern z.union([z.string().regex(...), z.literal(''), z.null(), z.undefined()]) invece di .refine(v => !v || regex). Questo garantisce compatibilit� nativa al 100% con i form di Nuxt UI quando il campo viene toccato e poi svuotato.
3. **Calcolo Data Inizio Pacchetto:** Quando si seleziona uno studente in "Nuovo Pacchetto", il sistema cerca in background i suoi pacchetti storici e imposta la data di inizio del nuovo pacchetto al **giorno successivo alla scadenza dell'ultimo pacchetto attivo**, garantendo continuit� senza accavallamenti.
4. **Eliminazione Matching Manuale:** Aggiunto endpoint DELETE /api/admin/bookings/:id per permettere l'eliminazione dei badge inseriti manualmente nel tabellone di matching giornaliero.

---

## [ADL-015] Audit & Remediation — 14 Giugno 2026

### Stato
**In corso** — branch `fix/audit-remediation`

### Contesto
Audit completo della webapp. Trovati e corretti diversi problemi (bug, discrepanze, RBAC, sicurezza).

### Correzioni applicate
1. **Sicurezza API (CRITICO):** 46/68 route `/api/**` erano prive di autenticazione. Aggiunta guardia globale `server/middleware/01.auth-guard.ts` + policy ruoli in `server/utils/auth-policy.ts`. Ogni route API ora richiede login + ruolo ammesso; gli endpoint interni `/api/_*` (icone, sessione) restano pubblici.
2. **Crash compensi tutor (ALTO):** `getMonthlyCompensation` referenziava una tabella `tutors` inesistente → corretto su `tutorProfiles`. Ripristinata anche la logica FORFAIT.
3. **Conti pacchetti (ALTO):** `updatePackage` ora ricalcola `importoResiduo` quando cambia il prezzo e mantiene `giorniResiduo` nel calcolo stati (MENSILI).
4. **RBAC contabilità (ALTO):** pagina `/contabilita` portata a middleware `admin-only` (SUPER_TUTOR escluso, come da ADL-009); API contabili ristrette ad ADMIN dalla guardia globale.
5. **Coerenza prenotazioni (MEDIO):** `listBookingsForAdmin` usa direttamente `bookings.studentId` (rimosso workaround obsoleto via `portalUserId`).
6. **Sessione genitore (MEDIO):** gli ID dei figli collegati vengono risolti dal DB ad ogni richiesta (no più staleness della sessione).
7. **Performance DB (BASSO):** indici GIN su `packages.stati` e trigram per le ricerche per nome.
8. **Pulizia (BASSO):** rimozione script/file temporanei, encoding €.

### Nota migrazioni
La migrazione `0002_mushy_raider.sql` È applicata. La precedente nota in ADL-014 era errata.
