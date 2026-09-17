// server/services/tutor.service.ts
import { db } from '../database/client'
import {
  users, tutorProfiles, lessons,
  tutorPayments, tutorReimbursements, accountingEntries,
} from '../database/schema'
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { annullaLinkAperti, inviaInvitoPassword } from '../utils/password-token'
import { inCentesimi, inEuro } from '../utils/arrotondamenti'
import { nomeProprio } from '../utils/nomi'
import { CAT } from '#shared/accounting-categories'
import {
  etichettaMese, fissoDelMese, meseDiOggi, mesiDovutiAFisso, primoGiornoDelMese,
  type ProfiloCompensoTutor,
} from '#shared/compenso-tutor'
import type {
  CreateTutorInput, UpdateTutorInput, TutorQuery,
  PayTutorInput, CreateReimbursementInput, PayReimbursementInput,
} from '#shared/schemas/tutor.schema'

// Giorno civile 'YYYY-MM-DD' dal fuso locale.
// NON usare toISOString(): converte in UTC e in ora legale sposta la data al giorno prima
// (1 agosto 00:00 Europe/Rome → '2025-07-31'), falsando i confronti su lessons.data.
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Chiave mese 'YYYY-MM' dal fuso locale, stessa ragione di ymd().
function ym(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─────────────────────────────────────────────
// LA GRIGLIA MESE-PER-MESE DEI COMPENSI DOVUTI — un pezzo di SQL solo, condiviso.
//
// È la stessa domanda di shared/compenso-tutor.ts ("questo mese vale il fisso o le
// ore?"), scritta in SQL perché gli arretrati si contano dentro il database, su tutti
// i tutor in una volta sola. Lo usano l'elenco dei tutor e il riepilogo debiti della
// dashboard: due copie che si scostano vorrebbero dire due totali diversi nella
// stessa schermata, ed è il difetto che stiamo chiudendo.
//
// Restituisce le CTE fino a `mesi_compenso`, una riga per (tutor, mese) con quanto
// gli è dovuto quel mese. Chi la usa ci attacca dopo le proprie CTE e la SELECT.
//
// Due cose che fa e che prima non succedevano:
//  • i mesi PRIMA della partenza del fisso restano contati a ore (niente arretrati
//    inventati per chi è passato al fisso a metà anno);
//  • i mesi a fisso compaiono ANCHE SENZA LEZIONI (generate_series), perché un fisso
//    mensile si deve anche nel mese in cui il tutor non ha lavorato.
//
// I tre parametri sono mesi 'AAAA-MM': dal mese `daMese` al mese `aMese` compresi, e
// `meseCorrente` è il mese di oggi — serve come partenza di riserva per i tutor a
// fisso che non hanno una data (i profili vecchi): mai all'indietro.
// ─────────────────────────────────────────────
export function sqlMesiCompenso(daMese: string, aMese: string, meseCorrente: string) {
  const primoGiornoDa  = primoGiornoDelMese(daMese)
  const primoGiornoA   = primoGiornoDelMese(aMese)
  const primoGiornoOra = primoGiornoDelMese(meseCorrente)

  return sql`
    profili_fisso AS (
      SELECT tp.user_id AS tutor_id,
             tp.importo_forfait::numeric AS importo_fisso,
             -- Da quale mese parte il fisso, tenuto dentro la finestra richiesta.
             -- COALESCE sul mese corrente: profilo a fisso senza data di partenza
             -- (dati anteriori al 14/09/2026) = il fisso vale da adesso in poi.
             GREATEST(
               DATE_TRUNC('month', COALESCE(tp.forfait_dal, ${primoGiornoOra}::date))::date,
               ${primoGiornoDa}::date
             ) AS primo_mese_fisso
      FROM tutor_profiles tp
      WHERE tp.modalita_pagamento = 'FORFAIT'
        AND tp.importo_forfait IS NOT NULL
        AND tp.importo_forfait::numeric > 0
    ),
    mesi_fisso AS (
      -- Un mese per ogni mese del periodo a fisso, lezioni o non lezioni.
      -- Se il fisso parte dopo la fine della finestra, generate_series non produce
      -- nessuna riga e per quel tutor è come se il fisso non ci fosse.
      SELECT p.tutor_id,
             gs.mese::date AS mese,
             p.importo_fisso AS compenso
      FROM profili_fisso p
      CROSS JOIN LATERAL generate_series(
        p.primo_mese_fisso::timestamp,
        ${primoGiornoA}::timestamp,
        INTERVAL '1 month'
      ) AS gs(mese)
    ),
    mesi_ore AS (
      -- Il conto a ore di sempre: somma dei compensi delle lezioni del mese,
      -- arrotondata PER DIFETTO all'euro (regola voluta, non si tocca).
      SELECT tutor_id,
             DATE_TRUNC('month', data)::date AS mese,
             FLOOR(COALESCE(SUM(compenso_tutor::numeric), 0)) AS compenso
      FROM lessons
      WHERE data >= ${primoGiornoDa}::date
        AND data <  (${primoGiornoA}::date + INTERVAL '1 month')
      GROUP BY tutor_id, DATE_TRUNC('month', data)::date
    ),
    mesi_compenso AS (
      -- FULL OUTER JOIN e non un LEFT: servono sia i mesi con lezioni ma senza fisso
      -- (i tutor a ore, cioè quasi tutti) sia i mesi a fisso senza nemmeno una lezione.
      -- Dove ci sono entrambi vince il fisso: quel mese il tutor è a fisso.
      SELECT COALESCE(mf.tutor_id, mo.tutor_id)    AS tutor_id,
             COALESCE(mf.mese, mo.mese)            AS mese,
             COALESCE(mf.compenso, mo.compenso, 0) AS compenso_calcolato
      FROM mesi_ore mo
      FULL OUTER JOIN mesi_fisso mf
        ON mf.tutor_id = mo.tutor_id AND mf.mese = mo.mese
    )
  `
}

// ─────────────────────────────────────────────
// LIST — GET /api/tutors
// 4 query parallele per evitare N+1
// ─────────────────────────────────────────────
export async function listTutors(query: TutorQuery) {
  const now = new Date()
  const meseStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const meseEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  // Confini del mese come stringhe 'YYYY-MM-DD' per la colonna lessons.data (giorno civile)
  const meseStartStr = ymd(meseStart)
  const meseEndStr   = ymd(meseEnd)
  const pastStart = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
  const pastEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  // Il mese di oggi in Italia: è la partenza di riserva del fisso per i profili che
  // non hanno una data di partenza (mai all'indietro) ed è il mese che l'elenco
  // mostra nella colonna "Lez. mese".
  const meseOggi  = meseDiOggi()

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
      // Da quando vale il fisso: senza, l'elenco tornerebbe a inventare arretrati
      forfaitDal:        tutorProfiles.forfaitDal,
      createdAt:         users.createdAt,
    })
    .from(users)
    .leftJoin(tutorProfiles, eq(tutorProfiles.userId, users.id))
    // Anche i SUPER_TUTOR insegnano: senza inArray chi viene promosso sparisce dalla lista
    .where(and(inArray(users.role, ['TUTOR', 'SUPER_TUTOR']), activeWhere, searchWhere))
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

    // 4. Arretrati: mesi passati con compenso > pagato.
    //    La griglia mese-per-mese arriva da sqlMesiCompenso(), lo stesso pezzo di SQL
    //    che usa il riepilogo debiti della dashboard: i mesi a fisso valgono il fisso
    //    (e compaiono anche senza lezioni), quelli prima della partenza del fisso
    //    restano a ore. Prima qui il fisso non veniva proprio guardato, ed elenco e
    //    scheda dello stesso tutor mostravano due numeri diversi.
    db.execute(sql`
      WITH ${sqlMesiCompenso(ym(pastStart), ym(pastEnd), meseOggi)},
      monthly_payments AS (
        SELECT tutor_id,
               DATE_TRUNC('month', mese)::date AS mese,
               COALESCE(SUM(importo::numeric), 0) AS pagato,
               BOOL_OR(status = 'PRO_BONO') AS pro_bono
        FROM tutor_payments
        WHERE mese >= ${pastStart.toISOString()} AND mese <= ${pastEnd.toISOString()}
        GROUP BY tutor_id, DATE_TRUNC('month', mese)::date
      )
      SELECT mc.tutor_id AS tutor_id,
             COUNT(*)::text AS mesi_arretrati,
             COALESCE(SUM(mc.compenso_calcolato - COALESCE(mp.pagato, 0)), 0)::text AS totale_arretrati
      FROM mesi_compenso mc
      LEFT JOIN monthly_payments mp ON mc.tutor_id = mp.tutor_id AND mc.mese = mp.mese
      WHERE mc.compenso_calcolato > COALESCE(mp.pagato, 0)
        AND NOT COALESCE(mp.pro_bono, false)
      GROUP BY mc.tutor_id
    `),
  ])

  const lessonMap  = new Map((lessonSums).map(r => [r.tutorId, r]))
  const payMap     = new Map((paymentSumsMese).map(r => [r.tutorId, r]))
  const arrearsMap = new Map((arrearsRows as any[]).map(r => [r.tutor_id as string, r]))

  let tutoriAttivi    = 0
  let daLiquidare     = 0
  let totaleDovutoCent = 0
  let sumLiquidazioni = 0
  let countLiquidati  = 0

  // F3 — gli importi da liquidare si contano in CENTESIMI INTERI (vedi
  // server/utils/arrotondamenti.ts) e si arrotondano una volta sola alla fine.
  // ⚠️ L'arrotondamento PER DIFETTO all'euro del compenso resta esattamente com'è:
  // è una regola voluta, non un errore di calcolo. Quello che cambia è solo che i
  // totali non si trascinano più dietro code di centesimi che non esistono.
  const tutors = tutorsList.map(tutor => {
    const ls = lessonMap.get(tutor.id)
    const ps = payMap.get(tutor.id)
    const ar = arrearsMap.get(tutor.id)

    // Il mese in corso segue la STESSA regola degli arretrati qui sopra e della
    // scheda del tutor: se il fisso è già partito si deve il fisso (anche con zero
    // lezioni), altrimenti le ore. È la riga che faceva dire all'elenco e alla
    // scheda due numeri diversi per lo stesso tutor.
    const fissoMese = fissoDelMese(tutor, meseOggi, meseOggi)
    // Arrotondamento all'euro per difetto: VOLUTO, si lascia (il fisso è già un
    // importo a due decimali e non si arrotonda).
    const compensoCalcolato     = fissoMese ?? Math.floor(parseFloat(ls?.compenso ?? '0'))
    const compensoCalcolatoCent = inCentesimi(compensoCalcolato)
    const pagatoCent            = inCentesimi(ps?.pagato ?? '0')
    // Pro Bono: il mese è considerato saldato (residuo 0) anche se non transita in contabilità.
    const compensoResiduoCent   = ps?.proBono ? 0 : Math.max(0, compensoCalcolatoCent - pagatoCent)
    const mesiArretrati         = parseInt(ar?.mesi_arretrati ?? '0')
    // Gli arretrati li ha già sommati Postgres in modo esatto (FLOOR compreso).
    const totaleArretratiCent   = inCentesimi(ar?.totale_arretrati ?? '0')

    // Totale unico "Da liquidare": mese corrente + tutti i mesi arretrati insieme.
    const totaleDaLiquidareCent = compensoResiduoCent + totaleArretratiCent
    // "più di un centesimo": la stessa soglia di prima, letta in centesimi.
    const mesiDaLiquidare       = mesiArretrati + (compensoResiduoCent > 1 ? 1 : 0)

    if (tutor.active) tutoriAttivi++
    if (totaleDaLiquidareCent > 1) { daLiquidare++; totaleDovutoCent += totaleDaLiquidareCent }
    if (compensoCalcolato > 0) { sumLiquidazioni += compensoCalcolato; countLiquidati++ }

    return {
      ...tutor,
      numLezioniMese:  parseInt(ls?.numLezioni ?? '0'),
      compensoCalcolato,
      compensoResiduo:  inEuro(compensoResiduoCent),
      mesiArretrati,
      totaleArretrati:  inEuro(totaleArretratiCent),
      totaleDaLiquidare: inEuro(totaleDaLiquidareCent),
      mesiDaLiquidare,
    }
  })

  const filtered = query.daLiquidare === 'true'
    ? tutors.filter(t => t.totaleDaLiquidare > 0.01)   // "più di un centesimo", come prima
    : tutors

  return {
    data: filtered,
    kpi: {
      tutoriAttivi,
      daLiquidare,
      totaleDovuto:      inEuro(totaleDovutoCent),
      // Media dei compensi già arrotondati all'euro: è una divisione vera, quindi
      // l'arrotondamento a 2 decimali qui è il primo e unico.
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
      dataNascita:       tutorProfiles.dataNascita,
      materie:           tutorProfiles.materie,
      noteInterne:       tutorProfiles.noteInterne,
      modalitaPagamento: tutorProfiles.modalitaPagamento,
      importoForfait:    tutorProfiles.importoForfait,
      // Serve alla scheda per scrivere "fisso mensile da settembre 2026" e per
      // capire quali righe della tabella compensi sono ancora a ore.
      forfaitDal:        tutorProfiles.forfaitDal,
      // Interruttore della scheda: il badge "Sempre disponibile lun–ven" e il modale Modifica
      sempreDisponibile: tutorProfiles.sempreDisponibile,
    })
    .from(users)
    .leftJoin(tutorProfiles, eq(tutorProfiles.userId, users.id))
    .where(and(eq(users.id, id), inArray(users.role, ['TUTOR', 'SUPER_TUTOR'])))
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
      // La password iniziale la digita l'admin nel modulo di creazione, quindi la
      // conosce anche un'altra persona: resta l'obbligo di cambiarla al primo
      // accesso. Se invece il tutor usa il link qui sotto e se ne sceglie una sua,
      // l'obbligo decade da solo (lo azzera consumaToken).
      mustChangePassword: true,
    }).returning()

    if (!user) throw new Error('Creazione utente fallita')

    const [profile] = await tx.insert(tutorProfiles).values({
      userId:            user.id,
      // L'anagrafica sta sul profilo, non sull'account: qui la data di nascita
      // (facoltativa) che serve al campanellino dei compleanni.
      dataNascita:       data.dataNascita ?? null,
      modalitaPagamento: data.modalitaPagamento ?? 'ORE',
      importoForfait:    data.importoForfait ?? null,
      // Il fisso mensile deve SEMPRE sapere da quando vale: se il modulo non lo dice
      // si parte da questo mese, mai da prima (è la regola che impedisce gli
      // arretrati inventati). Per un tutor a ore la colonna resta vuota.
      forfaitDal:        data.modalitaPagamento === 'FORFAIT'
        ? (data.forfaitDal ?? primoGiornoDelMese(meseDiOggi()))
        : null,
    }).returning()

    const { password: _, ...safeUser } = user
    return { user: safeUser, profile }
  })

  // Dopo la transazione: invito a scegliere la password (non blocca mai la creazione).
  // Nell'email NON viaggia nessuna password, solo un link monouso.
  // `invito` porta con sé anche il motivo dell'eventuale mancato invio
  // (motivoEmail/dettaglioEmail): lo spread qui sotto lo fa arrivare fino all'interfaccia.
  const invito = await inviaInvitoPassword(created.user)

  return { ...created, ...invito }
}

// ─────────────────────────────────────────────
// UPDATE — PUT /api/tutors/:id
// ─────────────────────────────────────────────
export async function updateTutor(id: string, data: UpdateTutorInput) {
  const userChanges: Record<string, unknown>    = { updatedAt: new Date() }
  const profileChanges: Record<string, unknown> = { updatedAt: new Date() }

  const userFields    = ['firstName', 'lastName', 'email', 'phone', 'role', 'active']
  const profileFields = ['indirizzo', 'citta', 'cap', 'codiceFiscale', 'partitaIva',
                         'dataNascita', 'materie', 'noteInterne', 'modalitaPagamento',
                         'importoForfait', 'forfaitDal', 'sempreDisponibile']

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
    // L'email di prima serve solo se il modulo ne porta una: è l'unico modo di
    // sapere se sta cambiando davvero (il modulo la rimanda anche quando è la stessa).
    const prima = typeof userChanges.email === 'string'
      ? await tx.query.users.findFirst({ where: eq(users.id, id), columns: { email: true } })
      : undefined

    const [user] = await tx.update(users)
      .set(userChanges as any)
      // Tutto lo staff è modificabile (serve per cambiare ruolo in entrambe le direzioni)
      .where(and(eq(users.id, id), inArray(users.role, ['TUTOR', 'SUPER_TUTOR', 'ADMIN'])))
      .returning()

    if (!user) return null

    // Email cambiata: i link "scegli la tua password" ancora aperti erano partiti
    // verso il VECCHIO indirizzo. Se era sbagliato, o di un'altra persona, chi li
    // ha ricevuti potrebbe ancora entrare nell'account del tutor: si annullano.
    // Maiuscole e minuscole non contano, la casella di posta è la stessa.
    if (prima && prima.email.toLowerCase() !== user.email.toLowerCase()) {
      await annullaLinkAperti(id, tx)
    }

    // IL FISSO MENSILE HA SEMPRE UN MESE DI PARTENZA.
    // Passando a Forfait senza indicarlo (o da una schermata che non ha il campo) si
    // parte da QUESTO mese: mai all'indietro, altrimenti tornerebbero gli arretrati
    // inventati che questa modifica esiste per chiudere. Se il profilo una data ce
    // l'ha già, si rispetta quella.
    if (profileChanges.modalitaPagamento === 'FORFAIT' && profileChanges.forfaitDal == null) {
      const [profiloPrima] = await tx
        .select({ forfaitDal: tutorProfiles.forfaitDal })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, id))
        .limit(1)
      if (!profiloPrima?.forfaitDal) profileChanges.forfaitDal = primoGiornoDelMese(meseDiOggi())
    }
    // Tornando "a ore" la data di partenza si azzera: il tutor non è più a fisso e,
    // se un giorno ci tornasse, il mese di partenza va deciso di nuovo — la vecchia
    // data resusciterebbe mesi già pagati a ore.
    if (profileChanges.modalitaPagamento === 'ORE') profileChanges.forfaitDal = null

    await tx.update(tutorProfiles)
      .set(profileChanges as any)
      .where(eq(tutorProfiles.userId, id))

    const { password: _, ...safeUser } = user
    return { user: safeUser }
  })

  // Password reimpostata dall'admin: al tutor arriva un LINK per scegliersela,
  // mai la password. Scopo PRIMO_ACCESSO (7 giorni) e non RECUPERO (2 ore) perché
  // l'invito parte dalla segreteria, non da una richiesta del tutor: deve avere
  // tempo di leggerlo con calma.
  if (updated && data.password) {
    const invito = await inviaInvitoPassword({ id, email: updated.user.email, firstName: updated.user.firstName })
    return { ...updated, ...invito }
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
      SELECT TO_CHAR(DATE_TRUNC('month', data), 'YYYY-MM') AS mese,
             COUNT(*)::text AS num_lezioni,
             COALESCE(SUM(compenso_tutor::numeric), 0)::text AS compenso_grezzo
      FROM lessons
      WHERE tutor_id = ${tutorId} AND data >= ${ymd(pastStart)}
      GROUP BY DATE_TRUNC('month', data)
      ORDER BY 1 DESC
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
      forfaitDal:        tutorProfiles.forfaitDal,
    })
    .from(tutorProfiles)
    .where(eq(tutorProfiles.userId, tutorId))
    .limit(1)

  // Il profilo nella forma che chiede la regola condivisa (shared/compenso-tutor.ts).
  // Se il profilo manca del tutto (leftJoin vuoto) il tutor è a ore: nessun fisso.
  const profilo: ProfiloCompensoTutor = {
    modalitaPagamento: tutorRec?.modalitaPagamento ?? null,
    importoForfait:    tutorRec?.importoForfait ?? null,
    forfaitDal:        tutorRec?.forfaitDal ?? null,
  }

  // Mappa pagamenti per chiave YYYY-MM (Local Time per evitare shift di fuso orario).
  // F3: i pagamenti dello stesso mese si sommano in CENTESIMI INTERI, così tre
  // versamenti da 33,33 € fanno esattamente 99,99 € e non 99,98999999999999.
  const payByMonth = new Map<string, { totaleCent: number; proBono: boolean }>()
  for (const p of paymentRows) {
    const key = ym(new Date(p.mese))
    const cur = payByMonth.get(key) ?? { totaleCent: 0, proBono: false }
    payByMonth.set(key, {
      totaleCent: cur.totaleCent + inCentesimi(p.importo),
      proBono:    cur.proBono || p.status === 'PRO_BONO',
    })
  }

  const nowKey = meseDiOggi()

  // I mesi da mostrare: quelli con lezioni, più — per un tutor a fisso — TUTTI i mesi
  // dalla partenza del fisso a oggi, anche quelli in cui non ha fatto niente.
  // Seconda decisione di Alessandro (14/09/2026): un fisso mensile si deve lo stesso,
  // e un mese fermo per malattia prima non compariva proprio nell'elenco.
  const mesiConLezioni = new Map<string, { numLezioni: number; compensoGrezzo: number }>()
  for (const row of lessonRows as any[]) {
    mesiConLezioni.set(String(row.mese), {
      numLezioni:     parseInt(row.num_lezioni),
      compensoGrezzo: parseFloat(row.compenso_grezzo),
    })
  }
  for (const meseFisso of mesiDovutiAFisso(profilo, ym(pastStart), nowKey, nowKey)) {
    if (!mesiConLezioni.has(meseFisso)) {
      mesiConLezioni.set(meseFisso, { numLezioni: 0, compensoGrezzo: 0 })
    }
  }

  // Dal più recente al più vecchio, come faceva l'ORDER BY della query.
  const mesiOrdinati = [...mesiConLezioni.keys()].sort().reverse()

  return mesiOrdinati.map(meseKey => {
    const riga              = mesiConLezioni.get(meseKey)!
    const compensoGrezzo    = riga.compensoGrezzo

    // LA REGOLA, una volta sola (shared/compenso-tutor.ts): il fisso vale solo dal
    // suo mese di partenza in poi. I mesi precedenti restano contati a ore, come
    // sono stati pagati davvero, con l'arrotondamento all'euro per difetto che è
    // una regola VOLUTA e non si tocca.
    const fissoMese         = fissoDelMese(profilo, meseKey, nowKey)
    const compensoCalcolato = fissoMese ?? Math.floor(compensoGrezzo)

    // F3: compenso meno pagato in centesimi interi, arrotondato una volta sola.
    const compensoCalcolatoCent = inCentesimi(compensoCalcolato)
    const pay                   = payByMonth.get(meseKey)
    const pagatoCent            = pay?.totaleCent ?? 0
    // Pro Bono: il mese è considerato saldato (residuo 0) anche se non transita in contabilità.
    const residuoCent           = pay?.proBono ? 0 : Math.max(0, compensoCalcolatoCent - pagatoCent)
    const isMeseCorrente        = meseKey === nowKey

    // Stesse soglie di prima, lette in centesimi: "un centesimo" invece di "0,01".
    let stato: string
    if (pay?.proBono)                              stato = 'PRO_BONO'
    else if (residuoCent <= 1 && pagatoCent > 0)   stato = 'PAGATO'
    else if (pagatoCent > 1 && residuoCent > 1)    stato = 'PARZIALE'
    else                                           stato = 'DA_PAGARE'

    return {
      mese:             meseKey,
      meseLabel:        etichettaMese(meseKey),
      numLezioni:       riga.numLezioni,
      compensoGrezzo:   Number(compensoGrezzo.toFixed(2)),
      compensoCalcolato,
      // Dice all'interfaccia se QUEL mese è stato pagato a fisso o a ore: serve
      // all'etichetta "a ore" sulle righe precedenti alla partenza del fisso.
      forfaitApplicato: fissoMese !== null,
      pagato:           inEuro(pagatoCent),
      residuo:          inEuro(residuoCent),
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
        categoria:       CAT.COMPENSO_TUTOR,
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
      TO_CHAR(DATE_TRUNC('month', l.data), 'YYYY-MM') AS mese,
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
    WHERE l.tutor_id = ${tutorId} AND l.data >= ${ymd(startDate)}
    GROUP BY DATE_TRUNC('month', l.data)
    ORDER BY 1 DESC
  `)

  // Tutor a fisso mensile (FORFAIT): il compenso reale è il fisso, non la somma per
  // lezione — ma SOLO dai mesi in cui il fisso è davvero partito. Prima il fisso
  // veniva spalmato su tutti i mesi indistintamente, e i margini dei mesi pagati a
  // ore risultavano falsati esattamente come gli arretrati.
  const [profiloPerf] = await db
    .select({
      modalitaPagamento: tutorProfiles.modalitaPagamento,
      importoForfait:    tutorProfiles.importoForfait,
      forfaitDal:        tutorProfiles.forfaitDal,
    })
    .from(tutorProfiles)
    .where(eq(tutorProfiles.userId, tutorId))
    .limit(1)
  const profilo: ProfiloCompensoTutor = {
    modalitaPagamento: profiloPerf?.modalitaPagamento ?? null,
    importoForfait:    profiloPerf?.importoForfait ?? null,
    forfaitDal:        profiloPerf?.forfaitDal ?? null,
  }
  const meseOggi = meseDiOggi()

  // F3 — qui il conto è GIÀ fatto nel modo giusto e si lascia com'è: il margine
  // nasce dai valori grezzi e viene arrotondato una volta sola, alla fine.
  // Attenzione a non "sistemarlo" portandolo in centesimi interi: il ricavo non è un
  // importo a due decimali, è una divisione (prezzo ÷ ore) e va tenuto per intero
  // fino all'ultimo, altrimenti il margine cambierebbe davvero di qualche centesimo.
  return (rows as any[]).map(row => {
    const meseKey  = String(row.mese)
    const ricavo   = parseFloat(row.ricavo_totale)
    // La regola sta scritta una volta sola in shared/compenso-tutor.ts: mese per mese
    // si chiede se vale il fisso; se non vale, il compenso è la somma delle lezioni.
    const compenso = fissoDelMese(profilo, meseKey, meseOggi) ?? parseFloat(row.compenso_totale)
    const margine  = ricavo - compenso

    return {
      mese:        meseKey,
      meseLabel:   etichettaMese(meseKey),
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
      WHERE l.tutor_id = ${tutorId} AND l.data >= ${ymd(startDate)}
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
      WHERE l.tutor_id = ${tutorId} AND l.data >= ${ymd(startDate)}
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

    // F3: somme e differenze in centesimi interi, arrotondate una volta sola quando
    // si riscrive la colonna o si scrive un messaggio.
    const importoTotaleCent  = inCentesimi(current.importo as string)
    const giaPagatoCent      = inCentesimi(current.importo_pagato as string)
    const nuovoPagamentoCent = inCentesimi(data.importoPagamento)
    const nuovoPagatoCent    = giaPagatoCent + nuovoPagamentoCent

    // Check against overpayment ("un centesimo di tolleranza", come prima)
    if (nuovoPagatoCent > importoTotaleCent + 1) {
      throw new Error(`Il pagamento (€${inEuro(nuovoPagamentoCent).toFixed(2)}) eccede l'importo totale rimborsabile (€${inEuro(importoTotaleCent - giaPagatoCent).toFixed(2)} rimanenti)`)
    }

    const nuovoStato: 'PARZIALE' | 'PAGATO' = nuovoPagatoCent >= importoTotaleCent - 1 ? 'PAGATO' : 'PARZIALE'

    const [updated] = await tx.update(tutorReimbursements)
      .set({
        importoPagato: inEuro(nuovoPagatoCent).toFixed(2),
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
      importo:         inEuro(nuovoPagamentoCent).toFixed(2),
      descrizione:     `Rimborso spese: ${current.descrizione}`,
      categoria:       CAT.RIMBORSO_TUTOR,
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
    // F3: la sottrazione si fa in centesimi interi e si torna agli euro una volta
    // sola, al momento di riscrivere la colonna. Stesso risultato di prima, senza
    // la coda decimale che una sottrazione fra numeri con la virgola si porta dietro.
    const nuovoPagatoCent = Math.max(0, inCentesimi(r.importoPagato) - inCentesimi(importoEntry))
    const totaleCent      = inCentesimi(r.importo)
    const stato: 'DA_PAGARE' | 'PARZIALE' | 'PAGATO' =
      nuovoPagatoCent <= 1 ? 'DA_PAGARE' : (nuovoPagatoCent >= totaleCent - 1 ? 'PAGATO' : 'PARZIALE')
    await tx.update(tutorReimbursements)
      .set({ importoPagato: inEuro(nuovoPagatoCent).toFixed(2), stato, updatedAt: new Date() })
      .where(eq(tutorReimbursements.id, reimbursementId))
  })
}
