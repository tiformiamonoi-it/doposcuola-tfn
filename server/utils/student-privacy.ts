// I TUTOR vedono gli studenti (per fare lezione) ma NON i recapiti e i dati
// fiscali dei genitori: minimizzazione GDPR — quei dati servono solo alla segreteria.
// Restano visibili al tutor: dati dello studente (nome, classe, scuola, telefono),
// note e bisogni speciali (servono per la didattica) e il nome del genitore.
//
// Vale per TUTTI E DUE i genitori/tutori dell'anagrafica: se una colonna parent2*
// non è in questo elenco, il tutor si ritrova sotto gli occhi telefono, email e
// codice fiscale del secondo genitore. Ogni campo aggiunto al primo genitore va
// aggiunto anche al secondo, e viceversa.
//
// Il NOME (parentName / parent2Name) resta invece visibile di proposito: al tutor
// serve sapere con chi sta parlando quando un genitore si presenta a prendere
// l'alunno. Stesso trattamento per la parentela ("Madre", "Padre"), che senza il
// nome non identifica nessuno. La data di nascita del genitore no: non serve alla
// didattica, quindi non si mostra.
const CAMPI_GENITORE_RISERVATI = [
  'parentEmail', 'parentPhone', 'parentIndirizzo', 'parentCitta',
  'parentCap', 'parentCF', 'parentPIva',
  'parent2Email', 'parent2Phone', 'parent2Indirizzo', 'parent2Citta',
  'parent2Cap', 'parent2CF', 'parent2PIva', 'parent2DataNascita',
] as const

export function sanitizeStudentForTutor<T extends Record<string, any>>(student: T): T {
  const copy: Record<string, any> = { ...student }
  for (const campo of CAMPI_GENITORE_RISERVATI) delete copy[campo]
  return copy as T
}
