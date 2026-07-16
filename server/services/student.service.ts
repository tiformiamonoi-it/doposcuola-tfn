import { db } from '../database/client'
import { students, packages } from '../database/schema'
import { and, asc, count, desc, eq, ilike, or, inArray, exists, notExists, not, arrayContains } from 'drizzle-orm'
import { nomeProprio } from '../utils/nomi'
import { computePackageStates } from './package.service'
import type { CreateStudentInput, StudentQuery, UpdateStudentInput } from '#shared/schemas/student.schema'

// Mappa i valori sortBy (dalla query) alle colonne Drizzle
const SORT_COLUMNS = {
  lastName:  students.lastName,
  firstName: students.firstName,
  createdAt: students.createdAt,
} as const

// ─────────────────────────────────────────────
// LIST  — GET /api/students
// ─────────────────────────────────────────────

export async function listStudents(query: StudentQuery) {
  const conditions = [
    query.active !== undefined ? eq(students.active, query.active === 'true') : undefined,
    query.classe ? eq(students.classe, query.classe) : undefined,
    query.search
      ? or(
          ilike(students.lastName,   `%${query.search}%`),
          ilike(students.firstName,  `%${query.search}%`),
          ilike(students.parentEmail, `%${query.search}%`),
        )
      : undefined,
  ]

  if (query.hideInactive === 'true') {
    conditions.push(eq(students.active, true))
    conditions.push(
      exists(
        db.select({ id: packages.id }).from(packages).where(and(eq(packages.studentId, students.id), not(arrayContains(packages.stati, ['CHIUSO']))))
      )
    )
  }

  if (query.packageStatus && query.packageStatus !== 'all') {
    if (query.packageStatus === 'NESSUNO') {
      conditions.push(
        notExists(
          db.select({ id: packages.id }).from(packages).where(and(eq(packages.studentId, students.id), not(arrayContains(packages.stati, ['CHIUSO']))))
        )
      )
    } else {
      conditions.push(
        exists(
          db.select({ id: packages.id }).from(packages).where(
            and(
              eq(packages.studentId, students.id),
              not(arrayContains(packages.stati, ['CHIUSO'])),
              arrayContains(packages.stati, [query.packageStatus as any])
            )
          )
        )
      )
    }
  }

  const where = and(...conditions)

  const sortCol = SORT_COLUMNS[query.sortBy as keyof typeof SORT_COLUMNS] ?? students.lastName
  const orderBy = query.sortDir === 'desc' ? desc(sortCol) : asc(sortCol)

  const [rows, [countRow]] = await Promise.all([
    db.select().from(students)
      .where(where)
      .orderBy(orderBy)
      .limit(query.limit)
      .offset((query.page - 1) * query.limit),
    db.select({ total: count() }).from(students).where(where),
  ])

  // Modalità leggera (tendine/autocomplete): niente join sui pacchetti né badge di stato
  if (query.light === 'true') {
    return {
      data: rows,
      meta: {
        page:       query.page,
        limit:      query.limit,
        total:      countRow!.total,
        totalPages: Math.ceil(countRow!.total / query.limit),
      },
    }
  }

  const studentIds = rows.map(r => r.id)
  let studentPackages: {
    id: string, nome: string, studentId: string, stati: string[], createdAt: Date, oreResiduo: string | null, tipo: string | null,
    oreAcquistate: string, importoResiduo: string, dataScadenza: Date | null, giorniResiduo: number | null, sospeso: boolean | null,
  }[] = []
  if (studentIds.length > 0) {
    studentPackages = await db.select({
      id: packages.id,
      nome: packages.nome,
      studentId: packages.studentId,
      stati: packages.stati,
      createdAt: packages.createdAt,
      oreResiduo: packages.oreResiduo,
      tipo: packages.tipo,
      oreAcquistate: packages.oreAcquistate,
      importoResiduo: packages.importoResiduo,
      dataScadenza: packages.dataScadenza,
      giorniResiduo: packages.giorniResiduo,
      sospeso: packages.sospeso,
    }).from(packages).where(inArray(packages.studentId, studentIds))
  }

  const dataWithStatus = rows.map(student => {
    // Ricalcola gli stati al volo (la colonna salvata può essere obsoleta, es. scadenza
    // superata dopo l'ultima scrittura) così SCADUTO/ESAURITO sono sempre veritieri.
    const pkgsAll = studentPackages
      .filter(p => p.studentId === student.id)
      .map(p => ({ ...p, stati: computePackageStates({
        oreAcquistate:  p.oreAcquistate,
        oreResiduo:     p.oreResiduo ?? '0',
        importoResiduo: p.importoResiduo,
        dataScadenza:   p.dataScadenza,
        giorniResiduo:  p.giorniResiduo,
        sospeso:        p.sospeso,
      }) as string[] }))

    const pkgs = pkgsAll.filter(p => !p.stati.includes('CHIUSO'))

    let globalStatus = 'Inattivo'
    let statusColor = 'neutral'

    if (student.active) {
       globalStatus = 'Attivo'
       statusColor = 'success'

       if (pkgs.length > 0) {
         pkgs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

         const hasDaPagare = pkgs.some(p => p.stati.includes('DA_PAGARE'))
         const hasDaRinnovare = pkgs.some(p => p.stati.includes('DA_RINNOVARE') || p.stati.includes('ESAURITO'))
         const hasScaduto = pkgs.some(p => p.stati.includes('SCADUTO'))

         if (hasDaPagare) {
           globalStatus = 'Da pagare'
           statusColor = 'error'
         } else if (hasDaRinnovare) {
           globalStatus = 'Da rinnovare'
           statusColor = 'warning'
         } else if (hasScaduto) {
           globalStatus = 'Scaduto'
           statusColor = 'error'
         }
       } else {
         globalStatus = 'Nessun pacchetto'
         statusColor = 'neutral'
       }
    }

    // Pacchetto attivo più rilevante (il primo non chiuso)
    const pkgAttivo = pkgs[0]
    const hasPacchetti = pkgsAll.length > 0

    // Selezionabile per una lezione se ha ALMENO un pacchetto ancora "buono":
    // non esaurito (ore/giorni finiti) e non scaduto. Il saldo "da pagare" NON blocca.
    const usable = pkgs.some(p => !p.stati.includes('ESAURITO') && !p.stati.includes('SCADUTO'))
    let blockLabel: string | null = null
    if (student.active && !usable) {
      if      (pkgs.some(p => p.stati.includes('SCADUTO')))  blockLabel = 'Scaduto'
      else if (pkgs.some(p => p.stati.includes('ESAURITO'))) blockLabel = 'Esaurito'
      else if (hasPacchetti)                                 blockLabel = 'Pacchetti chiusi'
    }

    // Pacchetti ATTIVI pronti per il form lezione: così il picker li invia già col
    // suo confirm e la finestra lezione NON deve fare una nuova chiamata /api/packages
    // alla selezione (che su connessione fredda costava ~0,5-2s di "caricamento").
    const pacchettiAttivi = pkgs
      .filter(p => p.stati.includes('ATTIVO'))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(p => ({ id: p.id, nome: p.nome, tipo: p.tipo, oreResiduo: p.oreResiduo, giorniResiduo: p.giorniResiduo, createdAt: p.createdAt }))

    return {
      ...student,
      globalStatus,
      statusColor,
      pkgOreResiduo: pkgAttivo?.oreResiduo ?? null,
      pkgTipo: pkgAttivo?.tipo ?? null,
      hasPacchetti,
      blockLabel,
      pacchettiAttivi,
    }
  })

  return {
    data: dataWithStatus,
    meta: {
      page:       query.page,
      limit:      query.limit,
      total:      countRow!.total,
      totalPages: Math.ceil(countRow!.total / query.limit),
    },
  }
}

// ─────────────────────────────────────────────
// STATS  — GET /api/students/stats
// Conteggi per le tessere di riepilogo in cima alla lista.
// Ogni conteggio rispecchia ESATTAMENTE il filtro corrispondente della lista,
// così cliccando una tessera si ottengono davvero quel numero di righe.
// ─────────────────────────────────────────────

export async function getStudentsStats() {
  // Studente che possiede almeno un pacchetto NON chiuso con un certo stato.
  const conPacchettoStato = (stato: string) =>
    exists(
      db.select({ id: packages.id }).from(packages).where(
        and(
          eq(packages.studentId, students.id),
          not(arrayContains(packages.stati, ['CHIUSO'])),
          arrayContains(packages.stati, [stato as any]),
        ),
      ),
    )

  const [[totRow], [attRow], [pagRow], [rinRow]] = await Promise.all([
    db.select({ n: count() }).from(students),
    db.select({ n: count() }).from(students).where(eq(students.active, true)),
    db.select({ n: count() }).from(students).where(conPacchettoStato('DA_PAGARE')),
    db.select({ n: count() }).from(students).where(conPacchettoStato('DA_RINNOVARE')),
  ])

  return {
    total:       totRow!.n,
    attivi:      attRow!.n,
    daPagare:    pagRow!.n,
    daRinnovare: rinRow!.n,
  }
}

// ─────────────────────────────────────────────
// GET ONE  — GET /api/students/:id
// ─────────────────────────────────────────────

export async function getStudentById(id: string) {
  const [student] = await db.select().from(students).where(eq(students.id, id)).limit(1)
  return student ?? null
}

// ─────────────────────────────────────────────
// CREATE  — POST /api/students
// ─────────────────────────────────────────────

export async function createStudent(data: CreateStudentInput) {
  const [created] = await db.insert(students).values({
    firstName:       nomeProprio(data.firstName),
    lastName:        nomeProprio(data.lastName),
    classe:          data.classe          ?? null,
    scuola:          data.scuola          ?? null,
    studentPhone:    data.studentPhone    ?? null,
    studentEmail:    data.studentEmail    ?? null,
    parentName:      data.parentName ? nomeProprio(data.parentName) : null,
    parentEmail:     data.parentEmail     ?? null,
    parentPhone:     data.parentPhone     ?? null,
    parentIndirizzo: data.parentIndirizzo ?? null,
    parentCitta:     data.parentCitta     ?? null,
    parentCap:       data.parentCap       ?? null,
    parentCF:        data.parentCF        ?? null,
    parentPIva:      data.parentPIva      ?? null,
    note:            data.note            ?? null,
    bisogniSpeciali: data.bisogniSpeciali ?? null,
    active:          data.active          ?? true,
  }).returning()

  return created
}

// ─────────────────────────────────────────────
// UPDATE  — PUT /api/students/:id
// Solo i campi presenti (non undefined) vengono aggiornati
// ─────────────────────────────────────────────

export async function updateStudent(id: string, data: UpdateStudentInput) {
  const changes: Record<string, unknown> = { updatedAt: new Date() }

  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) changes[key] = val
  }

  // Nomi sempre in formato "Nome Proprio" (mai tutto maiuscolo/minuscolo)
  if (typeof changes.firstName === 'string')  changes.firstName  = nomeProprio(changes.firstName)
  if (typeof changes.lastName === 'string')   changes.lastName   = nomeProprio(changes.lastName)
  if (typeof changes.parentName === 'string' && changes.parentName) changes.parentName = nomeProprio(changes.parentName)

  const [updated] = await db.update(students)
    .set(changes as Partial<typeof students.$inferInsert>)
    .where(eq(students.id, id))
    .returning()

  return updated ?? null
}

// ─────────────────────────────────────────────
// DEACTIVATE  — DELETE /api/students/:id
// Soft-delete: imposta active = false, non elimina fisicamente
// ─────────────────────────────────────────────

export async function deactivateStudent(id: string) {
  const [updated] = await db.update(students)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(students.id, id))
    .returning()

  return updated ?? null
}
