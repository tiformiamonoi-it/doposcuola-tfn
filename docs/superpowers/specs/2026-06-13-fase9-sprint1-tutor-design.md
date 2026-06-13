# Fase 9 — Sprint 1: Modulo Tutor — Design Spec

**Data:** 13 Giugno 2026
**Sessione:** Brainstorming → Spec approvata dall'utente
**Dipende da:** Fase 7 (layout), Fase 8 (auth + schema DB), ADL-011 (A_CONSUMO)
**Sprint successivo:** Sprint 2 — Dashboard (KPI operativi + finanziari)

---

## 1. Obiettivo

Sostituire il placeholder `app/pages/tutor/index.vue` ("Sezione in arrivo") con il modulo tutor completo. Aggiungere la pagina dettaglio `app/pages/tutor/[id].vue`. Costruire il layer backend (service + API routes) per supportare tutte le operazioni.

Al termine di questo sprint, l'admin può:
- Creare tutor (con account di accesso incluso)
- Vedere le statistiche mensili per ogni tutor
- Liquidare i compensi mensili
- Gestire i rimborsi spese
- Consultare le statistiche di performance per tutor

---

## 2. Schema DB coinvolto (già esistente — nessuna migrazione necessaria)

| Tabella | Ruolo |
|---------|-------|
| `users` | Un tutor **è** un User con `role = 'TUTOR'`. Creare tutor = creare User. |
| `tutor_profiles` | Dati extra (CF, P.IVA, indirizzo, materie, modalità pagamento ORE/FORFAIT) |
| `tutor_payments` | Compensi mensili liquidati — indice `(tutorId, mese)` |
| `tutor_reimbursements` | Rimborsi spese — indice `(tutorId, stato)` |
| `lessons` | Ore e compensi calcolati — indice `(tutorId, data DESC)` |
| `lesson_students` | Join lezione → studenti → pacchetti — indice `(packageId, studentId)` |
| `packages` | Tariffe orarie per calcolo ricavo — indice `(studentId, tipo)` |
| `accounting_entries` | Movimenti contabili per liquidazioni e rimborsi pagati |

---

## 3. Architettura Backend

### 3.1 Service: `server/services/tutor.service.ts` (nuovo)

Funzioni esportate:

| Funzione | Descrizione |
|----------|-------------|
| `listTutors(filters)` | Lista tutor con stats mese corrente (ore, compenso calcolato, mesi non pagati) |
| `getTutorById(id)` | Profilo completo (user + tutorProfile + stats aggregati) |
| `createTutor(data)` | Crea User (role TUTOR) + TutorProfile in transazione. Hash bcrypt password. |
| `updateTutor(id, data)` | Aggiorna user + tutorProfile (anagrafica + materie + modalità) |
| `deactivateTutor(id)` | Soft-disable: `users.active = false` |
| `getMonthlyCompensation(tutorId, months)` | Storico compensi mensili con breakdown ore per tipo |
| `payTutor(tutorId, data)` | Registra `tutorPayment` + `accountingEntry` USCITA in transazione |
| `getMonthlyPerformance(tutorId, months)` | Ricavo generato / compenso / margine per mese |
| `getDetailedStats(tutorId, months)` | Distribuzione ore per tipo + top alunni + giorni/fasce preferiti |
| `listReimbursements(tutorId)` | Lista rimborsi con stato |
| `createReimbursement(tutorId, data)` | Crea rimborso (stato DA_PAGARE) |
| `payReimbursement(reimbursementId, data)` | Paga rimborso (parziale o totale) + `accountingEntry` USCITA |

### 3.2 API Routes

```
GET    /api/tutors                        → listTutors (con filtri query)
POST   /api/tutors                        → createTutor
GET    /api/tutors/:id                    → getTutorById
PUT    /api/tutors/:id                    → updateTutor
DELETE /api/tutors/:id                    → deactivateTutor (soft)

GET    /api/tutors/:id/compensation       → getMonthlyCompensation
POST   /api/tutors/:id/pay               → payTutor (liquida un mese)

GET    /api/tutors/:id/performance        → getMonthlyPerformance
GET    /api/tutors/:id/stats              → getDetailedStats

GET    /api/tutors/:id/reimbursements     → listReimbursements
POST   /api/tutors/:id/reimbursements     → createReimbursement
POST   /api/tutors/:id/reimbursements/:rid/pay → payReimbursement
```

Tutti gli endpoint sono protetti da middleware `admin-or-super` (tranne GET che accetta anche `staff-only`).

---

## 4. Calcoli chiave — formule esatte

### 4.1 Compenso mensile tutor (da liquidare)

```
compensoCalcolato = Math.floor( SUM(lessons.compensoTutor) )
                   WHERE lessons.tutorId = X
                   AND   lessons.data >= primo del mese
                   AND   lessons.data <= ultimo del mese

compensoResiduo = compensoCalcolato
                - SUM(tutor_payments.importo WHERE mese = M AND status IN ('PAGATO','PARZIALE','PRO_BONO'))
```

Query usa l'indice `lessons(tutorId, data DESC)` — filtro sul mese con range su `data`.

### 4.2 Ricavo generato per slot (per le statistiche di performance)

```
Per ogni lesson_student nella lezione L:
  durata = lesson_student.mezzaLezione ? 0.5 : 1.0
  tariffa = packages.tariffaOraria           (A_CONSUMO)
          ?? packages.prezzoTotale / packages.oreAcquistate   (ORE/MENSILE)
          ?? 25.00                            (fallback se pacchetto non trovato)
  ricavo_studente = tariffa × durata

ricavo_lezione = SUM(ricavo_studente) per tutti gli studenti in L
compenso_lezione = lessons.compensoTutor

margine_lezione = ricavo_lezione - compenso_lezione
```

Join path: `lessons → lesson_students → packages` — usa indice `lesson_students(packageId, studentId)`.

### 4.3 Mesi non pagati

Un mese è "non pagato" se `compensoResiduo > 0.01` e il mese è già terminato (ultimo giorno < oggi).
Implementato come query aggregata con `LEFT JOIN tutor_payments` raggruppata per mese.

---

## 5. Frontend — Pagina Lista Tutor (`/tutor`)

**Accesso:** middleware `admin-or-super`. Se un utente con ruolo `TUTOR` accede a questa rotta, il middleware lo reindirizza automaticamente a `/tutor/[session.user.id]` (la propria pagina dettaglio). Il link "Tutor" nella sidebar è visibile a tutti gli staff ma il redirect avviene lato server.

### 5.1 Header + KPI cards

```
┌─────────────────────────────────────────────────┐
│ Tutor                              [+ Nuovo Tutor] │
│ Gestione del personale docente                    │
├─────────────────────────────────────────────────┤
│ [Tutor attivi: 6] [Da liquidare: 3] [€ dovuti: 850] [Media/mese: €142] │
└─────────────────────────────────────────────────┘
```

Le 4 KPI cards mostrano dati del mese corrente, calcolate nella response di `GET /api/tutors`.

### 5.2 Filtri

- Ricerca per nome/cognome (debounce 300ms)
- Toggle "Solo da liquidare" (filtra tutor con `compensoResiduo > 0`)

### 5.3 Tabella (UTable Nuxt UI v4)

| Colonna | Dato | Note |
|---------|------|------|
| Nome | `firstName + lastName` | Link a `/tutor/[id]` |
| Contatti | email + telefono | |
| Ore mese | somma ore mese corrente | |
| Compenso (€) | compensoCalcolato mese corrente | |
| Da liquidare (€) | compensoResiduo | Badge rosso se > 0 |
| Mesi arretrati | count mesi non pagati | Badge arancio se > 0 |
| Stato | Attivo / Inattivo | UBadge |
| Azioni | menu ⋮ | |

**Azioni menu ⋮:**
- Vedi dettaglio → `/tutor/[id]`
- Liquida mese corrente → modal
- Attiva / Disattiva
- Elimina (solo se 0 lezioni — soft check)

### 5.4 Modal "Crea Tutor"

Campi:
- Nome* + Cognome*
- Email* (usata per il login)
- Password iniziale* (impostata dall'admin — bcrypt al server)
- Telefono
- Modalità compenso: ORE / FORFAIT
- Importo forfait (€) — visibile solo se FORFAIT

Validazione Zod lato server: email unica nella tabella `users`, password min 8 caratteri.

### 5.5 Modal "Liquida mese" (accessibile anche dalla lista)

Precompilato con mese corrente e `compensoCalcolato`. Campi:
- Mese di riferimento (selector mese/anno)
- Importo da liquidare (pre-compilato, modificabile)
- Metodo: CONTANTI / BONIFICO / POS / ASSEGNO / ALTRO
- Flag "Pro Bono" (azzera importo, status PRO_BONO, nessun accounting)
- Note

---

## 6. Frontend — Pagina Dettaglio Tutor (`/tutor/[id]`)

**Accesso:** middleware `staff-only` (TUTOR vede solo se stesso — controllo `session.user.id === id`)

### 6.1 Header profilo

```
┌─────────────────────────────────────────────────┐
│ ← Tutor                                    [⋮ Menu] │
│ Marco Rossi                          🟢 Attivo    │
│ 📧 marco@email.it  •  📞 333-1234567             │
│                                                   │
│ [✏️ Modifica]  [💰 Liquida]                      │
├─────────────────────────────────────────────────┤
│ 🔴 2 mesi non pagati — € 480 da liquidare        │  ← alert, solo se > 0
└─────────────────────────────────────────────────┘
```

Menu ⋮: Attiva/Disattiva + Elimina (con conferma UModal).

### 6.2 Tab — Anagrafica

- Dati personali: Nome, Cognome, Email, Telefono, Codice Fiscale, P.IVA, Indirizzo, CAP, Città
- Modalità compenso: ORE (tariffa dalla tabella SINGOLA/GRUPPO/MAXI) o FORFAIT (€ fisso/mese)
- **Materie insegnate** — lista chip con livello (Medie / Superiori). Modal "Gestisci materie" permette di aggiungere/rimuovere con relativi livelli.

Salvato in `tutor_profiles.materie` come array di stringhe: `["Matematica (Medie, Superiori)", "Fisica (Superiori)"]`.

### 6.3 Tab — Compensi

**Cards riepilogo:**
- Totale liquidato (storico)
- Da liquidare (mese corrente)
- Mesi con arretrati (count)

**Tabella mesi** (ultimi 12 mesi, più recenti in cima):

| Mese | Compenso calcolato | Liquidato | Residuo | Stato | Azioni |
|------|--------------------|-----------|---------|-------|--------|

**Stato badge:** DA_PAGARE (rosso) / PARZIALE (arancio) / PAGATO (verde) / PRO_BONO (grigio)

**Riga espandibile "Dettaglio ore"** per ogni mese:
```
Ore singole intere:      X lezioni  →  € Y
Mezze ore singole:       X lezioni  →  € Y
Ore gruppo intere:       X lezioni  →  € Y
Mezze ore gruppo:        X lezioni  →  € Y
Ore maxi intere:         X lezioni  →  € Y
Mezze ore maxi:          X lezioni  →  € Y
─────────────────────────────────────────────
Totale grezzo:           € Z.ZZ
Arrotondato (floor):     € Z
```

**Azioni per riga:** Liquida (modal), Modifica importo (modal, solo mesi passati).

### 6.4 Tab — Rimborsi

**Cards:** Totale rimborsato (storico) + Da rimborsare (totale residuo)

**Tabella:**

| Data richiesta | Descrizione | Importo | Pagato | Residuo | Stato | Azioni |
|----------------|-------------|---------|--------|---------|-------|--------|

**Stato badge:** DA_PAGARE / PARZIALE / PAGATO

**Azioni:** Paga rimborso (modal: importo, metodo, data) + Modifica + Elimina

**Button "Nuovo rimborso"** → Modal: importo, descrizione, data richiesta, note.

### 6.5 Tab — Statistiche

**Performance ultimi 6 mesi (tabella):**

| Mese | Lezioni | Ore | Studenti | Ricavo generato | Compenso | Margine | Margine% |
|------|---------|-----|----------|-----------------|----------|---------|----------|

**Distribuzione ore per tipo** (progress bar):
- SINGOLA: X% (Y ore)
- GRUPPO: X% (Y ore)
- MAXI: X% (Y ore)

**Top 5 alunni seguiti** (per ore con questo tutor):

| Alunno | Lezioni | Ore totali |
|--------|---------|-----------|

---

## 7. Regole di business

1. **Creare tutor = creare User** — transazione atomica: `users` INSERT + `tutor_profiles` INSERT. Rollback se email duplicata.
2. **Password** — hashata con `bcrypt` (10 rounds) prima di salvare. Mai salvata in chiaro.
3. **Compenso floor** — `Math.floor(compensoGrezzo)` sempre, mai round o ceil.
4. **PRO_BONO** — nessun `accountingEntry` creato, importo = 0, status = PRO_BONO.
5. **Liquidazione** — crea sempre un `tutorPayment` + un `accountingEntry` (tipo USCITA, categoria "compenso_tutor") in transazione.
6. **Rimborso parziale** — `importoPagato` cresce ad ogni pagamento. Stato PARZIALE se `importoPagato < importo`, PAGATO se `importoPagato >= importo`.
7. **Rimborso pagato** — crea `accountingEntry` USCITA, categoria "rimborso_tutor".
8. **Eliminazione tutor** — solo se `lessons.tutorId` ha 0 righe (integrità dati). Altrimenti solo disattivazione.
9. **TUTOR vede solo sé stesso** — nel dettaglio `/tutor/[id]`, se `session.user.role === 'TUTOR'` e `session.user.id !== id` → redirect `/`.

---

## 8. Performance — indici usati

| Query | Indice sfruttato |
|-------|-----------------|
| Ore/compenso mese per tutor | `lessons(tutorId, data DESC)` |
| Mesi non pagati | `tutor_payments(tutorId, mese)` |
| Rimborsi per tutor | `tutor_reimbursements(tutorId, stato)` |
| Join lezione → pacchetti | `lesson_students(packageId, studentId)` |
| Ricavo per pacchetto tipo | `packages(studentId, tipo)` |

Query mensili usano `WHERE data >= primo_mese AND data <= ultimo_mese` su colonna indicizzata — no full scan.

---

## 9. Componenti Vue riutilizzabili

| Componente | Dove usato |
|------------|-----------|
| `StatoBadgeTutor` | badge PAGATO/DA_PAGARE/PRO_BONO/PARZIALE |
| `ModalLiquidaTutor` | lista tutor + tab compensi |
| `ModalRimborso` | tab rimborsi (crea + paga) |
| `TutorMaterie` | tab anagrafica |

---

## 10. File da creare / modificare

| Azione | File |
|--------|------|
| Modifica | `app/pages/tutor/index.vue` |
| Crea | `app/pages/tutor/[id].vue` |
| Crea | `server/services/tutor.service.ts` |
| Crea | `server/api/tutors/index.get.ts` |
| Crea | `server/api/tutors/index.post.ts` |
| Crea | `server/api/tutors/[id].get.ts` |
| Crea | `server/api/tutors/[id].put.ts` |
| Crea | `server/api/tutors/[id].delete.ts` |
| Crea | `server/api/tutors/[id]/compensation.get.ts` |
| Crea | `server/api/tutors/[id]/pay.post.ts` |
| Crea | `server/api/tutors/[id]/performance.get.ts` |
| Crea | `server/api/tutors/[id]/stats.get.ts` |
| Crea | `server/api/tutors/[id]/reimbursements.get.ts` |
| Crea | `server/api/tutors/[id]/reimbursements.post.ts` |
| Crea | `server/api/tutors/[id]/reimbursements/[rid]/pay.post.ts` |

---

## 11. Sprint successivo (Sprint 2 — Dashboard)

Dopo che i tutor sono registrati e le lezioni iniziano a essere salvate, il Sprint 2 costruirà:
- KPI operativi: lezioni di oggi, pacchetti in scadenza, chi non ha pagato
- KPI finanziari: ricavo lezioni (ieri / questa settimana / questo mese)
- KPI margine: media oraria = `(ricavo_studenti - compenso_tutor) / ore_totali` aggregata sul periodo
- Nuovo endpoint `/api/dashboard` con query parallele (`Promise.all`)
