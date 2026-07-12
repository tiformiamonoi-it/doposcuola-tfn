// Tariffe lezione — UNICA FONTE per server (calcolo autoritativo) e frontend (anteprime).
// Le tariffe piene sono configurabili dall'admin (system_configs → tariffe_tutor);
// questi valori sono solo il fallback quando la configurazione manca.
export type TipoLezione = 'SINGOLA' | 'GRUPPO' | 'MAXI'

export const TARIFFE_DEFAULT: Record<TipoLezione, number> = {
  SINGOLA: 5.00,
  GRUPPO:  8.00,
  MAXI:    8.50,
}

// Tariffe per le mezze lezioni: arrotondate per difetto (NON semplice tariffa/2).
// La mezza MAXI = €4,00, non €4,25 — regola di business confermata dall'utente.
// Hardcoded in quanto regola di business, non configurabile dall'admin.
export const TARIFFE_MEZZA: Record<TipoLezione, number> = {
  SINGOLA: 2.50,
  GRUPPO:  4.00,
  MAXI:    4.00,
}

// Supplemento per materia speciale prenotata fuori dalla sua giornata prefissata
// (€/giornata). Diventa un aumento del pacchetto solo dopo l'OK di ADMIN/SUPER_TUTOR.
export const SUPPLEMENTO_SPECIALE = 10.00

// Ricavo orario di un pacchetto — FORMULA UNICA (prima esisteva in 3 versioni divergenti):
// valore dell'ora = prezzo totale ÷ ore acquistate; se le ore non sono note si ripiega
// sulla tariffa oraria. Le ricariche aumentano sia prezzo che ore → tariffa "blended" stabile.
// Ogni query SQL che replica questo calcolo deve usare la stessa precedenza.
export function ricavoOrarioPacchetto(prezzoTotale: number, oreAcquistate: number, tariffaOraria?: number | null): number {
  return oreAcquistate > 0 ? prezzoTotale / oreAcquistate : (tariffaOraria ?? 0)
}
