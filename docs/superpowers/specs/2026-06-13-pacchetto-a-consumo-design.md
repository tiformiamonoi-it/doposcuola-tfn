# Design — Pacchetto "A Consumo" (crediti ricaricabili)

**Data:** 2026-06-13
**Stato:** Approvato dall'utente (brainstorming completato)
**Approccio scelto:** B — "Il libretto" (registro ricariche dedicato)

---

## 1. Obiettivo

Introdurre un terzo tipo di pacchetto, **`A_CONSUMO`**, accanto a `ORE` e `MENSILE`.
È un pacchetto orario **prepagato e ricaricabile**: le ore non si comprano in un unico
blocco fisso, ma si aggiungono progressivamente tramite "ricariche". Il prezzo di ogni
ricarica si calcola automaticamente da una **tariffa oraria**.

Metafora di riferimento: una **tessera prepagata** con un saldo (ore rimaste), una tariffa
(€/ora) e un libretto sul retro che elenca ogni ricarica.

## 2. Decisioni chiave (dal brainstorming)

| Tema | Decisione |
|---|---|
| Momento del pagamento | **Prepagato**: si paga al momento della ricarica (riusa il flusso "acconto" esistente) |
| Origine tariffa oraria | Dal **template Pacchetto Standard**, **modificabile per alunno** alla creazione, poi memorizzata sul pacchetto |
| Input ricarica | Si inseriscono le **ore** → il **totale** si calcola da solo (ore × tariffa); il totale resta **modificabile** manualmente |
| Storico | **Approccio B**: tabella dedicata `package_recharges` (libretto delle ricariche) |
| Scadenza | **Fissa al 15/06** come i pacchetti `ORE` (riusa `calcolaDataScadenza('ORE')`) |
| Consumo lezioni | **Invariato**: −1 ora a lezione, identico a `ORE` |
| Macchina a stati | **Invariata**: `ATTIVO`, `ESAURITO`, `DA_PAGARE`, `PAGATO`, ecc. |

## 3. Modello dati

### 3.1 Enum `packageTypeEnum`
Aggiungere il valore `A_CONSUMO`:
```
['ORE', 'MENSILE', 'A_CONSUMO']
```
Da aggiornare in:
- `server/database/schema.ts` (`packageTypeEnum`)
- `shared/schemas/package.schema.ts` (`PackageTypeEnum`)

### 3.2 Tabella `standard_packages` — nuova colonna
```
tariffaOraria  numeric(10,2)  NULL   -- valorizzata solo per i template A_CONSUMO
```
Per i template `A_CONSUMO`: `tariffaOraria` è il dato principale.
`oreIncluse` non è significativo (default `0`); `prezzoStandard` non usato (default `0`).

### 3.3 Tabella `packages` — nuova colonna
```
tariffaOraria  numeric(10,2)  NULL   -- valorizzata solo per i pacchetti A_CONSUMO
```
Copiata dal template alla creazione, ma modificabile per quell'alunno.
Le colonne esistenti vengono **riusate** e crescono ad ogni ricarica:
- `oreAcquistate` = somma di tutte le ore ricaricate
- `oreResiduo`    = ore ancora disponibili (scalate dalle lezioni)
- `prezzoTotale`  = somma dei totali di tutte le ricariche
- `importoPagato` / `importoResiduo` = invariati nella semantica

### 3.4 Nuova tabella `package_recharges` (il "libretto")
```
id             text PK (cuid)
packageId      text NOT NULL  → packages.id (onDelete: cascade)
ore            numeric(10,2) NOT NULL        -- ore aggiunte in questa ricarica
tariffaOraria  numeric(10,2) NOT NULL        -- snapshot della tariffa al momento
importo        numeric(10,2) NOT NULL        -- totale (ore × tariffa, o sovrascritto)
data           timestamp NOT NULL default now()
paymentId      text NULL → payments.id (onDelete: set null)  -- pagamento collegato
note           text NULL
createdAt      timestamp NOT NULL default now()
```
Indici: `index('recharges_package_idx').on(packageId, data)`.
Relazione Drizzle: `packages` → `many(packageRecharges)`; `packageRecharges` → `one(package)`, `one(payment)`.

## 4. Flussi

### 4.1 Creazione di un pacchetto A_CONSUMO
1. In Nuovo Pacchetto: Tipo → "A consumo (crediti)".
2. Scelta template standard A_CONSUMO → `tariffaOraria` precompilata, modificabile.
3. Inserimento **ore iniziali** → **totale** automatico = `ore × tariffa`, modificabile.
4. Salvataggio:
   - crea `packages` con `tipo='A_CONSUMO'`, `tariffaOraria`, `oreAcquistate=ore`,
     `oreResiduo=ore`, `prezzoTotale=totale`, `dataScadenza=15/06` (anno scolastico corrente);
   - crea la **prima riga** in `package_recharges`;
   - registra il pagamento iniziale tramite il flusso esistente (opzionale ma tipico, prepagato).

### 4.2 Ricarica di un pacchetto esistente
1. Pulsante "Ricarica" sul pacchetto A_CONSUMO (lista pacchetti e scheda studente).
2. Inserimento **ore** → **totale** automatico con `package.tariffaOraria`, modificabile.
3. Salvataggio (transazione):
   - `oreAcquistate += ore`, `oreResiduo += ore`, `prezzoTotale += importo`;
   - ricalcolo `importoResiduo` e degli stati (`computePackageStates`);
   - inserimento riga in `package_recharges`;
   - **pagamento condizionale**: se nel form viene indicato un `metodoPagamento`, si registra
     subito un pagamento pari a `importo` (riusa `payment.service`) e lo si collega via `paymentId`;
     altrimenti la ricarica aumenta solo `prezzoTotale` e il pacchetto resta `DA_PAGARE`.
     (Modello prepagato come default, ma flessibile.)

### 4.3 Consumo (lezioni)
Nessuna modifica. Il consumo di `oreResiduo` per `A_CONSUMO` segue la stessa logica di `ORE`
già implementata in `lesson.service`. (Verifica: la logica non deve avere rami `if tipo==='ORE'`
che escludano `A_CONSUMO`; in caso, trattare `A_CONSUMO` come `ORE`.)

## 5. Macchina a stati e scadenza

- Stati riusati senza modifiche. `ESAURITO` quando `oreResiduo = 0` → invito a ricaricare.
- `DA_PAGARE` / `PAGATO` in base a `importoResiduo`, come oggi.
- Scadenza `15/06` (anno scolastico corrente) calcolata come per `ORE`.
- `computePackageStates` non richiede modifiche: opera su `oreResiduo`, `oreAcquistate`,
  `importoResiduo`, `dataScadenza`, che restano validi anche per `A_CONSUMO`.

## 6. API

### 6.1 Modifiche a endpoint esistenti
- `POST /api/standard-packages`: accetta `tipo='A_CONSUMO'` e `tariffaOraria`.
- `POST /api/packages`: accetta `tipo='A_CONSUMO'` + `tariffaOraria`; alla creazione genera
  la prima riga `package_recharges` (più eventuale pagamento iniziale).
- `GET /api/packages/:id`: include l'elenco `recharges` (libretto) nel payload.
- `GET /api/packages` (lista): includere `tariffaOraria` nei campi restituiti.

### 6.2 Nuovo endpoint
- `POST /api/packages/:id/recharge` — body: `{ ore, importo, data?, richiedeFattura?, metodoPagamento?, note? }`.
  Esegue il Flusso 4.2 in transazione. Restituisce il pacchetto aggiornato.

## 7. Validazione (Zod, `shared/schemas/package.schema.ts`)

- `PackageTypeEnum` → aggiungere `A_CONSUMO`.
- `CreatePackageSchema`:
  - `tariffaOraria`: `number().positive().max(9999)` — **obbligatoria se `tipo==='A_CONSUMO'`** (via `superRefine`).
  - per `A_CONSUMO`, `oreAcquistate` rappresenta le ore iniziali; `prezzoTotale` è il totale (derivato ma inviato).
- Nuovo `RechargePackageSchema`:
  ```
  ore: number().positive().max(9999)
  importo: number().nonnegative().max(99999)
  tariffaOraria: number().positive().max(9999).optional()  // snapshot opzionale; default = tariffa del pacchetto
  data: coerce.date().default(now)
  pagamentoIniziale: z.object({
    importo: z.number().nonnegative().max(99999),
    metodoPagamento: PaymentMethodEnum,
    data: z.coerce.date(),
    richiedeFattura: z.boolean().default(false)
  }).optional()
  note: string().max(500).optional()
  ```
- `standard-packages` (validazione inline nel POST): aggiungere `tariffaOraria` opzionale,
  obbligatoria se `tipo==='A_CONSUMO'`.

## 8. Interfaccia utente

1. **Impostazioni → Pacchetti Standard**: Tipo "A consumo" mostra il campo **Tariffa oraria**
   al posto di ore/prezzo. (`app/pages/impostazioni/index.vue`)
2. **Nuovo Pacchetto** (`app/pages/pacchetti/index.vue`): terza voce Tipo "A consumo (crediti)".
   Campi: tariffa oraria (precompilata, modificabile), ore iniziali, totale (auto, modificabile).
   Scadenza 15/06 (riusa `calcolaDataScadenza`/`aggiornaDatiScadenza`).
3. **Lista pacchetti + Scheda studente** (`app/pages/pacchetti/index.vue`, `app/pages/studenti/[id].vue`):
   - azione **"Ricarica"** per i pacchetti `A_CONSUMO` → modale ricarica globale (`app/components/ModalRicaricaPacchetto.vue`);
   - **libretto delle ricariche** (data · ore · totale) in un modale globale dedicato (`app/components/ModalLibrettoRicariche.vue`);
   - azione **"Registra pagamento"** condivisa tramite `app/components/ModalPagamentoPacchetto.vue`.
4. **Evidenza Esaurito e Pagamenti**: badge/avviso "Ricarica" sui pacchetti `A_CONSUMO` esauriti, e badge "Da PAGARE" che diventa grigio (neutro) se >90% delle ore sono rimanenti.

## 9. Componenti coinvolti (riepilogo file)

| Area | File |
|---|---|
| Schema DB | `server/database/schema.ts` (+ migrazione Drizzle) |
| Schema Zod | `shared/schemas/package.schema.ts` |
| Service | `server/services/package.service.ts` (creazione + ricarica in transazione) |
| API | `server/api/packages/index.post.ts`, nuovo `server/api/packages/[id]/recharge.post.ts`, `server/api/packages/[id].get.ts`, `server/api/standard-packages/index.post.ts`, `index.get.ts` |
| UI | `app/pages/pacchetti/index.vue`, `app/pages/studenti/[id].vue`, `app/pages/impostazioni/index.vue` |

## 10. Test manuali (no test automatici — da CLAUDE.md)

1. Impostazioni → crea template "A consumo Medie" con tariffa 15 €/ora.
2. Nuovo Pacchetto → Tipo "A consumo" → scegli il template → tariffa = 15 (modificala a 13).
3. Ore iniziali 10 → totale = 130 €; sovrascrivi a 120 € → si salva 120 €.
4. Scheda studente → il pacchetto mostra 10 ore e una riga nel libretto.
5. "Ricarica" 10 ore → totale 130 €; salva → ore rimaste 20, prezzo totale 250 €, due righe nel libretto.
6. Registra una lezione per quell'alunno → ore rimaste 19.
7. Porta le ore a 0 → stato "Esaurito" con invito a ricaricare.
8. Scadenza del pacchetto = 15/06 dell'anno scolastico corrente.

## 11. Fuori scopo (YAGNI)

- Ricariche in euro con ore calcolate (si è scelto ore→totale; il totale modificabile copre i prezzi tondi).
- Scadenza dinamica o congelamento ore (si è scelta scadenza fissa 15/06).
- Tariffa globale o report di redditività per tariffa.
