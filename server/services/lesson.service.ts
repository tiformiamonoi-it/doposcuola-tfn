import { db } from '../database/client'
import {
  lessons,
  lessonStudents,
  packages,
  timeSlots,
  accountingEntries,
} from '../database/schema'
import { and, count, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { computePackageStates } from './package.service'
import type {
  CreateLessonInput,
  LessonQuery,
  CalendarQuery,
} from '../../shared/schemas/lesson.schema'

// ─────────────────────────────────────────────
// TARIFFE TUTOR (da lessonCalculations.js — DOCUMENTAZIONE §4)
//   SINGOLA = 1 studente senza forzaGruppo
//   GRUPPO  = 2–4 studenti OPPURE 1 studente con forzaGruppo=true
//   MAXI    = 5+ studenti
// ─────────────────────────────────────────────

type LessonType = 'SINGOLA' | 'GRUPPO' | 'MAXI'

const TARIFFE: Record<LessonType, number> = {
  SINGOLA: 5.00,
  GRUPPO:  8.00,
  MAXI:    8.50,
}

function calcDurationHours(oraInizio: string, oraFine: string): number {
  const [h1, m1] = oraInizio.split(':').map(Number) as [number, number]
  const [h2, m2] = oraFine.split(':').map(Number) as [number, number]
  return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60
}

function determineLessonType(numStudenti: number, forzaGruppo: boolean): LessonType {
  if (numStudenti >= 5) return 'MAXI'
  if (numStudenti >= 2 || forzaGruppo) return 'GRUPPO'
  return 'SINGOLA'
}

// ─────────────────────────────────────────────
// CREATE — POST /api/lessons
// Transazione atomica: lezione + scalamento ore + stati + compenso
//
// GARANZIA RACE CONDITION: le ore vengono scalate con SQL aritmetico
// (SET ore_residuo = ore_residuo - valore) — mai read-modify-write in memoria
// ─────────────────────────────────────────────

export async function createLesson(data: CreateLessonInput) {
  return await db.transaction(async (tx) => {
    // 1. Carica lo slot orario per calcolare la durata della lezione
    const [slot] = await tx
      .select()
      .from(timeSlots)
      .where(eq(timeSlots.id, data.timeSlotId))
      .limit(1)
    if (!slot) throw new Error('Slot orario non trovato')

    // 2. Determina tipo lezione e compenso tutor
    const tipo         = determineLessonType(data.studenti.length, data.forzaGruppo)
    // Se la lezione è contrassegnata come "Mezza Lezione", il tutor viene pagato per 0.5 ore
    const durataOre    = data.mezzaLezione ? 0.5 : calcDurationHours(slot.oraInizio, slot.oraFine)
    const compensoTutor = TARIFFE[tipo] * durataOre

    // 3. Inserisce la lezione
    const [lesson] = await tx
      .insert(lessons)
      .values({
        tutorId:       data.tutorId,
        timeSlotId:    data.timeSlotId,
        data:          data.data,
        tipo,
        mezzaLezione:  data.mezzaLezione,
        forzaGruppo:   data.forzaGruppo,
        compensoTutor: compensoTutor.toFixed(2),
        note:          data.note ?? null,
      })
      .returning()

    // 4. Per ogni studente: inserisce lesson_student + scala ore atomicamente
    const lessonDateStr = new Date(data.data).toISOString().split('T')[0]

    for (const studente of data.studenti) {
      // REGOLA: L'alunno, anche se fa mezz'ora, scala SEMPRE un'ora dal pacchetto
      const oreScalate = 1.0

      // 4.a Verifica che il pacchetto sia valido e abbia ore sufficienti
      const [pkgCheck] = await tx
        .select({ oreResiduo: packages.oreResiduo, stati: packages.stati })
        .from(packages)
        .where(eq(packages.id, studente.packageId))
        .limit(1)

      if (!pkgCheck) {
        throw new Error(`Pacchetto non trovato per lo studente ${studente.studentId}`)
      }

      const hasInvalidState = Array.isArray(pkgCheck.stati) 
        ? (pkgCheck.stati.includes('CHIUSO') || pkgCheck.stati.includes('ESAURITO'))
        // fallback in caso non sia un array
        : (String(pkgCheck.stati).includes('CHIUSO') || String(pkgCheck.stati).includes('ESAURITO'))

      if (Number(pkgCheck.oreResiduo) < oreScalate || hasInvalidState) {
        throw new Error(`Impossibile scalare le ore per lo studente ${studente.studentId}: il pacchetto non ha ore sufficienti o è chiuso/esaurito.`)
      }

      // Inserisce il record studente nella lezione
      await tx.insert(lessonStudents).values({
        lessonId:     lesson!.id,
        studentId:    studente.studentId,
        packageId:    studente.packageId,
        oreScalate:   String(oreScalate),
      })

      // Scalamento ore atomico (previene race conditions)
      await tx
        .update(packages)
        .set({
          oreResiduo: sql`GREATEST(0, ${packages.oreResiduo} - ${String(oreScalate)})`,
          updatedAt:  new Date(),
        })
        .where(eq(packages.id, studente.packageId))

      // Pacchetti MENSILI: deduci 1 giorno solo alla prima lezione di quella data
      const [pkg] = await tx
        .select({ tipo: packages.tipo, giorniResiduo: packages.giorniResiduo })
        .from(packages)
        .where(eq(packages.id, studente.packageId))
        .limit(1)

      if (pkg?.tipo === 'MENSILE' && (pkg.giorniResiduo ?? 0) > 0) {
        // Conta quante lesson_student esistono oggi per questo studente + pacchetto
        // (include il record appena inserito — se count = 1, è la prima lezione)
        const res = await tx
          .select({ n: count() })
          .from(lessonStudents)
          .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
          .where(
            and(
              eq(lessonStudents.studentId, studente.studentId),
              eq(lessonStudents.packageId, studente.packageId),
              sql`DATE(${lessons.data}) = ${lessonDateStr}::date`,
            )
          )
        const n = res[0]?.n ?? 0

        if (n <= 1) {
          await tx
            .update(packages)
            .set({
              giorniResiduo: sql`GREATEST(0, ${packages.giorniResiduo} - 1)`,
              updatedAt:     new Date(),
            })
            .where(eq(packages.id, studente.packageId))
        }
      }

      // Ricalcola stati del pacchetto (dentro la transazione — vede i valori aggiornati)
      const [updatedPkg] = await tx
        .select()
        .from(packages)
        .where(eq(packages.id, studente.packageId))
        .limit(1)

      if (updatedPkg) {
        const newStati = computePackageStates({
          oreAcquistate:  updatedPkg.oreAcquistate,
          oreResiduo:     updatedPkg.oreResiduo,
          importoResiduo: updatedPkg.importoResiduo,
          dataScadenza:   updatedPkg.dataScadenza,
          giorniResiduo:  updatedPkg.giorniResiduo,
        })
        await tx
          .update(packages)
          .set({ stati: newStati, updatedAt: new Date() })
          .where(eq(packages.id, studente.packageId))
      }
    }

    return lesson
  })
}
// ─────────────────────────────────────────────
// DELETE — DELETE /api/lessons/:id
// Transazione: cancella studenti lezione + rimborsa ore + ricalcola stati
// ─────────────────────────────────────────────

export async function deleteLesson(id: string) {
  return await db.transaction(async (tx) => {
    // 1. Carica gli studenti per sapere quante ore rimborsare e a quali pacchetti
    const students = await tx.select().from(lessonStudents).where(eq(lessonStudents.lessonId, id))

    const [lesson] = await tx.select().from(lessons).where(eq(lessons.id, id)).limit(1)
    if (!lesson) throw new Error('Lezione non trovata')
    const lessonDateStr = lesson.data.toISOString().split('T')[0]

    // 2. Rimborsa i pacchetti per ogni studente
    for (const studente of students) {
      const oreRimborsate = Number(studente.oreScalate)

      // Rimborso Ore
      await tx
        .update(packages)
        .set({
          oreResiduo: sql`${packages.oreResiduo} + ${String(oreRimborsate)}`,
          updatedAt:  new Date(),
        })
        .where(eq(packages.id, studente.packageId))

      // Rimborso Mesi (se applicabile)
      const [pkg] = await tx
        .select({ tipo: packages.tipo })
        .from(packages)
        .where(eq(packages.id, studente.packageId))
        .limit(1)

      if (pkg?.tipo === 'MENSILE') {
        // Conta quante lezioni esistono oggi per questo studente + pacchetto
        const res = await tx
          .select({ n: count() })
          .from(lessonStudents)
          .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
          .where(
            and(
              eq(lessonStudents.studentId, studente.studentId),
              eq(lessonStudents.packageId, studente.packageId),
              sql`DATE(${lessons.data}) = ${lessonDateStr}::date`
            )
          )
        const n = res[0]?.n ?? 0

        // Se è l'UNICA lezione rimasta di quel giorno, allora si rimborsa il giorno
        if (n === 1) {
          await tx
            .update(packages)
            .set({
              giorniResiduo: sql`${packages.giorniResiduo} + 1`,
              updatedAt:     new Date(),
            })
            .where(eq(packages.id, studente.packageId))
        }
      }

      // Ricalcola stati del pacchetto
      const [updatedPkg] = await tx
        .select()
        .from(packages)
        .where(eq(packages.id, studente.packageId))
        .limit(1)

      if (updatedPkg) {
        const newStati = computePackageStates({
          oreAcquistate:  updatedPkg.oreAcquistate,
          oreResiduo:     updatedPkg.oreResiduo,
          importoResiduo: updatedPkg.importoResiduo,
          dataScadenza:   updatedPkg.dataScadenza,
          giorniResiduo:  updatedPkg.giorniResiduo,
        })
        await tx
          .update(packages)
          .set({ stati: newStati, updatedAt: new Date() })
          .where(eq(packages.id, studente.packageId))
      }
    }

    // 3. Cancella i record di associazione
    await tx.delete(lessonStudents).where(eq(lessonStudents.lessonId, id))

    // 4. Cancella la lezione stessa
    await tx.delete(lessons).where(eq(lessons.id, id))

    return true
  })
}

// ─────────────────────────────────────────────
// LIST — GET /api/lessons
// ─────────────────────────────────────────────

export async function listLessons(query: LessonQuery) {
  const conditions: ReturnType<typeof eq>[] = []

  if (query.tutorId) {
    conditions.push(eq(lessons.tutorId, query.tutorId) as any)
  }
  if (query.tipo) {
    conditions.push(eq(lessons.tipo, query.tipo) as any)
  }
  if (query.dataInizio) {
    conditions.push(gte(lessons.data, query.dataInizio) as any)
  }
  if (query.dataFine) {
    conditions.push(lte(lessons.data, query.dataFine) as any)
  }
  if (query.studentId) {
    // Cerca lezioni che abbiano questo studente tra i partecipanti
    conditions.push(
      inArray(
        lessons.id,
        db
          .select({ id: lessonStudents.lessonId })
          .from(lessonStudents)
          .where(eq(lessonStudents.studentId, query.studentId)),
      ) as any
    )
  }

  const where = conditions.length > 0
    ? and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]))
    : undefined

  const [rows, [countRow]] = await Promise.all([
    db.query.lessons.findMany({
      where: where,
      orderBy: [desc(lessons.data)],
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
      with: {
        tutor: {
          columns: { firstName: true, lastName: true }
        },
        timeSlot: true,
        lessonStudents: {
          with: {
            student: {
              columns: { id: true, firstName: true, lastName: true }
            }
          }
        }
      }
    }),
    db.select({ total: count() }).from(lessons).where(where),
  ])

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

// ─────────────────────────────────────────────
// GET ONE — GET /api/lessons/:id
// Restituisce la lezione con i suoi studenti e le ore scalate
// ─────────────────────────────────────────────

export async function getLessonById(id: string) {
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, id))
    .limit(1)

  if (!lesson) return null

  const lessonStudentsWithDetails = await db.query.lessonStudents.findMany({
    where: eq(lessonStudents.lessonId, id),
    with: {
      student: {
        columns: { firstName: true, lastName: true }
      }
    }
  })

  return { ...lesson, studenti: lessonStudentsWithDetails }
}

// ─────────────────────────────────────────────
// CALENDARIO — GET /api/lessons/calendar
// Restituisce le lezioni raggruppate per giorno (formato: { "2026-06-12": [...] })
// ─────────────────────────────────────────────

export async function getLessonCalendar(query: CalendarQuery) {
  const startDate = new Date(query.anno, query.mese - 1, 1)
  const endDate   = new Date(query.anno, query.mese, 0, 23, 59, 59, 999)

  const conditions: ReturnType<typeof eq>[] = [
    gte(lessons.data, startDate) as any,
    lte(lessons.data, endDate)   as any,
  ]
  if (query.tutorId) {
    conditions.push(eq(lessons.tutorId, query.tutorId) as any)
  }

  const rows = await db
    .select()
    .from(lessons)
    .where(and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])))
    .orderBy(lessons.data)

  // Raggruppa per data (chiave: "YYYY-MM-DD")
  const byDay: Record<string, typeof rows> = {}
  for (const lesson of rows) {
    const key = lesson.data.toISOString().split('T')[0]!
    if (!byDay[key]) byDay[key] = []
    byDay[key]!.push(lesson)
  }

  return byDay
}
