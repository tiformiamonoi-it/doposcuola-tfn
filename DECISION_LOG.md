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
| Schemi validazione Zod (`shared/schemas/`) | ✅ Scritti per Student, Package, Lesson, Payment |
| Services: `student.service.ts`, `package.service.ts` | ✅ Scritti — vedi ADL-007 |
| API Routes: Studenti (5) + Pacchetti (4) | ✅ Scritte — vedi ADL-007 |
| Services: `lesson.service.ts`, `payment.service.ts`, `accounting.service.ts` | ✅ Scritti — vedi ADL-008 |
| API Routes: Lezioni (3) + Pagamenti (2) + Contabilità (1) | ✅ Scritte — vedi ADL-008 |
| Design Document: Evoluzione Piattaforma | ✅ Approvato — vedi ADL-009 |
| **Fase 7** — Nuxt 4 + Layout Admin + Portale Famiglie + Design System | ✅ Completata — vedi ADL-010 |
| **Fase 8** — Auth & RBAC + migrazioni DB evoluzione | ✅ Completata — schema + migrazione Supabase applicata + middleware + auth API + pagina login |
| **Fase 9** — Pagine Vue gestionale interno | ✅ Sprint 1 (Tutor) completato — vedi ADL-012 |
| **Fase 10** — Note Didattiche (service + API + UI) | ⏳ Dopo Fase 9 |
| **Fase 11** — Portale Famiglie (login, dashboard, prenota, feedback) | ⏳ Dopo Fase 9+10 |
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
*(aggiornato: Nuxt 3 → Nuxt 4; ORM risolto definitivamente in ADL-004)*

### Contesto
Valutati due scenari architetturali: Scenario A (Nuxt monolite full-stack) vs Scenario B (Vue 3 + backend Go/Python separato). I requisiti di sistema (principalmente operazioni CRUD, contabilità, prenotazioni) e la necessità di massima produttività di sviluppo hanno guidato la decisione.

### Decisione
Adottare ufficialmente **Scenario A — Nuxt 4 Full-Stack TypeScript**.

| Componente | Scelta | Motivazione |
|-----------|--------|-------------|
| **Framework** | Nuxt 4 (non Nuxt 3) | API server + frontend in un unico progetto; Nitro per il runtime server |
| **Linguaggio** | TypeScript ovunque | Tipi condivisi tra frontend e backend eliminano errori di integrazione |
| **Validazione** | Zod (condiviso) | Un solo schema usato sia dal browser che dal server (vedi ADL-005) |
| **Database** | PostgreSQL (Supabase o Vercel Postgres) | Serverless-first, scalabile, relazionale |
| **ORM** | Drizzle (**definitivo** — vedi ADL-004) | Edge-compatible, zero cold start, SQL trasparente |
| **UI Components** | Nuxt UI **v4** (Tailwind CSS v4) | Integrazione nativa Nuxt 4, accessibilità WCAG inclusa — vedi ADL-010 per dettagli configurazione |
| **Icone** | Heroicons via @iconify | Già usate nel frontend legacy, familiari al team |

### Conseguenze
- Velocità di sviluppo massimizzata: un solo linguaggio, tipi condivisi.
- Eliminazione della frammentazione (backend Express separato dal frontend Vue).
- Scalabilità sufficiente per i carichi CRUD senza la complessità di un backend Go/Python.

---

## [ADL-004] ORM: Drizzle (NON Prisma)

### Stato
**Approvato** — 12 Giugno 2026

### Contesto
ADL-003 lasciava aperta la scelta tra Drizzle e Prisma. Questa voce la chiude definitivamente.

### Problema con Prisma

Prisma usa un "query engine" compilato in Rust (binario nativo). Su ambienti serverless (Vercel, Netlify Edge Functions):
1. Deve essere inizializzato a ogni cold start → **ritardo 2–5 secondi** sulla prima richiesta dopo inattività
2. Peso del bundle > 8 MB → incompatibile con i limiti Vercel Edge Functions
3. Richiede configurazione target distinta per Node.js / Edge / Bun

### Decisione
**Drizzle ORM** per tutta la data access layer.

**Motivazioni:**
- **Zero cold start** — Drizzle è TypeScript puro, nessun binario. Avvio < 10ms.
- **Edge-first** — Compatibile nativamente con Cloudflare Workers, Vercel Edge, Netlify Edge.
- **SQL leggibile** — Le query generano SQL esatto e ottimizzabile. Con Prisma il SQL era opaco.
- **Type-safe** — Lo schema `server/database/schema.ts` è TypeScript puro: il compilatore verifica le query a compile-time.
- **Bundle size** — Drizzle ~30KB vs Prisma Client ~300KB.

> **Metafora per non tecnici:** Prisma è un montacarichi pesante — potente ma lento ad avviarsi. Drizzle è un cameriere sui pattini a rotelle: leggerissimo, arriva al tavolo quasi istantaneamente.
>
> **In pratica:** Aprendo l'app dopo ore di inattività, con Prisma il primo clic avrebbe atteso 2–3 secondi. Con Drizzle è istantaneo.

### File implementati in questa sessione
- `server/database/schema.ts` — 18 tabelle, 10 enum, relazioni complete
- `server/database/client.ts` — connessione singleton Drizzle + postgres.js

### Comandi PowerShell
```powershell
npm install drizzle-orm postgres
npm install --save-dev drizzle-kit
```

### Conseguenze
- Eliminazione totale del cold start.
- **BREAKING rispetto al legacy:** nessun `@prisma/client`, nessuna cartella `prisma/`. Usare `server/database/schema.ts`.

---

## [ADL-005] Validazione: Schemi Zod Condivisi

### Stato
**Approvato e Implementato** — 12 Giugno 2026

### Contesto
Il sistema legacy usava `express-validator` solo sul backend, con validazione assente o duplicata sul frontend. Questo ha prodotto inconsistenze e bug silenti (es. pacchetti con `oreAcquistate = 0` salvati nel DB).

### Decisione
Tutti i dati in ingresso (form → API → database) passano attraverso schemi Zod definiti in `shared/schemas/` e condivisi tra browser e server.

**Regola architetturale:** Non esiste validazione "locale" a un solo layer. Se uno schema esiste, è condiviso.

### File implementati
| File | Cosa valida |
|------|-------------|
| `shared/schemas/student.schema.ts` | Anagrafica studente, dati genitore, CF/CAP/PIva italiani |
| `shared/schemas/package.schema.ts` | Pacchetti ORE/MENSILE, pagamenti, regole incrociate (acconto ≤ prezzo totale) |
| `shared/schemas/lesson.schema.ts` | Lezioni, studenti (con dedup), slot, calendario, check-duplicate |

**Caratteristiche dei messaggi di errore:**
- Tutti in italiano chiaro (es. "Il CAP deve essere composto da 5 cifre")
- Validazione incrociata con `.superRefine()` per regole che coinvolgono più campi
- Tipi TypeScript inferiti automaticamente dagli schemi

### Comandi PowerShell
```powershell
npm install zod
```

### Conseguenze
- Un solo punto di verità per le regole di validazione.
- Errori mostrati nel browser prima ancora di inviare la richiesta al server.
- Impossibile salvare dati malformati (ore negative, email senza @, ecc.).

---

## [ADL-006] Documentazione: DOCUMENTAZIONE_PROGETTO.md come "Bibbia"

### Stato
**Approvato** — 12 Giugno 2026 — in attesa di revisione finale

### Contesto
Per garantire continuità tra sessioni e allineamento del team, è necessario un documento unico che descriva l'architettura completa in linguaggio accessibile a utenti non tecnici.

### Decisione
Il file `DOCUMENTAZIONE_PROGETTO.md` è la fonte di verità primaria del progetto. Contiene:

1. **Il progetto in breve** — cosa fa l'app, chi la usa, le 7 schermate principali
2. **Struttura Nuxt 4** — cartelle, metafora ristorante, comandi CLI passo per passo
3. **Validazione Zod** — metafora dogana, esempi schema, comandi installazione
4. **Macchina a stati pacchetti** — le 6 regole cristallizzate, il bug di concorrenza e la soluzione, tariffe tutor
5. **Diagrammi Mermaid** — 3 flussi: creazione lezione, prenotazione pubblica, evoluzione stato pacchetto
6. **Design System** — palette colori, font, regole bottoni, badge stati
7. **Manuale di collaudo** — 10 test visivi senza codice, eseguibili dall'utente finale

### Regola
**Nessuna riga di codice applicativo viene scritta prima che questo documento sia approvato dall'utente.**

### Conseguenze
- Allineamento garantito tra aspettative utente e implementazione.
- Riferimento permanente per decisioni di design future.

---

## [ADL-007] Fase 5 — Services e API Routes: Studenti e Pacchetti

### Stato
**Implementato** — 12 Giugno 2026

### Decisione
Architettura a 3 livelli implementata per le entità Studente e Pacchetto:

**Layer 1 — Services (`server/services/`)**
| File | Funzioni esportate |
|------|--------------------|
| `student.service.ts` | `listStudents`, `getStudentById`, `createStudent`, `updateStudent`, `deactivateStudent` |
| `package.service.ts` | `listPackages`, `getPackageById`, `createPackage`, `updatePackage`, `computePackageStates`, `recomputeAndSavePackageStates` |

**Layer 2 — API Routes (`server/api/`)**
| Route | Verbo | Funzione |
|-------|-------|----------|
| `/api/students` | GET | Lista paginata con filtri (search, active, classe) |
| `/api/students` | POST | Crea studente — validazione Zod → 201 Created |
| `/api/students/:id` | GET | Singolo studente — 404 se non trovato |
| `/api/students/:id` | PUT | Aggiornamento parziale — solo campi inviati |
| `/api/students/:id` | DELETE | Soft-delete (active=false) — 409 se già disattivato |
| `/api/packages` | GET | Lista con filtri (studentId, tipo, stati) |
| `/api/packages` | POST | Crea pacchetto + eventuale pagamento iniziale (transazione) |
| `/api/packages/:id` | GET | Singolo pacchetto — 404 se non trovato |
| `/api/packages/:id` | PUT | Aggiornamento + ricalcolo stati — 409 se CHIUSO |

**Macchina a stati** (`computePackageStates`): funzione pura esportata, implementa esattamente le 6 regole del §4 della Bibbia. Chiamata automaticamente su ogni create/update.

**`recomputeAndSavePackageStates`**: funzione di utilità esportata, sarà chiamata da `lesson.service.ts` (Fase 6) dopo ogni scalamento ore.

### Conseguenze
- Ogni richiesta HTTP è validata da Zod prima di toccare il DB.
- I pacchetti CHIUSI sono bloccati in scrittura a livello API (409 Conflict).
- Il soft-delete sugli studenti preserva la storia delle lezioni e dei pagamenti.
- La transazione atomica in `createPackage` garantisce che pacchetto + pagamento + accounting siano sempre coerenti.

---

## [ADL-008] Fase 6 — Services e API Routes: Lezioni, Pagamenti, Contabilità

### Stato
**Implementato** — 12 Giugno 2026

### Decisione architetturale chiave: Opzione A (mapping senza migrazione DB)
Il campo `fatturaRichiesta` richiesto dall'utente è mappato internamente al campo DB `richiedeFattura` (payments).
Il campo `fatturaEmessa` è gestito esclusivamente nella tabella `accounting_entries` (già presente nello schema).
Nessuna migrazione SQL è necessaria. Il Service Layer funge da strato di traduzione.

### Schemi Zod
| File | Contenuto |
|------|-----------|
| `shared/schemas/payment.schema.ts` | `metodoPagamento` ristretto a CONTANTI/BONIFICO, `fatturaRichiesta`, `UpdateInvoiceStatusSchema` |

### Services (`server/services/`)
| File | Funzioni esportate |
|------|--------------------|
| `lesson.service.ts` | `createLesson`, `listLessons`, `getLessonById`, `getLessonCalendar` |
| `payment.service.ts` | `createPayment`, `toggleInvoiceStatus`, `listPayments` |
| `accounting.service.ts` | `reverseTransaction`, `getCashFlow`, `getPendingInvoices`, `getNetMargin`, `getDashboard` |

### API Routes (`server/api/`)
| Route | Verbo | Funzione |
|-------|-------|----------|
| `/api/lessons` | GET | Lista paginata con filtri (tutor, studente, data, tipo) |
| `/api/lessons` | POST | Crea lezione — transazione atomica scalamento ore + compenso |
| `/api/lessons/:id` | GET | Singola lezione con studenti e ore scalate |
| `/api/payments` | POST | Registra pagamento — transazione atomica + ricalcolo stati |
| `/api/payments/:id/invoice` | PUT | Segna fattura emessa/non emessa (aggiorna accounting_entries) |
| `/api/accounting/dashboard` | GET | Cruscotto: Cassa/Banca totale + ultimi 30gg + fatture in attesa + margine |

### Garanzie architetturali implementate
1. **Race condition ore**: `SET ore_residuo = ore_residuo - X` — mai read-modify-write in memoria
2. **MENSILE**: giorno scalato solo alla prima lezione dello studente per quella data (COUNT check nella transazione)
3. **Penna Indelebile**: `reverseTransaction` crea uno STORNO (importo negativo) — nessun DELETE su accounting_entries
4. **Separazione Cassa/Banca**: `getCashFlow()` aggrega per metodoPagamento con SUM separato
5. **Tracciamento Fatture**: `getPendingInvoices()` JOIN payments + accounting_entries — sempre aggiornato in tempo reale

### Conseguenze
- Tutti i movimenti finanziari sono permanenti e tracciabili (audit trail completo).
- Il dashboard mostra lo stato finanziario reale senza calcoli a runtime complessi.
- `toggleInvoiceStatus` non modifica la tabella payments — il pagamento rimane immutabile.

---

## [ADL-009] Design Document — Evoluzione Piattaforma

### Stato
**Approvato** — 12 Giugno 2026

### Contesto
Il gestionale nasce come strumento interno. Con questa decisione evolve in una piattaforma di comunicazione completa tra centro, tutor e famiglie. Il design è stato prodotto tramite sessione di brainstorming strutturata e documentato in `docs/superpowers/specs/2026-06-12-platform-evolution-design.md`.

### Decisioni chiave

**Autenticazione:** `nuxt-auth-utils` con sessioni server cifrate in cookie HttpOnly. Sostituisce il JWT manuale del legacy. Revoca immediata lato server. Installazione: `npm install nuxt-auth-utils`.

**4 Ruoli operativi:**
| Ruolo | Accesso |
|-------|---------|
| `ADMIN` | Tutto — inclusa contabilità, cancellazione note, gestione utenti |
| `SUPER_TUTOR` | Operativo completo — NO contabilità |
| `TUTOR` | Solo proprie ore, disponibilità, note propri alunni |
| `GENITORE` | Solo portale famiglie |

**5 Middleware Nuxt 4:** `auth`, `staff-only`, `admin-or-super`, `admin-only`, `portal-only`.

**Evoluzione database (nessuna tabella rinominata o eliminata):**
| Modifica | Tabella | Dettaglio |
|----------|---------|-----------|
| Aggiunta valore enum | `users.role` | `SUPER_TUTOR` |
| Nuova colonna FK nullable | `students.portalUserId` | Uno-a-molti: un GENITORE → più studenti (fratelli) |
| Nuova colonna booleana | `students.abilitatoPrenotazioneOnline` | Flag admin per abilitare/disabilitare prenotazione portale |
| Nuova colonna obbligatoria | `bookings.userId` | Solo prenotazioni autenticate — flusso anonimo eliminato |
| 2 nuove colonne nullable | `tutor_profiles` | `modalitaPagamento` (ORE/FORFAIT) + `importoForfait` |
| Nuova tabella | `student_notes` | Note didattiche INTERNA/FAMIGLIA con autore e link lezione opzionale |

**Prenotazioni:** Il flusso anonimo (`/prenota`) viene eliminato. Chi vuole iscriversi contatta il centro → prova gratuita → iscrizione → l'admin crea l'account portale. Solo utenti GENITORE autenticati possono prenotare.

**Note didattiche:** Tabella `student_notes` con visibilità per ruolo. ADMIN e SUPER_TUTOR possono cancellare tutte le note. TUTOR solo le proprie.

**Compenso tutor ORE/FORFAIT:** I tutor a forfait hanno il compenso mensile fisso in `importoForfait`. Il sistema calcola comunque il costo teorico a ore per ogni lezione — la contabilità mostra il confronto forfait vs. ore reali.

**Funzionalità aggiuntive approvate:**
- Calendario Intelligente prenotazioni (implementato, nascosto al lancio — attivabile da `system_configs`)
- Bollettino Settimanale famiglie (email domenicale solo se ci sono note FAMIGLIA quella settimana)
- Briefing Mattutino admin (pannello "Da fare oggi" — appare solo se ci sono urgenze)

**Decisioni scartate con motivazione:** Vedi Appendice del design document.

### Fasi di implementazione
| Fase | Contenuto | Dipendenze |
|------|-----------|-----------|
| **Fase 7** | Nuxt 4 + Layout Admin + Portale Famiglie + Design System | Nessuna |
| **Fase 8** | Auth & RBAC + tutte le migrazioni DB | Fase 7 |
| **Fase 9** | Pagine Vue gestionale interno | Fase 8 |
| **Fase 10** | Note Didattiche (service + API + UI) | Fase 8 |
| **Fase 11** | Portale Famiglie | Fase 8 + Fase 10 |
| **Fase 12** | Funzionalità Aggiuntive | Fase 8 + 10 + 11 |

### Conseguenze
- Il gestionale diventa una piattaforma multi-ruolo con accesso esterno per le famiglie.
- La prenotazione anonima è eliminata — accesso solo tramite account gestito dall'admin.
- Il caso fratelli è gestito nativamente tramite `students.portalUserId` (uno-a-molti).
- Il flag `abilitatoPrenotazioneOnline` dà controllo totale all'admin senza logiche hardcodate.

---

## [ADL-010] Fase 7 — Nuxt 4 + Layout Admin + Design System

### Stato
**Completato** — 13 Giugno 2026

### Contesto
Installazione di Nuxt 4 su un progetto esistente (Drizzle + Zod già presenti), configurazione del design system brand Ti Formiamo Noi, e creazione dei due layout Vue: admin con sidebar collassabile e portale famiglie mobile-first.

### Decisioni chiave

**1. Nuxt UI v4 (non v3)**
Al momento dell'installazione `@nuxt/ui latest` ha installato la versione **v4.8.2**, non v3 come pianificato. La configurazione è diversa da v3 in tre punti critici:

| Aspetto | Nuxt UI v3 (pianificato) | Nuxt UI v4 (installato) |
|---------|--------------------------|-------------------------|
| Colori in `app.config.ts` | `ui.primary: 'tfn'` | `ui.colors.primary: 'tfn'` |
| Gray in `app.config.ts` | `ui.gray: 'slate'` | `ui.colors.neutral: 'slate'` |
| Wrapper obbligatorio | non richiesto | `<UApp>` richiesto in `app.vue` |

**2. CSS obbligatorio: `@import 'tailwindcss'` e `@import '@nuxt/ui'`**
Con Nuxt UI v4 + Tailwind CSS v4, il file `app/assets/css/main.css` DEVE iniziare con questi due import. Senza di essi, Tailwind non processa il file e nessun stile viene applicato:

```css
@import 'tailwindcss';
@import '@nuxt/ui';

@theme {
  --color-tfn-500: #0063a6;
  /* ... */
}
```

**3. Percorso CSS con `compatibilityVersion: 4`**
Con `future.compatibilityVersion: 4`, Nuxt cambia il `srcDir` da `.` (root) a `app/`. Quindi `~` in `nuxt.config.ts` risolve a `app/`, NON alla root del progetto. Il file CSS deve essere in `app/assets/css/main.css` — non in `assets/css/main.css` alla root.

**4. DB lazy init via Proxy (fix avvio server)**
`server/database/client.ts` riscritta con pattern Proxy JavaScript: la connessione al database avviene solo alla prima query API, mai al caricamento del modulo. Questo evita crash all'avvio quando `DATABASE_URL` non è ancora caricata da Nuxt.

**5. SSR-safe sidebar: `useCookie` (non `localStorage`)**
Lo stato collapsed/expanded della sidebar usa `useCookie('sidebar-collapsed')`. `localStorage` causerebbe un hydration mismatch: il server renderizza con lo stato default, il client legge localStorage e cambia → flash visibile. `useCookie` è letto identicamente da server e client.

**6. `npx nuxt prepare` prima di `npm run dev` dopo aver svuotato `.nuxt/`**
Dopo aver cancellato `.nuxt/` (pulizia cache), Vite cercherà `tsconfig.json` generato da Nuxt. Se `.nuxt/tsconfig.json` non esiste ancora, tutti i file `.vue` falliscono con `failed to resolve "extends":"./.nuxt/tsconfig.json"`. Soluzione: eseguire sempre `npx nuxt prepare` prima di `npm run dev` dopo una pulizia cache.

**7. Dipendenza peer `@paralleldrive/cuid2`**
`nuxt-auth-utils` (già installato per Fase 8) richiede `@paralleldrive/cuid2` come peer dependency. Installato con `npm install @paralleldrive/cuid2`.

### File creati/modificati

| File | Descrizione |
|------|-------------|
| `nuxt.config.ts` | Nuxt 4, moduli, font Google, CSS path, optimizeDeps Vite |
| `tsconfig.json` | Estende `.nuxt/tsconfig.json` generato automaticamente |
| `app.config.ts` | `ui.colors.primary: 'tfn'`, `ui.colors.neutral: 'slate'` |
| `app/assets/css/main.css` | Imports Tailwind+NuxtUI, palette `--color-tfn-*`, font-heading |
| `app/app.vue` | Entry point con wrapper `<UApp>` obbligatorio |
| `app/layouts/default.vue` | Sidebar collassabile, 7 voci nav Heroicons outline |
| `app/layouts/portal.vue` | Header blu, bottom nav mobile, desktop nav orizzontale |
| `app/pages/index.vue` | Pagina temporanea verifica design system |
| `app/pages/portale/index.vue` | Pagina portale con `definePageMeta({ layout: 'portal' })` |
| `server/database/client.ts` | Lazy Proxy init — evita crash avvio senza DB reale |
| `.env` | Valori placeholder per sviluppo locale |
| `.env.example` | Template committato per onboarding |
| `.gitignore` | Esclude `.nuxt`, `.output`, `.env`, `node_modules` |

### Comandi PowerShell di riferimento

```powershell
# Installa dipendenze
npm install nuxt @nuxt/ui @nuxtjs/google-fonts @iconify-json/heroicons
npm install @paralleldrive/cuid2

# Genera tipi Nuxt (obbligatorio dopo nuxt install o dopo aver svuotato .nuxt/)
npx nuxt prepare

# Avvia dev server
npm run dev

# Se si svuota .nuxt/ per debug:
Remove-Item -Recurse -Force .nuxt
npx nuxt prepare
npm run dev
```

### Conseguenze
- Il progetto ha ora un design system completo e funzionante basato su Nuxt UI v4.
- Il tema brand TFN (#0063A6) è attivo come colore `primary` in tutti i componenti UI.
- I due layout (admin e portale) sono pronti — le pagine interne saranno create nelle Fasi 9-11.
- Il DB si connette solo su richiesta — nessun crash in sviluppo senza PostgreSQL avviato.

---

## [ADL-011] Modulo Pacchetti a Consumo

### Stato
**Completato** � 13 Giugno 2026

### Contesto
� stato richiesto di aggiungere un terzo tipo di pacchetto (A_CONSUMO) oltre a quelli esistenti (ORE, MENSILE). Questo pacchetto ha una logica prepagata e ricaricabile, dove il cliente paga un importo che viene convertito in ore in base a una 	ariffaOraria specifica, senza limiti di validit� temporale intrinseci (la scadenza � opzionale).

### Decisioni chiave

**1. Architettura Data Model (Approccio B)**
Invece di stravolgere la tabella packages, si � scelto di mantenere la struttura esistente aggiungendo semplicemente 	ariffaOraria. Per gestire le ricariche successive, � stata creata la nuova tabella package_recharges che funge da "libretto". Ad ogni ricarica, la tabella packages accumula le ore e i costi nei totali storici (oreAcquistate, prezzoTotale).

**2. Transazioni Atomiche**
Sia la creazione del pacchetto che la successiva ricarica (echargePackage in package.service.ts) operano all'interno di una singola transazione Drizzle che:
- Aggiunge le ore al pacchetto (e aggiorna i residui).
- Inserisce un record nel libretto package_recharges.
- Se � previsto un pagamento immediato, registra in payments e genera il movimento ccountingEntries.
- Ricalcola gli stati del pacchetto (computePackageStates).

**3. Correzione Zod (Zod v4)**
Si � scoperto che la codebase adotta una versione recente di Zod (v4+), che non accetta pi� la sintassi equired_error come oggetto per i metodi base come z.number(), ma richiede { message: "..." }. I file schema sono stati fixati tramite refactoring di massa (message al posto di equired_error).

### File creati/modificati
- server/database/schema.ts � Aggiunta 	ariffaOraria, nuova tabella packageRecharges.
- shared/schemas/package.schema.ts � Modificato PackageTypeEnum e aggiunta RechargePackageSchema.
- server/services/package.service.ts � Implementata logica transazionale in echargePackage e modifica a createPackage.
- server/api/packages/[id]/recharge.post.ts & echarges.get.ts � Nuovi endpoint.
- pp/pages/pacchetti/index.vue e impostazioni/index.vue � UI di creazione e gestione template a consumo con stima automatica delle ore in base alla tariffa.
- pp/pages/studenti/[id].vue � Modal di Ricarica e consultazione Libretto Storico aggiunte alla vista studente.

### Conseguenze
- Il modulo si integra nativamente senza intaccare i calcoli delle lezioni esistenti.
- Totale compatibilit� con i compensi dei tutor (le ore vengono scalate allo stesso modo).
- Le transazioni evitano stati parziali in cui le ore vengono accreditate senza tracciamento contabile.


**4. Tabelle e UI (Nuxt UI v4)**
Le tabelle sono state aggiornate in tutto l'applicativo per usare i template slot corretti introdotti da Nuxt UI v4 (basato su TanStack Table). Gli slot '-data' sono stati sostituiti da '-cell'. Inoltre, � stata migliorata la UI dei pacchetti: la colonna residuo ora mostra in maniera inequivocabile i giorni per i pacchetti mensili e rimuove i decimali superflui (.0) per le ore.

**5. Validazione CUID2 (Zod)**
La libreria di generazione ID nel DB produce CUIDv2, ma Zod '.cuid()' valida solo CUIDv1. Si � deciso di utilizzare '.min(1)' negli schemi condivisi per prevenire fallimenti di validazione sui nuovi formati ID mantenendo la sicurezza delle API.

**6. Macchina a Stati - ESAURITO per Giorni**
Per i pacchetti MENSILI, la regola per calcolare lo stato ESAURITO non valuta pi� solo le ore, ma considera il pacchetto ESAURITO anche se i giorni residui arrivano a zero, anche in presenza di un plafond ore formalmente avanzato.


---

## [ADL-012] Fase 9 Sprint 1 — Modulo Tutor

### Stato
**Completato** — 13 Giugno 2026

### Contesto
Fase 9 e' la costruzione delle pagine Vue del gestionale interno. Lo Sprint 1 copre il modulo tutor completo: registrazione account tutor, gestione compensi mensili, rimborsi spese, statistiche di performance. Il modulo era un placeholder "Sezione in arrivo".

### Decisioni chiave

**1. Architettura a batch query (no N+1)**
`listTutors` esegue 4 query in parallelo via `Promise.all`: lista utenti+profili, somma lezioni per tutor (mese corrente), somma pagamenti effettuati, CTE SQL per arretrati mensili. Nessuna query dentro il loop.

**2. CTE SQL per arretrati in PostgreSQL**
Gli arretrati mensili sono calcolati con una CTE SQL via `db.execute(sql...)`. Alias CTE in snake_case senza virgolette (`tutor_id`, `mesi_arretrati`, `totale_arretrati`) — le virgolette su camelCase causano problemi nei driver PostgreSQL.

**3. Campi monetari come `z.string()` (deliberata)**
Tutti i campi monetari negli Zod schemas tutor (`importo`, `importoForfait`, `importoPagamento`) sono `z.string()`. I service usano `parseFloat()` internamente. Coerente con il layer di validazione esistente.

**4. PRO_BONO: nessuna registrazione contabile**
Se `payTutor` riceve `proBono: true`, il pagamento viene registrato con `importo=0` e `stato='PRO_BONO'`, senza creare record in `accountingEntries`.

**5. Rimborsi parziali con accumulo**
`payReimbursement` accumula l'importo pagato: `DA_PAGARE` -> `PARZIALE` -> `PAGATO`. Ogni pagamento (anche parziale) crea un record USCITA in `accountingEntries`.

**6. Protezione TUTOR nella pagina dettaglio**
La pagina `/tutor/[id]` usa middleware `staff-only`. I TUTOR vedono solo il proprio profilo. Confronto: `String(sessionUser.id) !== id` (cast obbligatorio: `sessionUser.id` e' `number`, `route.params.id` e' `string`).

**7. `USwitch` invece di `UToggle` in Nuxt UI v4**
Il componente toggle si chiama `USwitch` in Nuxt UI v4. Il linter del progetto lo corregge automaticamente.

**8. `await` obbligatorio in try/catch per Promise async**
In route handler, `return service()` senza `await` fa sfuggire gli errori al `try/catch`. Fix: `return await service()`.

### File creati

| File | Descrizione |
|------|-------------|
| `shared/schemas/tutor.schema.ts` | 6 Zod schemas: CreateTutor, UpdateTutor, TutorQuery, PayTutor, CreateReimbursement, PayReimbursement |
| `server/services/tutor.service.ts` | 12 funzioni di business logic |
| `server/api/tutors/` | 10 route API (CRUD + compensation + pay + performance + stats + reimbursements) |
| `app/pages/tutor/index.vue` | Lista tutor: 4 KPI, filtri con debounce, UTable v4, modal Crea/Liquida |
| `app/pages/tutor/[id].vue` | Dettaglio tutor: 4 tab, 5 modal, protezione TUTOR RBAC |

### Commit range
`6e95794` -> `81014dc` — 13 commit

### Conseguenze
- Modulo tutor completamente operativo: creazione account, compensi, rimborsi, statistiche.
- I tutor possono fare login e vedere solo il proprio profilo (RBAC corretto).
- Dashboard principale (`/`) rimane placeholder — Sprint 2 da pianificare.
