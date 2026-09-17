// server/services/notifiche.service.ts
//
// IL CAMPANELLINO — cosa c'è da sapere, non quanti sono.
//
// I pallini rossi sul menu dicono un numero ("3 contatti"), non una cosa: per
// scoprire QUALE bisogna aprire la pagina e cercare. Qui invece ogni avviso ha
// un titolo, una frase e, dove ha senso, un link che ci porta sopra.
//
// Due sezioni, con due nature diverse:
//
//  • COMPLEANNI — non si salvano da nessuna parte: si CALCOLANO ogni volta dalla
//    data di nascita. Salvarli vorrebbe dire scrivere una riga nuova ogni anno per
//    ogni persona, e correggere una data sbagliata non sistemerebbe le righe già
//    scritte. Non hanno stato "letto": un compleanno non si archivia, passa da solo
//    a mezzanotte.
//
//  • NOTIFICHE — righe vere nella tabella `notifiche`, con lo stato letto/non letto
//    condiviso da tutta la segreteria. In questo blocco la tabella resta VUOTA:
//    la riempirà il blocco dei consensi. È voluto — meglio un campanellino che oggi
//    mostra solo i compleanni che uno pieno di avvisi finti.

import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { notifiche, students, users, tutorProfiles } from '../database/schema'
import { oggiISO, giornoSuccessivo, annoBisestile } from '#shared/giorno-civile'

// Quante notifiche GIÀ LETTE tenere a schermo sotto le nuove: servono a capire
// "l'ho già visto?" senza trasformare il pannello in un archivio da scorrere.
const LETTE_DA_MOSTRARE = 10

export type CompleannoQuando = 'OGGI' | 'DOMANI'

export interface Compleanno {
  id: string
  nome: string
  /** 'ALUNNO' o 'TUTOR': cambia l'icona e il link */
  chi: 'ALUNNO' | 'TUTOR'
  quando: CompleannoQuando
  /** Anni che compie (non quelli che ha) */
  anni: number
  /** Numero da usare per gli auguri su WhatsApp: del genitore per gli alunni piccoli */
  telefono: string | null
  /** A chi appartiene quel numero, per non far scrivere "auguri!" alla persona sbagliata */
  telefonoDi: string | null
  link: string
  /** true solo per chi è nato il 29 febbraio in un anno senza il 29 febbraio */
  festeggiaIl28: boolean
}

// IL 29 FEBBRAIO.
// Chi è nato il 29 febbraio, in un anno non bisestile, quel giorno non ce l'ha:
// se aspettassimo la data esatta non compirebbe gli anni per tre anni su quattro.
// Per convenzione (la stessa dell'anagrafe italiana per i compleanni "civili")
// festeggia il 28 febbraio. Il caso è raro ma non teorico: capita a 1 persona su
// ~1500, e con ~120 fra alunni e tutor prima o poi arriva.
function compieGliAnniIl(dataNascita: string, giornoCivile: string): boolean {
  const mmddNascita = dataNascita.slice(5)   // 'MM-GG'
  const mmddGiorno  = giornoCivile.slice(5)
  const annoGiorno  = Number(giornoCivile.slice(0, 4))

  if (mmddNascita === '02-29' && !annoBisestile(annoGiorno)) {
    return mmddGiorno === '02-28'
  }
  return mmddNascita === mmddGiorno
}

function festeggiaIl28(dataNascita: string, giornoCivile: string): boolean {
  return dataNascita.slice(5) === '02-29' && !annoBisestile(Number(giornoCivile.slice(0, 4)))
}

function anniCompiuti(dataNascita: string, giornoCivile: string): number {
  return Number(giornoCivile.slice(0, 4)) - Number(dataNascita.slice(0, 4))
}

// ─────────────────────────────────────────────
// COMPLEANNI DI OGGI E DOMANI (calcolati al volo)
// ─────────────────────────────────────────────
//
// "Oggi" è il giorno civile ITALIANO (oggiISO), non new Date() grezzo: alle 00:30
// del 12 settembre il server, che ragiona in UTC, sarebbe ancora all'11 e i
// compleanni del 12 non comparirebbero fino alle 2 di notte.
//
// Il confronto giorno+mese si fa in JavaScript e non in SQL: le righe con una data
// di nascita sono poche (~120 in tutto), il filtro pesante lo fa già il database
// (solo attivi, solo chi ha la data), e la regola del 29 febbraio scritta in SQL
// sarebbe illeggibile per chiunque debba rimetterci mano.
export async function compleanniProssimi(): Promise<Compleanno[]> {
  const oggi   = oggiISO()
  const domani = giornoSuccessivo(oggi)

  const [alunni, staff] = await Promise.all([
    db
      .select({
        id:           students.id,
        firstName:    students.firstName,
        lastName:     students.lastName,
        dataNascita:  students.dataNascita,
        studentPhone: students.studentPhone,
        parentPhone:  students.parentPhone,
        parentName:   students.parentName,
      })
      .from(students)
      .where(and(eq(students.active, true), isNotNull(students.dataNascita))),

    db
      .select({
        id:        users.id,
        firstName: users.firstName,
        lastName:  users.lastName,
        phone:     users.phone,
        // La data di nascita del tutor sta sul profilo; users.dataNascita esiste
        // per genitori e studenti con account. Si guardano tutte e due e vince
        // il profilo: così un dato inserito da una parte o dall'altra non si perde.
        dataNascita: sql<string | null>`coalesce(${tutorProfiles.dataNascita}, ${users.dataNascita})`,
      })
      .from(users)
      .leftJoin(tutorProfiles, eq(tutorProfiles.userId, users.id))
      .where(and(eq(users.active, true), inArray(users.role, ['TUTOR', 'SUPER_TUTOR']))),
  ])

  const risultato: Compleanno[] = []

  for (const giorno of [oggi, domani]) {
    const quando: CompleannoQuando = giorno === oggi ? 'OGGI' : 'DOMANI'

    for (const a of alunni) {
      if (!a.dataNascita || !compieGliAnniIl(a.dataNascita, giorno)) continue
      // Per gli auguri si usa il numero del genitore quando c'è: gli alunni delle
      // elementari il telefono spesso non ce l'hanno.
      const usaGenitore = Boolean(a.parentPhone)
      risultato.push({
        id:     `alunno-${a.id}-${quando}`,
        nome:   `${a.firstName} ${a.lastName}`,
        chi:    'ALUNNO',
        quando,
        anni:   anniCompiuti(a.dataNascita, giorno),
        telefono:   usaGenitore ? a.parentPhone : a.studentPhone,
        telefonoDi: usaGenitore ? (a.parentName || 'il genitore') : null,
        link:   `/studenti/${a.id}`,
        festeggiaIl28: festeggiaIl28(a.dataNascita, giorno),
      })
    }

    for (const t of staff) {
      if (!t.dataNascita || !compieGliAnniIl(t.dataNascita, giorno)) continue
      risultato.push({
        id:     `tutor-${t.id}-${quando}`,
        nome:   `${t.firstName} ${t.lastName}`,
        chi:    'TUTOR',
        quando,
        anni:   anniCompiuti(t.dataNascita, giorno),
        telefono:   t.phone,
        telefonoDi: null,
        link:   `/tutor/${t.id}`,
        festeggiaIl28: festeggiaIl28(t.dataNascita, giorno),
      })
    }
  }

  // Prima quelli di oggi, poi in ordine alfabetico: la lista non deve ballare
  // a ogni ricaricamento della pagina.
  return risultato.sort((x, y) =>
    x.quando === y.quando ? x.nome.localeCompare(y.nome, 'it') : x.quando === 'OGGI' ? -1 : 1,
  )
}

// ─────────────────────────────────────────────
// IL CONTENUTO DEL CAMPANELLINO
// ─────────────────────────────────────────────
export async function getCentroNotifiche() {
  const [nonLette, ultimeLette, compleanni] = await Promise.all([
    db.query.notifiche.findMany({
      where: isNull(notifiche.lettaAt),
      orderBy: [desc(notifiche.createdAt)],
    }),
    db.query.notifiche.findMany({
      where: isNotNull(notifiche.lettaAt),
      orderBy: [desc(notifiche.lettaAt)],
      limit: LETTE_DA_MOSTRARE,
      with: {
        lettaDa: { columns: { firstName: true, lastName: true } },
      },
    }),
    compleanniProssimi(),
  ])

  return {
    nonLette,
    ultimeLette,
    compleanni,
    // Il numero sul campanellino conta SOLO le notifiche vere: i compleanni non
    // sono una cosa "da fare", e un pallino rosso che non si spegne mai smette
    // presto di voler dire qualcosa.
    numeroNonLette: nonLette.length,
  }
}

// ─────────────────────────────────────────────
// SEGNA LETTA / SEGNA TUTTE LETTE
// La lettura è di squadra: chi segna resta scritto, ma vale per tutti.
// ─────────────────────────────────────────────
export async function segnaLetta(id: string, userId: string) {
  const [aggiornata] = await db
    .update(notifiche)
    // Solo se non era già letta: così il nome di chi se n'è occupato per primo
    // non viene sovrascritto da chi clicca dopo.
    .set({ lettaAt: new Date(), lettaDaUserId: userId })
    .where(and(eq(notifiche.id, id), isNull(notifiche.lettaAt)))
    .returning({ id: notifiche.id })

  // Nessuna riga aggiornata = o non esiste, o l'aveva già letta un collega:
  // in entrambi i casi per chi guarda il risultato è lo stesso (è letta).
  return { ok: true, aggiornata: Boolean(aggiornata) }
}

export async function segnaTutteLette(userId: string) {
  const righe = await db
    .update(notifiche)
    .set({ lettaAt: new Date(), lettaDaUserId: userId })
    .where(isNull(notifiche.lettaAt))
    .returning({ id: notifiche.id })

  return { ok: true, quante: righe.length }
}

// Segna lette le notifiche ancora aperte di UNA pratica (es. entityType 'nota' +
// l'id della nota). Serve quando la pratica si chiude da sola: una nota approvata
// non ha più niente da chiedere, e lasciare acceso il suo avviso farebbe credere
// che manchi ancora qualcosa. Stessa regola di segnaLetta: chi chiude resta scritto.
export async function segnaLetteDellaPratica(entityType: string, entityId: string, userId: string) {
  const righe = await db
    .update(notifiche)
    .set({ lettaAt: new Date(), lettaDaUserId: userId })
    .where(and(
      isNull(notifiche.lettaAt),
      eq(notifiche.entityType, entityType),
      eq(notifiche.entityId, entityId),
    ))
    .returning({ id: notifiche.id })

  return { ok: true, quante: righe.length }
}

// ─────────────────────────────────────────────
// CREA UNA NOTIFICA
// Non serve ancora a nessuna pagina: la useranno i consensi. Sta qui perché la
// regola "non ripetere due volte lo stesso avviso" deve essere scritta una volta
// sola, non in ogni punto che genera notifiche.
// ─────────────────────────────────────────────
export async function creaNotifica(input: {
  tipo: 'CONSENSO' | 'COMPLEANNO' | 'GENERICA'
  titolo: string
  messaggio: string
  link?: string | null
  entityType?: string | null
  entityId?: string | null
  /** true = non ricrearla se ce n'è già una NON LETTA per la stessa pratica */
  evitaDoppioni?: boolean
}) {
  if (input.evitaDoppioni && input.entityType && input.entityId) {
    const esistente = await db.query.notifiche.findFirst({
      where: and(
        isNull(notifiche.lettaAt),
        eq(notifiche.entityType, input.entityType),
        eq(notifiche.entityId, input.entityId),
        eq(notifiche.tipo, input.tipo),
      ),
      columns: { id: true },
    })
    if (esistente) return { ok: true, creata: false as const, id: esistente.id }
  }

  const [creata] = await db.insert(notifiche).values({
    tipo:       input.tipo,
    titolo:     input.titolo,
    messaggio:  input.messaggio,
    link:       input.link ?? null,
    entityType: input.entityType ?? null,
    entityId:   input.entityId ?? null,
  }).returning({ id: notifiche.id })

  return { ok: true, creata: true as const, id: creata?.id }
}
