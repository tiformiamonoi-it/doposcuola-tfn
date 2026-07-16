// shared/fattura.ts
// Numero+data fattura non hanno colonne dedicate: vivono come suffisso testuale
// in coda alla descrizione del movimento. Qui il formato è definito una volta sola.

// Pattern del suffisso, ancorato in fondo alla stringa: " — Fatt. n. <num> del gg/mm/aaaa"
const RE_SUFFISSO = /\s*—\s*Fatt\.\s*n\.\s*.+?\s+del\s+\d{2}\/\d{2}\/\d{4}\s*$/

// 'YYYY-MM-DD' → 'gg/mm/aaaa' con split puro (niente fuso orario)
function formattaData(dataISO: string): string {
  const [y, m, d] = dataISO.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function suffissoFattura(numero: string, dataISO: string): string {
  return ` — Fatt. n. ${numero.trim()} del ${formattaData(dataISO)}`
}

export function rimuoviSuffissoFattura(descrizione: string): string {
  return descrizione.replace(RE_SUFFISSO, '')
}

// Accoda il suffisso, rimuovendo prima un eventuale suffisso già presente (no doppioni)
export function conFattura(descrizione: string, numero: string, dataISO: string): string {
  return rimuoviSuffissoFattura(descrizione) + suffissoFattura(numero, dataISO)
}
