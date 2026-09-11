import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, lte, notInArray, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../database/client'
import { contacts, contactFigli, contactInteractions, students, users } from '../database/schema'
import { nomeProprio } from '../utils/nomi'
import { oggiRomeStr } from '../utils/tutor-time-window'
// Il ponte con i Rientri (l'import va in questo verso soltanto: confirmation.service
// non conosce i contatti, così non si creano import circolari)
import { getAnnoCorrente, setRientro } from './confirmation.service'
import { normalizzaTelefono, sembraTelefono, sembraEmail } from '#shared/phone'
import { STATI_CHIUSI } from '#shared/contatti'
import type { TipoContatto } from '#shared/contatti'
import { normalizzaRigaImport } from '#shared/contatti-import'
import type { RigaImportContatto } from '#shared/contatti-import'
import type {
  CreateContactInput,
  UpdateContactInput,
  CreateInteractionInput,
  ListContactsQuery,
  FiglioContattoInput,
  CollegaFiglioInput,
} from '#shared/schemas/contact.schema'

// Convenzione di progetto: i service segnalano gli errori di dominio con
// `new Error('messaggio in italiano')`; gli handler li traducono in errori HTTP.

type ContactChanges = Partial<typeof contacts.$inferInsert>
type RigaContatto = typeof contacts.$inferSelect
// L'oggetto `tx` che Drizzle passa dentro db.transaction(...)
type Transazione = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Un contatto è "da ricontattare" se ha un post-it con data odierna o passata
// e non è già chiuso (convertito o perso). Costruito con gli operatori Drizzle
// (query parametrica, nessuna concatenazione di stringhe).
function daRicontattareEntro(giorno: string) {
  return and(
    isNotNull(contacts.prossimoRicontatto),
    lte(contacts.prossimoRicontatto, giorno),
    notInArray(contacts.stato, [...STATI_CHIUSI]),
  ) as SQL
}

// Convertiti nel mese civile italiano indicato ('YYYY-MM'): il confronto avviene
// sulla data riportata in Europe/Rome, non su quella UTC salvata nel database.
function convertitiNelMese(mese: string) {
  return and(
    eq(contacts.stato, 'CONVERTITO'),
    isNotNull(contacts.convertitoAt),
    sql`to_char(${contacts.convertitoAt} AT TIME ZONE 'Europe/Rome', 'YYYY-MM') = ${mese}`,
  ) as SQL
}

// Neutralizza i caratteri jolly di LIKE/ILIKE nel testo digitato dall'utente.
// (Postgres usa '\' come carattere di escape predefinito.)
function escapeLike(testo: string) {
  return testo.replace(/[\\%_]/g, (c) => `\\${c}`)
}

// Vero se il testo "sembra" un profilo o una chat social: un link a uno dei
// social più usati oppure un @nomeutente. Serve al form pubblico del sito, dove
// c'è un campo unico "contatto".
const SITI_SOCIAL = ['instagram.com', 'facebook.com', 'tiktok.com', 't.me', 'wa.me']

function sembraSocial(valore: string): boolean {
  const v = (valore ?? '').trim().toLowerCase()
  if (!v) return false
  if (v.startsWith('@')) return true
  return SITI_SOCIAL.some((sito) => v.includes(sito))
}

// Regola unica per convertitoAt: si valorizza entrando in CONVERTITO, si azzera uscendone
function aggiornaConvertitoAt(changes: ContactChanges, nuovoStato: string | null | undefined, convertitoAtAttuale: Date | null) {
  if (!nuovoStato) return
  if (nuovoStato === 'CONVERTITO') {
    if (!convertitoAtAttuale) changes.convertitoAt = new Date()
  } else if (convertitoAtAttuale) {
    changes.convertitoAt = null
  }
}

// ─────────────────────────────────────────────
// LIST + KPI — GET /api/contacts
// Una sola chiamata HTTP, due query in parallelo (lista + conteggi delle card).
// ─────────────────────────────────────────────

export async function listContacts(q: ListContactsQuery) {
  const oggi = oggiRomeStr()
  const meseCorrente = oggi.slice(0, 7) // 'YYYY-MM'

  const filtri = [
    eq(contacts.tipo, q.tipo),
    q.includiArchiviati ? undefined : isNull(contacts.archiviatoAt),
    q.stato ? eq(contacts.stato, q.stato) : undefined,
    q.canale ? eq(contacts.canaleOrigine, q.canale) : undefined,
    // "Chi è" esiste solo nel cassetto Doposcuola: altrove il filtro non si applica
    (q.tipo === 'DOPOSCUOLA' && q.ruolo) ? eq(contacts.doposcuolaRuolo, q.ruolo) : undefined,
    q.daRicontattare ? daRicontattareEntro(oggi) : undefined,
    // Stessa espressione del numero mostrato sulla card, così lista e numero coincidono
    q.convertitiMese ? convertitiNelMese(meseCorrente) : undefined,
  ]

  if (q.search) {
    // '%', '_' e '\' sono caratteri speciali di LIKE: vanno neutralizzati, altrimenti
    // digitare "100%" o "a_b" cercherebbe "qualsiasi cosa" invece del testo scritto.
    const testo = `%${escapeLike(q.search)}%`
    const perTesto = [
      ilike(contacts.nome, testo),
      ilike(contacts.cognome, testo),
      ilike(contacts.telefono, testo),
      ilike(contacts.email, testo),
      ilike(contacts.socialLink, testo),
      // Il figlio di una volta (contatti di prima, vedi figliConRipiego)…
      ilike(contacts.nomeStudente, testo),
      // …e tutti i figli della famiglia: cercando "Giulia" si trova la mamma che
      // ha chiamato per Luca e Giulia, anche se Giulia è il secondo figlio
      sql`EXISTS (SELECT 1 FROM ${contactFigli} WHERE ${contactFigli.contactId} = ${contacts.id} AND ${ilike(contactFigli.nome, testo)})`,
      ilike(contacts.azienda, testo),
    ]
    // Se si sta cercando un numero, cerchiamo anche la sua forma normalizzata:
    // "333 123" e "+39333123" devono trovare la stessa persona.
    if (sembraTelefono(q.search)) {
      const normalizzato = normalizzaTelefono(q.search)
      if (normalizzato) perTesto.push(ilike(contacts.telefono, `%${escapeLike(normalizzato)}%`))
    }
    filtri.push(or(...perTesto))
  }

  const where = and(...filtri)

  // Prima chi è da richiamare (post-it scaduto o di oggi), poi chi si è "mosso" più di recente.
  // Per chi non è mai stato sentito vale la data di inserimento: un contatto appena
  // aggiunto a mano deve comparire in cima, non in fondo alla lista.
  const priorita = sql`CASE WHEN ${daRicontattareEntro(oggi)} THEN 0 ELSE 1 END`
  const recenza = sql`COALESCE(${contacts.ultimoContattoAt}, ${contacts.createdAt}) DESC`

  // I 4 numeri delle card + i totali delle due tab: un'unica scansione con
  // COUNT(*) FILTER (WHERE …), lanciata in parallelo alla lista.
  const soloTipo = eq(contacts.tipo, q.tipo)
  const conta = (condizione: SQL) => sql<string>`COUNT(*) FILTER (WHERE ${condizione})::text`

  const [righe, [totaleRow], [kpiRow]] = await Promise.all([
    db.select().from(contacts)
      .where(where)
      .orderBy(priorita, recenza, desc(contacts.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),

    db.select({ n: count() }).from(contacts).where(where),

    db.select({
      nuovi:              conta(and(soloTipo, eq(contacts.stato, 'NUOVO')) as SQL),
      daRicontattareOggi: conta(and(soloTipo, daRicontattareEntro(oggi)) as SQL),
      inTrattativa:       conta(and(soloTipo, eq(contacts.stato, 'IN_TRATTATIVA')) as SQL),
      // Stessa espressione del filtro della card: numero e lista non possono discordare
      convertitiMese:     conta(and(soloTipo, convertitiNelMese(meseCorrente)) as SQL),
      totaleDoposcuola:   conta(eq(contacts.tipo, 'DOPOSCUOLA')),
      totaleMarketing:    conta(eq(contacts.tipo, 'MARKETING')),
      // Quanti, fra i Doposcuola, sono candidati tutor: serve al filtro "Chi è"
      totaleTutorDoposcuola: conta(and(
        eq(contacts.tipo, 'DOPOSCUOLA'),
        eq(contacts.doposcuolaRuolo, 'TUTOR'),
      ) as SQL),
    }).from(contacts).where(isNull(contacts.archiviatoAt)),
  ])

  const total = totaleRow?.n ?? 0

  // I figli delle famiglie della pagina: UNA lettura in più per tutti, non una a contatto
  const figliPerContatto = await leggiFigli(righe)

  return {
    items: righe.map((c) => ({ ...c, figli: figliPerContatto.get(c.id) ?? [] })),
    total,
    meta: {
      page:       q.page,
      pageSize:   q.pageSize,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    },
    kpi: {
      nuovi:              Number(kpiRow?.nuovi ?? 0),
      daRicontattareOggi: Number(kpiRow?.daRicontattareOggi ?? 0),
      inTrattativa:       Number(kpiRow?.inTrattativa ?? 0),
      convertitiMese:     Number(kpiRow?.convertitiMese ?? 0),
      totaleDoposcuola:   Number(kpiRow?.totaleDoposcuola ?? 0),
      totaleMarketing:    Number(kpiRow?.totaleMarketing ?? 0),
      totaleTutorDoposcuola: Number(kpiRow?.totaleTutorDoposcuola ?? 0),
    },
  }
}

// ─────────────────────────────────────────────
// BADGE DEL MENU — quanti contatti sono da ricontattare oggi
// Entrambe le tab insieme, archiviati esclusi. Una sola COUNT sull'indice.
// ─────────────────────────────────────────────

export async function countContactsDaRicontattare() {
  const [riga] = await db.select({ n: count() })
    .from(contacts)
    .where(and(isNull(contacts.archiviatoAt), daRicontattareEntro(oggiRomeStr())))

  return riga?.n ?? 0
}

// ─────────────────────────────────────────────
// GET ONE — scheda + diario (le due letture partono insieme)
// ─────────────────────────────────────────────

const nomeCompleto = (idCol: unknown, nome: unknown, cognome: unknown) =>
  sql<string | null>`CASE WHEN ${idCol} IS NULL THEN NULL ELSE ${nome} || ' ' || ${cognome} END`

// La tabella users entra due volte nella stessa lettura: una per chi ha inserito
// il contatto, una per il tutor creato dalla conversione. Senza un secondo nome
// ("tutor") Postgres non saprebbe quale delle due persone intendiamo.
const utenteTutor = alias(users, 'tutor')

export async function getContact(id: string) {
  const [[riga], interazioni] = await Promise.all([
    db.select({
      contatto:     contacts,
      studenteNome: nomeCompleto(students.id, students.firstName, students.lastName),
      creatoDaNome: nomeCompleto(users.id, users.firstName, users.lastName),
      tutorNome:    nomeCompleto(utenteTutor.id, utenteTutor.firstName, utenteTutor.lastName),
    })
      .from(contacts)
      .leftJoin(students, eq(contacts.studentId, students.id))
      .leftJoin(users, eq(contacts.createdByUserId, users.id))
      .leftJoin(utenteTutor, eq(contacts.tutorUserId, utenteTutor.id))
      .where(eq(contacts.id, id))
      .limit(1),

    db.select({
      id:         contactInteractions.id,
      contactId:  contactInteractions.contactId,
      tipo:       contactInteractions.tipo,
      direzione:  contactInteractions.direzione,
      canale:     contactInteractions.canale,
      esito:      contactInteractions.esito,
      note:       contactInteractions.note,
      data:       contactInteractions.data,
      createdAt:  contactInteractions.createdAt,
      autoreNome: nomeCompleto(users.id, users.firstName, users.lastName),
    })
      .from(contactInteractions)
      .leftJoin(users, eq(contactInteractions.createdByUserId, users.id))
      .where(eq(contactInteractions.contactId, id))
      .orderBy(desc(contactInteractions.data)),
  ])

  if (!riga) throw new Error('Contatto non trovato')

  // Per i figli serve il contatto già letto (il ripiego parte dai suoi vecchi
  // campi): questa lettura viene dopo le altre due, non insieme
  const figli = await leggiFigli([riga.contatto])

  return {
    ...riga.contatto,
    studenteNome: riga.studenteNome,
    creatoDaNome: riga.creatoDaNome,
    tutorNome:    riga.tutorNome,
    figli:        figli.get(riga.contatto.id) ?? [],
    interazioni,
  }
}

// ─────────────────────────────────────────────
// I FIGLI DI UNA FAMIGLIA (voce D2)
// Una famiglia può chiamare per più figli: ognuno è una riga di contact_figli e
// diventa alunno per conto suo. I contatti di prima avevano i tre campi sul
// contatto stesso (un figlio solo): finché non hanno righe, quel figlio si mostra
// lo stesso, "virtuale" (id null), ricavato dai vecchi campi.
// ─────────────────────────────────────────────

/** Un figlio come lo vedono lista, scheda e modulo (id null = il figlio "di prima") */
export interface FiglioLetto {
  id: string | null
  nome: string | null
  classeScuola: string | null
  materie: string | null
  studentId: string | null
  /** "Nome Cognome" dello studente collegato (null se non è ancora alunno) */
  studenteNome: string | null
}

type DatiFiglio = Pick<FiglioContattoInput, 'nome' | 'classeScuola' | 'materie'>

/** Solo le famiglie interessate hanno figli: non i candidati tutor, non il Marketing */
function eFamiglia(c: Pick<RigaContatto, 'tipo' | 'doposcuolaRuolo'>): boolean {
  return c.tipo === 'DOPOSCUOLA' && c.doposcuolaRuolo === 'STUDENTE'
}

const figlioVuoto = (f: DatiFiglio) => !f.nome && !f.classeScuola && !f.materie

/** Il nome del figlio in formato "Nome Proprio", come quello del contatto */
const nomeFiglio = (nome: string | null | undefined) => (nome ? nomeProprio(nome) : null)

/** "Luca  ROSSI" e "luca rossi" sono lo stesso ragazzo: via maiuscole, accenti e spazi doppi */
function chiaveNome(nome: string | null | undefined): string {
  return (nome ?? '')
    .normalize('NFD')
    // via gli accenti: 'è' scomposta diventa 'e' + segno, il segno si butta
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Le righe da inserire per dei figli nuovi, numerate da `primo` in poi */
function righeFigliNuove(contactId: string, figli: DatiFiglio[], primo = 0): Array<typeof contactFigli.$inferInsert> {
  return figli.map((f, i) => ({
    contactId,
    nome:         nomeFiglio(f.nome),
    classeScuola: f.classeScuola ?? null,
    materie:      f.materie ?? null,
    ordine:       primo + i,
  }))
}

// I vecchi campi del contatto svuotati: si usa quando il figlio "virtuale" è
// diventato una riga vera (o è stato tolto). Senza svuotarli, alla lettura dopo
// il ripiego lo farebbe ricomparire.
const SENZA_CAMPI_VECCHI = { nomeStudente: null, classeScuola: null, materie: null } satisfies ContactChanges

/**
 * IL RIPIEGO — dai figli salvati di un contatto, i figli da mostrare. Una regola
 * sola, usata per leggere (lista, scheda) e prima di scrivere: quello che l'utente
 * vede è sempre quello su cui il server ragiona.
 *
 * 1. Nessuna riga ma i vecchi campi valorizzati → UN figlio "virtuale" (id null).
 *    Perché: fra la migrazione del database e la pubblicazione del codice nuovo
 *    passano minuti, e intanto il sito vecchio può creare contatti col formato di
 *    prima. Così quei figli non si perdono mai.
 * 2. Il contatto è collegato a uno studente che nessuna riga porta → quel
 *    collegamento va sul primo figlio non ancora alunno. Succede se in quella
 *    stessa finestra (o da una scheda del browser aperta da prima
 *    dell'aggiornamento) si è usato il "Crea studente" vecchio, che scriveva solo
 *    sul contatto. Se tutti i figli sono già alunni resta solo sul contatto: con i
 *    bottoni del gestionale non può succedere.
 *
 * Contatti anonimizzati: nessun figlio (sono nomi di minori).
 */
function figliConRipiego(c: RigaContatto, righe: FiglioLetto[]): FiglioLetto[] {
  if (!eFamiglia(c) || c.anonimizzatoAt) return []

  if (righe.length === 0) {
    const vecchiCampi = c.nomeStudente || c.classeScuola || c.materie || c.studentId
    if (!vecchiCampi) return []
    return [{
      id:           null,
      nome:         c.nomeStudente,
      classeScuola: c.classeScuola,
      materie:      c.materie,
      studentId:    c.studentId,
      studenteNome: null,
    }]
  }

  const figli = righe.map((r) => ({ ...r }))
  if (c.studentId && !figli.some((f) => f.studentId === c.studentId)) {
    const libero = figli.find((f) => !f.studentId)
    if (libero) libero.studentId = c.studentId
  }
  return figli
}

/** Le righe salvate di un contatto, nell'ordine in cui vanno mostrate */
async function righeSalvate(esecutore: Transazione, contactId: string) {
  return await esecutore.select().from(contactFigli)
    .where(eq(contactFigli.contactId, contactId))
    .orderBy(asc(contactFigli.ordine), asc(contactFigli.createdAt))
}

/** Una riga salvata nella forma che vuole il ripiego (il nome dell'alunno qui non serve) */
const perRipiego = (r: typeof contactFigli.$inferSelect): FiglioLetto => ({
  id:           r.id,
  nome:         r.nome,
  classeScuola: r.classeScuola,
  materie:      r.materie,
  studentId:    r.studentId,
  studenteNome: null,
})

/**
 * I figli di più contatti in UNA lettura (la lista ne mostra 50 insieme: niente
 * una query per contatto). Restituisce contactId → figli, col ripiego già fatto.
 */
async function leggiFigli(contatti: RigaContatto[]): Promise<Map<string, FiglioLetto[]>> {
  const perContatto = new Map<string, FiglioLetto[]>()
  const famiglie = contatti.filter((c) => eFamiglia(c) && !c.anonimizzatoAt)
  if (famiglie.length === 0) return perContatto

  const righe = await db.select({
    id:           contactFigli.id,
    contactId:    contactFigli.contactId,
    nome:         contactFigli.nome,
    classeScuola: contactFigli.classeScuola,
    materie:      contactFigli.materie,
    studentId:    contactFigli.studentId,
    studenteNome: nomeCompleto(students.id, students.firstName, students.lastName),
  })
    .from(contactFigli)
    .leftJoin(students, eq(contactFigli.studentId, students.id))
    .where(inArray(contactFigli.contactId, famiglie.map((c) => c.id)))
    .orderBy(asc(contactFigli.ordine), asc(contactFigli.createdAt))

  const salvatePer = new Map<string, FiglioLetto[]>()
  for (const { contactId, ...figlio } of righe) {
    const lista = salvatePer.get(contactId) ?? []
    lista.push(figlio)
    salvatePer.set(contactId, lista)
  }
  for (const c of famiglie) perContatto.set(c.id, figliConRipiego(c, salvatePer.get(c.id) ?? []))

  // Il nome dello studente per i collegamenti che il ripiego ha preso dal contatto:
  // una lettura sola per tutti, e solo se ce n'è bisogno (contatti di prima)
  const tutti = [...perContatto.values()].flat()
  const senzaNome = [...new Set(tutti.filter((f) => f.studentId && !f.studenteNome).map((f) => f.studentId as string))]
  if (senzaNome.length > 0) {
    const nomi = await db.select({
      id:   students.id,
      nome: sql<string>`${students.firstName} || ' ' || ${students.lastName}`,
    }).from(students).where(inArray(students.id, senzaNome))
    const nomePerId = new Map(nomi.map((n) => [n.id, n.nome]))
    for (const f of tutti) {
      if (f.studentId && !f.studenteNome) f.studenteNome = nomePerId.get(f.studentId) ?? null
    }
  }

  return perContatto
}

/** Il contatto con i suoi figli: è la forma che lista, scheda e modulo si aspettano */
async function conFigli(c: RigaContatto) {
  const figli = await leggiFigli([c])
  return { ...c, figli: figli.get(c.id) ?? [] }
}

/**
 * Salva i figli arrivati dal modulo "Modifica contatto": è la lista COMPLETA, così
 * come l'utente la vede. Aggiorna quelli che c'erano, aggiunge i nuovi, cancella i
 * tolti — ma mai un figlio già diventato alunno: se manca è un errore, se c'è i
 * suoi dati non si toccano (quelli veri ora stanno sulla scheda dello studente).
 *
 * `c` è il contatto COM'ERA prima della modifica, cioè quello che l'utente aveva
 * davanti aprendo il modulo. Restituisce true se il contatto aveva il figlio
 * "virtuale" dei contatti di prima: ora è una riga vera (o è stato tolto), e chi
 * chiama ne svuota i vecchi campi.
 */
async function salvaFigli(tx: Transazione, c: RigaContatto, arrivati: FiglioContattoInput[]): Promise<boolean> {
  const salvati = await righeSalvate(tx, c.id)
  const salvatiPerId = new Map(salvati.map((r) => [r.id, r]))

  // Gli stessi figli che l'utente ha visto (ripiego compreso): dicono chi è già alunno
  const visti = figliConRipiego(c, salvati.map(perRipiego))
  const alunnoDaRipiego = new Map(visti.filter((f) => f.id).map((f) => [f.id as string, f.studentId]))
  const alunnoDi = (r: { id: string; studentId: string | null }) => alunnoDaRipiego.get(r.id) || r.studentId
  const virtuale = visti.find((f) => f.id === null) ?? null

  const tenuti = new Set<string>()
  const modifiche: Array<{ id: string; valori: Partial<typeof contactFigli.$inferInsert> }> = []
  const nuovi: Array<typeof contactFigli.$inferInsert> = []
  let virtualeArrivato = false
  const adesso = new Date()

  for (const f of arrivati) {
    const ordine = tenuti.size + nuovi.length
    const riga = f.id ? salvatiPerId.get(f.id) : undefined

    if (riga && !tenuti.has(riga.id)) {
      const studentId = alunnoDi(riga)
      if (studentId) {
        // Già alunno: si aggiornano solo la posizione e, per i contatti di prima,
        // il collegamento che fin qui stava solo sul contatto
        tenuti.add(riga.id)
        if (riga.ordine !== ordine || riga.studentId !== studentId) {
          modifiche.push({ id: riga.id, valori: { ordine, studentId, updatedAt: adesso } })
        }
        continue
      }
      // Svuotata del tutto = tolta (la cancellazione è qui sotto)
      if (figlioVuoto(f)) continue
      tenuti.add(riga.id)
      const valori = { nome: nomeFiglio(f.nome), classeScuola: f.classeScuola ?? null, materie: f.materie ?? null, ordine }
      if (valori.nome !== riga.nome || valori.classeScuola !== riga.classeScuola
        || valori.materie !== riga.materie || valori.ordine !== riga.ordine) {
        modifiche.push({ id: riga.id, valori: { ...valori, updatedAt: adesso } })
      }
      continue
    }

    // Riga nuova. Un id che non è di questo contatto (una riga cancellata nel
    // frattempo da un'altra finestra, o peggio) non tocca mai niente: vale come nuova.
    // Il figlio virtuale arriva senza id ed è sempre il primo del modulo: la prima
    // riga senza id prende il suo posto, e con lui il suo collegamento allo studente.
    if (virtuale && !virtualeArrivato && !f.id) {
      virtualeArrivato = true
      if (virtuale.studentId) {
        // Già alunno: i dati restano quelli di prima, come per le righe salvate
        nuovi.push({
          contactId:    c.id,
          nome:         virtuale.nome,
          classeScuola: virtuale.classeScuola,
          materie:      virtuale.materie,
          studentId:    virtuale.studentId,
          ordine,
        })
        continue
      }
    }
    if (figlioVuoto(f)) continue
    nuovi.push(righeFigliNuove(c.id, [f], ordine)[0]!)
  }

  const tolti = salvati.filter((r) => !tenuti.has(r.id))
  if (tolti.some((r) => alunnoDi(r)) || (virtuale?.studentId && !virtualeArrivato)) {
    throw new Error('Non puoi togliere un figlio che è già diventato alunno')
  }

  if (tolti.length > 0) {
    await tx.delete(contactFigli).where(and(
      eq(contactFigli.contactId, c.id),
      inArray(contactFigli.id, tolti.map((r) => r.id)),
    ))
  }
  for (const { id, valori } of modifiche) {
    await tx.update(contactFigli).set(valori).where(and(eq(contactFigli.id, id), eq(contactFigli.contactId, c.id)))
  }
  if (nuovi.length > 0) await tx.insert(contactFigli).values(nuovi)

  return virtuale !== null
}

/**
 * I figli di un contatto nuovo. Il modulo di adesso li manda in `figli`; una scheda
 * del browser aperta da prima dell'aggiornamento manda ancora i tre campi di una
 * volta. Qui non c'è niente di vecchio da sovrascrivere, quindi quei tre campi
 * diventano il primo figlio invece di andare persi.
 */
function figliDaCreare(data: CreateContactInput): DatiFiglio[] {
  if (!eFamiglia({ tipo: data.tipo, doposcuolaRuolo: data.doposcuolaRuolo ?? 'STUDENTE' })) return []
  const figli = data.figli ?? [{ nome: data.nomeStudente, classeScuola: data.classeScuola, materie: data.materie }]
  return figli.filter((f) => !figlioVuoto(f))
}

// ─────────────────────────────────────────────
// CREATE / UPDATE
// ─────────────────────────────────────────────

export async function createContact(data: CreateContactInput, userId: string) {
  const famiglia = eFamiglia({ tipo: data.tipo, doposcuolaRuolo: data.doposcuolaRuolo ?? 'STUDENTE' })
  const figli = figliDaCreare(data)

  const valori: typeof contacts.$inferInsert = {
    tipo:               data.tipo,
    nome:               nomeProprio(data.nome),
    cognome:            data.cognome ? nomeProprio(data.cognome) : null,
    telefono:           data.telefono ?? null,
    email:              data.email ?? null,
    socialLink:         data.socialLink ?? null,
    canaleOrigine:      data.canaleOrigine,
    stato:              data.stato,
    prossimoRicontatto: data.prossimoRicontatto ?? null,
    note:               data.note ?? null,
    // I figli (nome, classe, materie) vanno in contact_figli, qui sotto. Sul
    // contatto restano solo le materie che un candidato tutor insegna.
    materie:            famiglia ? null : (data.materie ?? null),
    azienda:            data.azienda ?? null,
    servizioInteresse:  data.servizioInteresse ?? null,
    marketingRuolo:     data.marketingRuolo ?? null,
    doposcuolaRuolo:    data.doposcuolaRuolo ?? 'STUDENTE',
    privacyInformata:   data.privacyInformata,
    createdByUserId:    userId,
    // Se nasce già "Convertito" (import/casi particolari) segniamo subito la data
    convertitoAt:       data.stato === 'CONVERTITO' ? new Date() : null,
  }

  const prima = data.primaInterazione
  // Quando ci si è sentiti la prima volta (se indicato): riempie anche "ultimo contatto"
  const quando = prima ? new Date(prima.data) : null

  // Rubrica, figli e prima riga del diario nella stessa operazione: o tutto, o
  // niente (mai un contatto a metà, senza i figli appena scritti).
  const creato = await db.transaction(async (tx) => {
    const [riga] = await tx.insert(contacts)
      .values(quando ? { ...valori, ultimoContattoAt: quando } : valori)
      .returning()

    if (!riga) throw new Error('Creazione del contatto non riuscita')

    if (figli.length > 0) await tx.insert(contactFigli).values(righeFigliNuove(riga.id, figli))

    if (prima && quando) {
      await tx.insert(contactInteractions).values({
        contactId:       riga.id,
        tipo:            prima.tipo,
        direzione:       prima.direzione,
        // Canale non scelto a mano: vale la fonte del contatto
        canale:          prima.canale ?? data.canaleOrigine,
        note:            prima.note ?? null,
        data:            quando,
        createdByUserId: userId,
      })
    }

    return riga
  })

  return await conFigli(creato)
}

/**
 * Il contatto appena diventato alunno entra nell'appello dei Rientri già
 * "Confermato": si è appena iscritto, è ovvio che viene (regola d'oro §2 del
 * piano: nessuno sta insieme nei Contatti e nei Rientri).
 * Se qualcosa qui va storto NON si annulla la conversione: il contatto è già
 * diventato studente, ed è quello che conta.
 */
async function segnaRientroConfermato(studentId: string, userId: string) {
  try {
    const { anno } = await getAnnoCorrente()
    await setRientro(
      studentId,
      anno,
      { stato: 'CONFERMATO', dataRisposta: oggiRomeStr(), note: 'Nuovo iscritto arrivato dai Contatti' },
      userId,
    )
  } catch (err) {
    console.error('[contatti] conversione riuscita ma rientro non segnato:', err)
  }
}

export async function updateContact(id: string, data: UpdateContactInput, userId: string) {
  const [esistente] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1)
  if (!esistente) throw new Error('Contatto non trovato')

  // I figli non sono una colonna del contatto: si salvano a parte (salvaFigli)
  const { figli, ...campi } = data
  const changes: ContactChanges = { updatedAt: new Date() }
  for (const [chiave, valore] of Object.entries(campi)) {
    if (valore !== undefined) (changes as Record<string, unknown>)[chiave] = valore
  }

  // Stessa garanzia della creazione: non si può restare senza NESSUN recapito.
  // Si controlla il risultato finale (modifiche unite ai dati già salvati), così
  // non si svuota l'ultimo recapito rimasto con una modifica parziale.
  // Il controllo scatta solo se la richiesta tocca davvero telefono, email o
  // profilo social: le richieste del sito possono creare contatti senza recapiti
  // riconosciuti e devono restare modificabili nel resto.
  if (changes.telefono !== undefined || changes.email !== undefined || changes.socialLink !== undefined) {
    const telefonoFinale = changes.telefono   !== undefined ? changes.telefono   : esistente.telefono
    const emailFinale    = changes.email      !== undefined ? changes.email      : esistente.email
    const socialFinale   = changes.socialLink !== undefined ? changes.socialLink : esistente.socialLink
    if (!telefonoFinale && !emailFinale && !socialFinale) {
      throw new Error('Inserisci almeno un recapito: telefono, email o profilo social')
    }
  }

  // Nomi sempre in formato "Nome Proprio" (mai tutto maiuscolo/minuscolo)
  if (typeof changes.nome === 'string') changes.nome = nomeProprio(changes.nome)
  if (typeof changes.cognome === 'string' && changes.cognome) changes.cognome = nomeProprio(changes.cognome)

  // Famiglia interessata, a modifica fatta? Allora i figli stanno in contact_figli
  // e i vecchi campi del contatto non si scrivono più. Se arrivano lo stesso li
  // manda una scheda del browser aperta da prima dell'aggiornamento, con i dati di
  // allora: si ignorano, per non scrivere dati vecchi sopra ai figli.
  const famiglia = eFamiglia({
    tipo:            changes.tipo ?? esistente.tipo,
    doposcuolaRuolo: changes.doposcuolaRuolo ?? esistente.doposcuolaRuolo,
  })
  if (famiglia) {
    delete changes.nomeStudente
    delete changes.classeScuola
    delete changes.materie
    // Appena diventato una famiglia (era un candidato tutor): le materie scritte sul
    // contatto erano quelle che insegnava, non di un figlio. Si svuotano, se no il
    // ripiego le scambierebbe per il figlio di un contatto di prima.
    if (!eFamiglia(esistente)) Object.assign(changes, SENZA_CAMPI_VECCHI)
  }

  aggiornaConvertitoAt(changes, data.stato, esistente.convertitoAt)

  // Contatto e figli nella stessa operazione: o tutti e due, o nessuno dei due
  const aggiornato = await db.transaction(async (tx) => {
    if (figli !== undefined) {
      // Chi non è (più) una famiglia, per esempio un contatto passato a "Possibile
      // tutor", non ha figli: la lista vuota toglie quelli rimasti, ma mai uno già
      // diventato alunno (salvaFigli si ferma con un errore chiaro).
      const virtualeConsumato = await salvaFigli(tx, esistente, famiglia ? figli : [])
      if (virtualeConsumato && famiglia) Object.assign(changes, SENZA_CAMPI_VECCHI)
    }
    const [riga] = await tx.update(contacts).set(changes).where(eq(contacts.id, id)).returning()
    return riga
  })

  // È questa la modifica che lo trasforma in alunno ("Crea studente")? Solo
  // allora si apre la riga nei Rientri: le modifiche successive non la toccano.
  // Un candidato tutor convertito con "Crea tutor" porta tutorUserId e non
  // studentId: qui non entra, i Rientri sono l'appello degli alunni.
  const appenaConvertito = Boolean(
    aggiornato
    && aggiornato.stato === 'CONVERTITO'
    && aggiornato.studentId
    && (esistente.stato !== 'CONVERTITO' || !esistente.studentId),
  )
  if (appenaConvertito && aggiornato?.studentId) {
    await segnaRientroConfermato(aggiornato.studentId, userId)
  }

  return aggiornato ? await conFigli(aggiornato) : null
}

// ─────────────────────────────────────────────
// COLLEGA UN FIGLIO ALLO STUDENTE CREATO — POST /api/contacts/:id/figli/collega
// "Crea studente" si fa un figlio alla volta: finito il wizard, QUEL figlio si
// collega allo studente appena nato e il contatto diventa "Convertito".
// ─────────────────────────────────────────────

export async function collegaFiglio(contactId: string, input: CollegaFiglioInput, userId: string) {
  const esito = await db.transaction(async (tx) => {
    const [contatto] = await tx.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    if (!contatto) throw new Error('Contatto non trovato')
    if (contatto.anonimizzatoAt) throw new Error('Questa scheda è stata svuotata dalla pulizia privacy: non si può più collegare')
    if (!eFamiglia(contatto)) throw new Error('Solo i possibili studenti del Doposcuola hanno figli da collegare')

    const [studente] = await tx.select({ id: students.id }).from(students).where(eq(students.id, input.studentId)).limit(1)
    if (!studente) throw new Error('Studente non trovato')

    // Si ragiona sugli stessi figli che l'utente vede (ripiego compreso): figlioId
    // null è il figlio "di prima" di un contatto vecchio, che non ha ancora una riga
    const salvati = await righeSalvate(tx, contactId)
    const figlio = figliConRipiego(contatto, salvati.map(perRipiego))
      .find((f) => f.id === input.figlioId)
    if (!figlio) throw new Error('Figlio non trovato in questo contatto')
    if (figlio.studentId && figlio.studentId !== input.studentId) {
      throw new Error('Questo figlio è già collegato a un altro alunno')
    }
    // Stesso collegamento già salvato (doppio clic, o una seconda chiamata): niente di nuovo
    const giaCollegato = figlio.id !== null
      && salvati.find((r) => r.id === figlio.id)?.studentId === input.studentId

    const adesso = new Date()
    const changes: ContactChanges = { updatedAt: adesso }

    if (figlio.id) {
      await tx.update(contactFigli)
        .set({ studentId: input.studentId, updatedAt: adesso })
        .where(and(eq(contactFigli.id, figlio.id), eq(contactFigli.contactId, contactId)))
    } else {
      // Il figlio "di prima" diventa ora una riga vera, già collegata; i vecchi
      // campi del contatto si svuotano (vedi figliConRipiego)
      await tx.insert(contactFigli).values({
        contactId,
        nome:         figlio.nome,
        classeScuola: figlio.classeScuola,
        materie:      figlio.materie,
        studentId:    input.studentId,
        ordine:       0,
      })
      Object.assign(changes, SENZA_CAMPI_VECCHI)
    }

    // Il collegamento "unico" di prima resta al primo figlio diventato alunno: c'è
    // ancora chi legge quel campo (il sito vecchio finché non si aggiorna, i
    // contatti convertiti da una scheda del browser aperta da prima)
    if (!contatto.studentId) changes.studentId = input.studentId
    if (contatto.stato !== 'CONVERTITO') {
      changes.stato = 'CONVERTITO'
      aggiornaConvertitoAt(changes, 'CONVERTITO', contatto.convertitoAt)
    }

    const [aggiornato] = await tx.update(contacts).set(changes).where(eq(contacts.id, contactId)).returning()
    return { aggiornato, giaCollegato }
  })

  // Ogni figlio che diventa alunno entra nei Rientri già "Confermato", non solo il
  // primo: due fratelli iscritti sono due ragazzi che a settembre ci sono
  if (!esito.giaCollegato) await segnaRientroConfermato(input.studentId, userId)

  return esito.aggiornato ? await conFigli(esito.aggiornato) : null
}

// ─────────────────────────────────────────────
// IMPORT DA CSV — POST /api/contacts/import
// Le righe arrivano dal browser così come stanno nel file; qui si traducono
// (stessa funzione dell'anteprima) e si scrivono, saltando i doppioni.
// Una riga sbagliata NON blocca le altre: si segnala e si va avanti.
// ─────────────────────────────────────────────

export async function importContacts(
  righe: RigaImportContatto[],
  tipoDefault: TipoContatto,
  userId: string,
) {
  const saltati: Array<{ riga: number; motivo: string }> = []
  const errori:  Array<{ riga: number; motivo: string }> = []
  let importati = 0

  await db.transaction(async (tx) => {
    // Recapiti già visti in questo stesso file: "chiave del recapito" → numero di riga
    const giaVisti = new Map<string, number>()

    for (const [indice, grezza] of righe.entries()) {
      // Se il browser non ha detto da quale riga viene, si conta dall'intestazione (riga 1)
      const numeroRiga = grezza.riga ?? indice + 2

      const esito = normalizzaRigaImport(grezza, tipoDefault)
      if (!esito.ok) {
        errori.push({ riga: numeroRiga, motivo: esito.errori.join(' · ') })
        continue
      }

      const d = esito.dati
      const social = d.socialLink ? d.socialLink.toLowerCase() : null
      const chiavi = [
        d.telefono ? `tel:${d.telefono}` : null,
        d.email ? `mail:${d.email}` : null,
        social ? `social:${social}` : null,
      ].filter((c): c is string => c !== null)

      // 1) doppione di una riga precedente dello stesso file
      const chiaveRipetuta = chiavi.find((c) => giaVisti.has(c))
      if (chiaveRipetuta) {
        saltati.push({ riga: numeroRiga, motivo: `doppione di riga ${giaVisti.get(chiaveRipetuta)} dello stesso file` })
        continue
      }

      // 2) doppione di un contatto già in rubrica (archiviati esclusi)
      const [esistente] = await tx.select({ nome: contacts.nome, cognome: contacts.cognome })
        .from(contacts)
        .where(and(
          isNull(contacts.archiviatoAt),
          or(
            d.telefono ? eq(contacts.telefono, d.telefono) : undefined,
            d.email ? sql`lower(${contacts.email}) = ${d.email}` : undefined,
            social ? sql`lower(${contacts.socialLink}) = ${social}` : undefined,
          ),
        ))
        .limit(1)

      if (esistente) {
        const chi = [esistente.cognome, esistente.nome].filter(Boolean).join(' ')
        saltati.push({ riga: numeroRiga, motivo: `doppione di ${chi || 'un contatto'} già in rubrica` })
        continue
      }

      // Salvataggio in un savepoint: se Postgres rifiuta proprio questa riga (es. un valore
      // che la validazione non ha previsto) si segnala SOLO lei e il blocco prosegue,
      // invece di annullare anche le righe buone già scritte.
      try {
        await tx.transaction(async (sp) => {
          const [creato] = await sp.insert(contacts).values({
            tipo:               d.tipo,
            nome:               nomeProprio(d.nome),
            cognome:            d.cognome ? nomeProprio(d.cognome) : null,
            telefono:           d.telefono ?? null,
            email:              d.email ?? null,
            socialLink:         d.socialLink ?? null,
            canaleOrigine:      d.canaleOrigine,
            stato:              d.stato,
            prossimoRicontatto: d.prossimoRicontatto ?? null,
            note:               d.note ?? null,
            // Per le famiglie normalizzaRigaImport mette le materie sul figlio (qui null)
            materie:            d.materie ?? null,
            azienda:            d.azienda ?? null,
            servizioInteresse:  d.servizioInteresse ?? null,
            marketingRuolo:     d.marketingRuolo ?? null,
            doposcuolaRuolo:    d.doposcuolaRuolo ?? 'STUDENTE',
            privacyInformata:   d.privacyInformata,
            createdByUserId:    userId,
            convertitoAt:       d.stato === 'CONVERTITO' ? new Date() : null,
          }).returning({ id: contacts.id })

          // Il figlio della riga (colonne nome_studente, classe_scuola, materie),
          // nello stesso savepoint: se non entra lui, non entra nemmeno il contatto
          if (creato && d.figli && d.figli.length > 0) {
            await sp.insert(contactFigli).values(righeFigliNuove(creato.id, d.figli))
          }
        })
      } catch (err) {
        const dettaglio = err instanceof Error ? err.message.split('\n')[0] : 'errore sconosciuto'
        errori.push({ riga: numeroRiga, motivo: `salvataggio rifiutato dal database (${dettaglio})` })
        continue
      }

      for (const c of chiavi) giaVisti.set(c, numeroRiga)
      importati++
    }
  })

  return { importati, saltati, errori }
}

// ─────────────────────────────────────────────
// ARCHIVIA / RIPRISTINA (cestino morbido: niente cancellazioni definitive)
// ─────────────────────────────────────────────

export async function archiveContact(id: string) {
  const [aggiornato] = await db.update(contacts)
    .set({ archiviatoAt: new Date(), updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning()

  if (!aggiornato) throw new Error('Contatto non trovato')
  return aggiornato
}

export async function restoreContact(id: string) {
  const [aggiornato] = await db.update(contacts)
    .set({ archiviatoAt: null, updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning()

  if (!aggiornato) throw new Error('Contatto non trovato')
  return aggiornato
}

// ─────────────────────────────────────────────
// DIARIO — aggiunta e cancellazione di un'interazione
// ─────────────────────────────────────────────

export async function addInteraction(contactId: string, data: CreateInteractionInput, userId: string) {
  return await db.transaction(async (tx) => {
    const [contatto] = await tx.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    if (!contatto) throw new Error('Contatto non trovato')

    const quando = data.data ? new Date(data.data) : new Date()

    const [interazione] = await tx.insert(contactInteractions).values({
      contactId,
      tipo:            data.tipo,
      direzione:       data.direzione,
      canale:          data.canale,
      esito:           data.esito ?? null,
      note:            data.note ?? null,
      data:            quando,
      createdByUserId: userId,
    }).returning()

    const changes: ContactChanges = { updatedAt: new Date() }

    // "Ultimo contatto" avanza solo se questa interazione è più recente
    if (!contatto.ultimoContattoAt || quando > contatto.ultimoContattoAt) {
      changes.ultimoContattoAt = quando
    }

    if (data.nuovoStato) {
      changes.stato = data.nuovoStato
      aggiornaConvertitoAt(changes, data.nuovoStato, contatto.convertitoAt)
    }

    // null = cancella il post-it, undefined = lascialo com'è
    if (data.prossimoRicontatto !== undefined) {
      changes.prossimoRicontatto = data.prossimoRicontatto
    }

    const [aggiornato] = await tx.update(contacts).set(changes).where(eq(contacts.id, contactId)).returning()

    return { interazione, contatto: aggiornato ?? contatto }
  })
}

export async function deleteInteraction(contactId: string, interactionId: string) {
  return await db.transaction(async (tx) => {
    // Il filtro su ENTRAMBI gli id impedisce di cancellare la riga di un altro contatto
    const [eliminata] = await tx.delete(contactInteractions)
      .where(and(eq(contactInteractions.id, interactionId), eq(contactInteractions.contactId, contactId)))
      .returning()

    if (!eliminata) throw new Error('Interazione non trovata')

    // "Ultimo contatto" ricalcolato dal diario rimasto
    const [ultima] = await tx.select({ quando: sql<Date | null>`MAX(${contactInteractions.data})` })
      .from(contactInteractions)
      .where(eq(contactInteractions.contactId, contactId))

    const [contatto] = await tx.update(contacts)
      .set({ ultimoContattoAt: ultima?.quando ?? null, updatedAt: new Date() })
      .where(eq(contacts.id, contactId))
      .returning()

    return { success: true, contatto: contatto ?? null }
  })
}

// ─────────────────────────────────────────────
// DOPPIONI — cerca sia tra i contatti sia tra gli studenti già clienti
// ─────────────────────────────────────────────

export async function findDuplicates(params: { telefono?: string | null; email?: string | null; social?: string | null }) {
  const telefono = params.telefono ? normalizzaTelefono(params.telefono) : ''
  const email = params.email ? params.email.trim().toLowerCase() : ''
  // Il profilo social si confronta senza distinzione fra maiuscole e minuscole
  const social = params.social ? params.social.trim().toLowerCase() : ''
  if (!telefono && !email && !social) return { contatti: [], studenti: [] }

  // Ultime 8 cifre: nel DB studenti i numeri sono in formati liberi ("333 12 34 567"),
  // quindi filtriamo in SQL sulle sole cifre e confermiamo lato applicazione.
  const coda = telefono.replace(/\D/g, '').slice(-8)
  const soloCifre = (colonna: unknown) => sql`regexp_replace(coalesce(${colonna}, ''), '[^0-9]', '', 'g')`

  const [contattiTrovati, studentiCandidati] = await Promise.all([
    db.select({
      id:         contacts.id,
      nome:       contacts.nome,
      cognome:    contacts.cognome,
      tipo:       contacts.tipo,
      stato:      contacts.stato,
      telefono:   contacts.telefono,
      email:      contacts.email,
      socialLink: contacts.socialLink,
    })
      .from(contacts)
      .where(and(
        isNull(contacts.archiviatoAt),
        or(
          telefono ? eq(contacts.telefono, telefono) : undefined,
          email ? sql`lower(${contacts.email}) = ${email}` : undefined,
          social ? sql`lower(${contacts.socialLink}) = ${social}` : undefined,
        ),
      ))
      .orderBy(asc(contacts.nome))
      .limit(10),

    db.select({
      id:           students.id,
      firstName:    students.firstName,
      lastName:     students.lastName,
      classe:       students.classe,
      parentPhone:  students.parentPhone,
      studentPhone: students.studentPhone,
      parentEmail:  students.parentEmail,
      studentEmail: students.studentEmail,
    })
      .from(students)
      .where(and(
        eq(students.active, true),
        // Cercando solo per profilo social non c'è niente da confrontare fra gli
        // studenti (là ci sono solo telefoni ed email): la query si ferma subito.
        (coda || email) ? undefined : sql`false`,
        or(
          coda ? sql`${soloCifre(students.parentPhone)} LIKE ${'%' + coda}` : undefined,
          coda ? sql`${soloCifre(students.studentPhone)} LIKE ${'%' + coda}` : undefined,
          email ? sql`lower(${students.parentEmail}) = ${email}` : undefined,
          email ? sql`lower(${students.studentEmail}) = ${email}` : undefined,
        ),
      ))
      .limit(20),
  ])

  const studenti = studentiCandidati
    .filter((s) => {
      if (email && (s.parentEmail?.toLowerCase() === email || s.studentEmail?.toLowerCase() === email)) return true
      if (!telefono) return false
      return normalizzaTelefono(s.parentPhone ?? '') === telefono
        || normalizzaTelefono(s.studentPhone ?? '') === telefono
    })
    .map((s) => ({ id: s.id, nome: `${s.firstName} ${s.lastName}`.trim(), classe: s.classe }))

  return { contatti: contattiTrovati, studenti }
}

// ─────────────────────────────────────────────
// FORM PUBBLICO DEL SITO — /api/contact
// Crea il contatto col suo primo figlio. Se lo conosciamo già aggiunge una riga
// di diario e, se ci scrive per un figlio nuovo, quel figlio in coda agli altri.
// ─────────────────────────────────────────────

export async function upsertFromPublicRequest(input: {
  requestId: string
  nomeStudente: string
  classeScuola?: string | null
  materie: string
  contatto: string
  note?: string | null
}) {
  const grezzo = (input.contatto ?? '').trim()

  // Il form del sito ha un campo unico "contatto": lo smistiamo nella colonna giusta
  let telefono: string | null = null
  if (sembraTelefono(grezzo)) {
    const normalizzato = normalizzaTelefono(grezzo)
    if (normalizzato && normalizzato.length <= 20) telefono = normalizzato
  }
  const email = !telefono && sembraEmail(grezzo) ? grezzo.toLowerCase().slice(0, 255) : null

  // Né telefono né email: se sembra un profilo social lo salviamo come recapito,
  // così il contatto non resta senza nessun modo per essere richiamato.
  const socialLink = !telefono && !email && sembraSocial(grezzo) ? grezzo.slice(0, 300) : null

  const testoDiario = [
    'Messaggio ricevuto dal sito.',
    `Studente: ${input.nomeStudente}`,
    input.classeScuola ? `Classe/Scuola: ${input.classeScuola}` : null,
    `Materie: ${input.materie}`,
    input.note ? `Note: ${input.note}` : null,
    !telefono && !email && !socialLink ? `Recapito indicato: ${grezzo}` : null,
  ].filter(Boolean).join('\n')

  // Il ragazzo per cui ci scrivono (il modulo del sito ne porta uno per invio)
  const figlioDalSito: DatiFiglio = {
    nome:         input.nomeStudente.trim().slice(0, 200) || null,
    classeScuola: input.classeScuola?.trim().slice(0, 200) || null,
    materie:      input.materie.trim().slice(0, 500) || null,
  }

  return await db.transaction(async (tx) => {
    const adesso = new Date()

    let esistente: typeof contacts.$inferSelect | null = null
    if (telefono || email || socialLink) {
      const [trovato] = await tx.select().from(contacts)
        .where(and(
          isNull(contacts.archiviatoAt),
          or(
            telefono ? eq(contacts.telefono, telefono) : undefined,
            email ? sql`lower(${contacts.email}) = ${email}` : undefined,
            socialLink ? sql`lower(${contacts.socialLink}) = ${socialLink.toLowerCase()}` : undefined,
          ),
        ))
        .orderBy(desc(contacts.createdAt))
        .limit(1)
      esistente = trovato ?? null
    }

    let contactId: string

    if (esistente) {
      contactId = esistente.id
      const changes: ContactChanges = { ultimoContattoAt: adesso, updatedAt: adesso }
      // Ci riscrive dopo essere stato archiviato come chiuso: torna in lavorazione
      if (esistente.stato === 'CONVERTITO' || esistente.stato === 'PERSO') {
        changes.stato = 'NUOVO'
        changes.convertitoAt = null
      }
      if (!esistente.contactRequestId) changes.contactRequestId = input.requestId

      // Una famiglia che conosciamo già ci scrive per un altro figlio: si aggiunge
      // in coda ai suoi. Se il nome c'è già (anche scritto diverso: maiuscole,
      // accenti, spazi doppi) è lo stesso ragazzo e non si duplica; la riga di
      // diario qui sotto c'è comunque. Un candidato tutor con lo stesso recapito
      // resta com'è, come prima: solo la riga di diario.
      if (eFamiglia(esistente)) {
        const salvati = await righeSalvate(tx, contactId)
        const visti = figliConRipiego(esistente, salvati.map(perRipiego))
        const chiave = chiaveNome(figlioDalSito.nome)

        if (!visti.some((f) => chiaveNome(f.nome) === chiave)) {
          const nuove: Array<typeof contactFigli.$inferInsert> = []
          const virtuale = visti.find((f) => f.id === null)
          if (virtuale) {
            // Il figlio "di prima" diventa una riga vera prima di aggiungergli il
            // fratello: se no, appena c'è una riga, sparirebbe (è il ripiego)
            nuove.push({
              contactId,
              nome:         virtuale.nome,
              classeScuola: virtuale.classeScuola,
              materie:      virtuale.materie,
              studentId:    virtuale.studentId,
              ordine:       0,
            })
            Object.assign(changes, SENZA_CAMPI_VECCHI)
          }
          const primo = salvati.length > 0 ? Math.max(...salvati.map((r) => r.ordine)) + 1 : nuove.length
          nuove.push(...righeFigliNuove(contactId, [figlioDalSito], primo))
          await tx.insert(contactFigli).values(nuove)
        }
      }

      await tx.update(contacts).set(changes).where(eq(contacts.id, contactId))
    } else {
      const [creato] = await tx.insert(contacts).values({
        tipo:             'DOPOSCUOLA',
        // Referente provvisorio: il form chiede solo il nome dello studente
        nome:             nomeProprio(input.nomeStudente).slice(0, 100),
        telefono,
        email,
        socialLink,
        canaleOrigine:    'SITO_WEB',
        stato:            'NUOVO',
        note:             input.note ?? null,
        contactRequestId: input.requestId,
        // Il form pubblico obbliga la presa visione dell'informativa
        privacyInformata: true,
        ultimoContattoAt: adesso,
      }).returning({ id: contacts.id })

      if (!creato) throw new Error('Creazione del contatto non riuscita')
      contactId = creato.id

      // Il ragazzo del modulo è il primo figlio della famiglia
      await tx.insert(contactFigli).values(righeFigliNuove(contactId, [figlioDalSito]))
    }

    await tx.insert(contactInteractions).values({
      contactId,
      tipo:      'MESSAGGIO',
      direzione: 'RICEVUTA',
      canale:    'SITO_WEB',
      note:      testoDiario,
      data:      adesso,
    })

    return { contactId, creato: !esistente }
  })
}
