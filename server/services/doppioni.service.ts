import { or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../database/client'
import { students } from '../database/schema'
import { nomeConfrontabile, telefonoConfrontabile } from '#shared/genitori'
import {
  MAX_DOPPIONI, emailConfrontabile, parentelaSeScritta, punteggioDoppione,
} from '#shared/doppioni'
import type { AlunnoSimile, MotivoDoppione, RecapitoCombaciato, RisultatoDoppioni } from '#shared/doppioni'

// "QUESTO RAGAZZO È GIÀ IN ARCHIVIO?" (D3)
//
// Qui non si scrive niente: si LEGGONO gli alunni che ci sono e si dice quali
// somigliano a quello che si sta creando, e perché. Il perché è metà del lavoro:
// un avviso che dice solo "forse è un doppione" viene ignorato al terzo giro,
// mentre "stesso numero della madre di Luca" fa fermare davvero.
//
// I criteri sono tre, e sono quelli già in uso altrove nel gestionale:
//   • nome e cognome normalizzati (shared/genitori, come la ricerca dei genitori);
//   • telefono con le ultime 8 cifre e conferma sul numero intero (identico alla
//     ricerca doppioni dei Contatti, contact.service.ts → findDuplicates);
//   • email in minuscolo senza spazi.
// Riusati apposta invece di riscritti: se un domani si decide che due numeri si
// somigliano in un altro modo, quel cambiamento deve valere dappertutto insieme.
//
// Convenzione di progetto: gli errori di dominio sono `new Error('messaggio in
// italiano')`; gli handler li traducono in errori HTTP.

/** Cosa si sta per creare: nome, cognome e i recapiti che si conoscono */
export interface RicercaDoppioni {
  firstName?: string | null
  lastName?: string | null
  /** Uno o più telefoni (genitore, secondo genitore, alunno): basta che uno combaci */
  telefoni?: (string | null | undefined)[]
  emails?: (string | null | undefined)[]
}

// Quante schede si leggono al massimo dal database prima di scegliere le migliori.
// Larghe abbastanza da non tagliare fuori nessuno (un cognome diffuso più il
// numero di casa condiviso da due fratelli non arriva neanche vicino a 40), basse
// abbastanza da restare una domanda istantanea.
const LIMITE_SCHEDE = 40

// Le sole cifre di una colonna telefono: nel database i numeri stanno in formato
// libero ("333 12 34 567", "+39 333…"), quindi si confrontano le cifre, non il testo.
// Stessa identica funzione di contact.service.ts e genitori.service.ts.
const soloCifre = (colonna: unknown) => sql`regexp_replace(coalesce(${colonna}, ''), '[^0-9]', '', 'g')`

// Il nome ridotto all'osso DAL LATO DATABASE: minuscole, accenti italiani tolti,
// spazi doppi schiacciati. È il gemello in SQL di `nomeConfrontabile`
// (shared/genitori.ts), e serve solo a farsi dare dal database i CANDIDATI: la
// parola definitiva la dice comunque il confronto in TypeScript qui sotto, che
// resta l'unico criterio vero e sta scritto in un posto solo.
const nomeNormalizzato = (colonna: unknown) => sql`regexp_replace(
  translate(lower(trim(coalesce(${colonna}, ''))), 'àáâäãåèéêëìíîïòóôöõùúûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'),
  '[[:space:]]+', ' ', 'g')`

const ugualeNome   = (colonna: unknown, valore: string) => sql`${nomeNormalizzato(colonna)} = ${valore}`
const ugualeEmail  = (colonna: unknown, valore: string) => sql`lower(trim(coalesce(${colonna}, ''))) = ${valore}`
const codaTelefono = (colonna: unknown, coda: string) => sql`${soloCifre(colonna)} LIKE ${'%' + coda}`

// Le colonne che servono: chi è l'alunno e i recapiti della sua famiglia. Mai la
// riga intera — note e bisogni speciali non c'entrano con un controllo doppioni.
const COLONNE = {
  id:        students.id,
  firstName: students.firstName,
  lastName:  students.lastName,
  classe:    students.classe,
  active:    students.active,
  parentName:      students.parentName,
  parentRelazione: students.parentRelazione,
  parentPhone:     students.parentPhone,
  parentEmail:     students.parentEmail,
  parent2Name:      students.parent2Name,
  parent2Relazione: students.parent2Relazione,
  parent2Phone:     students.parent2Phone,
  parent2Email:     students.parent2Email,
  studentPhone: students.studentPhone,
  studentEmail: students.studentEmail,
}
type Scheda = Pick<typeof students.$inferSelect, keyof typeof COLONNE>

// I posti in cui può stare un recapito su una scheda. Elencarli una volta sola
// evita il difetto classico di questi controlli: si aggiunge una colonna (il
// secondo genitore, per dire) e ci si ricorda di cercarla in due punti su tre.
interface PostoRecapito {
  tipo: 'telefono' | 'email'
  di: 'genitore' | 'alunno'
  colonna: unknown
  valore: (s: Scheda) => string | null
  intestatario: (s: Scheda) => string | null
  parentela: (s: Scheda) => string | null
}

const NESSUNO = () => null

const POSTI: PostoRecapito[] = [
  {
    tipo: 'telefono', di: 'genitore', colonna: students.parentPhone,
    valore: (s) => s.parentPhone, intestatario: (s) => s.parentName,
    parentela: (s) => parentelaSeScritta(s.parentRelazione),
  },
  {
    // Il secondo genitore è un genitore come il primo: il suo numero identifica
    // la stessa famiglia, e da quando esiste (voce C5) quelle colonne sono piene.
    tipo: 'telefono', di: 'genitore', colonna: students.parent2Phone,
    valore: (s) => s.parent2Phone, intestatario: (s) => s.parent2Name,
    parentela: (s) => parentelaSeScritta(s.parent2Relazione),
  },
  {
    tipo: 'telefono', di: 'alunno', colonna: students.studentPhone,
    valore: (s) => s.studentPhone, intestatario: NESSUNO, parentela: NESSUNO,
  },
  {
    tipo: 'email', di: 'genitore', colonna: students.parentEmail,
    valore: (s) => s.parentEmail, intestatario: (s) => s.parentName,
    parentela: (s) => parentelaSeScritta(s.parentRelazione),
  },
  {
    tipo: 'email', di: 'genitore', colonna: students.parent2Email,
    valore: (s) => s.parent2Email, intestatario: (s) => s.parent2Name,
    parentela: (s) => parentelaSeScritta(s.parent2Relazione),
  },
  {
    tipo: 'email', di: 'alunno', colonna: students.studentEmail,
    valore: (s) => s.studentEmail, intestatario: NESSUNO, parentela: NESSUNO,
  },
]

const unici = (valori: string[]) => [...new Set(valori.filter(Boolean))]

/**
 * Gli alunni già in archivio che somigliano a quello descritto in `input`, con
 * il motivo di ciascuno e i recapiti che hanno combaciato.
 *
 * Ci sono anche gli alunni NON attivi, segnalati come tali: un ex alunno che
 * torna è proprio il caso in cui il doppione nasce più facilmente, perché la sua
 * scheda dagli elenchi normali non si vede.
 *
 * Non trova nulla e NON interroga il database se non arriva né un nome completo
 * (nome *e* cognome) né un recapito: cercare "tutti i Rossi" o "tutti quelli
 * senza telefono" non è un controllo, è un elenco a caso.
 */
export async function cercaAlunniSimili(input: RicercaDoppioni): Promise<RisultatoDoppioni> {
  const nome    = nomeConfrontabile(input.firstName)
  const cognome = nomeConfrontabile(input.lastName)
  // `telefonoConfrontabile` scarta da solo i numeri troppo corti per identificare
  // qualcuno (interni, refusi): due refusi uguali non devono far somigliare due alunni.
  const telefoni = unici((input.telefoni ?? []).map((t) => telefonoConfrontabile(t)))
  const emails   = unici((input.emails ?? []).map((e) => emailConfrontabile(e)))

  const cercaNome = Boolean(nome && cognome)
  if (!cercaNome && telefoni.length === 0 && emails.length === 0) return { alunni: [] }

  const condizioni: (SQL | undefined)[] = []

  if (cercaNome) {
    condizioni.push(sql`(${ugualeNome(students.firstName, nome)} AND ${ugualeNome(students.lastName, cognome)})`)
    // Nome e cognome invertiti: "Rossi Luca" scritto al contrario è lo stesso
    // ragazzo, e nei moduli compilati di fretta succede di continuo.
    if (nome !== cognome) {
      condizioni.push(sql`(${ugualeNome(students.firstName, cognome)} AND ${ugualeNome(students.lastName, nome)})`)
    }
  }

  // Ultime 8 cifre in SQL, numero intero confermato dopo: è il criterio dei Contatti.
  for (const t of telefoni) {
    const coda = t.replace(/\D/g, '').slice(-8)
    for (const posto of POSTI) {
      if (posto.tipo === 'telefono') condizioni.push(codaTelefono(posto.colonna, coda))
    }
  }
  for (const e of emails) {
    for (const posto of POSTI) {
      if (posto.tipo === 'email') condizioni.push(ugualeEmail(posto.colonna, e))
    }
  }

  const candidati = await db.select(COLONNE).from(students).where(or(...condizioni)).limit(LIMITE_SCHEDE)

  const alunni: AlunnoSimile[] = []

  for (const s of candidati) {
    const motivi: MotivoDoppione[] = []
    const recapiti: RecapitoCombaciato[] = []

    // Il nome: confronto normalizzato, nei due versi. Vale solo se si conoscono
    // sia il nome sia il cognome (un cognome da solo non dice niente).
    const suoNome    = nomeConfrontabile(s.firstName)
    const suoCognome = nomeConfrontabile(s.lastName)
    if (cercaNome && ((suoNome === nome && suoCognome === cognome) || (suoNome === cognome && suoCognome === nome))) {
      motivi.push('nome')
    }

    for (const posto of POSTI) {
      const grezzo = posto.valore(s)
      if (!grezzo) continue

      const combacia = posto.tipo === 'telefono'
        // Conferma sul numero INTERO normalizzato: le ultime 8 cifre servono solo
        // a farsi dare i candidati dal database, non a decidere.
        ? telefoni.includes(telefonoConfrontabile(grezzo))
        : emails.includes(emailConfrontabile(grezzo))
      if (!combacia) continue

      if (!motivi.includes(posto.tipo)) motivi.push(posto.tipo)
      recapiti.push({
        tipo: posto.tipo,
        di: posto.di,
        intestatario: posto.intestatario(s),
        parentela: posto.parentela(s),
        valore: grezzo,
      })
    }

    // Candidato pescato dalla coda del telefono ma con un numero diverso davanti:
    // il database aveva ragione a proporlo, il confronto vero dice di no.
    if (motivi.length === 0) continue

    alunni.push({
      id: s.id,
      nome: `${s.firstName} ${s.lastName}`.trim(),
      classe: s.classe ?? null,
      attivo: s.active,
      motivi,
      recapiti,
    })
  }

  // Prima i più convincenti (nome + recapito, poi recapito, poi solo nome), poi
  // gli alunni ancora attivi, poi in ordine alfabetico: chi guarda la finestra
  // deve trovare in cima quello che con ogni probabilità è la stessa persona.
  alunni.sort((a, b) =>
    punteggioDoppione(b) - punteggioDoppione(a)
    || Number(b.attivo) - Number(a.attivo)
    || a.nome.localeCompare(b.nome, 'it'),
  )

  return { alunni: alunni.slice(0, MAX_DOPPIONI) }
}
