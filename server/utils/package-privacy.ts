// I TUTOR possono leggere i pacchetti (per verificare ore/giorni residui quando
// registrano una lezione) ma NON i dati economici dello studente.
const CAMPI_ECONOMICI = ['prezzoTotale', 'importoPagato', 'importoResiduo', 'recharges'] as const

export function isTutorRole(role: string | undefined): boolean {
  return role === 'TUTOR'
}

export function sanitizePackageForTutor<T extends Record<string, any>>(pkg: T): T {
  const copy: Record<string, any> = { ...pkg }
  for (const campo of CAMPI_ECONOMICI) delete copy[campo]
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
