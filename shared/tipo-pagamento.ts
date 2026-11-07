// Tipo di un pagamento di pacchetto — regola unica per browser e server.
// Prima c'erano tre versioni (finestra "Registra pagamento", scheda pacchetto,
// integrazione dell'upgrade sul server) e la stessa cifra poteva prendere nomi diversi.
//
//   copre tutto il residuo   → SALDO
//   è il primo pagamento     → ACCONTO
//   c'era già un saldo       → INTEGRAZIONE (pacchetto ampliato dopo essere stato saldato)
//   altrimenti               → RATA
//
// L'ordine è quello del server (upgrade): un importo che chiude il debito è sempre un saldo.

import { copre } from './arrotondamenti'

export type TipoPagamento = 'ACCONTO' | 'SALDO' | 'RATA' | 'INTEGRAZIONE'

export function calcolaTipoPagamento(p: {
  importo: number
  residuo: number
  primoPagamento: boolean
  giaSaldato: boolean
}): TipoPagamento {
  // Al centesimo, senza tolleranza: 99,99 su 100 è una rata, non un saldo
  if (copre(p.importo, p.residuo)) return 'SALDO'
  if (p.primoPagamento) return 'ACCONTO'
  if (p.giaSaldato) return 'INTEGRAZIONE'
  return 'RATA'
}

// MODIFICA di un pagamento già registrato: "primo" e "già saldato" si guardano sugli
// ALTRI pagamenti fatti fino alla sua data. `residuo` è quello che resterebbe senza
// questo pagamento.
export function calcolaTipoPagamentoInModifica(
  storico: { id: string, dataPagamento: string | Date, tipoPagamento: string }[],
  id: string,
  importo: number,
  residuo: number,
): TipoPagamento {
  const originale = storico.find(p => p.id === id)
  const finoA = new Date(originale?.dataPagamento || new Date())
  const precedenti = storico.filter(p => p.id !== id && new Date(p.dataPagamento) <= finoA)
  return calcolaTipoPagamento({
    importo,
    residuo,
    primoPagamento: precedenti.length === 0,
    giaSaldato: precedenti.some(p => p.tipoPagamento === 'SALDO' || p.tipoPagamento === 'INTEGRAZIONE'),
  })
}

// Il tipo scelto a mano torna con l'importo? Il saldo deve coprire il residuo,
// e ciò che copre il residuo dev'essere un saldo.
export function tipoPagamentoCoerente(tipo: string, importo: number, residuo: number): boolean {
  return (tipo === 'SALDO') === copre(importo, residuo)
}
