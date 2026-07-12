// server/services/tutor.service.ts
import { db } from '../database/client'
import {
  users, tutorProfiles, lessons,
  tutorPayments, tutorReimbursements, accountingEntries,
} from '../database/schema'
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { sendEmail, emailBenvenutoCredenziali } from '../utils/email'
import { nomeProprio } from '../utils/nomi'
import type {
  CreateTutorInput, UpdateTutorInput, TutorQuery,
  PayTutorInput, CreateReimbursementInput, PayReimbursementInput,
} from '#shared/schemas/tutor.schema'

// ─────────────────────────────────────────────
// LIST — GET /api/tutors
// 4 query parallele per evitare N+1
// ─────────────────────────────────────────────
export async function listTutors(query: TutorQuery) {
  const now = new Date()
  const meseStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const meseEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  // Confini del mese come stringhe 'YYYY-MM-DD' per la colonna lessons.data (giorno civile)
  const meseMM       = String(now.getMonth() + 1).padStart(2, '0')
  const meseStartStr = `${now.getFullYear()}-${meseMM}-01`
  const meseEndStr   = `${now.getFullYear()}-${meseMM}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`
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
    .where(and(gte(lessons.data, meseStartStr), lte(lessons.data, meseEndStr)))
    .groupBy(lessons.tutorId),

    // 3. Somma pagamenti mese corrente per tutorId (+ flag Pro Bono: mese liquidato a titolo gratuito)
    db.select({
      tutorId: tutorPayments.tutorId,
      pagato:  sql<string>`COALESCE(SUM(${tutorPayments.importo}::numeric), 0)::text`,
      proBono: sql<boolean>`BOOL_OR(${tutorPayments.status} = 'PRO_BONO')`,
    })
    .from(tutorPayments)
    .where(and(gte(tutorPayments.mese, meseStart), lte(tutorPayments.mese, meseEnd)))
    .groupBy(tutorPayments.tutorId),

    // 4. Arretrati: mesi passati con compenso > pagato
    db.execute(sql`
      WITH monthly_lessons AS (
        SELECT tutor_id,
               DATE_TRUNC('month', data) AS mese,
               FLOOR(COALESCE(SUM(compenso_tutor::numeric), 0)) AS compenso_calcolato
        FROM lessons
        WHERE data >= ${pastStart.toISOString().slice(0, 10)} AND data <= ${pastEnd.toISOString().slice(0, 10)}
        GROUP BY tutor_id, DATE_TRUNC('month', data)
      ),
      monthly_payments AS (
        SELECT tutor_id,
               DATE_TRUNC('month', mese) AS mese,
               COALESCE(SUM(importo::numeric), 0) AS pagato,
               BOOL_OR(status = 'PRO_BONO') AS pro_bono
        FROM tutor_payments
        WHERE mese >= ${pastStart.toISOString()} AND mese <= ${pastEnd.toISOString()}
        GROUP BY tutor_id, DATE_TRUNC('month', mese)
      )
      SELECT ml.tutor_id AS tutor_id,
             COUNT(*)::text AS mesi_arretrati,
             COALESCE(SUM(ml.compenso_calcolato - COALESCE(mp.pagato, 0)), 0)::text AS totale_arretrati
      FROM monthly_lessons ml
      LEFT JOIN monthly_payments mp ON ml.tutor_id = mp.tutor_id AND ml.mese = mp.mese
      WHERE ml.compenso_calcolato > COALESCE(mp.pagato, 0)
        AND NOT COALESCE(mp.pro_bono, false)
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
    // Pro Bono: il mese è considerato saldato (residuo 0) anche se non transita in contabilità.
    const compensoResiduo   = ps?.proBono ? 0 : Math.max(0, compensoCalcolato - pagato)
    const mesiArretrati     = parseInt(ar?.mesi_arretrati ?? '0')
    const totaleArretrati   = Math.round(parseFloat(ar?.totale_arretrati ?? '0') * 100) / 100

    // Totale unico "Da liquidare": mese corrente + tutti i mesi arretrati insieme.
    const totaleDaLiquidare = Number((compensoResiduo + totaleArretrati).toFixed(2))
    const mesiDaLiquidare   = mesiArretrati + (compensoResiduo > 0.01 ? 1 : 0)

    if (tutor.active) tutoriAttivi++
    if (totaleDaLiquidare > 0.01) { daLiquidare++; totaleDovuto += totaleDaLiquidare }
    if (compensoCalcolato > 0) { sumLiquidazioni += compensoCalcolato; countLiquidati++ }

    return {
      ...tutor,
      numLezioniMese:  parseInt(ls?.numLezioni ?? '0'),
      compensoCalcolato,
      compensoResiduo:  Number(compensoResiduo.toFixed(2)),
      mesiArretrati,
      totaleArretrati:  Number(totaleArretrati.toFixed(2)),
      totaleDaLiquidare,
      mesiDaLiquidare,
    }
  })

  const filtered = query.daLiquidare === 'true'
    ? tutors.filter(t => t.totaleDaLiquidare > 0.01)
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

  const created = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email:     data.email,
      password:  hashed,
      firstName: nomeProprio(data.firstName),
      lastName:  nomeProprio(data.lastName),
      role:      data.role ?? 'TUTOR',
      phone:     data.phone ?? null,
      mustChangePassword: true, // password impostata dall'admin: obbligo cambio al primo accesso
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

  // Dopo la transazione: benvenuto con credenziali (non blocca mai la creazione)
  const { sent } = await sendEmail({
    to: created.user.email,
    ...emailBenvenutoCredenziali({ nome: created.user.firstName, email: created.user.email, tempPassword: data.password, cambioObbligatorio: true }),
  })

  return { ...created, emailInviata: sent }
}

// ─────────────────────────────────────────────
// UPDATE — PUT /api/tutors/:id
// ─────────────────────────────────────────────
export async function updateTutor(id: string, data: UpdateTutorInput) {
  const userChanges: Record<string, unknown>    = { updatedAt: new Date() }
  const profileChanges: Record<string, unknown> = { updatedAt: new Date() }

  const userFields    = ['firstName', 'lastName', 'email', 'phone', 'role', 'active']
  const profileFields = ['indirizzo', 'citta', 'cap', 'codiceFiscale', 'partitaIva',
                         'materie', 'noteInterne', 'modalitaPagamento', 'importoForfait']

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue
    if (userFields.includes(key))    userChanges[key]    = val
    if (profileFields.includes(key)) profileChanges[key] = val
  }

  // Nomi sempre in formato "Nome Proprio" (mai tutto maiuscolo/minuscolo)
  if (typeof userChanges.firstName === 'string') userChanges.firstName = nomeProprio(userChanges.firstName)
  if (typeof userChanges.lastName === 'string')  userChanges.lastName  = nomeProprio(userChanges.lastName)

  // Reset password (admin): salvata solo hashata, mai in chiaro
  if (data.password) {
    userChanges.password = await bcrypt.hash(data.password, 10)
    userChanges.mustChangePassword = true // il tutor dovrà cambiarla al prossimo accesso
  }

  const updated = await db.transaction(async (tx) => {
    const [user] = await tx.update(users)
      .set(userChanges as any)
      // Tutto lo staff è modificabile (serve per cambiare ruolo in entrambe le direzioni)
      .where(and(eq(users.id, id), inArray(users.role, ['TUTOR', 'SUPER_TUTOR', 'ADMIN'])))
      .returning()

    if (!user) return null

    await tx.update(tutorProfiles)
      .set(profileChanges as any)
      .where(eq(tutorProfiles.userId, id))

    const { password: _, ...safeUser } = user
    return { user: safeUser }
  })

  // Password reimpostata dall'admin: invia le nuove credenziali al tutor
  if (updated && data.password) {
    const { sent } = await sendEmail({
      to: updated.user.email,
      ...emailBenvenutoCredenziali({ nome: updated.user.firstName, email: updated.user.email, tempPassword: data.password, cambioObbligatorio: true }),
    })
    return { ...updated, emailInviata: sent }
  }

  return updated
}

// ─────────────────────────────────────────────
// DEACTIVATE — DELETE /api/tutors/:id (soft)
// ─────────────────────────────────────────────
export async function deactivateTutor(id: string) {
  const [updated] = await db.update(users)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(users.id, id), inArray(users.role, ['TUTOR', 'SUPER_TUTOR', 'ADMIN'])))
    .returning()

  return updated ?? null
}

// ─────────────────────────────────────────────
// COMPENSI MENSILI — GET /api/tutors/:id/compensation
// Storico ultimi N mesi con stato pagamento
// ─────────────────────────────────────────────
export async function getMonthlyCompensation(tutorId: string, months = 12) {
  const now       = new Date()
  const pastStart = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)

  const [lessonRows, paymentRows] = await Promise.all([
    db.execute(sql`
      SELECT DATE_TRUNC('month', data) AS mese,
             COUNT(*)::text AS num_lezioni,
             COALESCE(SUM(compenso_tutor::numeric), 0)::text AS compenso_grezzo
      FROM lessons
      WHERE tutor_id = ${tutorId} AND data >= ${pastStart.toISOString().slice(0, 10)}
      GROUP BY DATE_TRUNC('month', data)
      ORDER BY mese DESC
    `),
    db.select()
      .from(tutorPayments)
      .where(and(
        eq(tutorPayments.tutorId, tutorId),
        gte(tutorPayments.mese, pastStart),
      ))
      .orderBy(desc(tutorPayments.mese)),
  ])

  const [tutorRec] = await db
    .select({
      modalitaPagamento: tutorProfiles.modalitaPagamento,
      importoForfait:    tutorProfiles.importoForfait,
    })
    .from(tutorProfiles)
    .where(eq(tutorProfiles.userId, tutorId))
    .limit(1)

  // Mappa pagamenti per chiave YYYY-MM (Local Time per evitare shift di fuso orario)
  const payByMonth = new Map<string, { totale: number; proBono: boolean }>()
  for (const p of paymentRows) {
    const pDate = new Date(p.mese)
    const key = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`
    const cur = payByMonth.get(key) ?? { totale: 0, proBono: false }
    payByMonth.set(key, {
      totale:  cur.totale + parseFloat(p.importo),
      proBono: cur.proBono || p.status === 'PRO_BONO',
    })
  }

  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return (lessonRows as any[]).map(row => {
    const meseDate          = new Date(row.mese)
    const meseKey           = `${meseDate.getFullYear()}-${String(meseDate.getMonth() + 1).padStart(2, '0')}`
    const compensoGrezzo    = parseFloat(row.compenso_grezzo)
    
    let compensoCalcolato = Math.floor(compensoGrezzo)
    if (tutorRec?.modalitaPagamento === 'FORFAIT' && tutorRec.importoForfait) {
      compensoCalcolato = parseFloat(tutorRec.importoForfait as string)
    }

    const pay               = payByMonth.get(meseKey)
    const pagato            = pay?.totale ?? 0
    // Pro Bono: il mese è considerato saldato (residuo 0) anche se non transita in contabilità.
    const residuo           = pay?.proBono ? 0 : Math.max(0, compensoCalcolato - pagato)
    const isMeseCorrente    = meseKey === nowKey

    let stato: string
    if (pay?.proBono)                          stato = 'PRO_BONO'
    else if (residuo <= 0.01 && pagato > 0)    stato = 'PAGATO'
    else if (pagato > 0.01 && residuo > 0.01)  stato = 'PARZIALE'
    else                                       stato = 'DA_PAGARE'

    return {
      mese:             meseKey,
      meseLabel:        meseDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
      numLezioni:       parseInt(row.num_lezioni),
      compensoGrezzo:   Number(compensoGrezzo.toFixed(2)),
      compensoCalcolato,
      pagato:           Number(pagato.toFixed(2)),
      residuo:          Number(residuo.toFixed(2)),
      stato,
      isMeseCorrente,
    }
  })
}

// ─────────────────────────────────────────────
// LIQUIDA — POST /api/tutors/:id/pay
// Crea tutorPayment + accountingEntry USCITA in transazione
// PRO_BONO: importo=0, nessun accounting
// ─────────────────────────────────────────────
export async function payTutor(tutorId: string, data: PayTutorInput) {
  const meseDate = new Date(data.mese)
  const importo  = data.proBono ? 0 : parseFloat(data.importo)
  const status   = data.proBono ? 'PRO_BONO' : 'PAGATO'

  if (!data.proBono && importo <= 0) {
    throw new Error('Inserisci un importo maggiore di zero, oppure spunta "Pro Bono" per un compenso a titolo gratuito.')
  }

  return db.transaction(async (tx) => {
    // Rete di sicurezza anti-doppio-invio: blocca un pagamento identico
    // (stesso tutor, mese, importo) registrato negli ultimi 15 secondi.
    const [duplicate] = await tx.select({ id: tutorPayments.id })
      .from(tutorPayments)
      .where(and(
        eq(tutorPayments.tutorId, tutorId),
        eq(tutorPayments.mese, meseDate),
        eq(tutorPayments.importo, importo.toFixed(2)),
        gte(tutorPayments.createdAt, new Date(Date.now() - 15_000)),
      ))
      .limit(1)

    if (duplicate) {
      throw new Error('Hai già registrato un pagamento identico pochi secondi fa. Controlla lo storico pagamenti prima di riprovare.')
    }

    const [payment] = await tx.insert(tutorPayments).values({
      tutorId,
      mese:    meseDate,
      importo: importo.toFixed(2),
      metodo:  data.metodo,
      status,
      note:    data.note ?? null,
    }).returning()

    if (!payment) throw new Error('Inserimento pagamento fallito')

    if (!data.proBono && importo > 0) {
      await tx.insert(accountingEntries).values({
        tipo:            'USCITA',
        importo:         importo.toFixed(2),
        descrizione:     `Compenso tutor — ${meseDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`,
        categoria:       'compenso_tutor',
        metodoPagamento: data.metodo,
        tutorPaymentId:  payment.id,
        note:            `tutorPaymentId:${payment.id} tutorId:${tutorId}`,
      })
    }

    return payment
  })
}

// ─────────────────────────────────────────────
// PERFORMANCE — GET /api/tutors/:id/performance
// Ricavo generato vs compenso vs margine per mese
// ─────────────────────────────────────────────
export async function getMonthlyPerformance(tutorId: string, months = 6) {
  const now       = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)

  // Il compenso è PER LEZIONE: va sommato una volta sola per lezione.
  // Il vecchio JOIN diretto con lesson_students lo contava una volta per ogni alunno
  // della lezione, gonfiando i compensi (e rendendo i margini sempre negativi).
  // Il ricavo invece è per alunno: lo calcola la subquery LATERAL, una riga per lezione.
  const rows = await db.execute(sql`
    SELECT
      DATE_TRUNC('month', l.data) AS mese,
      COUNT(*)::text AS num_lezioni,
      COALESCE(SUM(r.num_studenti), 0)::text AS num_studenti_slot,
      COALESCE(SUM(l.compenso_tutor::numeric), 0)::text AS compenso_totale,
      COALESCE(SUM(r.ricavo), 0)::text AS ricavo_totale
    FROM lessons l
    LEFT JOIN LATERAL (
      SELECT COUNT(ls.id) AS num_studenti,
             SUM(
               CASE WHEN l.mezza_lezione THEN 0.5 ELSE 1.0 END
               -- Stessa formula/precedenza di ricavoOrarioPacchetto() in shared/tariffe.ts
               -- (prima preferiva tariffa_oraria con fallback 25€: numeri diversi dal calendario)
               * CASE
                   WHEN p.ore_acquistate IS NOT NULL AND p.ore_acquistate::numeric > 0
                        AND p.prezzo_totale IS NOT NULL
                   THEN p.prezzo_totale::numeric / p.ore_acquistate::numeric
                   ELSE COALESCE(p.tariffa_oraria::numeric, 0)
                 END
             ) AS ricavo
      FROM lesson_students ls
      LEFT JOIN packages p ON p.id = ls.package_id
      WHERE ls.lesson_id = l.id
    ) r ON true
    WHERE l.tutor_id = ${tutorId} AND l.data >= ${startDate.toISOString().slice(0, 10)}
    GROUP BY DATE_TRUNC('month', l.data)
    ORDER BY mese DESC
  `)

  // Tutor a fisso mensile (FORFAIT): il compenso reale è il fisso, non la somma per lezione
  // (stessa regola dello storico compensi, così le due tabelle tornano).
  const [profiloPerf] = await db
    .select({ modalitaPagamento: tutorProfiles.modalitaPagamento, importoForfait: tutorProfiles.importoForfait })
    .from(tutorProfiles)
    .where(eq(tutorProfiles.userId, tutorId))
    .limit(1)
  const forfait = profiloPerf?.modalitaPagamento === 'FORFAIT' && profiloPerf.importoForfait
    ? parseFloat(profiloPerf.importoForfait as string)
    : null

  return (rows as any[]).map(row => {
    const ricavo   = parseFloat(row.ricavo_totale)
    const compenso = forfait ?? parseFloat(row.compenso_totale)
    const margine  = ricavo - compenso
    const meseDate = new Date(row.mese)

    return {
      mese:        meseDate.toISOString().substring(0, 7),
      meseLabel:   meseDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
      numLezioni:  parseInt(row.num_lezioni),
      numStudenti: parseInt(row.num_studenti_slot),
      ricavo:      Number(ricavo.toFixed(2)),
      compenso:    Number(compenso.toFixed(2)),
      margine:     Number(margine.toFixed(2)),
      marginePerc: ricavo > 0 ? Math.round((margine / ricavo) * 100) : 0,
    }
  })
}

// ─────────────────────────────────────────────
// STATISTICHE DETTAGLIATE — GET /api/tutors/:id/stats
// Distribuzione per tipo lezione + top 5 alunni
// ─────────────────────────────────────────────
export async function getDetailedStats(tutorId: string, months = 6) {
  const now       = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)

  const tipoRows = await db.execute(sql`
      SELECT l.tipo,
             COUNT(DISTINCT l.id)::text AS num_lezioni,
             COALESCE(SUM(CASE WHEN l.mezza_lezione THEN 0.5 ELSE 1.0 END), 0)::text AS ore_totali
      FROM lessons l
      JOIN lesson_students ls ON ls.lesson_id = l.id
      WHERE l.tutor_id = ${tutorId} AND l.data >= ${startDate.toISOString().slice(0, 10)}
      GROUP BY l.tipo
    `)

  const topStudentRows = await db.execute(sql`
      SELECT s.id,
             s.first_name AS first_name,
             s.last_name  AS last_name,
             COUNT(DISTINCT l.id)::text AS num_lezioni,
             COALESCE(SUM(CASE WHEN l.mezza_lezione THEN 0.5 ELSE 1.0 END), 0)::text AS ore_totali
      FROM lessons l
      JOIN lesson_students ls ON ls.lesson_id = l.id
      JOIN students s ON s.id = ls.student_id
      WHERE l.tutor_id = ${tutorId} AND l.data >= ${startDate.toISOString().slice(0, 10)}
      GROUP BY s.id, s.first_name, s.last_name
      ORDER BY COALESCE(SUM(CASE WHEN l.mezza_lezione THEN 0.5 ELSE 1.0 END), 0) DESC
      LIMIT 5
    `)

  const tipoData = (tipoRows as any[]).map(r => ({
    tipo:       r.tipo as string,
    numLezioni: parseInt(r.num_lezioni),
    oreTotali:  parseFloat(r.ore_totali),
  }))

  const totalOre = tipoData.reduce((s, r) => s + r.oreTotali, 0)

  return {
    distribuzioneTipo: tipoData.map(r => ({
      ...r,
      percentuale: totalOre > 0 ? Math.round((r.oreTotali / totalOre) * 100) : 0,
    })),
    topStudenti: (topStudentRows as any[]).map(r => ({
      id:         r.id as string,
      firstName:  r.first_name as string,
      lastName:   r.last_name as string,
      numLezioni: parseInt(r.num_lezioni),
      oreTotali:  parseFloat(r.ore_totali),
    })),
  }
}

// ─────────────────────────────────────────────
// RIMBORSI — GET /api/tutors/:id/reimbursements
// ─────────────────────────────────────────────
export async function listReimbursements(tutorId: string) {
  return db.select()
    .from(tutorReimbursements)
    .where(eq(tutorReimbursements.tutorId, tutorId))
    .orderBy(desc(tutorReimbursements.dataRichiesta))
}

// ─────────────────────────────────────────────
// CREA RIMBORSO — POST /api/tutors/:id/reimbursements
// ─────────────────────────────────────────────
export async function createReimbursement(tutorId: string, data: CreateReimbursementInput) {
  const [created] = await db.insert(tutorReimbursements).values({
    tutorId,
    importo:       data.importo,
    descrizione:   data.descrizione,
    dataRichiesta: data.dataRichiesta ? new Date(data.dataRichiesta) : new Date(),
    stato:         'DA_PAGARE',
    note:          data.note ?? null,
  }).returning()

  return created
}

// ─────────────────────────────────────────────
// PAGA RIMBORSO — POST /api/tutors/:id/reimbursements/:rid/pay
// importoPagato cresce ad ogni pagamento
// stato PARZIALE se importoPagato < importo, PAGATO se >=
// ─────────────────────────────────────────────
export async function payReimbursement(reimbursementId: string, data: PayReimbursementInput) {
  return db.transaction(async (tx) => {
    // 1. Lock the row to prevent concurrent payment race conditions
    const [current] = await tx.execute(sql`
      SELECT * FROM tutor_reimbursements 
      WHERE id = ${reimbursementId} 
      FOR UPDATE
    `)
    
    if (!current) throw new Error('Rimborso non trovato')

    const importoTotale  = parseFloat(current.importo as string)
    const giaPagato      = parseFloat(current.importo_pagato as string)
    const nuovoPagamento = parseFloat(data.importoPagamento)
    const nuovoPagato    = giaPagato + nuovoPagamento
    
    // Check against overpayment
    if (nuovoPagato > importoTotale + 0.01) {
      throw new Error(`Il pagamento (€${nuovoPagamento.toFixed(2)}) eccede l'importo totale rimborsabile (€${(importoTotale - giaPagato).toFixed(2)} rimanenti)`)
    }

    const nuovoStato: 'PARZIALE' | 'PAGATO' = nuovoPagato >= importoTotale - 0.01 ? 'PAGATO' : 'PARZIALE'

    const [updated] = await tx.update(tutorReimbursements)
      .set({
        importoPagato: nuovoPagato.toFixed(2),
        stato:         nuovoStato,
        dataPagamento: nuovoStato === 'PAGATO' ? new Date() : new Date(current.data_pagamento as string ?? Date.now()),
        metodo:        data.metodo,
        note:          data.note ?? (current.note as string),
        updatedAt:     new Date(),
      })
      .where(eq(tutorReimbursements.id, reimbursementId))
      .returning()

    await tx.insert(accountingEntries).values({
      tipo:            'USCITA',
      importo:         nuovoPagamento.toFixed(2),
      descrizione:     `Rimborso spese: ${current.descrizione}`,
      categoria:       'rimborso_tutor',
      metodoPagamento: data.metodo,
      reimbursementId: reimbursementId,
      note:            `rimborsoId:${reimbursementId} tutorId:${current.tutor_id}`,
    })

    return updated
  })
}

// ─────────────────────────────────────────────
// DELETE compenso tutor — la scrittura contabile collegata sparisce via CASCADE.
// Il "pagato" del mese è calcolato a runtime, quindi si riallinea da solo.
// ─────────────────────────────────────────────
export async function deleteTutorPayment(id: string) {
  const [row] = await db.delete(tutorPayments).where(eq(tutorPayments.id, id)).returning()
  if (!row) throw new Error('Compenso non trovato')
  return { ok: true }
}

// Elenco dei singoli compensi pagati a un tutor (più recenti in cima)
export async function listTutorPayments(tutorId: string) {
  return await db
    .select()
    .from(tutorPayments)
    .where(eq(tutorPayments.tutorId, tutorId))
    .orderBy(desc(tutorPayments.mese), desc(tutorPayments.createdAt))
}

// ─────────────────────────────────────────────
// DELETE rimborso (intero) — tutte le scritture contabili collegate
// spariscono via CASCADE su accounting_entries.reimbursementId.
// ─────────────────────────────────────────────
export async function deleteReimbursement(id: string) {
  const [row] = await db.delete(tutorReimbursements).where(eq(tutorReimbursements.id, id)).returning()
  if (!row) throw new Error('Rimborso non trovato')
  return { ok: true }
}

// ─────────────────────────────────────────────
// Eliminazione di UNA scrittura parziale di rimborso (dalla contabilità):
// riduce l'importo già pagato del rimborso e ne ricalcola lo stato.
// La cancellazione della riga contabile avviene nel chiamante (accounting.service).
// ─────────────────────────────────────────────
export async function reduceReimbursementOnEntryDelete(reimbursementId: string, importoEntry: string) {
  return await db.transaction(async (tx) => {
    const [r] = await tx.select().from(tutorReimbursements).where(eq(tutorReimbursements.id, reimbursementId)).limit(1)
    if (!r) return
    const nuovoPagato = Math.max(0, parseFloat(r.importoPagato) - parseFloat(importoEntry))
    const totale      = parseFloat(r.importo)
    const stato: 'DA_PAGARE' | 'PARZIALE' | 'PAGATO' =
      nuovoPagato <= 0.01 ? 'DA_PAGARE' : (nuovoPagato >= totale - 0.01 ? 'PAGATO' : 'PARZIALE')
    await tx.update(tutorReimbursements)
      .set({ importoPagato: nuovoPagato.toFixed(2), stato, updatedAt: new Date() })
      .where(eq(tutorReimbursements.id, reimbursementId))
  })
}
