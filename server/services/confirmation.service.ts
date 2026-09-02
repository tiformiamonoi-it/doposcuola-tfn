import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../database/client'
import { contacts, lessons, lessonStudents, packages, students, studentConfirmations, systemConfigs, users } from '../database/schema'
import { oggiRomeStr } from '../utils/tutor-time-window'
import { annoScolasticoDa, inizioAnnoProposto, inizioCampagna } from '#shared/rientri'
import type { StatoRientro } from '#shared/rientri'
import type { ListRientriQuery, SetRientroInput } from '#shared/schemas/confirmation.schema'

// Convenzione di progetto: i service segnalano gli errori di dominio con
// `new Error('messaggio in italiano')`; gli handler li traducono in errori HTTP.

// Chiavi in system_configs (le stesse che si vedono in Impostazioni)
export const CHIAVE_ANNO   = 'anno_scolastico_corrente'
export const CHIAVE_INIZIO = 'anno_scolastico_inizio'

// Neutralizza i caratteri jolly di LIKE/ILIKE nel testo digitato dall'utente.
// (Postgres usa '\' come carattere di escape predefinito.)
function escapeLike(testo: string) {
  return testo.replace(/[\\%_]/g, (c) => `\\${c}`)
}

const nomeCompleto = (idCol: unknown, nome: unknown, cognome: unknown) =>
  sql<string | null>`CASE WHEN ${idCol} IS NULL THEN NULL ELSE ${nome} || ' ' || ${cognome} END`

// Un alunno "ha il pacchetto" se ne ha almeno uno ancora buono (ATTIVO o DA_RINNOVARE)
const PACCHETTO_BUONO = sql`ARRAY['ATTIVO','DA_RINNOVARE']::package_status[]`

// ─────────────────────────────────────────────
// ANNO SCOLASTICO CORRENTE
// Le due chiavi si leggono dalle impostazioni; se non ci sono ancora, si usano
// i valori proposti (calcolati dalla data di oggi).
// ─────────────────────────────────────────────

export async function getAnnoCorrente(): Promise<{ anno: string; inizio: string }> {
  const righe = await db
    .select({ key: systemConfigs.key, value: systemConfigs.value })
    .from(systemConfigs)
    .where(inArray(systemConfigs.key, [CHIAVE_ANNO, CHIAVE_INIZIO]))

  const mappa = new Map(righe.map((r) => [r.key, (r.value ?? '').trim()]))

  const anno = mappa.get(CHIAVE_ANNO) || annoScolasticoDa(oggiRomeStr())
  const inizio = mappa.get(CHIAVE_INIZIO) || inizioAnnoProposto(anno)

  return { anno, inizio }
}

/**
 * Gli anni che hanno almeno una riga nel quaderno, dal più recente.
 * Serve al menu dello storico: l'anno corrente lo aggiunge chi chiama.
 */
export async function anniDisponibili(): Promise<string[]> {
  const righe = await db
    .selectDistinct({ anno: studentConfirmations.anno })
    .from(studentConfirmations)
    .orderBy(desc(studentConfirmations.anno))

  return righe.map((r) => r.anno)
}

// ─────────────────────────────────────────────
// LISTA + NUMERI DELLE CARD — GET /api/confirmations
// Una sola risposta. Le letture partono tutte insieme (Promise.all) e si
// uniscono in memoria: sono ~100 righe, nessuna query dentro un ciclo.
// ─────────────────────────────────────────────

export interface RigaRientro {
  studentId: string
  firstName: string
  lastName: string
  classe: string | null
  scuola: string | null
  parentName: string | null
  parentPhone: string | null
  studentPhone: string | null
  parentEmail: string | null
  stato: StatoRientro
  dataRisposta: string | null
  note: string | null
  aggiornatoDaNome: string | null
  /** Giorno civile dell'ultima lezione fatta ('AAAA-MM-GG'), null = mai partito */
  ultimaLezione: string | null
  haPacchettoAttivo: boolean
  pacchettoNome: string | null
}

// Ordine dell'appello: prima chi devi ancora sentire, in fondo chi non torna
const PESO_STATO: Record<StatoRientro, number> = {
  DA_SENTIRE: 0,
  IN_FORSE:   1,
  CONFERMATO: 2,
  NON_TORNA:  3,
}

export async function listRientri(q: ListRientriQuery) {
  // L'anno delle impostazioni, salvo che se ne chieda un altro (storico)
  const corrente = await getAnnoCorrente()
  const annoRichiesto = q.anno ?? corrente.anno
  const inizio = annoRichiesto === corrente.anno ? corrente.inizio : inizioAnnoProposto(annoRichiesto)

  // Il quaderno dell'anno richiesto, agganciato all'alunno
  const conferma = and(
    eq(studentConfirmations.studentId, students.id),
    eq(studentConfirmations.anno, annoRichiesto),
  )

  const filtri: Array<SQL | undefined> = [eq(students.active, true)]

  // "Da sentire" vale anche per chi non ha ancora nessuna riga nel quaderno
  if (q.stato === 'DA_SENTIRE') {
    filtri.push(or(isNull(studentConfirmations.id), eq(studentConfirmations.stato, 'DA_SENTIRE')))
  } else if (q.stato) {
    filtri.push(eq(studentConfirmations.stato, q.stato))
  }

  if (q.search) {
    // '%', '_' e '\' sono caratteri speciali di LIKE: vanno neutralizzati
    const testo = `%${escapeLike(q.search)}%`
    const dove: Array<SQL | undefined> = [
      ilike(students.firstName, testo),
      ilike(students.lastName, testo),
      ilike(students.parentName, testo),
      ilike(students.parentPhone, testo),
      ilike(students.studentPhone, testo),
    ]
    // Se si è scritto il nome intero ("Rossi Luca" o "Luca Rossi") nessuna delle
    // due colonne da sola combacia: si cercano anche le due combinazioni.
    if (q.search.includes(' ')) {
      dove.push(
        ilike(sql`${students.lastName} || ' ' || ${students.firstName}`, testo),
        ilike(sql`${students.firstName} || ' ' || ${students.lastName}`, testo),
      )
    }
    filtri.push(or(...dove))
  }

  const conta = (condizione: SQL) => sql<string>`COUNT(*) FILTER (WHERE ${condizione})::text`
  const haPacchettoBuono = sql`EXISTS (SELECT 1 FROM packages p WHERE p.student_id = ${students.id} AND p.stati && ${PACCHETTO_BUONO})`
  // Ha almeno una lezione alle spalle: è la stessa condizione che decide chi la
  // lista nasconde di default ("mai partiti"), qui contata sul totale degli attivi.
  const haFattoLezione = sql`EXISTS (SELECT 1 FROM lesson_students ls JOIN lessons l ON l.id = ls.lesson_id WHERE ls.student_id = ${students.id})`
  const dal = inizioCampagna(annoRichiesto)

  const [righe, lezioni, pacchetti, [kpiAlunni], [kpiContatti], anniConRighe] = await Promise.all([
    // 1) L'elenco: alunni attivi + la loro risposta (se già data)
    db.select({
      studentId:    students.id,
      firstName:    students.firstName,
      lastName:     students.lastName,
      classe:       students.classe,
      scuola:       students.scuola,
      parentName:   students.parentName,
      parentPhone:  students.parentPhone,
      studentPhone: students.studentPhone,
      parentEmail:  students.parentEmail,
      stato:        sql<string>`COALESCE(${studentConfirmations.stato}::text, 'DA_SENTIRE')`,
      // to_char: la data-giorno viaggia come testo, senza fusi orari di mezzo
      dataRisposta: sql<string | null>`to_char(${studentConfirmations.dataRisposta}, 'YYYY-MM-DD')`,
      note:         studentConfirmations.note,
      aggiornatoDaNome: nomeCompleto(users.id, users.firstName, users.lastName),
    })
      .from(students)
      .leftJoin(studentConfirmations, conferma)
      .leftJoin(users, eq(studentConfirmations.aggiornatoDaUserId, users.id))
      .where(and(...filtri)),

    // 2) L'ultima lezione di ogni alunno: UNA query aggregata per tutti
    db.select({
      studentId: lessonStudents.studentId,
      ultima:    sql<string | null>`to_char(max(${lessons.data}), 'YYYY-MM-DD')`,
    })
      .from(lessonStudents)
      .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
      .groupBy(lessonStudents.studentId),

    // 3) I pacchetti: UNA query aggregata (ha un pacchetto buono? come si chiama?)
    db.select({
      studentId: packages.studentId,
      haBuono:   sql<boolean>`bool_or(${packages.stati} && ${PACCHETTO_BUONO})`,
      nome:      sql<string | null>`(ARRAY_AGG(${packages.nome} ORDER BY ${packages.dataInizio} DESC) FILTER (WHERE ${packages.stati} && ${PACCHETTO_BUONO}))[1]`,
    })
      .from(packages)
      .groupBy(packages.studentId),

    // 4) I numeri delle card: sempre sull'anno INTERO, mai sui filtri della lista
    db.select({
      daSentire:  conta(sql`COALESCE(${studentConfirmations.stato}::text, 'DA_SENTIRE') = 'DA_SENTIRE'`),
      confermati: conta(sql`${studentConfirmations.stato} = 'CONFERMATO'`),
      inForse:    conta(sql`${studentConfirmations.stato} = 'IN_FORSE'`),
      nonTornano: conta(sql`${studentConfirmations.stato} = 'NON_TORNA'`),
      // Ha detto sì ma non ha ancora scelto il pacchetto: la lista di lavoro di ottobre
      confermatiSenzaPacchetto: conta(sql`${studentConfirmations.stato} = 'CONFERMATO' AND NOT ${haPacchettoBuono}`),
      // Non hanno MAI fatto lezione: la lista li nasconde, ma i numeri li contano
      maiPartiti: conta(sql`NOT ${haFattoLezione}`),
      totaleAttivi: sql<string>`COUNT(*)::text`,
    })
      .from(students)
      .leftJoin(studentConfirmations, conferma)
      .where(eq(students.active, true)),

    // 5) Il ponte con i Contatti: nuovi iscritti dell'anno e trattative aperte
    db.select({
      nuoviDaContatti: conta(sql`
        ${contacts.stato} = 'CONVERTITO'
        AND ${contacts.studentId} IS NOT NULL
        AND ${contacts.convertitoAt} IS NOT NULL
        AND to_char(${contacts.convertitoAt} AT TIME ZONE 'Europe/Rome', 'YYYY-MM-DD') >= ${dal}
      `),
      inTrattativa: conta(sql`
        ${contacts.tipo} = 'DOPOSCUOLA'
        AND ${contacts.stato} = 'IN_TRATTATIVA'
        AND ${contacts.archiviatoAt} IS NULL
      `),
    }).from(contacts),

    // 6) Gli anni già presenti nel quaderno: alimentano il menu dello storico
    anniDisponibili(),
  ])

  // ── Unione in memoria (niente query dentro il ciclo) ──
  const ultimaPerAlunno = new Map(lezioni.map((l) => [l.studentId, l.ultima]))
  const pacchettoPerAlunno = new Map(pacchetti.map((p) => [p.studentId, p]))

  // "Ha fatto lezione quest'anno" = negli ultimi 12 mesi
  const oggi = oggiRomeStr()
  const dodiciMesiFa = `${Number(oggi.slice(0, 4)) - 1}${oggi.slice(4)}`

  let items: RigaRientro[] = righe.map((r) => {
    const pkg = pacchettoPerAlunno.get(r.studentId)
    return {
      ...r,
      stato:             r.stato as StatoRientro,
      ultimaLezione:     ultimaPerAlunno.get(r.studentId) ?? null,
      haPacchettoAttivo: Boolean(pkg?.haBuono),
      pacchettoNome:     pkg?.haBuono ? (pkg.nome ?? null) : null,
    }
  })

  // Filtri che dipendono dalle lezioni: si applicano dopo l'unione
  if (q.soloAttiviRecenti) {
    items = items.filter((r) => r.ultimaLezione !== null && r.ultimaLezione >= dodiciMesiFa)
  }
  // Chi non ha MAI fatto lezione resta nascosto finché non si accende l'interruttore
  if (!q.includiMaiPartiti) {
    items = items.filter((r) => r.ultimaLezione !== null)
  }

  // Ordine: prima da sentire, poi in forse, confermati, non tornano; dentro ogni
  // gruppo i più "caldi" (lezione recente) davanti, i mai partiti in fondo.
  items.sort((a, b) => {
    const peso = PESO_STATO[a.stato] - PESO_STATO[b.stato]
    if (peso !== 0) return peso
    if (a.ultimaLezione !== b.ultimaLezione) {
      if (a.ultimaLezione === null) return 1
      if (b.ultimaLezione === null) return -1
      return a.ultimaLezione < b.ultimaLezione ? 1 : -1
    }
    return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'it')
  })

  // Il menu dello storico: sempre l'anno corrente (anche se il quaderno è vuoto)
  // e quello richiesto, più tutti gli anni già scritti. Dal più recente.
  const anni = [...new Set([corrente.anno, annoRichiesto, ...anniConRighe])]
    .filter(Boolean)
    .sort()
    .reverse()

  return {
    anno:   annoRichiesto,
    // Serve alla pagina per capire se sta guardando lo storico (sola lettura)
    annoCorrente: corrente.anno,
    inizio,
    anni,
    items,
    kpi: {
      daSentire:                Number(kpiAlunni?.daSentire ?? 0),
      confermati:               Number(kpiAlunni?.confermati ?? 0),
      inForse:                  Number(kpiAlunni?.inForse ?? 0),
      nonTornano:               Number(kpiAlunni?.nonTornano ?? 0),
      confermatiSenzaPacchetto: Number(kpiAlunni?.confermatiSenzaPacchetto ?? 0),
      maiPartiti:               Number(kpiAlunni?.maiPartiti ?? 0),
      totaleAttivi:             Number(kpiAlunni?.totaleAttivi ?? 0),
      nuoviDaContatti:          Number(kpiContatti?.nuoviDaContatti ?? 0),
      inTrattativa:             Number(kpiContatti?.inTrattativa ?? 0),
    },
  }
}

// ─────────────────────────────────────────────
// BADGE DEL MENU — quanti alunni restano da sentire per l'anno corrente
// ─────────────────────────────────────────────

export async function countRientriDaSentire(): Promise<number> {
  const { anno } = await getAnnoCorrente()

  const [riga] = await db
    .select({ n: sql<string>`COUNT(*)::text` })
    .from(students)
    .leftJoin(studentConfirmations, and(
      eq(studentConfirmations.studentId, students.id),
      eq(studentConfirmations.anno, anno),
    ))
    .where(and(
      eq(students.active, true),
      or(isNull(studentConfirmations.id), eq(studentConfirmations.stato, 'DA_SENTIRE')),
    ))

  return Number(riga?.n ?? 0)
}

// ─────────────────────────────────────────────
// SALVA LA RISPOSTA DI UN ALUNNO
// Upsert: se la riga del quaderno non c'è ancora nasce adesso.
// ─────────────────────────────────────────────

export async function setRientro(
  studentId: string,
  anno: string,
  dati: SetRientroInput,
  userId: string,
) {
  const [[studente], [esistente]] = await Promise.all([
    db.select({ id: students.id }).from(students).where(eq(students.id, studentId)).limit(1),
    db.select().from(studentConfirmations)
      .where(and(eq(studentConfirmations.anno, anno), eq(studentConfirmations.studentId, studentId)))
      .limit(1),
  ])

  if (!studente) throw new Error('Alunno non trovato')

  // La data della risposta: tornando a "Da sentire" si azzera; cambiando risposta
  // senza indicare una data vale oggi (giorno civile italiano).
  let dataRisposta: string | null
  if (dati.stato === 'DA_SENTIRE') {
    dataRisposta = null
  } else if (dati.dataRisposta) {
    dataRisposta = dati.dataRisposta
  } else if (esistente && esistente.stato === dati.stato && esistente.dataRisposta) {
    dataRisposta = esistente.dataRisposta
  } else {
    dataRisposta = oggiRomeStr()
  }

  // Le note si toccano solo se sono state inviate (undefined = "lascia com'è")
  const note = dati.note !== undefined ? (dati.note ?? null) : (esistente?.note ?? null)

  const [salvata] = await db.insert(studentConfirmations)
    .values({
      anno,
      studentId,
      stato: dati.stato,
      dataRisposta,
      note,
      aggiornatoDaUserId: userId,
    })
    .onConflictDoUpdate({
      target: [studentConfirmations.anno, studentConfirmations.studentId],
      set: {
        stato: dati.stato,
        dataRisposta,
        note,
        aggiornatoDaUserId: userId,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!salvata) throw new Error('Salvataggio della risposta non riuscito')
  return salvata
}

// ─────────────────────────────────────────────
// FINE APPELLO — chi ha detto "non torna" esce dagli alunni attivi
// Non tocca nient'altro: pacchetti, utenti e storici restano dove sono, e la
// disattivazione è sempre reversibile dalla scheda dell'alunno.
// ─────────────────────────────────────────────

function selezioneNonRientrati(anno: string) {
  return and(
    eq(students.active, true),
    eq(studentConfirmations.anno, anno),
    eq(studentConfirmations.stato, 'NON_TORNA'),
  ) as SQL
}

export async function contaNonRientrati(anno: string): Promise<number> {
  const [riga] = await db
    .select({ n: sql<string>`COUNT(*)::text` })
    .from(students)
    .innerJoin(studentConfirmations, eq(studentConfirmations.studentId, students.id))
    .where(selezioneNonRientrati(anno))

  return Number(riga?.n ?? 0)
}

export async function disattivaNonRientrati(anno: string): Promise<{ disattivati: number; nomi: string[] }> {
  return await db.transaction(async (tx) => {
    const righe = await tx
      .select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
      .from(students)
      .innerJoin(studentConfirmations, eq(studentConfirmations.studentId, students.id))
      .where(selezioneNonRientrati(anno))

    if (righe.length === 0) return { disattivati: 0, nomi: [] }

    await tx.update(students)
      .set({ active: false, updatedAt: new Date() })
      .where(inArray(students.id, righe.map((r) => r.id)))

    return {
      disattivati: righe.length,
      nomi: righe.map((r) => `${r.lastName} ${r.firstName}`),
    }
  })
}
