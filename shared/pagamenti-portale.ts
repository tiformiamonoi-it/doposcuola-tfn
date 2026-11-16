// PAGAMENTI NEL PORTALE (piano del 16/11/2026, sezione C): le righe di system_configs.
//
// Le leggono la pagina Impostazioni (per disegnare il modulo) e il server (per
// rispondere al portale): scritte una volta sola, come gli interruttori delle email.
//
// L'interruttore nasce SPENTO, con la stessa regola "spento-di-base" degli avvisi
// pacchetto (interruttoreAcceso in shared/email.ts): finché nessuno salva "true",
// nel portale la sezione dice solo "In arrivo" e il server non manda nessun dato.
export const INTERRUTTORE_PAGAMENTI_PORTALE = { chiave: 'pagamenti_portale_attivi', seAssente: false } as const
export const CHIAVE_BONIFICO_INTESTATARIO = 'bonifico_intestatario'
export const CHIAVE_BONIFICO_IBAN = 'bonifico_iban'
