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

// Giorno civile corrente in Italia (Europe/Rome), formato 'AAAA-MM-GG'.
//
// NON usare new Date().toISOString().slice(0,10): quella è la data UTC e tra
// mezzanotte e le ~2 di notte italiane restituisce ancora "ieri" — un compleanno
// controllato all'una di notte finirebbe nel giorno sbagliato.
//
// Vive qui, in shared/, perché serve identica al browser E al server (il
// campanellino delle notifiche calcola i compleanni lato server). `app/utils/format.ts`
// la ri-esporta, così nei template si continua a scrivere oggiISO() come sempre.
export function oggiISO(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date())
}

// Il giorno dopo, sempre come giorno civile 'AAAA-MM-GG'.
// I conti si fanno in UTC su una data senza ora: così il "domani" non cambia mai
// per colpa dell'ora legale (il 30 marzo dura 23 ore, il 26 ottobre ne dura 25 —
// sommare 24 ore a un orario sbaglierebbe proprio in quei due giorni).
export function giornoSuccessivo(giorno: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(giorno)
  if (!m) return giorno
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1))
  return d.toISOString().slice(0, 10)
}

// Anno bisestile secondo il calendario gregoriano (il 2000 sì, il 1900 no).
export function annoBisestile(anno: number): boolean {
  return (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0
}
