// I TUTOR possono leggere i pacchetti (per verificare ore/giorni residui quando
// registrano una lezione) ma NON i dati economici dello studente.
// Elenco dei campi AMMESSI, non di quelli esclusi: una colonna economica aggiunta
// domani al pacchetto (come è successo con tariffaOraria) resta nascosta da sola.
const CAMPI_TUTOR = [
  'id', 'studentId', 'standardPackageId', 'nome', 'tipo',
  'oreAcquistate', 'oreResiduo', 'orePerse',
  'giorniAcquistati', 'giorniResiduo', 'orarioGiornaliero',
  'dataInizio', 'dataScadenza', 'stati', 'sospeso', 'note',
  'createdAt', 'updatedAt', 'studentFirstName', 'studentLastName',
] as const

// Stati che raccontano i pagamenti: il tutor non li vede e non può filtrarci sopra
export const STATI_ECONOMICI = ['DA_PAGARE', 'PAGATO']

export function isTutorRole(role: string | undefined): boolean {
  return role === 'TUTOR'
}

export function sanitizePackageForTutor<T extends Record<string, any>>(pkg: T): T {
  const copy: Record<string, any> = {}
  for (const campo of CAMPI_TUTOR) if (campo in pkg) copy[campo] = pkg[campo]
  if (Array.isArray(copy.stati)) copy.stati = copy.stati.filter((s: string) => !STATI_ECONOMICI.includes(s))
  return copy as T
}

// Lezione vista da un TUTOR: il tutor inserisce lezioni ma non vede soldi → via il
// compenso (anche quello forzato e chi l'ha forzato) e i dati economici del pacchetto
// annidato (le ore restano).
export function sanitizeLessonForTutor<T extends Record<string, any> | undefined>(lesson: T): T {
  if (!lesson) return lesson
  const { compensoTutor: _compenso, compensoForzato: _forzato, compensoForzatoDa: _forzatoDa, ...copy } = lesson as Record<string, any>
  if (Array.isArray(copy.lessonStudents)) {
    copy.lessonStudents = copy.lessonStudents.map((ls: any) =>
      ls.package ? { ...ls, package: sanitizePackageForTutor(ls.package) } : ls)
  }
  return copy as T
}
