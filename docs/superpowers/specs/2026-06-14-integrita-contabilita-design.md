# Integrità Contabilità — Design Spec

**Data:** 14 Giugno 2026
**Stato:** Approvato dall'utente (decisioni chiave confermate)

## Obiettivo

Collegare in modo solido (foreign key, non testo) ogni pagamento alla sua scrittura contabile, e mantenere i due lati sempre allineati su modifica/eliminazione. Questa è la **Fase 1**, prerequisito per la **Fase 2 (import dati storici)**.

## Decisioni dell'utente (cristallizzate)

1. **Collegamento solido** (Opzione A) per: pagamenti studenti, compensi tutor, rimborsi tutor.
2. **Eliminazione vera** (non solo storno), MA:
   - Dalla **pagina Contabilità**: prima di eliminare un movimento → popup con due scelte: **"Elimina definitivamente"** oppure **"Crea storno"** (best practice, mantiene lo storico).
   - Dalla **scheda Studente / Tutor**: eliminazione **diretta** (con conferma "Sei sicuro?"), si ripercuote a cascata su contabilità e saldi.
3. **Modifica consentita SOLO sui movimenti inseriti manualmente** (Credito/Debito/Nota). I movimenti automatici (generati da pagamenti) non si modificano: per correggere → elimina e rifai.

## Modello dati

`accounting_entries` ottiene 3 collegamenti FK verso le sorgenti (uno valorizzato per riga, gli altri NULL):

| Colonna | Verso | Cardinalità | onDelete |
|---------|-------|-------------|----------|
| `paymentId` (già esiste) | `payments` | 1:1 (unique) | **cascade** (era set null) |
| `tutorPaymentId` (nuova) | `tutor_payments` | 1:1 (unique) | cascade |
| `reimbursementId` (nuova) | `tutor_reimbursements` | 1:N (no unique) | cascade |

Un movimento è **automatico** se ha almeno uno di questi tre valorizzato; **manuale** altrimenti.

`ON DELETE CASCADE` garantisce a livello DB: eliminata la sorgente → sparisce la scrittura contabile. Il verso opposto (elimino la scrittura → elimino la sorgente) è gestito in codice applicativo, perché richiede anche il ricalcolo dei saldi.

## Comportamenti

### Eliminazione

| Origine azione | Tipo movimento | Comportamento |
|----------------|----------------|---------------|
| Pagina Contabilità | Automatico | Popup: **Elimina** (cancella sorgente + scrittura + ricalcola saldi) oppure **Storno** (crea movimento opposto, mantiene tutto) |
| Pagina Contabilità | Manuale | Popup: **Elimina** (cancella la riga) oppure **Storno** |
| Scheda Studente | Pagamento studente | Eliminazione diretta (conferma) → scrittura contabile via cascade + pacchetto torna "da pagare" (stati ricalcolati) |
| Scheda Tutor | Compenso tutor | Eliminazione diretta → scrittura via cascade; il "pagato" del mese si riallinea (è calcolato a runtime) |
| Scheda Tutor | Rimborso (intero) | Eliminazione diretta → tutte le scritture collegate via cascade |
| Pagina Contabilità | Scrittura di un rimborso parziale | Elimina → riduce `importoPagato` del rimborso e ricalcola lo stato |

### Modifica

- **Movimenti manuali**: modifica completa (importo, descrizione, categoria, metodo, data).
- **Movimenti automatici**: modifica **bloccata** (UI: pulsante disabilitato; server: errore 403 "Modifica dal pagamento di origine"). Per correggere → elimina e rifai.

### Saldi ricalcolati all'eliminazione di un pagamento studente

`importoPagato -= importo`, `importoResiduo += importo` (clamp ≥ 0), poi `computePackageStates` per aggiornare gli stati (es. PAGATO → DA_PAGARE).

## Componenti da costruire

1. Schema + migrazione (2 colonne + cascade su paymentId).
2. Valorizzazione FK in `payTutor` e `payReimbursement` (createPayment già OK).
3. Service di eliminazione: `deletePayment`, `deleteTutorPayment`, `deleteReimbursement`, e `deleteAccountingEntry(mode)` "intelligente".
4. Service `updateAccountingEntry` (solo manuali).
5. API: DELETE pagamenti/compensi/rimborsi; DELETE+PUT scritture contabili.
6. API GET entries: esporre i 3 campi FK (o flag `isAuto`) per la UI.
7. UI: popup elimina/storno in Contabilità; modifica solo su manuali; pulsanti elimina nelle schede Studente e Tutor.

## Fuori scope (Fase 2)

Import dei dati storici dal vecchio database — riuserà le colonne FK appena create per rimettere i collegamenti originali al 100%.

## Nota fiscale (accettata dall'utente)

L'eliminazione definitiva rimuove la traccia storica del movimento. Lo storno resta disponibile come alternativa "a norma" nel popup della pagina Contabilità.
