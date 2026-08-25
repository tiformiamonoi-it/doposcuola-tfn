// Calcolo della data di scadenza di un pacchetto — regola unica condivisa.
// Prima era copiata identica in ModalCreaPacchetto.vue e in pacchetti/index.vue.
//
// Regola:
//   ORE / A_CONSUMO → 15 giugno successivo (l'anno scolastico finisce lì).
//                     Se si parte dopo il 15/06, si va al 15/06 dell'anno dopo.
//   MENSILE         → data di inizio + 30 giorni di calendario.
//
// Le date sono trattate come GIORNI CIVILI ('YYYY-MM-DD'), mai come istanti:
// tutti i conti usano UTC e poi si riformatta a mano. Con `new Date(...)` +
// `toISOString()` il risultato slittava di un giorno nei cambi di ora legale.

export type TipoPacchetto = 'ORE' | 'MENSILE' | 'A_CONSUMO'

function due(n: number): string {
  return String(n).padStart(2, '0')
}

export function calcolaDataScadenza(tipo: TipoPacchetto, dataInizio: string): string {
  const [annoStr, meseStr, giornoStr] = dataInizio.slice(0, 10).split('-')
  const anno   = Number(annoStr)
  const mese   = Number(meseStr)   // 1-12
  const giorno = Number(giornoStr) // 1-31

  if (!anno || !mese || !giorno) return ''

  if (tipo === 'ORE' || tipo === 'A_CONSUMO') {
    // Dopo il 15 giugno si punta al 15 giugno dell'anno successivo
    const annoScadenza = (mese > 6 || (mese === 6 && giorno > 15)) ? anno + 1 : anno
    return `${annoScadenza}-06-15`
  }

  // MENSILE: +30 giorni, con l'aritmetica di Date in UTC (niente fusi orari di mezzo)
  const d = new Date(Date.UTC(anno, mese - 1, giorno + 30))
  return `${d.getUTCFullYear()}-${due(d.getUTCMonth() + 1)}-${due(d.getUTCDate())}`
}

/** Anno del 15 giugno di scadenza, per le scritte di aiuto nei form. */
export function annoScadenzaOre(dataInizio: string): string {
  return calcolaDataScadenza('ORE', dataInizio).slice(0, 4)
}
