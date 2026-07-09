// Categorie contabili — definizione condivisa (server + client).
// La lista "viva" è salvata in system_configs[key='categorie_contabili'] come JSON,
// modificabile da Impostazioni. Questa è solo la lista di partenza (seed) + i tipi.

export type Categoria = {
  chiave:    string   // identificativo stabile salvato sui movimenti (non cambia mai)
  etichetta: string   // nome visualizzato (modificabile)
  neutra:    boolean  // true = esclusa dal calcolo del margine (giroconti, saldo iniziale…)
  sistema:   boolean  // true = scritta in automatico dal sistema → bloccata (no modifica/elimina)
}

// Categorie che il codice scrive da solo (pagamenti, compensi, rimborsi, rettifiche).
// Vanno protette: non modificabili e non eliminabili.
export const CATEGORIE_SISTEMA = ['compenso_tutor', 'rimborso_tutor', 'pacchetti', 'rettifica'] as const

export const CATEGORIE_DEFAULT: Categoria[] = [
  { chiave: 'compenso_tutor', etichetta: 'Compenso Tutor',      neutra: false, sistema: true },
  { chiave: 'rimborso_tutor', etichetta: 'Rimborso Tutor',      neutra: false, sistema: true },
  { chiave: 'pacchetti',      etichetta: 'Pagamento Pacchetto', neutra: false, sistema: true },
  { chiave: 'rettifica',      etichetta: 'Rettifica',           neutra: false, sistema: true },
  { chiave: 'spese_generali', etichetta: 'Spese Generali',      neutra: false, sistema: false },
  { chiave: 'marketing',      etichetta: 'Marketing',           neutra: false, sistema: false },
  { chiave: 'giroconto',      etichetta: 'Giroconto',           neutra: true,  sistema: false },
  { chiave: 'saldo_iniziale', etichetta: 'Saldo Iniziale',      neutra: true,  sistema: false },
  { chiave: 'varie',          etichetta: 'Varie',               neutra: false, sistema: false },
]

/** Mappa chiave → etichetta, con fallback alla chiave grezza per categorie non in elenco. */
export function mappaEtichette(categorie: Categoria[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const c of categorie) m[c.chiave] = c.etichetta
  return m
}
