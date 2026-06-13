// server/services/tutor.service.ts
import { db } from '../database/client'
import {
  users, tutorProfiles, lessons, tutorPayments, tutorReimbursements,
  accountingEntries,
} from '../database/schema'
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import type {
  CreateTutorInput, UpdateTutorInput, TutorQuery,
  PayTutorInput, CreateReimbursementInput, PayReimbursementInput,
} from '../../shared/schemas/tutor.schema'

// ─────────────────────────────────────────────
// LIST — GET /api/tutors
// 4 query parallele per evitare N+1
// ─────────────────────────────────────────────
export async function listTutors(query: TutorQuery) {
  const now = new Date()
  const meseStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const meseEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const pastStart = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
  const pastEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  const searchWhere = query.search
    ? or(
        ilike(users.firstName, `%${query.search}%`),
        ilike(users.lastName,  `%${query.search}%`),
        ilike(users.email,     `%${query.search}%`),
      )
    : undefined

  const activeWhere = query.active !== undefined
    ? eq(users.active, query.active === 'true')
    : undefined

  const [tutorsList, lessonSums, paymentSumsMese, arrearsRows] = await Promise.all([
    // 1. Tutti i tutor con profilo
    db.select({
      id:                users.id,
      email:             users.email,
      firstName:         users.firstName,
      lastName:          users.lastName,
      phone:             users.phone,
      active:            users.active,
      modalitaPagamento: tutorProfiles.modalitaPagamento,
      importoForfait:    tutorProfiles.importoForfait,
      createdAt:         users.createdAt,
    })
    .from(users)
    .leftJoin(tutorProfiles, eq(tutorProfiles.userId, users.id))
    .where(and(eq(users.role, 'TUTOR'), activeWhere, searchWhere))
    .orderBy(asc(users.lastName), asc(users.firstName)),

    // 2. Somma compensi lezioni mese corrente per tutorId
    db.select({
      tutorId:    lessons.tutorId,
      numLezioni: sql<string>`COUNT(*)::text`,
      compenso:   sql<string>`COALESCE(SUM(${lessons.compensoTutor}::numeric), 0)::text`,
    })
    .from(lessons)
    .where(and(gte(lessons.data, meseStart), lte(lessons.data, meseEnd)))
    .groupBy(lessons.tutorId),

    // 3. Somma pagamenti mese corrente per tutorId
    db.select({
      tutorId: tutorPayments.tutorId,
      pagato:  sql<string>`COALESCE(SUM(${tutorPayments.importo}::numeric), 0)::text`,
    })
    .from(tutorPayments)
    .where(and(gte(tutorPayments.mese, meseStart), lte(tutorPayments.mese, meseEnd)))
    .groupBy(tutorPayments.tutorId),

    // 4. Arretrati: mesi passati con compenso > pagato (CTE SQL)
    db.execute(sql`
      WITH monthly_lessons AS (
        SELECT tutor_id,
               DATE_TRUNC('month', data) AS mese,
               FLOOR(COALESCE(SUM(compenso_tutor::numeric), 0)) AS compenso_calcolato
        FROM lessons
        WHERE data >= ${pastStart} AND data <= ${pastEnd}
        GROUP BY tutor_id, DATE_TRUNC('month', data)
      ),
      monthly_payments AS (
        SELECT tutor_id,
               DATE_TRUNC('month', mese) AS mese,
               COALESCE(SUM(importo::numeric), 0) AS pagato
        FROM tutor_payments
        WHERE mese >= ${pastStart} AND mese <= ${pastEnd}
        GROUP BY tutor_id, DATE_TRUNC('month', mese)
      )
      SELECT ml.tutor_id AS tutor_id,
             COUNT(*)::text AS mesi_arretrati,
             COALESCE(SUM(ml.compenso_calcolato - COALESCE(mp.pagato, 0)), 0)::text AS totale_arretrati
      FROM monthly_lessons ml
      LEFT JOIN monthly_payments mp ON ml.tutor_id = mp.tutor_id AND ml.mese = mp.mese
      WHERE ml.compenso_calcolato > COALESCE(mp.pagato, 0)
      GROUP BY ml.tutor_id
    `),
  ])

  const lessonMap  = new Map((lessonSums).map(r => [r.tutorId, r]))
  const payMap     = new Map((paymentSumsMese).map(r => [r.tutorId, r]))
  const arrearsMap = new Map((arrearsRows as any[]).map(r => [r.tutor_id as string, r]))

  let tutoriAttivi    = 0
  let daLiquidare     = 0
  let totaleDovuto    = 0
  let sumLiquidazioni = 0
  let countLiquidati  = 0

  const tutors = tutorsList.map(tutor => {
    const ls = lessonMap.get(tutor.id)
    const ps = payMap.get(tutor.id)
    const ar = arrearsMap.get(tutor.id)

    const compensoCalcolato = Math.floor(parseFloat(ls?.compenso ?? '0'))
    const pagato            = parseFloat(ps?.pagato ?? '0')
    const compensoResiduo   = Math.max(0, compensoCalcolato - pagato)
    const mesiArretrati     = parseInt(ar?.mesi_arretrati ?? '0')
    const totaleArretrati   = Math.round(parseFloat(ar?.totale_arretrati ?? '0') * 100) / 100

    if (tutor.active) tutoriAttivi++
    if (compensoResiduo > 0.01) { daLiquidare++; totaleDovuto += compensoResiduo }
    if (compensoCalcolato > 0) { sumLiquidazioni += compensoCalcolato; countLiquidati++ }

    return {
      ...tutor,
      numLezioniMese:  parseInt(ls?.numLezioni ?? '0'),
      compensoCalcolato,
      compensoResiduo:  Number(compensoResiduo.toFixed(2)),
      mesiArretrati,
      totaleArretrati:  Number(totaleArretrati.toFixed(2)),
    }
  })

  const filtered = query.daLiquidare === 'true'
    ? tutors.filter(t => t.compensoResiduo > 0.01)
    : tutors

  return {
    data: filtered,
    kpi: {
      tutoriAttivi,
      daLiquidare,
      totaleDovuto:      Number(totaleDovuto.toFixed(2)),
      mediaLiquidazione: countLiquidati > 0 ? Number((sumLiquidazioni / countLiquidati).toFixed(2)) : 0,
    },
  }
}

// ─────────────────────────────────────────────
// GET ONE — GET /api/tutors/:id
// ─────────────────────────────────────────────
export async function getTutorById(id: string) {
  const [tutor] = await db
    .select({
      id:                users.id,
      email:             users.email,
      firstName:         users.firstName,
      lastName:          users.lastName,
      phone:             users.phone,
      active:            users.active,
      role:              users.role,
      createdAt:         users.createdAt,
      profileId:         tutorProfiles.id,
      indirizzo:         tutorProfiles.indirizzo,
      citta:             tutorProfiles.citta,
      cap:               tutorProfiles.cap,
      codiceFiscale:     tutorProfiles.codiceFiscale,
      partitaIva:        tutorProfiles.partitaIva,
      materie:           tutorProfiles.materie,
      noteInterne:       tutorProfiles.noteInterne,
      modalitaPagamento: tutorProfiles.modalitaPagamento,
      importoForfait:    tutorProfiles.importoForfait,
    })
    .from(users)
    .leftJoin(tutorProfiles, eq(tutorProfiles.userId, users.id))
    .where(and(eq(users.id, id), eq(users.role, 'TUTOR')))
    .limit(1)

  return tutor ?? null
}

// ─────────────────────────────────────────────
// CREATE — POST /api/tutors
// Transazione: users INSERT + tutorProfiles INSERT
// ─────────────────────────────────────────────
export async function createTutor(data: CreateTutorInput) {
  const hashed = await bcrypt.hash(data.password, 10)

  return db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email:     data.email,
      password:  hashed,
      firstName: data.firstName,
      lastName:  data.lastName,
      role:      'TUTOR',
      phone:     data.phone ?? null,
    }).returning()

    if (!user) throw new Error('Creazione utente fallita')

    const [profile] = await tx.insert(tutorProfiles).values({
      userId:            user.id,
      modalitaPagamento: data.modalitaPagamento ?? 'ORE',
      importoForfait:    data.importoForfait ?? null,
    }).returning()

    const { password: _, ...safeUser } = user
    return { user: safeUser, profile }
  })
}

// ─────────────────────────────────────────────
// UPDATE — PUT /api/tutors/:id
// ─────────────────────────────────────────────
export async function updateTutor(id: string, data: UpdateTutorInput) {
  const userChanges: Record<string, unknown>    = { updatedAt: new Date() }
  const profileChanges: Record<string, unknown> = { updatedAt: new Date() }

  const userFields    = ['firstName', 'lastName', 'email', 'phone', 'active']
  const profileFields = ['indirizzo', 'citta', 'cap', 'codiceFiscale', 'partitaIva',
                         'materie', 'noteInterne', 'modalitaPagamento', 'importoForfait']

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue
    if (userFields.includes(key))    userChanges[key]    = val
    if (profileFields.includes(key)) profileChanges[key] = val
  }

  return db.transaction(async (tx) => {
    const [user] = await tx.update(users)
      .set(userChanges as any)
      .where(and(eq(users.id, id), eq(users.role, 'TUTOR')))
      .returning()

    if (!user) return null

    await tx.update(tutorProfiles)
      .set(profileChanges as any)
      .where(eq(tutorProfiles.userId, id))

    const { password: _, ...safeUser } = user
    return { user: safeUser }
  })
}

// ─────────────────────────────────────────────
// DEACTIVATE — DELETE /api/tutors/:id (soft)
// ─────────────────────────────────────────────
export async function deactivateTutor(id: string) {
  const [updated] = await db.update(users)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.role, 'TUTOR')))
    .returning()

  return updated ?? null
}
