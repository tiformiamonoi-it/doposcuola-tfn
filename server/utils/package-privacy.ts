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
