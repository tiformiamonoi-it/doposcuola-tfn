// Controllo di calendario per le date-giorno 'AAAA-MM-GG'.
// Il solo formato non basta: "2026-04-31" e "2026-02-30" sono ben formati ma non
// esistono, e Postgres li rifiuta al salvataggio (errore 22008). Qui si verifica
// che il giorno esista davvero nel mese, con un giro di andata e ritorno in UTC
// (niente fuso orario di mezzo).
export function giornoCivileValido(giorno: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(giorno)
  if (!m) return false
  const anno = Number(m[1])
  const mese = Number(m[2])
  const g    = Number(m[3])
  const d = new Date(Date.UTC(anno, mese - 1, g))
  return d.getUTCFullYear() === anno && d.getUTCMonth() === mese - 1 && d.getUTCDate() === g
}
