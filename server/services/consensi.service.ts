// server/services/consensi.service.ts
//
// I CONSENSI PRIVACY — chi ha detto sì, a che cosa, quando e da dove.
//
// Tre interruttori separati, non uno generale (voce B4 del piano):
//   • MINORE_14 — l'autorizzazione del genitore per l'alunno che non ha ancora
//     14 anni. Obbligatoria per lui, e per nessun altro.
//   • IMMAGINI  — foto e video. Facoltativa sul serio: si può dire di no e il
//     doposcuola funziona identico. Un consenso "in blocco" con gli obbligatori
//     non sarebbe libero, e quindi non varrebbe niente.
//   • MARKETING — le comunicazioni promozionali. È della PERSONA (il genitore),
//     non del figlio: la mamma che dice no dice no per sé, non "per Luca".
//
// LA REGOLA DI CASA: non si modifica mai una riga, se ne scrive una nuova. Lo
// stato di adesso è l'ULTIMA riga per ciascun tipo; tutte le altre restano e sono
// la risposta alla domanda «in che data ha revocato?». Vedi schema/consensi.ts.
//
// Questo servizio è il PRIMO che accende il campanellino (creaNotifica): fino a
// oggi la tabella delle notifiche era pronta e vuota. Suona solo per i
// cambiamenti che arrivano dal PORTALE — quelli fatti in segreteria li sta
// facendo proprio la persona che guarderebbe il campanellino.

import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../database/client'
import { consensi, students, studentParents, users } from '../database/schema'
import { creaNotifica } from './notifiche.service'
import { eMinoreDi14 } from '#shared/eta'

export type ConsensoTipo = 'MINORE_14' | 'IMMAGINI' | 'MARKETING'
export type ConsensoOrigine = 'PORTALE' | 'GESTIONALE'

// Le etichette in italiano stanno qui, una volta sola: le usano sia il testo
// delle notifiche sia (in futuro) le pagine. Due elenchi che si allontanano nel
// tempo sono il modo più sicuro per far leggere alla famiglia una parola e alla
// segreteria un'altra.
export const ETICHETTA_BREVE: Record<ConsensoTipo, string> = {
  MINORE_14: 'Autorizzazione del genitore',
  IMMAGINI:  'Consenso immagini',
  MARKETING: 'Consenso marketing',
}

export const ETICHETTA_ESTESA: Record<ConsensoTipo, string> = {
  MINORE_14: 'l\'autorizzazione del genitore per il minore di 14 anni',
  IMMAGINI:  'il consenso alle immagini (foto e video)',
  MARKETING: 'il consenso alle comunicazioni promozionali',
}

// I titoli del campanellino, scritti per esteso invece di incollare
// "etichetta + dato/revocato": in italiano l'accordo cambia
// ("autorizzazione revocatA", "consenso revocatO") e un titolo sgrammaticato in
// cima a un avviso di privacy fa l'effetto sbagliato.
const TITOLO_AVVISO: Record<ConsensoTipo, { dato: string; revocato: string }> = {
  MINORE_14: { dato: 'Autorizzazione del genitore data', revocato: 'Autorizzazione del genitore revocata' },
  IMMAGINI:  { dato: 'Consenso immagini dato',           revocato: 'Consenso immagini revocato' },
  MARKETING: { dato: 'Consenso marketing dato',          revocato: 'Consenso marketing revocato' },
}

/** Una voce dello stato attuale. `valore: null` = non ha mai risposto. */
export interface VoceConsenso {
  tipo: ConsensoTipo
  valore: boolean | null
  quando: Date | null
  origine: ConsensoOrigine | null
  /** Nome di chi ha fatto il cambiamento (attoreUserId) */
  chi: string | null
  /** Versione del testo accettato; null quando l'ha registrato la segreteria */
  versione: string | null
  note: string | null
}

/** Una riga dello storico, già pronta da mostrare (nomi risolti) */
export interface RigaStorico {
  id: string
  tipo: ConsensoTipo
  valore: boolean
  quando: Date
  origine: ConsensoOrigine
  /** Chi ha fatto il cambiamento */
  chi: string | null
  /** La persona a cui il consenso si riferisce (per il marketing è lei il soggetto) */
  persona: string | null
  versione: string | null
  note: string | null
}

// "Mario Rossi" oppure null quando la join non ha trovato nessuno (account
// cancellato, oppure colonna vuota). Mai la stringa "null null".
const nomeDi = (u: { firstName: string | null; lastName: string | null } | null | undefined) =>
  u && (u.firstName || u.lastName) ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : null

const VUOTA = (tipo: ConsensoTipo): VoceConsenso => ({
  tipo, valore: null, quando: null, origine: null, chi: null, versione: null, note: null,
})

/**
 * I genitori di questo alunno che hanno un account del portale.
 * Sono loro (e nessun altro) i titolari del consenso MARKETING che la segreteria
 * può vedere e cambiare dalla scheda dell'alunno.
 */
export async function genitoriPortaleDi(studentId: string) {
  const righe = await db.query.studentParents.findMany({
    where: eq(studentParents.studentId, studentId),
    orderBy: [studentParents.createdAt],
    with: {
      parentUser: { columns: { id: true, firstName: true, lastName: true, email: true, active: true } },
    },
  })

  return righe.map((r) => ({
    userId:    r.parentUser.id,
    nome:      nomeDi(r.parentUser) ?? r.parentUser.email,
    email:     r.parentUser.email,
    relazione: r.relazione,
    active:    r.parentUser.active,
  }))
}

// Tutte le righe che riguardano questo alunno: le sue (minore 14, immagini) più
// il MARKETING dei suoi genitori del portale. Una sola query con due alias di
// users, così i nomi arrivano già risolti e non si fa una domanda al database
// per ogni riga. Le righe di un alunno sono una manciata: si leggono tutte e si
// ragiona in JavaScript, che è molto più leggibile di un DISTINCT ON in SQL.
async function righeDi(studentId: string, idGenitori: string[]) {
  const attore  = alias(users, 'consensi_attore')
  const persona = alias(users, 'consensi_persona')

  // Senza genitori collegati resta solo la parte dell'alunno: `inArray` con una
  // lista vuota genererebbe una condizione sempre falsa, ma dentro un OR
  // confonde e basta.
  const filtroMarketing = idGenitori.length > 0
    ? and(eq(consensi.tipo, 'MARKETING'), inArray(consensi.userId, idGenitori))
    : undefined

  const dove = filtroMarketing
    ? or(eq(consensi.studentId, studentId), filtroMarketing)
    : eq(consensi.studentId, studentId)

  return await db
    .select({
      id:            consensi.id,
      tipo:          consensi.tipo,
      studentId:     consensi.studentId,
      userId:        consensi.userId,
      valore:        consensi.valore,
      testoVersione: consensi.testoVersione,
      origine:       consensi.origine,
      note:          consensi.note,
      createdAt:     consensi.createdAt,
      attoreNome:    { firstName: attore.firstName,  lastName: attore.lastName },
      personaNome:   { firstName: persona.firstName, lastName: persona.lastName },
    })
    .from(consensi)
    .leftJoin(attore,  eq(attore.id,  consensi.attoreUserId))
    .leftJoin(persona, eq(persona.id, consensi.userId))
    .where(dove)
    // Dalla più recente: la prima riga di ogni tipo è già lo stato di adesso.
    .orderBy(desc(consensi.createdAt))
}

type Riga = Awaited<ReturnType<typeof righeDi>>[number]

function voceDa(tipo: ConsensoTipo, riga: Riga | undefined): VoceConsenso {
  if (!riga) return VUOTA(tipo)
  return {
    tipo,
    valore:   riga.valore,
    quando:   riga.createdAt,
    origine:  riga.origine as ConsensoOrigine,
    chi:      nomeDi(riga.attoreNome),
    versione: riga.testoVersione,
    note:     riga.note,
  }
}

/**
 * LO STATO ATTUALE dei consensi di un alunno: l'ultima riga per ciascun tipo.
 *
 * Dentro ci sono anche due cose che NON stanno nella tabella dei consensi ma che
 * chi guarda la scheda si aspetta di trovare accanto alle altre:
 *  • `minoreDi14`, calcolato dalla data di nascita (null se la data manca: Q17,
 *    "non lo so" non è "no");
 *  • `autorizzazioneAccount`, la riga storica di users.consenso_genitore_at —
 *    l'autorizzazione raccolta in segreteria quando è stato creato l'account
 *    personale dello studente. È nata prima di questo registro e resta dov'è:
 *    ricopiarla qui vorrebbe dire avere la stessa cosa scritta in due posti che
 *    un giorno si contraddicono.
 */
export async function statoConsensi(studentId: string) {
  const studente = await db.query.students.findFirst({
    where: eq(students.id, studentId),
    columns: { id: true, firstName: true, lastName: true, dataNascita: true, studentUserId: true },
    with: {
      studentUser: {
        columns: { consensoGenitoreAt: true, consensoGenitoreRegistratoDaUserId: true },
      },
    },
  })
  if (!studente) throw new Error('Studente non trovato')

  const genitori = await genitoriPortaleDi(studentId)
  const righe = await righeDi(studentId, genitori.map((g) => g.userId))

  // L'operatore che raccolse l'autorizzazione alla creazione dell'account: una
  // query in più, e solo quando quel consenso esiste davvero. Non passa da una
  // relation perché users→users è un auto-riferimento (stessa scelta di
  // student-account.get.ts).
  let registratoDa: string | null = null
  const operatoreId = studente.studentUser?.consensoGenitoreRegistratoDaUserId
  if (operatoreId) {
    const operatore = await db.query.users.findFirst({
      where: eq(users.id, operatoreId),
      columns: { firstName: true, lastName: true },
    })
    registratoDa = nomeDi(operatore)
  }

  // La prima riga di ciascun tipo è la più recente: le righe arrivano già ordinate.
  const ultimaDellAlunno = (tipo: ConsensoTipo) =>
    righe.find((r) => r.tipo === tipo && r.studentId === studentId)

  return {
    studentId,
    nomeAlunno:  `${studente.firstName} ${studente.lastName}`.trim(),
    dataNascita: studente.dataNascita,
    // null = non lo sappiamo, e va detto: non è un "no"
    minoreDi14:  eMinoreDi14(studente.dataNascita),

    minore14: voceDa('MINORE_14', ultimaDellAlunno('MINORE_14')),
    immagini: voceDa('IMMAGINI',  ultimaDellAlunno('IMMAGINI')),

    // Un interruttore per ciascun genitore con account: il marketing è suo.
    marketing: genitori.map((g) => ({
      ...g,
      ...voceDa('MARKETING', righe.find((r) => r.tipo === 'MARKETING' && r.userId === g.userId)),
    })),

    // La riga storica "raccolto in segreteria alla creazione dell'account"
    autorizzazioneAccount: studente.studentUser?.consensoGenitoreAt
      ? { quando: studente.studentUser.consensoGenitoreAt, chi: registratoDa }
      : null,
  }
}

/**
 * TUTTO LO STORICO dell'alunno (e il marketing dei suoi genitori), dalla riga più
 * recente, con i nomi delle persone già risolti: pronto da mostrare.
 */
export async function storicoConsensi(studentId: string): Promise<RigaStorico[]> {
  const genitori = await genitoriPortaleDi(studentId)
  const righe = await righeDi(studentId, genitori.map((g) => g.userId))

  return righe.map((r) => ({
    id:       r.id,
    tipo:     r.tipo as ConsensoTipo,
    valore:   r.valore,
    quando:   r.createdAt,
    origine:  r.origine as ConsensoOrigine,
    chi:      nomeDi(r.attoreNome),
    persona:  nomeDi(r.personaNome),
    versione: r.testoVersione,
    note:     r.note,
  }))
}

export interface ImpostaConsensoInput {
  tipo: ConsensoTipo
  /** Obbligatorio per MINORE_14 e IMMAGINI; deve mancare per MARKETING */
  studentId?: string | null
  /** Obbligatorio per MARKETING (è il titolare); facoltativo per gli altri */
  userId?: string | null
  /** true = dato · false = revocato */
  valore: boolean
  /** La versione del testo accettato: la passa il portale, non la segreteria */
  testoVersione?: string | null
  origine: ConsensoOrigine
  /** CHI sta facendo il cambiamento: SEMPRE dalla sessione, mai dal browser */
  attoreUserId?: string | null
  note?: string | null
}

/**
 * Registra un cambiamento di consenso: scrive UNA RIGA NUOVA, mai un update.
 *
 * Se il cambiamento arriva dal PORTALE accende anche il campanellino, perché è
 * una notizia che la segreteria deve vedere senza andarla a cercare. Dal
 * gestionale no: la sta facendo proprio chi il campanellino lo guarda.
 */
export async function impostaConsenso(input: ImpostaConsensoInput) {
  const { tipo } = input
  const studentId = input.studentId ?? null
  const userId    = input.userId ?? null

  // Le combinazioni sbagliate si fermano qui e non nel database: una riga di
  // MARKETING appesa a un figlio direbbe una cosa falsa (che quella scelta vale
  // per quel figlio soltanto), e nessun controllo a valle se ne accorgerebbe più.
  if (tipo === 'MARKETING') {
    if (!userId) throw new Error('Il consenso marketing è della persona: serve l\'account del genitore.')
    if (studentId) throw new Error('Il consenso marketing non si collega a un alunno: vale per la persona.')
  } else {
    if (!studentId) throw new Error('Questo consenso riguarda l\'alunno: serve l\'alunno.')
  }

  const [riga] = await db.insert(consensi).values({
    tipo,
    studentId,
    userId,
    valore:        input.valore,
    testoVersione: input.testoVersione ?? null,
    origine:       input.origine,
    attoreUserId:  input.attoreUserId ?? null,
    note:          input.note ?? null,
  }).returning({ id: consensi.id, createdAt: consensi.createdAt })

  if (input.origine === 'PORTALE') {
    // Il campanellino non deve mai far fallire il salvataggio del consenso: il
    // consenso è il dato che conta, l'avviso è un servizio in più.
    try {
      await avvisaLaSegreteria({ tipo, studentId, userId, valore: input.valore, attoreUserId: input.attoreUserId ?? null })
    } catch {
      // volutamente silenzioso: la riga di consenso è già scritta
    }
  }

  return { ok: true as const, id: riga?.id, quando: riga?.createdAt }
}

// ─────────────────────────────────────────────
// IL LATO FAMIGLIA (portale)
// ─────────────────────────────────────────────

/**
 * I figli per cui il genitore deve ancora fare la dichiarazione del minore di 14
 * anni: quelli sotto i 14 che non hanno MAI avuto una riga MINORE_14.
 *
 * "MAI avuto una riga" e non "l'ultima riga dice no": la differenza è tutta qui.
 * Se il gate ripresentasse la spunta anche a chi ha REVOCATO, il genitore
 * resterebbe chiuso fuori dal portale finché non riacconsente — e un consenso che
 * non si può togliere senza perdere il servizio non è libero, quindi non vale
 * niente. Chi revoca lo fa dal Profilo, il campanellino avvisa la segreteria, e
 * il portale continua a funzionare: sarà il Centro a decidere cosa fare
 * dell'account del ragazzo, parlando con la famiglia.
 *
 * Senza data di nascita non si chiede niente (decisione Q17): "non lo so" non è "sì".
 */
export async function dichiarazioniMinoriMancanti(studentIds: string[]) {
  if (studentIds.length === 0) return []

  const figli = await db.query.students.findMany({
    where: inArray(students.id, studentIds),
    columns: { id: true, firstName: true, lastName: true, dataNascita: true, active: true },
  })

  // Solo i minori di 14 anni ancora iscritti: per un ex alunno non si chiede più niente
  const minori = figli.filter((f) => f.active && eMinoreDi14(f.dataNascita) === true)
  if (minori.length === 0) return []

  const risposte = await db
    .select({ studentId: consensi.studentId })
    .from(consensi)
    .where(and(
      eq(consensi.tipo, 'MINORE_14'),
      inArray(consensi.studentId, minori.map((m) => m.id)),
    ))
  const giaRisposto = new Set(risposte.map((r) => r.studentId))

  return minori
    .filter((m) => !giaRisposto.has(m.id))
    .map((m) => ({ id: m.id, nome: `${m.firstName} ${m.lastName}`.trim() }))
}

/**
 * Gli interruttori come li vede il genitore nel portale: per ogni figlio la
 * dichiarazione del minore (se lo riguarda) e le immagini; per sé stesso le
 * comunicazioni promozionali, che sono sue e non del figlio.
 */
export async function statoConsensiFamiglia(parentUserId: string, studentIds: string[]) {
  const figli = studentIds.length === 0 ? [] : await db.query.students.findMany({
    where: inArray(students.id, studentIds),
    columns: { id: true, firstName: true, lastName: true, dataNascita: true },
  })

  // Una lettura sola per tutti i figli, più quella del marketing di chi è entrato
  const righe = studentIds.length === 0
    ? []
    : await db.select({
      tipo: consensi.tipo, studentId: consensi.studentId, userId: consensi.userId,
      valore: consensi.valore, testoVersione: consensi.testoVersione,
      origine: consensi.origine, note: consensi.note, createdAt: consensi.createdAt,
    })
      .from(consensi)
      .where(and(
        inArray(consensi.studentId, studentIds),
        inArray(consensi.tipo, ['MINORE_14', 'IMMAGINI']),
      ))
      .orderBy(desc(consensi.createdAt))

  const [righeMarketing] = await db.select({
    valore: consensi.valore, testoVersione: consensi.testoVersione,
    origine: consensi.origine, createdAt: consensi.createdAt,
  })
    .from(consensi)
    .where(and(eq(consensi.tipo, 'MARKETING'), eq(consensi.userId, parentUserId)))
    .orderBy(desc(consensi.createdAt))
    .limit(1)

  // Nel portale non serve dire CHI ha toccato l'interruttore: lo sa, è lui.
  const voce = (tipo: ConsensoTipo, r?: { valore: boolean; createdAt: Date; origine: string; testoVersione: string | null }) =>
    r
      ? { tipo, valore: r.valore, quando: r.createdAt, origine: r.origine as ConsensoOrigine, versione: r.testoVersione }
      : { tipo, valore: null, quando: null, origine: null, versione: null }

  return {
    figli: figli.map((f) => ({
      studentId:  f.id,
      nome:       `${f.firstName} ${f.lastName}`.trim(),
      // null = non sappiamo quanti anni ha: niente dichiarazione, niente avvisi
      minoreDi14: eMinoreDi14(f.dataNascita),
      minore14:   voce('MINORE_14', righe.find((r) => r.tipo === 'MINORE_14' && r.studentId === f.id)),
      immagini:   voce('IMMAGINI',  righe.find((r) => r.tipo === 'IMMAGINI'  && r.studentId === f.id)),
    })),
    marketing: voce('MARKETING', righeMarketing),
  }
}

// ─────────────────────────────────────────────
// IL CAMPANELLINO (solo per i cambiamenti che arrivano dal portale)
// ─────────────────────────────────────────────
//
// Il testo deve dire tre cose senza aprire nulla: CHI, COSA e SU CHI.
// Es. "Maria Bianchi ha revocato il consenso alle immagini (foto e video) — Luca Rossi".
//
// NIENTE evitaDoppioni: qui i doppioni non esistono. Se un genitore revoca oggi e
// ridà domani, sono due notizie diverse e vanno viste tutte e due — accorparle
// significherebbe nascondere proprio il passaggio che interessa.
async function avvisaLaSegreteria(input: {
  tipo: ConsensoTipo
  studentId: string | null
  userId: string | null
  valore: boolean
  attoreUserId: string | null
}) {
  // Chi ha toccato l'interruttore
  let chi = 'Una famiglia'
  const idChi = input.attoreUserId ?? input.userId
  if (idChi) {
    const persona = await db.query.users.findFirst({
      where: eq(users.id, idChi),
      columns: { firstName: true, lastName: true },
    })
    chi = nomeDi(persona) ?? chi
  }

  // Su quale alunno. Il marketing non ne ha uno: si prova con il figlio più
  // probabile (il primo collegato a quel genitore) solo per avere un link dove
  // andare. Se ne ha due, meglio nessun nome che il nome sbagliato: il link porta
  // comunque su una scheda della famiglia giusta, ma nel testo non lo scriviamo.
  let studentIdPerLink = input.studentId
  let nomeAlunno: string | null = null

  if (input.studentId) {
    const alunno = await db.query.students.findFirst({
      where: eq(students.id, input.studentId),
      columns: { firstName: true, lastName: true },
    })
    nomeAlunno = alunno ? `${alunno.firstName} ${alunno.lastName}`.trim() : null
  } else if (input.userId) {
    const figli = await db.query.studentParents.findMany({
      where: eq(studentParents.parentUserId, input.userId),
      orderBy: [studentParents.createdAt],
      columns: { studentId: true },
      limit: 2,
    })
    studentIdPerLink = figli[0]?.studentId ?? null
  }

  const azione = input.valore ? 'ha dato' : 'ha revocato'
  const titolo = TITOLO_AVVISO[input.tipo][input.valore ? 'dato' : 'revocato']
  const coda   = nomeAlunno ? ` — ${nomeAlunno}` : ''

  await creaNotifica({
    tipo:      'CONSENSO',
    titolo:    titolo.slice(0, 200),
    messaggio: `${chi} ${azione} ${ETICHETTA_ESTESA[input.tipo]}${coda}. Cambiamento fatto dal portale famiglie.`,
    link:      studentIdPerLink ? `/studenti/${studentIdPerLink}` : null,
    entityType: studentIdPerLink ? 'student' : 'user',
    entityId:   studentIdPerLink ?? input.userId,
    // Vedi sopra: ogni cambiamento è una notizia a sé
    evitaDoppioni: false,
  })
}
