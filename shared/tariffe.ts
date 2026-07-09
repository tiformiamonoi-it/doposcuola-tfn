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
