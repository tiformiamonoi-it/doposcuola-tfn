// I TUTOR vedono gli studenti (per fare lezione) ma NON i recapiti e i dati
// fiscali dei genitori: minimizzazione GDPR — quei dati servono solo alla segreteria.
// Restano visibili al tutor: dati dello studente (nome, classe, scuola, telefono),
// note e bisogni speciali (servono per la didattica) e il nome del genitore.
const CAMPI_GENITORE_RISERVATI = [
  'parentEmail', 'parentPhone', 'parentIndirizzo', 'parentCitta',
  'parentCap', 'parentCF', 'parentPIva',
] as const

export function sanitizeStudentForTutor<T extends Record<string, any>>(student: T): T {
  const copy: Record<string, any> = { ...student }
  for (const campo of CAMPI_GENITORE_RISERVATI) delete copy[campo]
  return copy as T
}
