// Creazione e scaricamento di file CSV apribili con Excel italiano.
// Tre accortezze che fanno la differenza quando il file si apre in Excel:
//  - separatore ';' (in Italia la virgola è il separatore dei decimali);
//  - ogni cella fra virgolette, con le " interne raddoppiate;
//  - BOM in testa al file, altrimenti le lettere accentate si vedono sbagliate.

/** Una cella: sempre fra virgolette, con le " raddoppiate. */
export const cellaCsv = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`

/** Intestazione + righe → testo del file CSV già pronto (BOM compreso). */
export function righeInCsv(intestazione: string[], righe: unknown[][]): string {
  const linee = [intestazione, ...righe].map((r) => r.map(cellaCsv).join(';'))
  // '﻿' = BOM
  return '﻿' + linee.join('\r\n')
}

/** Fa scaricare al browser un testo come file. */
export function scaricaCsv(nomeFile: string, contenuto: string): void {
  const blob = new Blob([contenuto], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeFile
  a.click()
  URL.revokeObjectURL(url)
}
