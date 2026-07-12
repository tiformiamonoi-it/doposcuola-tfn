import { db } from '../database/client'
import {
  lessons,
  lessonStudents,
  packages,
  timeSlots,
  accountingEntries,
  students,
  users,
  bookings,
  bookingSubjects,
  systemConfigs,
} from '../database/schema'
import { and, count, desc, eq, gte, inArray, isNotNull, lte, ne, sql } from 'drizzle-orm'
import { computePackageStates } from './package.service'
import { confiniGiornoOggiRome } from '../utils/tutor-time-window'
import { TARIFFE_DEFAULT, TARIFFE_MEZZA } from '#shared/tariffe'
import type {
  CreateLessonInput,
  UpdateLessonInput,
  LessonQuery,
  CalendarQuery,
} from '#shared/schemas/lesson.schema'

// ─────────────────────────────────────────────
// TARIFFE TUTOR — lette da system_configs (chiave: tariffe_tutor)
//   SINGOLA = 1 studente senza forzaGruppo
//   GRUPPO  = 2–4 studenti OPPURE 1 studente con forzaGruppo=true
//   MAXI    = 5+ studenti
// ─────────────────────────────────────────────

type LessonType = 'SINGOLA' | 'GRUPPO' | 'MAXI'

// Tariffe di fallback e tariffe mezza lezione: centralizzate in shared/tariffe.ts
// (stessa fonte usata dalle anteprime frontend — niente divergenze UI/server)
const DEFAULT_TARIFFE: Record<LessonType, number> = TARIFFE_DEFAULT

// Cache in-memory con TTL 60 secondi (il valore cambia raramente)
let tariffeCache: Record<LessonType, number> | null = null
let tariffeCacheExpiry = 0
const CACHE_TTL_MS = 60_000

async function getTariffeTutor(): Promise<Record<LessonType, number>> {
  const now = Date.now()
  if (tariffeCache && tariffeCacheExpiry > now) {
    return tariffeCache
  }
  try {
    const rows = await db.select({ value: systemConfigs.value }).from(systemConfigs).where(eq(systemConfigs.key, 'tariffe_tutor')).limit(1)
    const raw = rows[0]?.value
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, number>
      tariffeCache = {
        SINGOLA: parsed.SINGOLA ?? DEFAULT_TARIFFE.SINGOLA,
        GRUPPO:  parsed.GRUPPO  ?? DEFAULT_TARIFFE.GRUPPO,
        MAXI:    parsed.MAXI    ?? DEFAULT_TARIFFE.MAXI,
      }
    } else {
      tariffeCache = { ...DEFAULT_TARIFFE }
    }
  } catch {
    tariffeCache = { ...DEFAULT_TARIFFE }
  }
  tariffeCacheExpiry = now + CACHE_TTL_MS
  return tariffeCache
}

function calcDurationHours(oraInizio: string, oraFine: string): number {
  const [h1, m1] = oraInizio.split(':').map(Number) as [number, number]
  const [h2, m2] = oraFine.split(':').map(Number) as [number, number]
  return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60
}

function calcCompenso(tariffe: Record<LessonType, number>, tipo: LessonType, mezzaLezione: boolean, oraInizio: string, oraFine: string): number {
  if (mezzaLezione) return TARIFFE_MEZZA[tipo]
  return tariffe[tipo] * calcDurationHours(oraInizio, oraFine)
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

    // 1.b Anti-doppia-prenotazione: nessuno studente selezionato può essere già in
    // un'altra lezione, con un ALTRO tutor, nello stesso slot/data (vale per chiunque crei
    // la lezione: admin, super tutor o tutor).
    const lessonDateStrCheck = data.data
    const studentIds = data.studenti.map(s => s.studentId)

    // Nomi studenti per messaggi d'errore leggibili (una query, usata solo se errore)
    const nomiStudentiRows = await tx
      .select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
      .from(students)
      .where(inArray(students.id, studentIds))
    const nomeStudente = (id: string) => {
      const s = nomiStudentiRows.find(r => r.id === id)
      return s ? `${s.firstName} ${s.lastName}` : id
    }

    const conflitti = await tx
      .select({
        studentFirstName: students.firstName,
        studentLastName:  students.lastName,
        tutorFirstName:   users.firstName,
        tutorLastName:    users.lastName,
      })
      .from(lessonStudents)
      .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
      .innerJoin(students, eq(lessonStudents.studentId, students.id))
      .innerJoin(users, eq(lessons.tutorId, users.id))
      .where(and(
        inArray(lessonStudents.studentId, studentIds),
        eq(lessons.timeSlotId, data.timeSlotId),
        eq(lessons.data, lessonDateStrCheck),
      ))
      .limit(1)

    if (conflitti.length > 0) {
      const c = conflitti[0]!
      throw new Error(
        `${c.studentFirstName} ${c.studentLastName} è già in una lezione in questo slot orario con ${c.tutorFirstName} ${c.tutorLastName}.`
      )
    }

    // 2. Determina tipo lezione e compenso tutor
    const tipo          = determineLessonType(data.studenti.length, data.forzaGruppo)
    const tariffe       = await getTariffeTutor()
    const compensoTutor = calcCompenso(tariffe, tipo, data.mezzaLezione, slot.oraInizio, slot.oraFine)

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
    const lessonDateStr = data.data

    for (const studente of data.studenti) {
      // REGOLA: L'alunno, anche se fa mezz'ora, scala SEMPRE un'ora dal pacchetto
      const oreScalate = 1.0

      // 4.a Verifica che il pacchetto sia valido e abbia ore sufficienti
      const [pkgCheck] = await tx
        .select({
          oreAcquistate:  packages.oreAcquistate,
          oreResiduo:     packages.oreResiduo,
          importoResiduo: packages.importoResiduo,
          dataScadenza:   packages.dataScadenza,
          giorniResiduo:  packages.giorniResiduo,
          sospeso:        packages.sospeso,
        })
        .from(packages)
        .where(eq(packages.id, studente.packageId))
        .limit(1)

      if (!pkgCheck) {
        throw new Error(`Pacchetto non trovato per ${nomeStudente(studente.studentId)}`)
      }

      if (pkgCheck.sospeso) {
        throw new Error(`${nomeStudente(studente.studentId)}: il pacchetto è sospeso e non può essere usato.`)
      }

      // Valida sugli stati RICALCOLATI: la colonna salvata può essere obsoleta
      // (es. pacchetto chiuso/esaurito/scaduto dopo l'ultima scrittura).
      const statiFreschi = computePackageStates(pkgCheck)
      const hasInvalidState = statiFreschi.includes('CHIUSO') || statiFreschi.includes('ESAURITO') || statiFreschi.includes('SCADUTO')

      if (Number(pkgCheck.oreResiduo) < oreScalate || hasInvalidState) {
        throw new Error(`${nomeStudente(studente.studentId)}: il pacchetto non ha ore sufficienti oppure è chiuso, esaurito o scaduto.`)
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
              eq(lessons.data, lessonDateStr),
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
          sospeso:        updatedPkg.sospeso,
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
// UPDATE — PUT /api/lessons/:id
// Aggiorna gli studenti/note/forzaGruppo di una lezione esistente (tutor/slot/data restano
// quelli della lezione originale). Rimborsa le ore degli studenti tolti, scala le ore dei
// nuovi, ricalcola tipo e compenso tutor in base al numero finale di studenti.
// ─────────────────────────────────────────────

export async function updateLesson(id: string, data: UpdateLessonInput) {
  return await db.transaction(async (tx) => {
    const [lesson] = await tx.select().from(lessons).where(eq(lessons.id, id)).limit(1)
    if (!lesson) throw new Error('Lezione non trovata')

    const lessonDateStr = lesson.data

    if (data.studenti) {
      const existing = await tx.select().from(lessonStudents).where(eq(lessonStudents.lessonId, id))
      const newIds        = new Set(data.studenti.map(s => s.studentId))
      const studentiNuovi = data.studenti.filter(s => !existing.some(e => e.studentId === s.studentId))

      // Nomi studenti per messaggi d'errore leggibili
      const allIdsUpdate = [...new Set(data.studenti.map(s => s.studentId))]
      const nomiUpdateRows = await tx
        .select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
        .from(students)
        .where(inArray(students.id, allIdsUpdate))
      const nomeStudenteUpd = (id: string) => {
        const s = nomiUpdateRows.find(r => r.id === id)
        return s ? `${s.firstName} ${s.lastName}` : id
      }

      // Anti-doppia-prenotazione: solo per gli studenti effettivamente nuovi in questa lezione
      if (studentiNuovi.length > 0) {
        const conflitti = await tx
          .select({
            studentFirstName: students.firstName,
            studentLastName:  students.lastName,
            tutorFirstName:   users.firstName,
            tutorLastName:    users.lastName,
          })
          .from(lessonStudents)
          .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
          .innerJoin(students, eq(lessonStudents.studentId, students.id))
          .innerJoin(users, eq(lessons.tutorId, users.id))
          .where(and(
            inArray(lessonStudents.studentId, studentiNuovi.map(s => s.studentId)),
            eq(lessons.timeSlotId, lesson.timeSlotId),
            ne(lessons.id, id),
            eq(lessons.data, lessonDateStr),
          ))
          .limit(1)

        if (conflitti.length > 0) {
          const c = conflitti[0]!
          throw new Error(
            `${c.studentFirstName} ${c.studentLastName} è già in una lezione in questo slot orario con ${c.tutorFirstName} ${c.tutorLastName}.`
          )
        }
      }

      // Rimuove gli studenti tolti: rimborsa ore (e giorni per i pacchetti MENSILE)
      for (const old of existing) {
        if (newIds.has(old.studentId)) continue

        const oreRimborsate = Number(old.oreScalate)
        await tx
          .update(packages)
          .set({ oreResiduo: sql`${packages.oreResiduo} + ${String(oreRimborsate)}`, updatedAt: new Date() })
          .where(eq(packages.id, old.packageId))

        const [pkg] = await tx.select({ tipo: packages.tipo }).from(packages).where(eq(packages.id, old.packageId)).limit(1)
        if (pkg?.tipo === 'MENSILE') {
          const res = await tx
            .select({ n: count() })
            .from(lessonStudents)
            .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
            .where(and(
              eq(lessonStudents.studentId, old.studentId),
              eq(lessonStudents.packageId, old.packageId),
              eq(lessons.data, lessonDateStr),
            ))
          if ((res[0]?.n ?? 0) === 1) {
            await tx.update(packages)
              .set({ giorniResiduo: sql`${packages.giorniResiduo} + 1`, updatedAt: new Date() })
              .where(eq(packages.id, old.packageId))
          }
        }

        await tx.delete(lessonStudents).where(eq(lessonStudents.id, old.id))

        const [updatedPkg] = await tx.select().from(packages).where(eq(packages.id, old.packageId)).limit(1)
        if (updatedPkg) {
          const newStati = computePackageStates({
            oreAcquistate:  updatedPkg.oreAcquistate,
            oreResiduo:     updatedPkg.oreResiduo,
            importoResiduo: updatedPkg.importoResiduo,
            dataScadenza:   updatedPkg.dataScadenza,
            giorniResiduo:  updatedPkg.giorniResiduo,
            sospeso:        updatedPkg.sospeso,
          })
          await tx.update(packages).set({ stati: newStati, updatedAt: new Date() }).where(eq(packages.id, old.packageId))
        }
      }

      // Aggiunge i nuovi studenti: valida pacchetto e scala le ore (stessa logica di createLesson)
      for (const nuovo of studentiNuovi) {
        const oreScalate = 1.0

        const [pkgCheck] = await tx
          .select({
            oreAcquistate:  packages.oreAcquistate,
            oreResiduo:     packages.oreResiduo,
            importoResiduo: packages.importoResiduo,
            dataScadenza:   packages.dataScadenza,
            giorniResiduo:  packages.giorniResiduo,
            sospeso:        packages.sospeso,
          })
          .from(packages)
          .where(eq(packages.id, nuovo.packageId))
          .limit(1)

        if (!pkgCheck) throw new Error(`Pacchetto non trovato per ${nomeStudenteUpd(nuovo.studentId)}`)

        if (pkgCheck.sospeso) {
          throw new Error(`${nomeStudenteUpd(nuovo.studentId)}: il pacchetto è sospeso e non può essere usato.`)
        }

        // Valida sugli stati RICALCOLATI (la colonna salvata può essere obsoleta)
        const statiFreschi = computePackageStates(pkgCheck)
        const hasInvalidState = statiFreschi.includes('CHIUSO') || statiFreschi.includes('ESAURITO') || statiFreschi.includes('SCADUTO')

        if (Number(pkgCheck.oreResiduo) < oreScalate || hasInvalidState) {
          throw new Error(`${nomeStudenteUpd(nuovo.studentId)}: il pacchetto non ha ore sufficienti oppure è chiuso, esaurito o scaduto.`)
        }

        await tx.insert(lessonStudents).values({
          lessonId:  id,
          studentId: nuovo.studentId,
          packageId: nuovo.packageId,
          oreScalate: String(oreScalate),
        })

        await tx.update(packages)
          .set({ oreResiduo: sql`GREATEST(0, ${packages.oreResiduo} - ${String(oreScalate)})`, updatedAt: new Date() })
          .where(eq(packages.id, nuovo.packageId))

        const [pkg] = await tx.select({ tipo: packages.tipo, giorniResiduo: packages.giorniResiduo }).from(packages).where(eq(packages.id, nuovo.packageId)).limit(1)
        if (pkg?.tipo === 'MENSILE' && (pkg.giorniResiduo ?? 0) > 0) {
          const res = await tx
            .select({ n: count() })
            .from(lessonStudents)
            .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
            .where(and(
              eq(lessonStudents.studentId, nuovo.studentId),
              eq(lessonStudents.packageId, nuovo.packageId),
              eq(lessons.data, lessonDateStr),
            ))
          if ((res[0]?.n ?? 0) <= 1) {
            await tx.update(packages)
              .set({ giorniResiduo: sql`GREATEST(0, ${packages.giorniResiduo} - 1)`, updatedAt: new Date() })
              .where(eq(packages.id, nuovo.packageId))
          }
        }

        const [updatedPkg] = await tx.select().from(packages).where(eq(packages.id, nuovo.packageId)).limit(1)
        if (updatedPkg) {
          const newStati = computePackageStates({
            oreAcquistate:  updatedPkg.oreAcquistate,
            oreResiduo:     updatedPkg.oreResiduo,
            importoResiduo: updatedPkg.importoResiduo,
            dataScadenza:   updatedPkg.dataScadenza,
            giorniResiduo:  updatedPkg.giorniResiduo,
            sospeso:        updatedPkg.sospeso,
          })
          await tx.update(packages).set({ stati: newStati, updatedAt: new Date() }).where(eq(packages.id, nuovo.packageId))
        }
      }

      // F7 — studenti già presenti ma con pacchetto cambiato: rimborsa il vecchio, scala il nuovo
      for (const newStu of data.studenti) {
        const oldRecord = existing.find(e => e.studentId === newStu.studentId && e.packageId !== newStu.packageId)
        if (!oldRecord) continue

        const oreScalate = Number(oldRecord.oreScalate)

        // Rimborsa ore al vecchio pacchetto
        await tx.update(packages)
          .set({ oreResiduo: sql`${packages.oreResiduo} + ${String(oreScalate)}`, updatedAt: new Date() })
          .where(eq(packages.id, oldRecord.packageId))

        // Gestione giorni MENSILE per il vecchio pacchetto
        const [oldPkg] = await tx.select({ tipo: packages.tipo }).from(packages).where(eq(packages.id, oldRecord.packageId)).limit(1)
        if (oldPkg?.tipo === 'MENSILE') {
          const resOld = await tx.select({ n: count() }).from(lessonStudents)
            .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
            .where(and(
              eq(lessonStudents.studentId, oldRecord.studentId),
              eq(lessonStudents.packageId, oldRecord.packageId),
              eq(lessons.data, lessonDateStr),
            ))
          if ((resOld[0]?.n ?? 0) === 1) {
            await tx.update(packages)
              .set({ giorniResiduo: sql`${packages.giorniResiduo} + 1`, updatedAt: new Date() })
              .where(eq(packages.id, oldRecord.packageId))
          }
        }

        // Verifica nuovo pacchetto
        const [newPkgCheck] = await tx.select({
          oreAcquistate:  packages.oreAcquistate,
          oreResiduo:     packages.oreResiduo,
          importoResiduo: packages.importoResiduo,
          dataScadenza:   packages.dataScadenza,
          giorniResiduo:  packages.giorniResiduo,
          sospeso:        packages.sospeso,
        })
          .from(packages).where(eq(packages.id, newStu.packageId)).limit(1)
        if (!newPkgCheck) throw new Error(`Pacchetto non trovato per ${nomeStudenteUpd(newStu.studentId)}`)
        if (newPkgCheck.sospeso) {
          throw new Error(`${nomeStudenteUpd(newStu.studentId)}: il nuovo pacchetto è sospeso e non può essere usato.`)
        }
        // Valida sugli stati RICALCOLATI (la colonna salvata può essere obsoleta)
        const statiFreschiF7 = computePackageStates(newPkgCheck)
        const hasInvalidStateF7 = statiFreschiF7.includes('CHIUSO') || statiFreschiF7.includes('ESAURITO') || statiFreschiF7.includes('SCADUTO')
        if (Number(newPkgCheck.oreResiduo) < oreScalate || hasInvalidStateF7) {
          throw new Error(`${nomeStudenteUpd(newStu.studentId)}: il nuovo pacchetto non ha ore sufficienti oppure è chiuso, esaurito o scaduto.`)
        }

        // Scala ore dal nuovo pacchetto
        await tx.update(packages)
          .set({ oreResiduo: sql`GREATEST(0, ${packages.oreResiduo} - ${String(oreScalate)})`, updatedAt: new Date() })
          .where(eq(packages.id, newStu.packageId))

        // Gestione giorni MENSILE per il nuovo pacchetto
        const [newPkg] = await tx.select({ tipo: packages.tipo, giorniResiduo: packages.giorniResiduo })
          .from(packages).where(eq(packages.id, newStu.packageId)).limit(1)
        if (newPkg?.tipo === 'MENSILE' && (newPkg.giorniResiduo ?? 0) > 0) {
          const resNew = await tx.select({ n: count() }).from(lessonStudents)
            .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
            .where(and(
              eq(lessonStudents.studentId, newStu.studentId),
              eq(lessonStudents.packageId, newStu.packageId),
              eq(lessons.data, lessonDateStr),
            ))
          if ((resNew[0]?.n ?? 0) === 0) {
            await tx.update(packages)
              .set({ giorniResiduo: sql`GREATEST(0, ${packages.giorniResiduo} - 1)`, updatedAt: new Date() })
              .where(eq(packages.id, newStu.packageId))
          }
        }

        // Aggiorna il record lesson_students con il nuovo pacchetto
        await tx.update(lessonStudents)
          .set({ packageId: newStu.packageId })
          .where(eq(lessonStudents.id, oldRecord.id))

        // Ricalcola stati per entrambi i pacchetti
        for (const pkgId of [oldRecord.packageId, newStu.packageId]) {
          const [updPkg] = await tx.select().from(packages).where(eq(packages.id, pkgId)).limit(1)
          if (updPkg) {
            const newStati = computePackageStates({
              oreAcquistate:  updPkg.oreAcquistate,
              oreResiduo:     updPkg.oreResiduo,
              importoResiduo: updPkg.importoResiduo,
              dataScadenza:   updPkg.dataScadenza,
              giorniResiduo:  updPkg.giorniResiduo,
              sospeso:        updPkg.sospeso,
            })
            await tx.update(packages).set({ stati: newStati, updatedAt: new Date() }).where(eq(packages.id, pkgId))
          }
        }
      }
    }

    // Ricalcola tipo e compenso tutor in base al numero finale di studenti
    const studentCountFinal = data.studenti
      ? data.studenti.length
      : (await tx.select({ n: count() }).from(lessonStudents).where(eq(lessonStudents.lessonId, id)))[0]?.n ?? 0
    const forzaGruppoFinal = data.forzaGruppo ?? lesson.forzaGruppo
    const tipo = determineLessonType(studentCountFinal, forzaGruppoFinal)

    const [slot] = await tx.select().from(timeSlots).where(eq(timeSlots.id, lesson.timeSlotId)).limit(1)
    if (!slot) throw new Error('Slot orario non trovato')
    const mezzaLezioneFinal = data.mezzaLezione ?? lesson.mezzaLezione
    const tariffe       = await getTariffeTutor()
    const compensoTutor = calcCompenso(tariffe, tipo, mezzaLezioneFinal, slot.oraInizio, slot.oraFine)

    const [updated] = await tx
      .update(lessons)
      .set({
        tipo,
        mezzaLezione:  mezzaLezioneFinal,
        compensoTutor: compensoTutor.toFixed(2),
        forzaGruppo:   forzaGruppoFinal,
        note:          data.note !== undefined ? data.note : lesson.note,
        updatedAt:     new Date(),
      })
      .where(eq(lessons.id, id))
      .returning()

    return updated
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
    const lessonDateStr = lesson.data

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
              eq(lessons.data, lessonDateStr)
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
          sospeso:        updatedPkg.sospeso,
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
          columns: { id: true, firstName: true, lastName: true }
        },
        timeSlot: true,
        lessonStudents: {
          with: {
            student: {
              columns: { id: true, firstName: true, lastName: true }
            },
            package: {
              columns: { id: true, nome: true, prezzoTotale: true, oreAcquistate: true }
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
  // Confini del mese come stringhe 'YYYY-MM-DD' (la colonna data è un giorno civile, non un istante)
  const mm = String(query.mese).padStart(2, '0')
  const startDate = `${query.anno}-${mm}-01`
  const ultimoGiorno = new Date(query.anno, query.mese, 0).getDate()
  const endDate   = `${query.anno}-${mm}-${String(ultimoGiorno).padStart(2, '0')}`

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

  // Raggruppa per data (chiave: "YYYY-MM-DD") — lesson.data è già una stringa 'YYYY-MM-DD'
  const byDay: Record<string, typeof rows> = {}
  for (const lesson of rows) {
    const key = lesson.data
    if (!byDay[key]) byDay[key] = []
    byDay[key]!.push(lesson)
  }

  return byDay
}

// ─────────────────────────────────────────────
// POOL DI OGGI — GET /api/tutors/today-pool
// Studenti selezionabili per registrare una lezione oggi: tutte le materie prenotate
// per la giornata odierna (qualunque tutor assegnato, o anche non assegnate), collegate
// a un'anagrafica studente reale.
// ─────────────────────────────────────────────

export async function getPoolStudentiOggi() {
  const { start, end } = confiniGiornoOggiRome()

  const rows = await db
    .select({
      studentId:      bookings.studentId,
      studentName:    bookings.studentName,
      studentSurname: bookings.studentSurname,
      subject:        bookingSubjects.name,
    })
    .from(bookingSubjects)
    .innerJoin(bookings, eq(bookingSubjects.bookingId, bookings.id))
    .where(and(
      isNotNull(bookings.studentId),
      ne(bookings.status, 'CANCELLED'),
      gte(bookings.requestedDate, start),
      lte(bookings.requestedDate, end),
    ))

  return rows.map(r => ({
    studentId: r.studentId as string,
    nome:      `${r.studentName} ${r.studentSurname}`,
    materia:   r.subject,
  }))
}

// Verifica che ogni studente sia nel pool di oggi — usata per impedire a un TUTOR di
// creare una lezione con uno studente non presente nel Matching di oggi.
// Ritorna gli ID degli studenti NON trovati nel pool (vuoto = tutti validi).
export async function verificaPoolOggiPerTutor(studentIds: string[]): Promise<string[]> {
  if (studentIds.length === 0) return []
  const pool = await getPoolStudentiOggi()
  const trovati = new Set(pool.map(p => p.studentId))
  return studentIds.filter(id => !trovati.has(id))
}

// ─────────────────────────────────────────────
// STORICO LEZIONI DI UN PACCHETTO — GET /api/packages/:id/lessons
// Tutte le lezioni in cui sono state scalate ore da questo pacchetto.
// ─────────────────────────────────────────────

export async function getLessonsByPackage(packageId: string) {
  const rows = await db
    .select({
      lessonId:    lessons.id,
      data:        lessons.data,
      tipo:        lessons.tipo,
      oreScalate:  lessonStudents.oreScalate,
      studentFirstName: students.firstName,
      studentLastName:  students.lastName,
      tutorFirstName:   users.firstName,
      tutorLastName:    users.lastName,
    })
    .from(lessonStudents)
    .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
    .innerJoin(students, eq(lessonStudents.studentId, students.id))
    .innerJoin(users, eq(lessons.tutorId, users.id))
    .where(eq(lessonStudents.packageId, packageId))
    .orderBy(desc(lessons.data))

  return rows
}

// ─────────────────────────────────────────────
// MANUTENZIONE — Ricalcolo tipo + compenso di TUTTE le lezioni
// Corregge i dati incoerenti (es. lezioni importate con tipo "SINGOLA" ma 2 studenti):
// ricalcola tipo (SINGOLA/GRUPPO/MAXI) dal numero reale di studenti + forzaGruppo, e il
// compenso tutor di conseguenza. Con apply=false è una simulazione (non scrive nulla).
// ─────────────────────────────────────────────

export type RicalcoloLezioneChange = {
  id: string
  numStudenti: number
  tipoVecchio: LessonType
  tipoNuovo: LessonType
  compensoVecchio: string | null
  compensoNuovo: string
}

export async function ricalcolaTipiECompensiLezioni(apply = false) {
  // Lezioni + slot (per la durata) in un colpo solo
  const allLessons = await db
    .select({
      id:           lessons.id,
      tipo:         lessons.tipo,
      forzaGruppo:  lessons.forzaGruppo,
      mezzaLezione: lessons.mezzaLezione,
      compenso:     lessons.compensoTutor,
      oraInizio:    timeSlots.oraInizio,
      oraFine:      timeSlots.oraFine,
    })
    .from(lessons)
    .innerJoin(timeSlots, eq(lessons.timeSlotId, timeSlots.id))

  // Numero di studenti per lezione
  const counts = await db
    .select({ lessonId: lessonStudents.lessonId, n: count() })
    .from(lessonStudents)
    .groupBy(lessonStudents.lessonId)
  const countMap = new Map(counts.map(c => [c.lessonId, Number(c.n)]))

  const changes: RicalcoloLezioneChange[] = []
  for (const l of allLessons) {
    const n = countMap.get(l.id) ?? 0
    if (n === 0) continue // lezione senza studenti: non la tocco

    const tipoNuovo     = determineLessonType(n, l.forzaGruppo)
    const tariffe = await getTariffeTutor()
    const compensoNuovo = calcCompenso(tariffe, tipoNuovo, l.mezzaLezione, l.oraInizio, l.oraFine).toFixed(2)

    if (tipoNuovo !== l.tipo || compensoNuovo !== l.compenso) {
      changes.push({
        id: l.id,
        numStudenti: n,
        tipoVecchio: l.tipo as LessonType,
        tipoNuovo,
        compensoVecchio: l.compenso,
        compensoNuovo,
      })
    }
  }

  if (apply && changes.length > 0) {
    await db.transaction(async (tx) => {
      for (const c of changes) {
        await tx
          .update(lessons)
          .set({ tipo: c.tipoNuovo, compensoTutor: c.compensoNuovo, updatedAt: new Date() })
          .where(eq(lessons.id, c.id))
      }
    })
  }

  return {
    totaleLezioni: allLessons.length,
    daCorreggere:  changes.length,
    applied:       apply,
    changes,
  }
}
