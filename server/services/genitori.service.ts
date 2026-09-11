import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm'
import type { Column, SQL } from 'drizzle-orm'
import { db } from '../database/client'
import { students, studentParents, users } from '../database/schema'
import { normalizzaTelefono, sembraTelefono } from '#shared/phone'
import { chiaviGenitore, genitoreRiconoscibile, leggiSerie } from '#shared/genitori'
import type {
  AccountGenitore, AltroGenitore, DatiGenitore, FiglioDiGenitore, Fratello, GenitoriDelFratello,
  LegameFratello, PersonaGenitore, RisultatoCercaGenitori, Slot,
} from '#shared/genitori'

// STESSO GENITORE PER PIÙ FIGLI (C5).
//
// Qui non si scrive niente: si LEGGE l'anagrafica che c'è già (le due serie di
// colonne dei genitori sulla scheda, e gli account del portale in student_parents)
// e se ne ricavano le persone e i fratelli. Niente colonne nuove, niente indici:
// con ~100 alunni ogni domanda al database è istantanea.
//
// Convenzione di progetto: gli errori di dominio sono `new Error('messaggio in
// italiano')`; gli handler li traducono in errori HTTP.

// Massimo di persone restituite dalla ricerca: oltre, conviene scrivere di più
const LIMITE_PERSONE = 10
// Righe lette al massimo dal database per una ricerca: bastano e avanzano per
// trovare 10 persone anche con due lettere sole ("ro")
const LIMITE_SCHEDE = 60
const LIMITE_ACCOUNT = 20

const SLOT: readonly Slot[] = [1, 2]

// Neutralizza i caratteri jolly di LIKE/ILIKE nel testo digitato dall'utente
// (stessa funzione di contact.service e confirmation.service): "100%" deve
// cercare "100%", non "qualsiasi cosa che inizi con 100".
function escapeLike(testo: string) {
  return testo.replace(/[\\%_]/g, (c) => `\\${c}`)
}

// Le sole cifre di una colonna telefono. È lo stesso criterio della ricerca dei
// doppioni nei Contatti (contact.service.ts, findDuplicates): nel database i
// numeri stanno in formato libero ("333 12 34 567", "+39 333…"), quindi si
// confrontano le cifre e non il testo.
const soloCifre = (colonna: unknown) => sql`regexp_replace(coalesce(${colonna}, ''), '[^0-9]', '', 'g')`

// Le colonne della scheda che servono qui: chi è l'alunno e le due serie dei
// genitori. Mai la riga intera: note e bisogni speciali non c'entrano.
const COLONNE_SCHEDA = {
  id:        students.id,
  firstName: students.firstName,
  lastName:  students.lastName,
  classe:    students.classe,
  active:    students.active,
  updatedAt: students.updatedAt,
  parentName:      students.parentName,
  parentEmail:     students.parentEmail,
  parentPhone:     students.parentPhone,
  parentIndirizzo: students.parentIndirizzo,
  parentCitta:     students.parentCitta,
  parentCap:       students.parentCap,
  parentCF:        students.parentCF,
  parentPIva:      students.parentPIva,
  parentRelazione: students.parentRelazione,
  parent2Name:        students.parent2Name,
  parent2Email:       students.parent2Email,
  parent2Phone:       students.parent2Phone,
  parent2Indirizzo:   students.parent2Indirizzo,
  parent2Citta:       students.parent2Citta,
  parent2Cap:         students.parent2Cap,
  parent2CF:          students.parent2CF,
  parent2PIva:        students.parent2PIva,
  parent2DataNascita: students.parent2DataNascita,
  parent2Relazione:   students.parent2Relazione,
}
type Scheda = Pick<typeof students.$inferSelect, keyof typeof COLONNE_SCHEDA>

function figlioDa(s: Pick<Scheda, 'id' | 'firstName' | 'lastName' | 'classe' | 'active'>): FiglioDiGenitore {
  return { id: s.id, nome: `${s.firstName} ${s.lastName}`.trim(), classe: s.classe ?? null, attivo: s.active }
}

// Prima gli alunni attivi, poi in ordine di cognome e nome
function ordineFigli(a: FiglioDiGenitore, b: FiglioDiGenitore) {
  return Number(b.attivo) - Number(a.attivo) || a.nome.localeCompare(b.nome, 'it')
}

// ─────────────────────────────────────────────
// GLI ACCOUNT DEL PORTALE
// ─────────────────────────────────────────────

type Collegamento = Awaited<ReturnType<typeof caricaCollegamenti>>[number]

// I collegamenti alunno ↔ account genitore (student_parents), con i dati
// dell'account e dell'alunno: una query sola per tutti gli alunni e gli account
// che servono, niente N+1.
async function caricaCollegamenti(idFigli: string[], idAccount: string[] = []) {
  if (idFigli.length === 0 && idAccount.length === 0) return []
  return await db
    .select({
      studentId:    studentParents.studentId,
      parentUserId: studentParents.parentUserId,
      relazione:    studentParents.relazione,
      email:        users.email,
      firstName:    users.firstName,
      lastName:     users.lastName,
      phone:        users.phone,
      dataNascita:  users.dataNascita,
      ruolo:        users.role,
      accountAttivo: users.active,
      figlioNome:    students.firstName,
      figlioCognome: students.lastName,
      figlioClasse:  students.classe,
      figlioAttivo:  students.active,
    })
    .from(studentParents)
    .innerJoin(users, eq(users.id, studentParents.parentUserId))
    .innerJoin(students, eq(students.id, studentParents.studentId))
    .where(or(
      idFigli.length > 0 ? inArray(studentParents.studentId, idFigli) : undefined,
      idAccount.length > 0 ? inArray(studentParents.parentUserId, idAccount) : undefined,
    ))
    .orderBy(asc(studentParents.createdAt))
}

// Si propone di collegare solo un account GENITORE attivo: con uno disattivato il
// genitore non entrerebbe comunque, e collegarlo darebbe l'idea che sia a posto.
const collegabile = (c: Collegamento) => c.ruolo === 'GENITORE' && c.accountAttivo

/**
 * L'account del portale di questa persona: quello GIÀ collegato a uno dei suoi
 * figli e con la STESSA email della scheda. Solo per email, e solo fra gli
 * account della sua famiglia: se la scheda non ha email non si indovina, e un
 * account con quell'email ma legato a un'altra famiglia non si propone mai
 * (collegarlo farebbe vedere questo alunno a un estraneo).
 */
function accountDi(idFigli: string[], email: Set<string>, collegamenti: Collegamento[]): Collegamento | null {
  if (email.size === 0) return null
  return collegamenti.find((c) =>
    collegabile(c) && idFigli.includes(c.studentId) && email.has(c.email.trim().toLowerCase()),
  ) ?? null
}

const accountBreve = (c: Collegamento | null): AccountGenitore | null =>
  c ? { userId: c.parentUserId, email: c.email } : null

// ─────────────────────────────────────────────
// DA "RIGHE" A "PERSONE"
// ─────────────────────────────────────────────

// Un genitore scritto in un posto preciso di una scheda precisa
interface Registrazione {
  scheda: Scheda
  slot: Slot
  dati: DatiGenitore
  chiavi: ReturnType<typeof chiaviGenitore>
}

// Le registrazioni che appartengono alla stessa persona
interface Gruppo {
  registrazioni: Registrazione[]
  cf: Set<string>
  email: Set<string>
  telefono: Set<string>
}

function registrazione(scheda: Scheda, slot: Slot): Registrazione | null {
  const dati = leggiSerie(scheda, slot)
  if (!genitoreRiconoscibile(dati)) return null
  return { scheda, slot, dati, chiavi: chiaviGenitore(dati) }
}

function nuovoGruppo(r: Registrazione): Gruppo {
  const g: Gruppo = { registrazioni: [], cf: new Set(), email: new Set(), telefono: new Set() }
  aggiungiAlGruppo(g, r)
  return g
}

function aggiungiAlGruppo(g: Gruppo, r: Registrazione) {
  g.registrazioni.push(r)
  if (r.chiavi.cf) g.cf.add(r.chiavi.cf)
  if (r.chiavi.email) g.email.add(r.chiavi.email)
  if (r.chiavi.telefono) g.telefono.add(r.chiavi.telefono)
}

/**
 * È la stessa persona? Decide il "documento" più sicuro che hanno TUTTI E DUE:
 * codice fiscale, poi email, poi telefono. Se tutti e due hanno il codice
 * fiscale e sono diversi, sono due persone anche con la stessa email (una
 * mamma che usa l'email del marito). Senza nessuno dei tre in comune non si
 * indovina dal nome: resta una persona a sé (chiave "nome + figlio").
 */
function stessaPersona(g: Gruppo, r: Registrazione): boolean {
  // I due posti della STESSA scheda sono sempre due persone diverse: mamma e papà
  // possono avere lo stesso telefono di casa, ma non sono la stessa persona.
  if (g.registrazioni.some((x) => x.scheda.id === r.scheda.id)) return false
  const k = r.chiavi
  if (k.cf && g.cf.size > 0) return g.cf.has(k.cf)
  if (k.email && g.email.size > 0) return g.email.has(k.email)
  if (k.telefono && g.telefono.size > 0) return g.telefono.has(k.telefono)
  return false
}

function raggruppa(registrazioni: Registrazione[]): Gruppo[] {
  const gruppi: Gruppo[] = []
  for (const r of registrazioni) {
    const candidati = gruppi.filter((g) => stessaPersona(g, r))
    // Se più persone "somigliano" (es. stesso telefono di casa per mamma e papà
    // sulla scheda del fratello), vince quella con lo stesso nome.
    const scelto = candidati.find((g) => g.registrazioni.some((x) => x.chiavi.nome && x.chiavi.nome === r.chiavi.nome))
      ?? candidati[0]
    if (scelto) aggiungiAlGruppo(scelto, r)
    else gruppi.push(nuovoGruppo(r))
  }
  return gruppi
}

function chiaveDi(g: Gruppo): string {
  const [cf] = g.cf
  if (cf) return `cf:${cf}`
  const [email] = g.email
  if (email) return `email:${email}`
  const [telefono] = g.telefono
  if (telefono) return `tel:${telefono}`
  const r = g.registrazioni[0]!
  return `scheda:${r.scheda.id}:${r.slot}`
}

// L'altro genitore registrato sulla stessa scheda, con il suo eventuale account
function altroGenitoreDi(r: Registrazione, collegamenti: Collegamento[]): AltroGenitore | null {
  const altroSlot: Slot = r.slot === 1 ? 2 : 1
  const dati = leggiSerie(r.scheda, altroSlot)
  if (!genitoreRiconoscibile(dati)) return null
  const email = chiaviGenitore(dati).email
  const account = accountDi([r.scheda.id], new Set(email ? [email] : []), collegamenti)
  return {
    ...dati,
    // Sulla serie 1 la data di nascita non c'è: se ha l'account, sta lì
    dataNascita: dati.dataNascita ?? account?.dataNascita ?? null,
    account: accountBreve(account),
  }
}

/**
 * La persona ricavata da un gruppo di registrazioni.
 * I dati sono quelli della scheda più "viva" (alunno attivo, modificata per
 * ultima): è la fotocopia più aggiornata. I buchi si riempiono dalle altre
 * schede, ma l'indirizzo si prende tutto intero da una scheda sola: via da
 * una, città e CAP da un'altra darebbero un indirizzo che non esiste.
 */
function personaDa(g: Gruppo, collegamenti: Collegamento[]): PersonaGenitore {
  const ordinate = [...g.registrazioni].sort((a, b) =>
    Number(b.scheda.active) - Number(a.scheda.active)
    || b.scheda.updatedAt.getTime() - a.scheda.updatedAt.getTime())
  const principale = ordinate[0]!
  const dati: DatiGenitore = { ...principale.dati }

  for (const r of ordinate.slice(1)) {
    for (const campo of ['nome', 'relazione', 'telefono', 'email', 'cf', 'piva', 'dataNascita'] as const) {
      if (!dati[campo] && r.dati[campo]) dati[campo] = r.dati[campo]
    }
    const senzaIndirizzo = !dati.indirizzo && !dati.citta && !dati.cap
    if (senzaIndirizzo && (r.dati.indirizzo || r.dati.citta || r.dati.cap)) {
      dati.indirizzo = r.dati.indirizzo
      dati.citta = r.dati.citta
      dati.cap = r.dati.cap
    }
  }

  // figli[0] = l'alunno della scheda da cui vengono i dati (e l'altro genitore)
  const altriFigli = ordinate.slice(1)
    .map((r) => figlioDa(r.scheda))
    .filter((f, i, tutti) => f.id !== principale.scheda.id && tutti.findIndex((x) => x.id === f.id) === i)
    .sort(ordineFigli)
  const figli = [figlioDa(principale.scheda), ...altriFigli]

  const account = accountDi(figli.map((f) => f.id), g.email, collegamenti)
  if (!dati.dataNascita && account?.dataNascita) dati.dataNascita = account.dataNascita

  return {
    chiave: chiaveDi(g),
    ...dati,
    figli,
    account: accountBreve(account),
    altroGenitore: altroGenitoreDi(principale, collegamenti),
  }
}

/**
 * Un account del portale che non corrisponde a nessuna persona in anagrafica
 * (es. la scheda non ha l'email, o ne ha una diversa): lo si mostra lo stesso,
 * con i dati dell'account e i figli che vede nel portale.
 */
function personaDaAccount(
  a: { id: string; email: string; firstName: string; lastName: string; phone: string | null; dataNascita: string | null },
  collegamenti: Collegamento[],
): PersonaGenitore {
  const suoi = collegamenti.filter((c) => c.parentUserId === a.id)
  const figli = suoi
    .map((c) => figlioDa({ id: c.studentId, firstName: c.figlioNome, lastName: c.figlioCognome, classe: c.figlioClasse, active: c.figlioAttivo }))
    .sort(ordineFigli)
  return {
    chiave: `account:${a.id}`,
    nome: `${a.firstName} ${a.lastName}`.trim() || null,
    relazione: suoi[0]?.relazione ?? null,
    telefono: a.phone,
    email: a.email,
    cf: null,
    piva: null,
    indirizzo: null,
    citta: null,
    cap: null,
    dataNascita: a.dataNascita,
    figli,
    account: { userId: a.id, email: a.email },
    // Non sappiamo in quale posto delle schede dei figli sia registrato: meglio
    // non proporre un "altro genitore" che potrebbe essere lui stesso.
    altroGenitore: null,
  }
}

function chiaviUniche(persone: PersonaGenitore[]) {
  const viste = new Set<string>()
  for (const p of persone) {
    let chiave = p.chiave
    for (let n = 2; viste.has(chiave); n++) chiave = `${p.chiave}#${n}`
    p.chiave = chiave
    viste.add(chiave)
  }
}

// ─────────────────────────────────────────────
// RICERCA — GET /api/admin/genitori/cerca?q=
// ─────────────────────────────────────────────

/**
 * Cerca un genitore già registrato: per nome e cognome del genitore O
 * DELL'ALUNNO ("cerco dal fratello"), email, codice fiscale e telefono; più gli
 * account GENITORE del portale. Anche fra gli ex alunni: una famiglia può tornare
 * con un altro figlio.
 * - Se il testo trova l'alunno, si propongono tutti e due i suoi genitori.
 * - Se trova i dati di un genitore, si propone quel genitore.
 */
export async function cercaGenitori(testo: string): Promise<RisultatoCercaGenitori> {
  const q = testo.trim().replace(/\s+/g, ' ')
  if (q.length < 2) return { persone: [], altri: false }

  // Per i nomi basta che ci siano tutte le parole, in qualsiasi ordine:
  // "rossi luca" trova "Luca Rossi"
  const parole = q.split(' ').slice(0, 5)
  const tuttoIlTesto = `%${escapeLike(q)}%`
  // Un numero di telefono si riconosce come nei Contatti (sembraTelefono: solo
  // cifre e simboli da telefono, almeno 6 cifre). Si confrontano le cifre SENZA
  // il +39: "333 1234567" deve trovare "+39 333 123 4567" e viceversa.
  const cifre = sembraTelefono(q) ? normalizzaTelefono(q).slice(3) : ''

  const nomeContiene = (espressione: Column | SQL) =>
    and(...parole.map((p) => ilike(espressione, `%${escapeLike(p)}%`)))
  const cifreContengono = (colonna: unknown) => sql`${soloCifre(colonna)} LIKE ${`%${cifre}%`}`

  const [schede, accountTrovati] = await Promise.all([
    db.select(COLONNE_SCHEDA)
      .from(students)
      .where(or(
        nomeContiene(sql`${students.firstName} || ' ' || ${students.lastName}`),
        nomeContiene(students.parentName),
        nomeContiene(students.parent2Name),
        ilike(students.parentEmail, tuttoIlTesto),
        ilike(students.parent2Email, tuttoIlTesto),
        ilike(students.parentCF, tuttoIlTesto),
        ilike(students.parent2CF, tuttoIlTesto),
        cifre ? cifreContengono(students.parentPhone) : undefined,
        cifre ? cifreContengono(students.parent2Phone) : undefined,
      ))
      .orderBy(desc(students.active), asc(students.lastName), asc(students.firstName))
      .limit(LIMITE_SCHEDE),

    db.select({
      id:          users.id,
      email:       users.email,
      firstName:   users.firstName,
      lastName:    users.lastName,
      phone:       users.phone,
      dataNascita: users.dataNascita,
    })
      .from(users)
      .where(and(
        eq(users.role, 'GENITORE'),
        eq(users.active, true),
        or(
          nomeContiene(sql`${users.firstName} || ' ' || ${users.lastName}`),
          ilike(users.email, tuttoIlTesto),
          cifre ? cifreContengono(users.phone) : undefined,
        ),
      ))
      .orderBy(asc(users.lastName), asc(users.firstName))
      .limit(LIMITE_ACCOUNT),
  ])

  // Il database dice QUALI schede c'entrano; qui si capisce PERCHÉ, con le stesse
  // regole, per sapere quale genitore proporre di ciascuna.
  const minuscolo = (v?: string | null) => (v ?? '').toLowerCase()
  const haTutteLeParole = (v?: string | null) => {
    const t = minuscolo(v)
    return parole.every((p) => t.includes(p.toLowerCase()))
  }
  const contieneIlTesto = (v?: string | null) => minuscolo(v).includes(q.toLowerCase())
  const perTelefono = (v?: string | null) => cifre !== '' && (v ?? '').replace(/\D/g, '').includes(cifre)

  const registrazioni: Registrazione[] = []
  for (const s of schede) {
    const perAlunno = haTutteLeParole(`${s.firstName} ${s.lastName}`)
    for (const slot of SLOT) {
      const r = registrazione(s, slot)
      if (!r) continue
      const perGenitore = haTutteLeParole(r.dati.nome) || contieneIlTesto(r.dati.email)
        || contieneIlTesto(r.dati.cf) || perTelefono(r.dati.telefono)
      if (perAlunno || perGenitore) registrazioni.push(r)
    }
  }

  const gruppi = raggruppa(registrazioni)
  const idFigli = [...new Set(registrazioni.map((r) => r.scheda.id))]
  const collegamenti = await caricaCollegamenti(idFigli, accountTrovati.map((a) => a.id))

  const persone = gruppi.map((g) => personaDa(g, collegamenti))

  // Gli account trovati che non sono già l'account di una delle persone
  const giaAssegnati = new Set(persone.map((p) => p.account?.userId).filter(Boolean))
  for (const a of accountTrovati) {
    if (!giaAssegnati.has(a.id)) persone.push(personaDaAccount(a, collegamenti))
  }

  // Prima chi ha almeno un figlio ancora iscritto, poi in ordine di nome
  const conFigliAttivi = (p: PersonaGenitore) => (p.figli.some((f) => f.attivo) ? 0 : 1)
  persone.sort((a, b) => conFigliAttivi(a) - conFigliAttivi(b) || (a.nome ?? '').localeCompare(b.nome ?? '', 'it'))

  const mostrate = persone.slice(0, LIMITE_PERSONE)
  chiaviUniche(mostrate)
  return {
    persone: mostrate,
    altri: persone.length > LIMITE_PERSONE || schede.length === LIMITE_SCHEDE || accountTrovati.length === LIMITE_ACCOUNT,
  }
}

// ─────────────────────────────────────────────
// GENITORI DI UN FRATELLO — GET /api/admin/students/:id/genitori
// ─────────────────────────────────────────────

/**
 * I genitori di un alunno già iscritto, nella stessa forma della ricerca, pronti
 * da copiare sulla scheda del fratello (wizard con `prefill.fratelloId`, voce D2).
 * Primo e secondo restano al loro posto. Se un posto è vuoto ma l'alunno ha un
 * account del portale che non corrisponde a nessuno dei due, quel posto si
 * riempie con i dati dell'account: è pur sempre un suo genitore.
 */
export async function genitoriDelFratello(studentId: string): Promise<GenitoriDelFratello> {
  const [[scheda], collegamenti] = await Promise.all([
    db.select(COLONNE_SCHEDA).from(students).where(eq(students.id, studentId)).limit(1),
    caricaCollegamenti([studentId]),
  ])
  if (!scheda) throw new Error('Studente non trovato')

  const perSlot = (slot: Slot) => {
    const r = registrazione(scheda, slot)
    return r ? personaDa(nuovoGruppo(r), collegamenti) : null
  }
  let primo = perSlot(1)
  let secondo = perSlot(2)

  const giaUsati = new Set([primo?.account?.userId, secondo?.account?.userId].filter(Boolean))
  const emailInScheda = new Set([primo?.email, secondo?.email].filter(Boolean).map((e) => e!.toLowerCase()))
  const soloAccount = collegamenti.filter((c) =>
    collegabile(c) && !giaUsati.has(c.parentUserId) && !emailInScheda.has(c.email.trim().toLowerCase()))
  for (const c of soloAccount) {
    const persona = personaDaAccount(
      { id: c.parentUserId, email: c.email, firstName: c.firstName, lastName: c.lastName, phone: c.phone, dataNascita: c.dataNascita },
      collegamenti,
    )
    if (!primo) primo = persona
    else if (!secondo) secondo = persona
  }

  // L'uno è l'"altro genitore" dell'altro, come nella ricerca
  if (primo && secondo) {
    const comeAltro = (p: PersonaGenitore): AltroGenitore => {
      const { chiave: _c, figli: _f, altroGenitore: _a, ...resto } = p
      return resto
    }
    primo.altroGenitore = comeAltro(secondo)
    secondo.altroGenitore = comeAltro(primo)
  }

  return { fratello: figlioDa(scheda), primo, secondo }
}

// ─────────────────────────────────────────────
// FRATELLI — GET /api/admin/students/:id/fratelli
// ─────────────────────────────────────────────

/**
 * Gli altri alunni che hanno un genitore in comune con questo.
 * È DEDOTTO, non memorizzato (come il livello scolastico): nessuna colonna
 * "fratello di". Il legame si riconosce da:
 * - lo stesso account del portale (student_parents in comune);
 * - lo stesso codice fiscale, email o telefono (non vuoti) fra una delle due
 *   serie di questo alunno e una delle due dell'altro.
 * Per ogni legame si dice in quale posto sta il genitore sulle due schede: serve
 * a "aggiorno anche su Luca?" (Q15) per scrivere nella colonna giusta.
 */
export async function fratelliDi(studentId: string): Promise<Fratello[]> {
  const [[io], perAccount] = await Promise.all([
    db.select(COLONNE_SCHEDA).from(students).where(eq(students.id, studentId)).limit(1),
    // Gli altri alunni collegati ad almeno uno degli account dei genitori di questo
    db.select({ studentId: studentParents.studentId, email: users.email })
      .from(studentParents)
      .innerJoin(users, eq(users.id, studentParents.parentUserId))
      .where(and(
        ne(studentParents.studentId, studentId),
        inArray(
          studentParents.parentUserId,
          db.select({ id: studentParents.parentUserId }).from(studentParents).where(eq(studentParents.studentId, studentId)),
        ),
      )),
  ])
  if (!io) throw new Error('Studente non trovato')

  const mie = SLOT.map((slot) => ({ slot, chiavi: chiaviGenitore(leggiSerie(io, slot)) }))
  const unici = (valori: string[]) => [...new Set(valori.filter(Boolean))]
  const cf = unici(mie.map((m) => m.chiavi.cf))
  const email = unici(mie.map((m) => m.chiavi.email))
  // Filtro grezzo sulle ultime 8 cifre (come i Contatti), conferma esatta più sotto
  const code = unici(mie.map((m) => m.chiavi.telefono.replace(/\D/g, '').slice(-8)))
  const idPerAccount = unici(perAccount.map((p) => p.studentId))

  const condizioni: (SQL | undefined)[] = []
  if (cf.length > 0) {
    condizioni.push(inArray(sql`upper(trim(${students.parentCF}))`, cf), inArray(sql`upper(trim(${students.parent2CF}))`, cf))
  }
  if (email.length > 0) {
    condizioni.push(inArray(sql`lower(trim(${students.parentEmail}))`, email), inArray(sql`lower(trim(${students.parent2Email}))`, email))
  }
  for (const coda of code) {
    condizioni.push(sql`${soloCifre(students.parentPhone)} LIKE ${`%${coda}`}`, sql`${soloCifre(students.parent2Phone)} LIKE ${`%${coda}`}`)
  }
  if (idPerAccount.length > 0) condizioni.push(inArray(students.id, idPerAccount))
  if (condizioni.length === 0) return []

  const candidati = await db.select(COLONNE_SCHEDA)
    .from(students)
    .where(and(ne(students.id, studentId), or(...condizioni)))

  const fratelli: (Fratello & { cognome: string; nomeProprio: string })[] = []
  for (const s of candidati) {
    const sue = SLOT.map((slot) => ({ slot, chiavi: chiaviGenitore(leggiSerie(s, slot)) }))
    const legami: LegameFratello[] = []
    const aggiungi = (l: LegameFratello) => {
      if (!legami.some((x) => x.mioSlot === l.mioSlot && x.suoSlot === l.suoSlot && x.motivo === l.motivo)) legami.push(l)
    }

    for (const m of mie) {
      for (const t of sue) {
        if (m.chiavi.cf && m.chiavi.cf === t.chiavi.cf) aggiungi({ mioSlot: m.slot, suoSlot: t.slot, motivo: 'cf' })
        if (m.chiavi.email && m.chiavi.email === t.chiavi.email) aggiungi({ mioSlot: m.slot, suoSlot: t.slot, motivo: 'email' })
        if (m.chiavi.telefono && m.chiavi.telefono === t.chiavi.telefono) aggiungi({ mioSlot: m.slot, suoSlot: t.slot, motivo: 'telefono' })
      }
    }
    // Stesso account del portale: il posto sulle due schede si ritrova dall'email
    // dell'account; se la scheda riporta un'altra email resta "non si sa" (null)
    for (const p of perAccount) {
      if (p.studentId !== s.id) continue
      const e = p.email.trim().toLowerCase()
      aggiungi({
        mioSlot: mie.find((m) => m.chiavi.email === e)?.slot ?? null,
        suoSlot: sue.find((t) => t.chiavi.email === e)?.slot ?? null,
        motivo: 'account',
      })
    }

    // Il filtro sulle ultime cifre ha pescato un numero solo simile: non è un fratello
    if (legami.length === 0) continue
    fratelli.push({ ...figlioDa(s), legami, cognome: s.lastName, nomeProprio: s.firstName })
  }

  fratelli.sort((a, b) =>
    Number(b.attivo) - Number(a.attivo)
    || a.cognome.localeCompare(b.cognome, 'it')
    || a.nomeProprio.localeCompare(b.nomeProprio, 'it'))

  return fratelli.map(({ cognome: _c, nomeProprio: _n, ...f }) => f)
}
