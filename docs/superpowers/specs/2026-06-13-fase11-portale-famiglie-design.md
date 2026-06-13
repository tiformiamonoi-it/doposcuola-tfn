# Design — Fase 11: Portale Famiglie

**Data:** 2026-06-13  
**Stato:** Approvato  
**Riferimento:** `2026-06-12-platform-evolution-design.md §5` (decisioni già approvate)

---

## 1. Obiettivo

Costruire il Portale Famiglie: area riservata ai genitori (ruolo GENITORE) per consultare lo stato del pacchetto del figlio, leggere le note didattiche a loro visibili, e richiedere una lezione. Include anche il pannello admin nella scheda studente per creare account genitore e gestire le prenotazioni in arrivo. Un form pubblico semplice raccoglie le richieste di nuove famiglie.

---

## 2. Decisioni chiave

### 2.1 Dashboard portale (`/portale`) — NASCOSTA al lancio

La pagina `/portale/index.vue` esiste ma mostra **solo un messaggio di benvenuto placeholder** ("Coming soon — stiamo preparando il riepilogo"). Nessun dato, nessuna card. La dashboard completa (ore residue, ultima lezione, feedback) è prevista per Sprint 2.

**Motivazione:** evitare di esporre dati parziali in produzione prima che tutte le API di riepilogo siano testate.

### 2.2 Wizard prenotazione — Opzione A (semplice)

Il genitore seleziona:
1. Data desiderata (calendario — giorni passati non selezionabili)
2. Materie (multi-select dalle materie in `system_configs`)
3. Nota orario opzionale (testo libero — placeholder: "Es. preferisco dopo le 17")

**Non** viene mostrata alcuna selezione di slot. La segreteria assegna tutor e orario.

La pagina `/portale/prenota` è **visibile nel menu solo se**:
- `students.abilitatoPrenotazioneOnline = true`
- Esiste almeno un pacchetto attivo collegato allo studente

### 2.3 Note didattiche (`/portale/note`)

Feed cronologico delle sole note con `visibilita = 'FAMIGLIA'` per gli studenti collegati al genitore. Ogni nota mostra: data, nome tutor autore, testo. Read-only.

### 2.4 Profilo (`/portale/profilo`)

Dati account genitore (email, nome), lista studenti collegati, cambio password, logout.

### 2.5 Pannello "Accesso Portale" nel gestionale

Nella scheda `/studenti/[id]` — nuovo pannello visibile solo ad ADMIN:
- Se studente non ha account portale: bottone "Crea accesso portale" → modal con campo email → crea utente GENITORE + linka `students.portalUserId`
- Se account già esiste: mostra email + stato + bottone "Reimposta password" (genera nuova password temporanea)
- Toggle `abilitatoPrenotazioneOnline` (checkbox)
- Lista prenotazioni PENDING con bottoni Conferma / Cancella

### 2.6 Form pubblico (`/prenota`)

Pagina fuori dal portale, senza layout admin, nessun login richiesto. Raccoglie:
- Nome e cognome figlio
- Classe / scuola
- Materie di interesse (multi-select o campo testo)
- Telefono o email di contatto
- Note libere (opzionale)

Alla submit: mostra messaggio di successo "Grazie! Ti contatteremo presto." **Nessuna persistenza DB in questa fase** — nessuna migrazione necessaria. Il genitore viene ricontattato manualmente dalla segreteria. La tabella per tracciare queste richieste è prevista per Fase 12.

---

## 3. Architettura

### Backend

| File | Responsabilità |
|------|---------------|
| `server/services/portal.service.ts` | `getPortalStudent` (carica studente+pacchetto), `getPortalNotes`, `checkPrenotazioneAbilitata` |
| `server/services/booking.service.ts` | `createBooking`, `listBookings` (admin), `updateBookingStatus` |
| `server/services/portal-user.service.ts` | `createPortalAccount`, `resetPortalPassword` |
| `server/api/portal/student.get.ts` | Dati studente per il portale (solo GENITORE) |
| `server/api/portal/notes.get.ts` | Note FAMIGLIA per lo studente (solo GENITORE) |
| `server/api/portal/bookings.get.ts` | Prenotazioni del genitore |
| `server/api/portal/bookings.post.ts` | Crea prenotazione |
| `server/api/portal/profile.put.ts` | Aggiorna profilo + cambio password |
| `server/api/admin/students/[id]/portal-access.post.ts` | Crea account GENITORE (solo ADMIN) |
| `server/api/admin/students/[id]/portal-access.put.ts` | Aggiorna flag + reset password (solo ADMIN) |
| `server/api/admin/bookings/index.get.ts` | Lista booking per admin |
| `server/api/admin/bookings/[id]/status.put.ts` | Conferma/cancella booking (solo ADMIN) |
| `server/api/public/contact.post.ts` | Salva richiesta contatto (pubblica, no auth) |
| `shared/schemas/booking.schema.ts` | Zod: CreateBookingSchema, UpdateBookingStatusSchema |
| `shared/schemas/portal-user.schema.ts` | Zod: CreatePortalAccessSchema, ResetPasswordSchema |
| `shared/schemas/contact.schema.ts` | Zod: PublicContactSchema |

### Frontend — Portale

| File | Descrizione |
|------|-------------|
| `app/pages/portale/index.vue` | Placeholder "Coming soon" — no dati |
| `app/pages/portale/prenota.vue` | Wizard 3-step: data → materie → conferma |
| `app/pages/portale/note.vue` | Feed note FAMIGLIA (read-only) |
| `app/pages/portale/profilo.vue` | Account + cambio password + logout |
| `app/middleware/portal-only.ts` | Blocca non-GENITORE dal portale |

### Frontend — Gestionale (modifica esistente)

| File | Modifica |
|------|---------|
| `app/pages/studenti/[id].vue` | Aggiunge pannello "Accesso Portale" (fondo pagina) |

### Frontend — Pubblico

| File | Descrizione |
|------|-------------|
| `app/pages/prenota.vue` | Form contatto per nuove famiglie (layout: nessuno o minimal) |

---

## 4. Zod Schemas

### `shared/schemas/booking.schema.ts`

```typescript
export const CreateBookingSchema = z.object({
  dataDesiderata: z.string().datetime(),                    // ISO date
  materie:        z.array(z.string().min(1)).min(1),        // almeno una materia
  noteOrario:     z.string().max(500).optional(),
})

export const UpdateBookingStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED']),
  note:   z.string().max(500).optional(),
})
```

### `shared/schemas/portal-user.schema.ts`

```typescript
export const CreatePortalAccessSchema = z.object({
  studentId: z.string().min(1),
  email:     z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
})

export const ResetPortalPasswordSchema = z.object({
  userId: z.string().min(1),
})
```

### `shared/schemas/contact.schema.ts`

```typescript
export const PublicContactSchema = z.object({
  nomeStudente: z.string().min(1).max(200),
  classeScuola: z.string().max(200).optional(),
  materie:      z.string().min(1).max(500),   // campo testo libero (es. "Matematica, Fisica")
  contatto:     z.string().min(1).max(200),   // telefono o email — campo unico
  note:         z.string().max(1000).optional(),
})
// Nessun endpoint backend — il form è solo lato client (validate + show success)
```

### Materie nel wizard prenotazione

Le materie vengono caricate dall'endpoint pubblico esistente che legge `system_configs`. Se non disponibile, il wizard usa una lista fallback hardcodata. Le materie sono le stesse del vecchio sistema: Matematica, Fisica, Chimica, Italiano, Inglese, Storia, Geografia, Latino, Greco + eventuali custom configurate.

---

## 5. Regole di business

### Creazione account portale

1. Admin apre `/studenti/[id]` → pannello "Accesso Portale"
2. Inserisce email + nome genitore → click "Crea accesso"
3. Sistema: genera password temporanea (8 char random), crea `users` con `role='GENITORE'`, aggiorna `students.portalUserId`
4. Admin comunica credenziali al genitore (telefono/email manuale — nessun invio automatico in questa fase)

### Reset password

- Admin clicca "Reimposta password" → genera nuova password temporanea → mostra a schermo (una sola volta)

### Prenotazione dal portale

1. Genitore accede a `/portale/prenota`
2. Se ha più figli: seleziona quale
3. Compila: data + materie + nota opzionale
4. Conferma: `POST /api/portal/bookings` → `status = 'PENDING'`
5. Admin vede il badge PENDING nel pannello della scheda studente
6. Admin Conferma → `status = 'CONFIRMED'`; Cancella → `status = 'CANCELLED'`

### Sessione GENITORE

La session include già `linkedStudentIds: string[]` (impostata al login in `login.post.ts`). Il service porta usa questo array per filtrare dati dello studente corretto.

### Middleware portal-only

File: `app/middleware/portal-only.ts`  
Logica: se `user.role !== 'GENITORE'` → redirect a `/`

---

## 6. Decisioni scartate

| Idea | Motivo |
|------|--------|
| Dashboard con dati in tempo reale | Rinviata a Sprint 2 — meglio stabile vuota che instabile con dati |
| Slot selection nel wizard | Non necessario — admin gestisce l'assegnazione manualmente |
| Invio email automatico credenziali | Troppa infrastruttura per questa fase — admin comunica manualmente |
| Auto-registrazione pubblica | Non in scope — solo su invito admin |
| Prenotazione pubblica (senza login) | Eliminata — form pubblico = solo richiesta di contatto |

---

## 7. Cosa NON è in scope (Fase 11)

- Dashboard portale con dati reali (Sprint 2)
- Calendario intelligente con evidenziazione disponibilità tutor (Fase 12)
- Bollettino settimanale email (Fase 12)
- Notifiche push o email alla conferma prenotazione (Fase 12)
