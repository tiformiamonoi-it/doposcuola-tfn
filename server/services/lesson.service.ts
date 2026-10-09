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
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core'
import { computePackageStates } from './package.service'
import { confiniGiornoOggiRome } from '../utils/tutor-time-window'
import { TARIFFE_DEFAULT, determinaTipoLezione } from '#shared/tariffe'
import { caricaRegole, whereRegolePerLezione, calcolaCompensoLezione, type EsitoCompenso } from './tariffe-speciali.service'
import type {
  CreateLessonInput,
  UpdateLessonInput,
  LessonQuery,
  CalendarQuery,
} from '#shared/schemas/lesson.schema'
import type { AnteprimaCompensoInput } from '#shared/schemas/tariffe-speciali.schema'

// ─────────────────────────────────────────────
// TARIFFE TUTOR — lette da system_configs (chiave: tariffe_tutor)
//   SINGOLA = 1 studente senza forzaGruppo
//   GRUPPO  = 2–4 studenti OPPURE 1 studente con forzaGruppo=true
//   MAXI    = 5+ studenti (solo se il maxi gruppo è attivo, altrimenti GRUPPO)
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

// Il compenso si calcola in tariffe-speciali.service.ts (calcolaCompensoLezione): una
// formula sola per creazione, modifica, ricalcolo e anteprima.

// Quando una lezione GIÀ SALVATA va ricalcolata: solo se cambia qualcosa che conta per
// il compenso. Le tariffe (listino e regole speciali) valgono per le lezioni nuove: una
// modifica che non cambia tipo/mezza/alunni/forzatura non ristampa lo scontrino
// (altrimenti i mesi già liquidati mostrerebbero arretrati fantasma).
// La usano updateLesson e l'anteprima della finestra di modifica: stessa risposta.
function compensoDaRicalcolare(
  salvata: { tipo: string; mezzaLezione: boolean; compensoTutor: string | null; compensoForzato: string | null; studentIds: string[] },
  nuova:   { tipo: string; mezzaLezione: boolean; compensoForzato: number | null; studentIds: string[] },
): boolean {
  const prima = new Set(salvata.studentIds)
  const alunniCambiati = prima.size !== new Set(nuova.studentIds).size || nuova.studentIds.some(id => !prima.has(id))
  const forzatoPrima = salvata.compensoForzato == null ? null : Number(salvata.compensoForzato)
  return nuova.tipo !== salvata.tipo ||
    nuova.mezzaLezione !== salvata.mezzaLezione ||
    alunniCambiati ||
    nuova.compensoForzato !== forzatoPrima ||
    salvata.compensoTutor === null
}

// Interruttore "Maxi gruppo attivo" (system_configs → maxi_gruppo_attivo): acceso salvo
// un "false" esplicito, come prima che esistesse. Stessa cache di 60 s delle tariffe.
// La regola del tipo sta in shared/tariffe.ts (determinaTipoLezione), usata anche dalle anteprime.
let maxiCache: { valore: boolean; scade: number } | null = null

async function getMaxiAttivo(): Promise<boolean> {
  const now = Date.now()
  if (maxiCache && maxiCache.scade > now) return maxiCache.valore
  let valore = true
  try {
    const rows = await db.select({ value: systemConfigs.value }).from(systemConfigs).where(eq(systemConfigs.key, 'maxi_gruppo_attivo')).limit(1)
    valore = (rows[0]?.value ?? '').trim().toLowerCase() !== 'false'
  } catch { /* config illeggibile → acceso */ }
  maxiCache = { valore, scade: now + CACHE_TTL_MS }
  return valore
}

// Eccezione "stesso giorno" per i pacchetti MENSILI: se i giorni sono finiti ma la
// giornata della lezione è GIÀ stata conteggiata (esiste già una lezione di quel
// pacchetto in quella data), le ore aggiuntive dello stesso giorno restano permesse.
// Es: ultimo giorno rimasto, oggi 3 ore → la 1ª ora consuma il giorno, la 2ª e 3ª passano.
async function oreAggiuntiveStessoGiornoOk(
  tx: any,
  pkg: { oreResiduo: string; giorniResiduo: number | null },
  statiFreschi: string[],
  studentId: string,
  packageId: string,
  lessonDateStr: string,
  oreScalate: number,
): Promise<boolean> {
  if (Number(pkg.oreResiduo) < oreScalate) return false                 // le ore servono comunque
  if (statiFreschi.includes('SCADUTO')) return false                    // scaduto resta bloccato
  if (pkg.giorniResiduo == null || pkg.giorniResiduo > 0) return false  // blocco non dovuto ai giorni
  const res = await tx
    .select({ n: count() })
    .from(lessonStudents)
    .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
    .where(and(
      eq(lessonStudents.studentId, studentId),
      eq(lessonStudents.packageId, packageId),
      eq(lessons.data, lessonDateStr),
    ))
  return (res[0]?.n ?? 0) > 0
}

// ─────────────────────────────────────────────
// PACCHETTI TOCCATI DA UNA LEZIONE (dentro la transazione)
//
// Prima, per ogni studente, lo stesso pacchetto veniva letto, scritto, riletto per
// sapere il tipo, riletto ancora per ricalcolare gli stati e riscritto: 6-8 viaggi al
// database a studente. Qui si tiene in memoria l'ULTIMA versione di ogni pacchetto:
//
//  - leggi(): i pacchetti da controllare arrivano con UNA query sola (inArray);
//  - scrivi(): UPDATE … RETURNING. Dal primo UPDATE la riga resta bloccata dalla
//    nostra transazione fino alla fine, quindi quello che torna indietro è identico a
//    quello che darebbe una SELECT subito dopo: la rilettura non serve più. La memoria
//    si aggiorna a ogni scrittura, così se due studenti usassero lo stesso pacchetto il
//    secondo lo vede con le ore già scalate, esattamente come prima;
//  - salvaStati(): gli stati si calcolano con la stessa computePackageStates
//    sull'ultima versione di ogni pacchetto scritto e si salvano con UNA query alla
//    fine. Durante la transazione nessuno rilegge la colonna `stati` (i controlli li
//    ricalcolano ogni volta dai numeri), quindi scriverla alla fine invece che dopo
//    ogni studente lascia lo stesso valore finale.
//
// Tutte le scritture sui pacchetti di createLesson/updateLesson passano da scrivi():
// se se ne aggiunge una che non ci passa, la memoria resta indietro.
// ─────────────────────────────────────────────

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type RigaPacchetto = typeof packages.$inferSelect

function pacchettiDellaLezione(tx: Tx) {
  const ultime  = new Map<string, RigaPacchetto>()
  const scritti = new Set<string>()

  return {
    // FOR NO KEY UPDATE: le righe lette restano BLOCCATE fino alla fine della
    // transazione. Così il controllo "ha ancora ore? è scaduto? è sospeso?" vale fino
    // allo scalamento: un pagamento o un'altra lezione sullo stesso pacchetto nello
    // stesso istante aspetta che abbiamo finito, invece di passarci in mezzo.
    // ORDER BY id: tutti i salvataggi bloccano i pacchetti nello stesso ordine, e due
    // lezioni salvate insieme sugli stessi pacchetti non possono bloccarsi a vicenda.
    async leggi(ids: string[]) {
      if (ids.length === 0) return
      const righe = await tx.select().from(packages)
        .where(inArray(packages.id, ids))
        .orderBy(packages.id)
        .for('no key update')
      for (const r of righe) ultime.set(r.id, r)
    },

    ultima(id: string) {
      return ultime.get(id)
    },

    async scrivi(id: string, valori: PgUpdateSetSource<typeof packages>) {
      const [riga] = await tx.update(packages).set(valori).where(eq(packages.id, id)).returning()
      // Nessuna riga = pacchetto inesistente: come prima, niente stati da ricalcolare
      if (riga) {
        ultime.set(riga.id, riga)
        scritti.add(riga.id)
      }
      return riga
    },

    async salvaStati() {
      if (scritti.size === 0) return
      const ids = [...scritti]
      // sql.param con la colonna `stati` = stessa conversione dell'array che fa .set({ stati })
      const casi = ids.map(id =>
        sql`when ${id} then ${sql.param(computePackageStates(ultime.get(id)!), packages.stati)}::package_status[]`,
      )
      await tx
        .update(packages)
        .set({
          stati:     sql`case ${packages.id} ${sql.join(casi, sql` `)} else ${packages.stati} end`,
          updatedAt: new Date(),
        })
        .where(inArray(packages.id, ids))
    },
  }
}

// ─────────────────────────────────────────────
// CREATE — POST /api/lessons
// Transazione atomica: lezione + scalamento ore + stati + compenso
//
// GARANZIA RACE CONDITION: le ore vengono scalate con SQL aritmetico
// (SET ore_residuo = ore_residuo - valore) — mai read-modify-write in memoria
// ─────────────────────────────────────────────

// `utenteId` = chi salva: finisce in compensoForzatoDa se la lezione ha un compenso forzato.
export async function createLesson(data: CreateLessonInput, utenteId: string) {
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

    // 2. Determina tipo lezione e compenso tutor (listino + tariffe speciali + forzatura).
    // Le regole si leggono UNA volta, già filtrate per questo tutor, alunni e giorno.
    const tipo            = determinaTipoLezione(data.studenti.length, data.forzaGruppo, await getMaxiAttivo())
    const compensoForzato = data.compensoForzato ?? null
    const regole          = await caricaRegole(tx, whereRegolePerLezione(data.tutorId, studentIds, data.data))
    const { compenso: compensoTutor } = calcolaCompensoLezione({
      tutorId: data.tutorId, timeSlotId: data.timeSlotId, data: data.data, studentIds,
      tipo, mezzaLezione: data.mezzaLezione, oraInizio: slot.oraInizio, oraFine: slot.oraFine, compensoForzato,
    }, await getTariffeTutor(), regole)

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
        compensoForzato:   compensoForzato?.toFixed(2) ?? null,
        compensoForzatoDa: compensoForzato != null ? utenteId : null,
        note:          data.note ?? null,
      })
      .returning()

    // 4. Per ogni studente: inserisce lesson_student + scala ore atomicamente
    const lessonDateStr = data.data

    // Tutti i pacchetti da controllare in UNA lettura (prima: una lettura per studente),
    // bloccati da qui alla fine: la verifica di ogni studente vale fino al suo scalamento.
    const pacchetti = pacchettiDellaLezione(tx)
    await pacchetti.leggi(data.studenti.map(s => s.packageId))

    for (const studente of data.studenti) {
      // REGOLA: L'alunno, anche se fa mezz'ora, scala SEMPRE un'ora dal pacchetto
      const oreScalate = 1.0

      // 4.a Verifica che il pacchetto sia valido e abbia ore sufficienti
      const pkgCheck = pacchetti.ultima(studente.packageId)

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
        const okStessoGiorno = await oreAggiuntiveStessoGiornoOk(tx, pkgCheck, statiFreschi, studente.studentId, studente.packageId, lessonDateStr, oreScalate)
        if (!okStessoGiorno) {
          throw new Error(`${nomeStudente(studente.studentId)}: il pacchetto non ha ore sufficienti oppure è chiuso, esaurito o scaduto.`)
        }
      }

      // Inserisce il record studente nella lezione
      await tx.insert(lessonStudents).values({
        lessonId:     lesson!.id,
        studentId:    studente.studentId,
        packageId:    studente.packageId,
        oreScalate:   String(oreScalate),
      })

      // Scalamento ore atomico (previene race conditions).
      // RETURNING restituisce già tipo e giorni aggiornati: niente rilettura.
      const pkg = await pacchetti.scrivi(studente.packageId, {
        oreResiduo: sql`GREATEST(0, ${packages.oreResiduo} - ${String(oreScalate)})`,
        updatedAt:  new Date(),
      })

      // Pacchetti MENSILI: deduci 1 giorno solo alla prima lezione di quella data
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
          await pacchetti.scrivi(studente.packageId, {
            giorniResiduo: sql`GREATEST(0, ${packages.giorniResiduo} - 1)`,
            updatedAt:     new Date(),
          })
        }
      }
    }

    // Ricalcola gli stati dei pacchetti (dentro la transazione, sui valori aggiornati):
    // una query per tutti invece di rilettura + scrittura per ogni studente
    await pacchetti.salvaStati()

    return lesson
  })
}

// ─────────────────────────────────────────────
// UPDATE — PUT /api/lessons/:id
// Aggiorna gli studenti/note/forzaGruppo di una lezione esistente (tutor/slot/data restano
// quelli della lezione originale). Rimborsa le ore degli studenti tolti, scala le ore dei
// nuovi, ricalcola tipo e compenso tutor in base al numero finale di studenti.
// ─────────────────────────────────────────────

// `utenteId` = chi salva: finisce in compensoForzatoDa se cambia il compenso forzato.
export async function updateLesson(id: string, data: UpdateLessonInput, utenteId: string) {
  return await db.transaction(async (tx) => {
    const [lesson] = await tx.select().from(lessons).where(eq(lessons.id, id)).limit(1)
    if (!lesson) throw new Error('Lezione non trovata')

    const lessonDateStr = lesson.data

    // Gli alunni di PRIMA della modifica: servono sia qui sotto (chi togliere, chi
    // aggiungere) sia per decidere se il compenso va ricalcolato.
    const existing = await tx.select().from(lessonStudents).where(eq(lessonStudents.lessonId, id))

    if (data.studenti) {
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

      // Ultima versione dei pacchetti toccati (vedi pacchettiDellaLezione): niente riletture
      const pacchetti = pacchettiDellaLezione(tx)

      // Rimuove gli studenti tolti: rimborsa ore (e giorni per i pacchetti MENSILE)
      for (const old of existing) {
        if (newIds.has(old.studentId)) continue

        const oreRimborsate = Number(old.oreScalate)
        // RETURNING restituisce già il tipo: niente rilettura
        const pkg = await pacchetti.scrivi(old.packageId, {
          oreResiduo: sql`${packages.oreResiduo} + ${String(oreRimborsate)}`, updatedAt: new Date(),
        })

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
            await pacchetti.scrivi(old.packageId, {
              giorniResiduo: sql`${packages.giorniResiduo} + 1`, updatedAt: new Date(),
            })
          }
        }

        await tx.delete(lessonStudents).where(eq(lessonStudents.id, old.id))
        // Stati: ricalcolati e salvati tutti insieme in fondo (pacchetti.salvaStati)
      }

      // Pacchetti da controllare (studenti nuovi + studenti che cambiano pacchetto) in UNA
      // lettura, fatta nello stesso punto in cui prima partiva la prima delle letture singole
      // e bloccata fino alla fine come in createLesson (vedi pacchettiDellaLezione.leggi).
      const cambiati = data.studenti.filter(s => existing.some(e => e.studentId === s.studentId && e.packageId !== s.packageId))
      await pacchetti.leggi([...studentiNuovi, ...cambiati].map(s => s.packageId))

      // Aggiunge i nuovi studenti: valida pacchetto e scala le ore (stessa logica di createLesson)
      for (const nuovo of studentiNuovi) {
        const oreScalate = 1.0

        const pkgCheck = pacchetti.ultima(nuovo.packageId)

        if (!pkgCheck) throw new Error(`Pacchetto non trovato per ${nomeStudenteUpd(nuovo.studentId)}`)

        if (pkgCheck.sospeso) {
          throw new Error(`${nomeStudenteUpd(nuovo.studentId)}: il pacchetto è sospeso e non può essere usato.`)
        }

        // Valida sugli stati RICALCOLATI (la colonna salvata può essere obsoleta)
        const statiFreschi = computePackageStates(pkgCheck)
        const hasInvalidState = statiFreschi.includes('CHIUSO') || statiFreschi.includes('ESAURITO') || statiFreschi.includes('SCADUTO')

        if (Number(pkgCheck.oreResiduo) < oreScalate || hasInvalidState) {
          const okStessoGiorno = await oreAggiuntiveStessoGiornoOk(tx, pkgCheck, statiFreschi, nuovo.studentId, nuovo.packageId, lessonDateStr, oreScalate)
          if (!okStessoGiorno) {
            throw new Error(`${nomeStudenteUpd(nuovo.studentId)}: il pacchetto non ha ore sufficienti oppure è chiuso, esaurito o scaduto.`)
          }
        }

        await tx.insert(lessonStudents).values({
          lessonId:  id,
          studentId: nuovo.studentId,
          packageId: nuovo.packageId,
          oreScalate: String(oreScalate),
        })

        // RETURNING restituisce già tipo e giorni aggiornati: niente rilettura
        const pkg = await pacchetti.scrivi(nuovo.packageId, {
          oreResiduo: sql`GREATEST(0, ${packages.oreResiduo} - ${String(oreScalate)})`, updatedAt: new Date(),
        })

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
            await pacchetti.scrivi(nuovo.packageId, {
              giorniResiduo: sql`GREATEST(0, ${packages.giorniResiduo} - 1)`, updatedAt: new Date(),
            })
          }
        }
        // Stati: ricalcolati e salvati tutti insieme in fondo (pacchetti.salvaStati)
      }

      // F7 — studenti già presenti ma con pacchetto cambiato: rimborsa il vecchio, scala il nuovo
      for (const newStu of data.studenti) {
        const oldRecord = existing.find(e => e.studentId === newStu.studentId && e.packageId !== newStu.packageId)
        if (!oldRecord) continue

        const oreScalate = Number(oldRecord.oreScalate)

        // Rimborsa ore al vecchio pacchetto (RETURNING restituisce già il tipo)
        const oldPkg = await pacchetti.scrivi(oldRecord.packageId, {
          oreResiduo: sql`${packages.oreResiduo} + ${String(oreScalate)}`, updatedAt: new Date(),
        })

        // Gestione giorni MENSILE per il vecchio pacchetto
        if (oldPkg?.tipo === 'MENSILE') {
          const resOld = await tx.select({ n: count() }).from(lessonStudents)
            .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
            .where(and(
              eq(lessonStudents.studentId, oldRecord.studentId),
              eq(lessonStudents.packageId, oldRecord.packageId),
              eq(lessons.data, lessonDateStr),
            ))
          if ((resOld[0]?.n ?? 0) === 1) {
            await pacchetti.scrivi(oldRecord.packageId, {
              giorniResiduo: sql`${packages.giorniResiduo} + 1`, updatedAt: new Date(),
            })
          }
        }

        // Verifica nuovo pacchetto
        const newPkgCheck = pacchetti.ultima(newStu.packageId)
        if (!newPkgCheck) throw new Error(`Pacchetto non trovato per ${nomeStudenteUpd(newStu.studentId)}`)
        if (newPkgCheck.sospeso) {
          throw new Error(`${nomeStudenteUpd(newStu.studentId)}: il nuovo pacchetto è sospeso e non può essere usato.`)
        }
        // Valida sugli stati RICALCOLATI (la colonna salvata può essere obsoleta)
        const statiFreschiF7 = computePackageStates(newPkgCheck)
        const hasInvalidStateF7 = statiFreschiF7.includes('CHIUSO') || statiFreschiF7.includes('ESAURITO') || statiFreschiF7.includes('SCADUTO')
        if (Number(newPkgCheck.oreResiduo) < oreScalate || hasInvalidStateF7) {
          const okStessoGiorno = await oreAggiuntiveStessoGiornoOk(tx, newPkgCheck, statiFreschiF7, newStu.studentId, newStu.packageId, lessonDateStr, oreScalate)
          if (!okStessoGiorno) {
            throw new Error(`${nomeStudenteUpd(newStu.studentId)}: il nuovo pacchetto non ha ore sufficienti oppure è chiuso, esaurito o scaduto.`)
          }
        }

        // Scala ore dal nuovo pacchetto (RETURNING restituisce già tipo e giorni)
        const newPkg = await pacchetti.scrivi(newStu.packageId, {
          oreResiduo: sql`GREATEST(0, ${packages.oreResiduo} - ${String(oreScalate)})`, updatedAt: new Date(),
        })

        // Gestione giorni MENSILE per il nuovo pacchetto
        if (newPkg?.tipo === 'MENSILE' && (newPkg.giorniResiduo ?? 0) > 0) {
          const resNew = await tx.select({ n: count() }).from(lessonStudents)
            .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
            .where(and(
              eq(lessonStudents.studentId, newStu.studentId),
              eq(lessonStudents.packageId, newStu.packageId),
              eq(lessons.data, lessonDateStr),
            ))
          if ((resNew[0]?.n ?? 0) === 0) {
            await pacchetti.scrivi(newStu.packageId, {
              giorniResiduo: sql`GREATEST(0, ${packages.giorniResiduo} - 1)`, updatedAt: new Date(),
            })
          }
        }

        // Aggiorna il record lesson_students con il nuovo pacchetto
        await tx.update(lessonStudents)
          .set({ packageId: newStu.packageId })
          .where(eq(lessonStudents.id, oldRecord.id))

        // Stati di entrambi i pacchetti: ricalcolati e salvati in fondo (pacchetti.salvaStati)
      }

      // Stati di tutti i pacchetti scritti (tolti, nuovi, cambiati): una query sola.
      // Qui, prima dello slot e della lezione, esattamente dove finiva l'ultima scrittura di prima.
      await pacchetti.salvaStati()
    }

    // Ricalcola tipo e compenso tutor in base agli alunni finali
    const studentIdsFinali = data.studenti ? data.studenti.map(s => s.studentId) : existing.map(e => e.studentId)
    const forzaGruppoFinal = data.forzaGruppo ?? lesson.forzaGruppo
    // Una lezione già MAXI resta MAXI anche a maxi gruppo spento (storico intatto)
    const tipo = determinaTipoLezione(studentIdsFinali.length, forzaGruppoFinal, lesson.tipo === 'MAXI' || await getMaxiAttivo())

    const mezzaLezioneFinal = data.mezzaLezione ?? lesson.mezzaLezione
    // undefined = il compenso forzato non si tocca; null = si toglie la forzatura
    const forzatoPrima = lesson.compensoForzato == null ? null : Number(lesson.compensoForzato)
    const forzatoFinal = data.compensoForzato !== undefined ? data.compensoForzato : forzatoPrima
    const forzatoCambiato = forzatoFinal !== forzatoPrima

    // Nota: updateLesson non può cambiare slot né data (vedi UpdateLessonSchema), quindi la durata è invariata.
    let compensoTutor = lesson.compensoTutor
    if (compensoDaRicalcolare(
      { ...lesson, studentIds: existing.map(e => e.studentId) },
      { tipo, mezzaLezione: mezzaLezioneFinal, compensoForzato: forzatoFinal, studentIds: studentIdsFinali },
    )) {
      const [slot] = await tx.select().from(timeSlots).where(eq(timeSlots.id, lesson.timeSlotId)).limit(1)
      if (!slot) throw new Error('Slot orario non trovato')
      const regole = await caricaRegole(tx, whereRegolePerLezione(lesson.tutorId, studentIdsFinali, lesson.data))
      compensoTutor = calcolaCompensoLezione({
        tutorId: lesson.tutorId, timeSlotId: lesson.timeSlotId, data: lesson.data, studentIds: studentIdsFinali,
        tipo, mezzaLezione: mezzaLezioneFinal, oraInizio: slot.oraInizio, oraFine: slot.oraFine, compensoForzato: forzatoFinal,
      }, await getTariffeTutor(), regole).compenso.toFixed(2)
    }

    const [updated] = await tx
      .update(lessons)
      .set({
        tipo,
        mezzaLezione:  mezzaLezioneFinal,
        compensoTutor,
        // Chi ha forzato: si aggiorna solo quando la forzatura cambia davvero
        ...(forzatoCambiato ? {
          compensoForzato:   forzatoFinal?.toFixed(2) ?? null,
          compensoForzatoDa: forzatoFinal != null ? utenteId : null,
        } : {}),
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
              // classe: il tutor la vede al posto del pacchetto nella finestra della lezione
              columns: { id: true, firstName: true, lastName: true, classe: true }
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
      // Il tutor vede la classe al posto del pacchetto (ottobre 2026)
      classe:         students.classe,
    })
    .from(bookingSubjects)
    .innerJoin(bookings, eq(bookingSubjects.bookingId, bookings.id))
    .leftJoin(students, eq(bookings.studentId, students.id))
    .where(and(
      isNotNull(bookings.studentId),
      ne(bookings.status, 'CANCELLED'),
      gte(bookings.requestedDate, start),
      lte(bookings.requestedDate, end),
    ))

  // Uno studente prenotato per più materie (o con più prenotazioni) deve comparire
  // UNA volta sola nel picker del tutor: dedup per studentId, materie unite.
  const perStudente = new Map<string, { studentId: string; nome: string; materia: string; classe: string | null }>()
  for (const r of rows) {
    const id = r.studentId as string
    const esistente = perStudente.get(id)
    if (!esistente) {
      perStudente.set(id, { studentId: id, nome: `${r.studentName} ${r.studentSurname}`, materia: r.subject, classe: r.classe })
    } else if (r.subject && !esistente.materia.split(', ').includes(r.subject)) {
      esistente.materia += `, ${r.subject}`
    }
  }
  return [...perStudente.values()]
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
// compenso tutor di conseguenza (listino + tariffe speciali, stessa formula del salvataggio).
// Le lezioni con COMPENSO FORZATO non si toccano mai: la forzatura è una scelta a mano.
// Con apply=false è una simulazione (non scrive nulla).
// ─────────────────────────────────────────────

export type RicalcoloLezioneChange = {
  id: string
  numStudenti: number
  tipoVecchio: LessonType
  tipoNuovo: LessonType
  compensoVecchio: string | null
  compensoNuovo: string
}

// `daData` ('YYYY-MM-DD', opzionale): limita il ricalcolo alle lezioni da quella data in poi.
// Serve per non riscrivere con le tariffe di oggi i mesi già liquidati.
export async function ricalcolaTipiECompensiLezioni(apply = false, daData?: string) {
  // Lezioni + slot (per la durata) in un colpo solo
  const allLessons = await db
    .select({
      id:              lessons.id,
      tutorId:         lessons.tutorId,
      timeSlotId:      lessons.timeSlotId,
      data:            lessons.data,
      tipo:            lessons.tipo,
      forzaGruppo:     lessons.forzaGruppo,
      mezzaLezione:    lessons.mezzaLezione,
      compenso:        lessons.compensoTutor,
      compensoForzato: lessons.compensoForzato,
      oraInizio:       timeSlots.oraInizio,
      oraFine:         timeSlots.oraFine,
    })
    .from(lessons)
    .innerJoin(timeSlots, eq(lessons.timeSlotId, timeSlots.id))
    .where(daData ? gte(lessons.data, daData) : undefined)

  // Gli alunni di ogni lezione (servono alle tariffe speciali, non basta più il numero)
  const righeAlunni = await db
    .select({ lessonId: lessonStudents.lessonId, studentId: lessonStudents.studentId })
    .from(lessonStudents)
  const alunniPerLezione = new Map<string, string[]>()
  for (const r of righeAlunni) {
    const elenco = alunniPerLezione.get(r.lessonId)
    if (elenco) elenco.push(r.studentId)
    else alunniPerLezione.set(r.lessonId, [r.studentId])
  }

  // Una sola lettura per tutto il ciclo: listino, maxi e TUTTE le regole speciali
  const [tariffe, maxiAttivo, regole] = await Promise.all([getTariffeTutor(), getMaxiAttivo(), caricaRegole()])

  const changes: RicalcoloLezioneChange[] = []
  for (const l of allLessons) {
    if (l.compensoForzato != null) continue // compenso forzato a mano: non lo tocco
    const studentIds = alunniPerLezione.get(l.id) ?? []
    const n = studentIds.length
    if (n === 0) continue // lezione senza studenti: non la tocco

    // Stessa regola della modifica: a maxi spento le MAXI già salvate restano MAXI
    const tipoNuovo     = determinaTipoLezione(n, l.forzaGruppo, l.tipo === 'MAXI' || maxiAttivo)
    const compensoNuovo = calcolaCompensoLezione({
      tutorId: l.tutorId, timeSlotId: l.timeSlotId, data: l.data, studentIds,
      tipo: tipoNuovo, mezzaLezione: l.mezzaLezione, oraInizio: l.oraInizio, oraFine: l.oraFine, compensoForzato: null,
    }, tariffe, regole).compenso.toFixed(2)

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
    daData:        daData ?? null,
    changes,
  }
}

// ─────────────────────────────────────────────
// ANTEPRIMA COMPENSO — POST /api/tariffe-speciali/anteprima
// Le finestre del calendario chiedono qui il compenso invece di calcolarlo da sole:
// così vedono la cifra vera (con le tariffe speciali) e da dove viene.
// Una chiamata per tutte le lezioni della finestra; regole, slot e lezioni salvate
// si leggono una volta sola.
// ─────────────────────────────────────────────
export type AnteprimaCompenso = EsitoCompenso & {
  tipo: LessonType
  // true = lezione in modifica che NON verrebbe ricalcolata: resta il compenso salvato
  invariato: boolean
}

export async function anteprimaCompensi(input: AnteprimaCompensoInput): Promise<AnteprimaCompenso[]> {
  const tuttiAlunni = [...new Set(input.lezioni.flatMap(l => l.studentIds))]
  const slotIds     = [...new Set(input.lezioni.map(l => l.timeSlotId))]
  const lessonIds   = input.lezioni.map(l => l.lessonId).filter((x): x is string => !!x)

  const [slots, salvate, alunniSalvati, regole, tariffe, maxiAttivo] = await Promise.all([
    db.select({ id: timeSlots.id, oraInizio: timeSlots.oraInizio, oraFine: timeSlots.oraFine })
      .from(timeSlots).where(inArray(timeSlots.id, slotIds)),
    lessonIds.length
      ? db.select().from(lessons).where(inArray(lessons.id, lessonIds))
      : Promise.resolve([]),
    lessonIds.length
      ? db.select({ lessonId: lessonStudents.lessonId, studentId: lessonStudents.studentId })
          .from(lessonStudents).where(inArray(lessonStudents.lessonId, lessonIds))
      : Promise.resolve([]),
    caricaRegole(db, whereRegolePerLezione(input.tutorId, tuttiAlunni, input.data)),
    getTariffeTutor(),
    getMaxiAttivo(),
  ])

  return input.lezioni.map((l) => {
    const slot = slots.find(s => s.id === l.timeSlotId)
    if (!slot) throw new Error('Slot orario non trovato')
    const salvata = l.lessonId ? salvate.find(x => x.id === l.lessonId) : undefined
    if (l.lessonId && !salvata) throw new Error('Lezione non trovata')

    // Stessa regola del tipo di createLesson/updateLesson (una MAXI salvata resta MAXI)
    const tipo = determinaTipoLezione(l.studentIds.length, l.forzaGruppo, salvata?.tipo === 'MAXI' || maxiAttivo)
    // In modifica il compenso forzato mancante vuol dire "lascia quello salvato", come nel PUT
    const compensoForzato = l.compensoForzato !== undefined
      ? l.compensoForzato
      : (salvata?.compensoForzato == null ? null : Number(salvata.compensoForzato))

    if (salvata && !compensoDaRicalcolare(
      { ...salvata, studentIds: alunniSalvati.filter(a => a.lessonId === salvata.id).map(a => a.studentId) },
      { tipo, mezzaLezione: l.mezzaLezione, compensoForzato, studentIds: l.studentIds },
    )) {
      return {
        compenso:      Number(salvata.compensoTutor),
        tariffaOraria: 0,
        fonte:         compensoForzato != null ? 'FORZATO' as const : 'LISTINO' as const,
        regolaId:      null,
        descrizione:   'compenso già salvato: non cambia con questa modifica',
        tipo,
        invariato:     true,
      }
    }

    const esito = calcolaCompensoLezione({
      tutorId: input.tutorId, timeSlotId: l.timeSlotId, data: input.data, studentIds: l.studentIds,
      tipo, mezzaLezione: l.mezzaLezione, oraInizio: slot.oraInizio, oraFine: slot.oraFine, compensoForzato,
    }, tariffe, regole)
    return { ...esito, tipo, invariato: false }
  })
}
