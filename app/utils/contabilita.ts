// Etichette leggibili per metodi di pagamento e tipi di movimento.
// Le CATEGORIE sono ora dinamiche (gestite da Impostazioni → Categorie Contabili):
// vedi shared/accounting-categories.ts e /api/accounting/categories.

export const METODO_LABELS: Record<string, string> = {
  CONTANTI: 'Contanti',
  BONIFICO: 'Bonifico',
  POS:      'POS',
  ASSEGNO:  'Assegno',
  ALTRO:    'Altro',
}

export const TIPO_LABELS: Record<string, string> = {
  ENTRATA: 'Entrata',
  USCITA:  'Uscita',
  CREDITO: 'Credito',
  DEBITO:  'Debito',
  NOTA:    'Nota',
  STORNO:  'Storno',
}

export function labelMetodo(metodo: string | null | undefined): string {
  if (!metodo) return '—'
  return METODO_LABELS[metodo] ?? metodo
}

export function labelTipo(tipo: string | null | undefined): string {
  if (!tipo) return '—'
  return TIPO_LABELS[tipo] ?? tipo
}

// Metodi e tipi di pagamento — centralizzati per evitare duplicazioni
export const METODI_PAGAMENTO_ITEMS = [
  { label: 'Contanti', value: 'CONTANTI' },
  { label: 'Bonifico', value: 'BONIFICO' },
  { label: 'POS',      value: 'POS' },
  { label: 'Assegno',  value: 'ASSEGNO' },
]

export const TIPI_PAGAMENTO_ITEMS = [
  { label: 'Acconto',      value: 'ACCONTO' },
  { label: 'Saldo',        value: 'SALDO' },
  { label: 'Rata',         value: 'RATA' },
  { label: 'Integrazione', value: 'INTEGRAZIONE' },
]

// Colori badge stato pagamento tutor
export function coloreStatoPagamento(stato: string): string {
  switch (stato) {
    case 'PAGATO':      return 'success'
    case 'DA_PAGARE':   return 'warning'
    case 'PARZIALE':    return 'warning'
    case 'IN_ATTESA':   return 'neutral'
    case 'PRO_BONO':    return 'neutral'
    case 'RIFIUTATO':   return 'error'
    default:            return 'error'
  }
}

export function coloreStatoRimborso(stato: string): string {
  switch (stato) {
    case 'RIMBORSATO':  return 'success'
    case 'PAGATO':      return 'success'
    case 'DA_RIMBORSARE': return 'warning'
    case 'PARZIALE':    return 'warning'
    case 'RIFIUTATO':   return 'error'
    default:            return 'error'
  }
}
