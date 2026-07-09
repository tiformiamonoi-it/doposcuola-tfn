// Finestra di tempo in cui un TUTOR può inserire/modificare/cancellare le proprie lezioni:
// solo per la data odierna, solo fino alle 20:00, orario Europe/Rome (calcolato lato server
// per evitare che l'orologio del browser/telefono del tutor possa essere usato per forzare il limite).

const CUTOFF_HOUR = 20

function romeParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit',
    hour:  '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0'
  return {
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    hour:    parseInt(get('hour'), 10),
  }
}

export function isOggiRome(dateStr: string): boolean {
  return romeParts(new Date()).dateStr === dateStr
}

export function entroOrarioLimiteRome(): boolean {
  return romeParts(new Date()).hour < CUTOFF_HOUR
}

// Vero se un TUTOR può agire ora su una lezione con questa data (stringa "YYYY-MM-DD" o Date).
export function tutorPuoModificareOggi(data: string | Date): boolean {
  const dateStr = typeof data === 'string' ? data.substring(0, 10) : data.toISOString().substring(0, 10)
  return isOggiRome(dateStr) && entroOrarioLimiteRome()
}

// Confini (in UTC) della giornata civile odierna a Roma — usati per filtrare query SQL
// su colonne timestamptz senza incorrere nello sfasamento di fuso orario (CET/CEST)
// che ha già causato bug di importazione/visualizzazione in questo progetto.
function romeOffsetMinutes(date: Date): number {
  const utcMillis  = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()
  const romeMillis = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Rome' })).getTime()
  return Math.round((romeMillis - utcMillis) / 60000)
}

export function confiniGiornoOggiRome(): { start: Date; end: Date } {
  const now = new Date()
  const offsetMin = romeOffsetMinutes(now)
  const [y, m, d] = romeParts(now).dateStr.split('-').map(Number) as [number, number, number]

  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)    - offsetMin * 60000)
  const end   = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - offsetMin * 60000)
  return { start, end }
}
