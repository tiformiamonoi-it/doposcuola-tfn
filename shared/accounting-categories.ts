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
export const CATEGORIE_SISTEMA = ['compenso_tutor', 'rimborso_tutor', 'pacchetti', 'rettifica', 'proventi_diversi', 'costi_proventi_diversi', 'bollo_incassato', 'bollo_da_versare', 'versamento_bolli'] as const

// Le tre categorie della marca da bollo (F1). Le scrive solo il codice, mai a mano:
// 'bollo_incassato'   → ENTRATA di 2 € pagata dal cliente (cassa vera)
// 'bollo_da_versare'  → DEBITO di 2 € verso lo Stato, in attesa dell'F24
// 'versamento_bolli'  → USCITA unica dell'F24, che chiude in blocco i bolli inclusi
export const CATEGORIE_BOLLO = ['bollo_incassato', 'bollo_da_versare', 'versamento_bolli']

// Coppia gemella dei "Proventi diversi" (+X entrata / -X uscita)
export const CATEGORIE_PROVENTI_DIVERSI = ['proventi_diversi', 'costi_proventi_diversi']

// I proventi diversi (movimenti, righe "+X" nelle card, voce nel form) sono riservati
// a questi account ADMIN. Confronto sempre in minuscolo.
export const EMAILS_PROVENTI_DIVERSI = ['info@tiformiamonoi.it', 'amministrazione@tiformiamonoi.it']

export const CATEGORIE_DEFAULT: Categoria[] = [
  { chiave: 'compenso_tutor', etichetta: 'Compenso Tutor',      neutra: false, sistema: true },
  { chiave: 'rimborso_tutor', etichetta: 'Rimborso Tutor',      neutra: false, sistema: true },
  { chiave: 'pacchetti',      etichetta: 'Pagamento Pacchetto', neutra: false, sistema: true },
  { chiave: 'rettifica',      etichetta: 'Rettifica',           neutra: false, sistema: true },
  // Coppia "Proventi diversi": +X in entrata e -X in uscita, margine invariato ma
  // entrate (e quindi tasse stimate) e fatturato aumentano. NON neutre di proposito.
  { chiave: 'proventi_diversi',       etichetta: 'Proventi diversi',           neutra: false, sistema: true },
  { chiave: 'costi_proventi_diversi', etichetta: 'Costi per proventi diversi', neutra: false, sistema: true },
  // Marca da bollo: i 2 € incassati sono cassa vera (entrano nel margine) e il
  // versamento F24 è l'uscita vera che li restituisce allo Stato. Sul giro completo
  // il margine torna a zero, quindi NON sono neutre: devono comparire nei conti.
  { chiave: 'bollo_incassato',  etichetta: 'Bollo incassato dal cliente', neutra: false, sistema: true },
  { chiave: 'bollo_da_versare', etichetta: 'Bollo da versare allo Stato', neutra: false, sistema: true },
  { chiave: 'versamento_bolli', etichetta: 'Versamento bolli (F24)',      neutra: false, sistema: true },
  { chiave: 'spese_generali', etichetta: 'Spese Generali',      neutra: false, sistema: false },
  { chiave: 'marketing',      etichetta: 'Marketing',           neutra: false, sistema: false },
  { chiave: 'giroconto',      etichetta: 'Giroconto',           neutra: true,  sistema: false },
  { chiave: 'saldo_iniziale', etichetta: 'Saldo Iniziale',      neutra: true,  sistema: false },
  { chiave: 'varie',          etichetta: 'Varie',               neutra: false, sistema: false },
]

// Chiavi delle categorie usate dal codice: si scrivono qui una volta sola, invece di
// ripetere la stringa in ogni servizio (un refuso lì passava inosservato).
export const CAT = {
  PACCHETTI:               'pacchetti',
  COMPENSO_TUTOR:          'compenso_tutor',
  RIMBORSO_TUTOR:          'rimborso_tutor',
  RETTIFICA:               'rettifica',
  PROVENTI_DIVERSI:        'proventi_diversi',
  COSTI_PROVENTI_DIVERSI:  'costi_proventi_diversi',
  MARKETING:               'marketing',
  SPESE_GENERALI:          'spese_generali',
  BOLLO_INCASSATO:         'bollo_incassato',
  BOLLO_DA_VERSARE:        'bollo_da_versare',
  VERSAMENTO_BOLLI:        'versamento_bolli',
} as const

/** Mappa chiave → etichetta, con fallback alla chiave grezza per categorie non in elenco. */
export function mappaEtichette(categorie: Categoria[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const c of categorie) m[c.chiave] = c.etichetta
  return m
}
