// server/services/tutor.service.ts
import { db } from '../database/client'
import { conflitto, nonTrovato } from '../utils/http-error'
import {
  users, tutorProfiles, lessons,
  tutorPayments, tutorReimbursements, accountingEntries,
} from '../database/schema'
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { annullaLinkAperti, inviaInvitoPassword } from '../utils/password-token'
import { inCentesimi, inEuro, restaDaPagare } from '#shared/arrotondamenti'
import { nomeProprio } from '../utils/nomi'
import { CAT } from '#shared/accounting-categories'
import {
  dovutoDelMese, etichettaMese, fissoDelMese, meseDiOggi, mesePrecedente, mesiDovutiAFisso, mesiPrima,
  primoGiornoDelMese, type ProfiloCompensoTutor,
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
// fisso che non hanno una data (i profili vecchi): mai all'indietro. E fa da tetto:
// il fisso del mese in corso non è ancora dovuto (si paga dal 1° del mese dopo).
// ─────────────────────────────────────────────
export function sqlMesiCompenso(daMese: string, aMese: string, meseCorrente: string) {
  const primoGiornoDa  = primoGiornoDelMese(daMese)
  const primoGiornoA   = primoGiornoDelMese(aMese)
  const primoGiornoOra = primoGiornoDelMese(meseCorrente)

  return sql`
    profili_fisso AS (
      -- Chi ha (o ha avuto) un periodo a fisso. Stessa regola di meseInizioFisso():
      --  • tutor FORFAIT: dal mese di partenza (COALESCE sul mese corrente: profilo
      --    senza data, dati anteriori al 14/09/2026 = il fisso vale da adesso in poi);
      --  • tutor oggi "a ore": solo se il periodo è chiuso (inizio E fine), cioè è
      --    passato a ore dopo il 09/10/2026 e i suoi mesi a fisso restano a fisso.
      SELECT tp.user_id AS tutor_id,
             tp.importo_forfait::numeric AS importo_fisso,
             tp.modalita_pagamento = 'FORFAIT' AS a_fisso_oggi,
             DATE_TRUNC('month', COALESCE(tp.forfait_dal, ${primoGiornoOra}::date))::date AS inizio_fisso,
             -- L'ultimo mese a fisso (archiviato o passato a ore). NULL = nessuna fine.
             DATE_TRUNC('month', tp.forfait_al)::date AS fine_fisso
      FROM tutor_profiles tp
      WHERE tp.importo_forfait IS NOT NULL
        AND tp.importo_forfait::numeric > 0
        AND (tp.modalita_pagamento = 'FORFAIT'
             OR (tp.forfait_dal IS NOT NULL AND tp.forfait_al IS NOT NULL))
    ),
    mesi_fisso AS (
      -- Un mese per ogni mese del periodo a fisso, lezioni o non lezioni, tenuto
      -- dentro la finestra richiesta. Il periodo si ferma al primo che arriva fra:
      --  • la fine della finestra;
      --  • l'ultimo mese a fisso del tutor (fine_fisso);
      --  • IL MESE PRIMA DI QUELLO IN CORSO: il fisso del mese M si paga dal 1° del
      --    mese M+1 (regola del 09/10/2026), quindi il mese in corso non è ancora
      --    dovuto. Sottrazione fra date, non fra stringhe: gennaio → dicembre
      --    dell'anno prima viene giusto da sé.
      -- Se l'inizio cade dopo la fine, generate_series non produce nessuna riga.
      SELECT p.tutor_id,
             gs.mese::date AS mese,
             p.importo_fisso AS compenso
      FROM profili_fisso p
      CROSS JOIN LATERAL generate_series(
        GREATEST(p.inizio_fisso, ${primoGiornoDa}::date)::timestamp,
        LEAST(
          ${primoGiornoA}::date::timestamp,
          COALESCE(p.fine_fisso, ${primoGiornoA}::date)::timestamp,
          ${primoGiornoOra}::date - INTERVAL '1 month'
        ),
        INTERVAL '1 month'
      ) AS gs(mese)
    ),
    mesi_ore AS (
      -- Il conto a ore di sempre: somma dei compensi delle lezioni del mese,
      -- arrotondata PER DIFETTO all'euro (regola voluta, non si tocca).
      -- Restano FUORI le lezioni dei mesi in cui il tutor non si paga a ore
      -- (stessa regola di dovutoDelMese()): i mesi del periodo a fisso e, per chi
      -- è ancora segnato FORFAIT, tutti i mesi dalla partenza del fisso in poi —
      -- anche quello in corso (niente "a ore adesso e fisso il mese dopo") e quelli
      -- dopo l'archiviazione (il mese in cui lo archivi non si paga).
      SELECT l.tutor_id,
             DATE_TRUNC('month', l.data)::date AS mese,
             FLOOR(COALESCE(SUM(l.compenso_tutor::numeric), 0)) AS compenso
      FROM lessons l
      WHERE l.data >= ${primoGiornoDa}::date
        AND l.data <  (${primoGiornoA}::date + INTERVAL '1 month')
        AND NOT EXISTS (
          SELECT 1 FROM profili_fisso p
          WHERE p.tutor_id = l.tutor_id
            AND DATE_TRUNC('month', l.data)::date >= p.inizio_fisso
            AND (p.a_fisso_oggi OR DATE_TRUNC('month', l.data)::date <= p.fine_fisso)
        )
      GROUP BY l.tutor_id, DATE_TRUNC('month', l.data)::date
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
  // Finestre dal mese civile ITALIANO (come il riepilogo debiti), mai da new Date()
  // del server: alle 00:30 del 1° in Italia, su Vercel (UTC) è ancora il mese prima.
  const meseOggi     = meseDiOggi()
  const meseStartStr = primoGiornoDelMese(meseOggi)
  const meseDopoStr  = primoGiornoDelMese(mesiPrima(meseOggi, -1))
  // Arretrati: gli 11 mesi prima di quello in corso
  const pastDa       = mesiPrima(meseOggi, 11)
  // meseOggi è anche la partenza di riserva del fisso per i profili che non hanno
  // una data di partenza (mai all'indietro) ed è il mese della colonna "Lez. mese".

  // Caratteri jolly di ILIKE neutralizzati (come in student.service): "%" cerca "%"
  const cerca = query.search ? `%${query.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : undefined
  const searchWhere = cerca
    ? or(
        ilike(users.firstName, cerca),
        ilike(users.lastName,  cerca),
        ilike(users.email,     cerca),
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
      // ...e fin quando: un archiviato o un passato "a ore" non matura più il fisso
      forfaitAl:         tutorProfiles.forfaitAl,
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
    .where(and(gte(lessons.data, meseStartStr), lt(lessons.data, meseDopoStr)))
    .groupBy(lessons.tutorId),

    // 3. Somma pagamenti mese corrente per tutorId (+ flag Pro Bono: mese liquidato a titolo gratuito)
    db.select({
      tutorId: tutorPayments.tutorId,
      pagato:  sql<string>`COALESCE(SUM(${tutorPayments.importo}::numeric), 0)::text`,
      proBono: sql<boolean>`BOOL_OR(${tutorPayments.status} = 'PRO_BONO')`,
    })
    .from(tutorPayments)
    // Confronto con ::date come nel riepilogo debiti, così i due conti vedono gli stessi pagamenti
    .where(sql`${tutorPayments.mese} >= ${meseStartStr}::date AND ${tutorPayments.mese} < ${meseDopoStr}::date`)
    .groupBy(tutorPayments.tutorId),

    // 4. Arretrati: mesi passati con compenso > pagato.
    //    La griglia mese-per-mese arriva da sqlMesiCompenso(), lo stesso pezzo di SQL
    //    che usa il riepilogo debiti della dashboard: i mesi a fisso valgono il fisso
    //    (e compaiono anche senza lezioni), quelli prima della partenza del fisso
    //    restano a ore. Prima qui il fisso non veniva proprio guardato, ed elenco e
    //    scheda dello stesso tutor mostravano due numeri diversi.
    db.execute(sql`
      WITH ${sqlMesiCompenso(pastDa, mesePrecedente(meseOggi), meseOggi)},
      monthly_payments AS (
        SELECT tutor_id,
               DATE_TRUNC('month', mese)::date AS mese,
               COALESCE(SUM(importo::numeric), 0) AS pagato,
               BOOL_OR(status = 'PRO_BONO') AS pro_bono
        FROM tutor_payments
        WHERE mese >= ${primoGiornoDelMese(pastDa)}::date AND mese < ${meseStartStr}::date
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
  // shared/arrotondamenti.ts) e si arrotondano una volta sola alla fine.
  // ⚠️ L'arrotondamento PER DIFETTO all'euro del compenso resta esattamente com'è:
  // è una regola voluta, non un errore di calcolo. Quello che cambia è solo che i
  // totali non si trascinano più dietro code di centesimi che non esistono.
  const tutors = tutorsList.map(tutor => {
    const ls = lessonMap.get(tutor.id)
    const ps = payMap.get(tutor.id)
    const ar = arrearsMap.get(tutor.id)

    // Il mese in corso segue la STESSA regola degli arretrati qui sopra e della
    // scheda del tutor (dovutoDelMese, in shared/compenso-tutor.ts). Per un tutor a
    // fisso il mese in corso è "in maturazione": il fisso si paga dal 1° del mese
    // dopo, quindi qui non è ancora dovuto niente — e le lezioni del mese NON si
    // pagano a ore al suo posto. Per i tutor a ore non cambia niente.
    // Arrotondamento all'euro per difetto delle ore: VOLUTO, si lascia (il fisso è
    // già un importo a due decimali e non si arrotonda).
    const dovuto                = dovutoDelMese(tutor, meseOggi, Math.floor(parseFloat(ls?.compenso ?? '0')), meseOggi)
    // Quanto VALE il mese (il fisso anche se non ancora dovuto): serve alla media
    // mensile qui sotto, che resta quella di prima.
    const compensoCalcolato     = dovuto.fisso ?? dovuto.importo
    const pagatoCent            = inCentesimi(ps?.pagato ?? '0')
    // Pro Bono: il mese è considerato saldato (residuo 0) anche se non transita in contabilità.
    const compensoResiduoCent   = ps?.proBono ? 0 : Math.max(0, inCentesimi(dovuto.importo) - pagatoCent)
    const mesiArretrati         = parseInt(ar?.mesi_arretrati ?? '0')
    // Gli arretrati li ha già sommati Postgres in modo esatto (FLOOR compreso).
    const totaleArretratiCent   = inCentesimi(ar?.totale_arretrati ?? '0')

    // Totale unico "Da liquidare": mese corrente + tutti i mesi arretrati insieme.
    const totaleDaLiquidareCent = compensoResiduoCent + totaleArretratiCent
    // Ogni centesimo conta: anche 0,01 € ancora da dare è un mese da liquidare.
    const mesiDaLiquidare       = mesiArretrati + (compensoResiduoCent > 0 ? 1 : 0)

    if (tutor.active) tutoriAttivi++
    if (totaleDaLiquidareCent > 0) { daLiquidare++; totaleDovutoCent += totaleDaLiquidareCent }
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
    ? tutors.filter(t => restaDaPagare(t.totaleDaLiquidare))   // anche un solo centesimo
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
      // L'ultimo mese a fisso (archiviato o passato a ore): la scheda lo scrive
      forfaitAl:         tutorProfiles.forfaitAl,
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
// CHI PUÒ GESTIRE QUALE ACCOUNT DELLO STAFF
// Conta il ruolo ATTUALE dell'account, non quello che gli si vuole dare:
// l'ADMIN gestisce tutto lo staff; il SUPER_TUTOR (e chiunque altro) solo i TUTOR.
// Altrimenti un SUPER_TUTOR potrebbe cambiare email o password di un ADMIN,
// archiviarlo o mandarsi un link per entrare al suo posto.
// ─────────────────────────────────────────────
export function ruoliStaffGestibili(ruoloChiamante: string): Array<'TUTOR' | 'SUPER_TUTOR' | 'ADMIN'> {
  return ruoloChiamante === 'ADMIN' ? ['TUTOR', 'SUPER_TUTOR', 'ADMIN'] : ['TUTOR']
}

// ─────────────────────────────────────────────
// UPDATE — PUT /api/tutors/:id
// ─────────────────────────────────────────────
// proprioProfilo: chi chiama modifica SÉ STESSO. Il handler ha già tolto dai dati
// ruolo, attivo, password, email e campi economici: qui basta lasciar passare il suo account.
export async function updateTutor(id: string, data: UpdateTutorInput, ruoloChiamante: string, proprioProfilo = false) {
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

  // CHIUSURA DELLE SESSIONI APERTE (vedi users.sessionVersion): password reimpostata,
  // ruolo cambiato, archiviato o ripristinato → i dispositivi già collegati escono.
  // Il modulo rimanda ruolo e "attivo" a ogni salvataggio anche quando non cambiano:
  // per questo si confronta col valore attuale DENTRO la stessa UPDATE (a destra del
  // SET Postgres legge la riga com'era prima), così correggere un telefono non butta
  // fuori nessuno.
  const cambiaAccesso = [
    userChanges.role !== undefined ? sql`${users.role}::text IS DISTINCT FROM ${userChanges.role}` : null,
    userChanges.active !== undefined ? sql`${users.active} IS DISTINCT FROM ${userChanges.active}` : null,
  ].filter((c) => c !== null)
  if (data.password) {
    userChanges.sessionVersion = sql`${users.sessionVersion} + 1`
  } else if (cambiaAccesso.length > 0) {
    userChanges.sessionVersion = sql`CASE WHEN ${sql.join(cambiaAccesso, sql` OR `)} THEN ${users.sessionVersion} + 1 ELSE ${users.sessionVersion} END`
  }

  const updated = await db.transaction(async (tx) => {
    // L'email di prima serve solo se il modulo ne porta una: è l'unico modo di
    // sapere se sta cambiando davvero (il modulo la rimanda anche quando è la stessa).
    const prima = typeof userChanges.email === 'string'
      ? await tx.query.users.findFirst({ where: eq(users.id, id), columns: { email: true } })
      : undefined

    const [user] = await tx.update(users)
      .set(userChanges as any)
      // Solo gli account che chi chiama può gestire (vedi ruoliStaffGestibili): il vincolo
      // sta nella stessa UPDATE, così non c'è un attimo tra controllo e scrittura.
      // Per l'ADMIN resta tutto lo staff (serve per cambiare ruolo in entrambe le direzioni).
      .where(and(eq(users.id, id), inArray(users.role, proprioProfilo ? ['TUTOR', 'SUPER_TUTOR', 'ADMIN'] : ruoliStaffGestibili(ruoloChiamante))))
      .returning()

    if (!user) return null

    // Email cambiata: i link "scegli la tua password" ancora aperti erano partiti
    // verso il VECCHIO indirizzo. Se era sbagliato, o di un'altra persona, chi li
    // ha ricevuti potrebbe ancora entrare nell'account del tutor: si annullano.
    // Maiuscole e minuscole non contano, la casella di posta è la stessa.
    if (prima && prima.email.toLowerCase() !== user.email.toLowerCase()) {
      await annullaLinkAperti(id, tx)
    }

    const [profiloPrima] = await tx
      .select({
        modalitaPagamento: tutorProfiles.modalitaPagamento,
        forfaitDal:        tutorProfiles.forfaitDal,
        forfaitAl:         tutorProfiles.forfaitAl,
      })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.userId, id))
      .limit(1)
    const modalitaDopo = profileChanges.modalitaPagamento ?? profiloPrima?.modalitaPagamento

    if (modalitaDopo === 'FORFAIT') {
      const daOre = profiloPrima?.modalitaPagamento !== 'FORFAIT'
      // IL FISSO MENSILE HA SEMPRE UN MESE DI PARTENZA.
      // Passando a Forfait senza indicarlo (o da una schermata che non ha il campo) si
      // parte da QUESTO mese: mai all'indietro, altrimenti tornerebbero gli arretrati
      // inventati. Se il profilo una data ce l'ha già, si rispetta quella — tranne
      // per chi arriva da "a ore": la sua data è l'inizio del periodo VECCHIO, già
      // chiuso, e riusarla rimetterebbe a fisso anche i mesi pagati a ore nel mezzo.
      if (profileChanges.forfaitDal == null) {
        delete profileChanges.forfaitDal
        if (profileChanges.modalitaPagamento === 'FORFAIT' && (daOre || !profiloPrima?.forfaitDal)) {
          profileChanges.forfaitDal = primoGiornoDelMese(meseDiOggi())
        }
      }
      // UN PERIODO A FISSO NUOVO: passare a fisso da "a ore", o scegliere un mese di
      // partenza diverso, riapre il fisso da lì e toglie la fine. Il periodo è uno
      // solo: i mesi a fisso vecchi PRIMA della nuova partenza tornano a ore — per
      // questo la scheda avvisa se fra quelli c'è un fisso non ancora liquidato.
      // Ripristinare un archiviato invece NON riapre niente: la fine resta.
      const nuovoDal = profileChanges.forfaitDal
      if (daOre || (typeof nuovoDal === 'string' && nuovoDal !== profiloPrima?.forfaitDal)) {
        profileChanges.forfaitAl = null
      }
    } else {
      // A ORE la data di partenza e l'importo del fisso non si toccano più: se c'è
      // stato un periodo a fisso sono la sua storia, e cambiarli ricalcolerebbe mesi
      // già maturati. Prima qui la data si AZZERAVA, e così i mesi passati a fisso
      // tornavano a ore: un fisso non ancora pagato poteva sparire.
      delete profileChanges.forfaitDal
      delete profileChanges.importoForfait
      if (profileChanges.modalitaPagamento === 'ORE') Object.assign(profileChanges, chiusuraFisso(profiloPrima))
    }
    // Archiviato dal modulo (active: false) e non dal tasto "Archivia": stessa chiusura.
    if (userChanges.active === false) Object.assign(profileChanges, chiusuraFisso(profiloPrima))

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
export async function deactivateTutor(id: string, ruoloChiamante: string) {
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(users)
      // sessionVersion + 1: i dispositivi su cui il tutor è collegato escono subito
      .set({ active: false, sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() })
      // Come in updateTutor: si archivia solo un account che chi chiama può gestire
      .where(and(eq(users.id, id), inArray(users.role, ruoliStaffGestibili(ruoloChiamante))))
      .returning()
    if (!updated) return null

    // Un tutor a fisso archiviato smette di maturare il fisso: prima continuava a
    // risultare creditore di un fisso al mese, per sempre.
    const [profilo] = await tx
      .select({
        modalitaPagamento: tutorProfiles.modalitaPagamento,
        forfaitDal:        tutorProfiles.forfaitDal,
        forfaitAl:         tutorProfiles.forfaitAl,
      })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.userId, id))
      .limit(1)
    const chiusura = chiusuraFisso(profilo)
    if (chiusura.forfaitAl) {
      await tx.update(tutorProfiles)
        .set({ ...chiusura, updatedAt: new Date() })
        .where(eq(tutorProfiles.userId, id))
    }
    return updated
  })
}

// ─────────────────────────────────────────────
// LA FINE DEL FISSO — quando un tutor a fisso viene archiviato o passa "a ore".
//
// L'ultimo mese a fisso è il mese PRIMA di quello in corso. Decisione di Alessandro
// del 09/10/2026: archiviato (o passato a ore) il 15 ottobre → l'ultimo fisso dovuto
// è settembre, ottobre non si paga.
// Restituisce le colonne da scrivere sul profilo, oppure {} se non c'è niente da
// chiudere: tutor non a fisso, o fisso già chiuso (la fine che c'è resta quella).
// ─────────────────────────────────────────────
function chiusuraFisso(
  prima: { modalitaPagamento: string | null; forfaitDal: string | null; forfaitAl: string | null } | undefined,
): { forfaitDal?: string; forfaitAl?: string } {
  if (prima?.modalitaPagamento !== 'FORFAIT' || prima.forfaitAl) return {}
  const oggi = meseDiOggi()
  return {
    // Profilo vecchio senza mese di partenza: per la regola di riserva il fisso valeva
    // "da questo mese", e lo scriviamo nero su bianco. Altrimenti un domani il modulo
    // di modifica riproporrebbe "da questo mese" e riaprirebbe il fisso di un tutor
    // archiviato. Con partenza = questo mese e fine = il mese prima, non resta nessun
    // mese a fisso: esattamente come prima, quando i mesi passati restavano a ore.
    forfaitDal: prima.forfaitDal ?? primoGiornoDelMese(oggi),
    forfaitAl:  primoGiornoDelMese(mesePrecedente(oggi)),
  }
}

// ─────────────────────────────────────────────
// COMPENSI MENSILI — GET /api/tutors/:id/compensation
// Storico ultimi N mesi con stato pagamento
// ─────────────────────────────────────────────
export async function getMonthlyCompensation(tutorId: string, months = 12) {
  // Finestra dal mese civile ITALIANO (come elenco tutor e riepilogo debiti):
  // il mese in corso e i `months - 1` prima. Mai new Date() del server (UTC).
  const nowKey    = meseDiOggi()
  const meseDa    = mesiPrima(nowKey, months - 1)
  const primoDa   = primoGiornoDelMese(meseDa)

  const [lessonRows, paymentRows] = await Promise.all([
    db.execute(sql`
      SELECT TO_CHAR(DATE_TRUNC('month', data), 'YYYY-MM') AS mese,
             COUNT(*)::text AS num_lezioni,
             -- Quante lezioni del mese hanno il compenso forzato a mano (segno "forzato")
             COUNT(*) FILTER (WHERE compenso_forzato IS NOT NULL)::text AS num_forzate,
             COALESCE(SUM(compenso_tutor::numeric), 0)::text AS compenso_grezzo
      FROM lessons
      WHERE tutor_id = ${tutorId} AND data >= ${primoDa}
      GROUP BY DATE_TRUNC('month', data)
      ORDER BY 1 DESC
    `),
    db.select()
      .from(tutorPayments)
      .where(and(
        eq(tutorPayments.tutorId, tutorId),
        sql`${tutorPayments.mese} >= ${primoDa}::date`,
      ))
      .orderBy(desc(tutorPayments.mese)),
  ])

  const [tutorRec] = await db
    .select({
      modalitaPagamento: tutorProfiles.modalitaPagamento,
      importoForfait:    tutorProfiles.importoForfait,
      forfaitDal:        tutorProfiles.forfaitDal,
      forfaitAl:         tutorProfiles.forfaitAl,
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
    forfaitAl:         tutorRec?.forfaitAl ?? null,
  }

  // Mappa pagamenti per chiave YYYY-MM (Local Time per evitare shift di fuso orario).
  // F3: i pagamenti dello stesso mese si sommano in CENTESIMI INTERI, così tre
  // versamenti da 33,33 € fanno esattamente 99,99 € e non 99,98999999999999.
  const payByMonth = new Map<string, { totaleCent: number; proBono: boolean }>()
  for (const p of paymentRows) {
    // Mese del pagamento letto in UTC, come DATE_TRUNC nelle query SQL dell'elenco
    // e del riepilogo (database in UTC): non dal fuso del computer che fa girare il server
    const key = new Date(p.mese).toISOString().slice(0, 7)
    const cur = payByMonth.get(key) ?? { totaleCent: 0, proBono: false }
    payByMonth.set(key, {
      totaleCent: cur.totaleCent + inCentesimi(p.importo),
      proBono:    cur.proBono || p.status === 'PRO_BONO',
    })
  }

  // I mesi da mostrare: quelli con lezioni, più — per un tutor a fisso — TUTTI i mesi
  // dalla partenza del fisso a oggi, anche quelli in cui non ha fatto niente.
  // Seconda decisione di Alessandro (14/09/2026): un fisso mensile si deve lo stesso,
  // e un mese fermo per malattia prima non compariva proprio nell'elenco.
  const mesiConLezioni = new Map<string, { numLezioni: number; numForzate: number; compensoGrezzo: number }>()
  for (const row of lessonRows as any[]) {
    mesiConLezioni.set(String(row.mese), {
      numLezioni:     parseInt(row.num_lezioni),
      numForzate:     parseInt(row.num_forzate),
      compensoGrezzo: parseFloat(row.compenso_grezzo),
    })
  }
  for (const meseFisso of mesiDovutiAFisso(profilo, meseDa, nowKey, nowKey)) {
    if (!mesiConLezioni.has(meseFisso)) {
      mesiConLezioni.set(meseFisso, { numLezioni: 0, numForzate: 0, compensoGrezzo: 0 })
    }
  }

  // Dal più recente al più vecchio, come faceva l'ORDER BY della query.
  const mesiOrdinati = [...mesiConLezioni.keys()].sort().reverse()

  return mesiOrdinati.map(meseKey => {
    const riga              = mesiConLezioni.get(meseKey)!
    const compensoGrezzo    = riga.compensoGrezzo

    // LA REGOLA, una volta sola (shared/compenso-tutor.ts): il fisso vale dal suo
    // mese di partenza al suo ultimo mese, e si paga dal 1° del mese DOPO. I mesi
    // fuori dal fisso restano contati a ore, come sono stati pagati davvero, con
    // l'arrotondamento all'euro per difetto che è una regola VOLUTA e non si tocca.
    const dovuto            = dovutoDelMese(profilo, meseKey, Math.floor(compensoGrezzo), nowKey)
    // In tabella il mese mostra quanto VALE: il fisso anche se è ancora in maturazione.
    const compensoCalcolato = dovuto.fisso ?? dovuto.importo

    // F3: dovuto meno pagato in centesimi interi, arrotondato una volta sola.
    const pay                   = payByMonth.get(meseKey)
    const pagatoCent            = pay?.totaleCent ?? 0
    // Pro Bono: il mese è considerato saldato (residuo 0) anche se non transita in contabilità.
    // Il fisso in maturazione non è ancora dovuto: residuo 0, niente rosso.
    const residuoCent           = pay?.proBono ? 0 : Math.max(0, inCentesimi(dovuto.importo) - pagatoCent)
    const isMeseCorrente        = meseKey === nowKey

    // Soglie esatte al centesimo, senza tolleranza: 0,01 € mancante non è PAGATO.
    let stato: string
    if (pay?.proBono)                              stato = 'PRO_BONO'
    // Fisso del mese in corso: "in maturazione" finché non è pagato per intero
    // (chi lo anticipa lo vede PAGATO).
    else if (dovuto.inMaturazione)                 stato = pagatoCent > 0 && pagatoCent >= inCentesimi(compensoCalcolato) ? 'PAGATO' : 'IN_MATURAZIONE'
    else if (residuoCent === 0 && pagatoCent > 0)  stato = 'PAGATO'
    else if (pagatoCent > 0 && residuoCent > 0)    stato = 'PARZIALE'
    else                                           stato = 'DA_PAGARE'

    return {
      mese:             meseKey,
      meseLabel:        etichettaMese(meseKey),
      numLezioni:       riga.numLezioni,
      numForzate:       riga.numForzate,
      compensoGrezzo:   Number(compensoGrezzo.toFixed(2)),
      compensoCalcolato,
      // Dice all'interfaccia se QUEL mese è stato pagato a fisso o a ore: serve
      // all'etichetta "a ore" sulle righe precedenti alla partenza del fisso.
      forfaitApplicato: dovuto.fisso !== null,
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
      throw conflitto('Hai già registrato un pagamento identico pochi secondi fa. Controlla lo storico pagamenti prima di riprovare.')
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
               -- Ore pagate dalla famiglia, come in dashboard e calendario: la mezza
               -- lezione scala comunque 1 ora (lo 0,5 vale solo per il compenso del tutor)
               ls.ore_scalate::numeric
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
      forfaitAl:         tutorProfiles.forfaitAl,
    })
    .from(tutorProfiles)
    .where(eq(tutorProfiles.userId, tutorId))
    .limit(1)
  // Il costo del mese segue il periodo a fisso [forfaitDal, forfaitAl]: dopo la
  // fine (archiviato o passato a ore) il fisso non è più un costo. Il mese in corso
  // invece CONTA il fisso anche se si pagherà il mese dopo: è un costo di quel mese.
  const profilo: ProfiloCompensoTutor = {
    modalitaPagamento: profiloPerf?.modalitaPagamento ?? null,
    importoForfait:    profiloPerf?.importoForfait ?? null,
    forfaitDal:        profiloPerf?.forfaitDal ?? null,
    forfaitAl:         profiloPerf?.forfaitAl ?? null,
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
    
    if (!current) throw nonTrovato('Rimborso non trovato')

    // F3: somme e differenze in centesimi interi, arrotondate una volta sola quando
    // si riscrive la colonna o si scrive un messaggio.
    const importoTotaleCent  = inCentesimi(current.importo as string)
    const giaPagatoCent      = inCentesimi(current.importo_pagato as string)
    const nuovoPagamentoCent = inCentesimi(data.importoPagamento)
    const nuovoPagatoCent    = giaPagatoCent + nuovoPagamentoCent

    // Niente pagamenti oltre il dovuto, nemmeno di un centesimo
    if (nuovoPagatoCent > importoTotaleCent) {
      throw new Error(`Il pagamento (€${inEuro(nuovoPagamentoCent).toFixed(2)}) eccede l'importo totale rimborsabile (€${inEuro(importoTotaleCent - giaPagatoCent).toFixed(2)} rimanenti)`)
    }

    const nuovoStato: 'PARZIALE' | 'PAGATO' = nuovoPagatoCent >= importoTotaleCent ? 'PAGATO' : 'PARZIALE'

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
  if (!row) throw nonTrovato('Compenso non trovato')
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
  if (!row) throw nonTrovato('Rimborso non trovato')
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
      nuovoPagatoCent === 0 ? 'DA_PAGARE' : (nuovoPagatoCent >= totaleCent ? 'PAGATO' : 'PARZIALE')
    await tx.update(tutorReimbursements)
      .set({ importoPagato: inEuro(nuovoPagatoCent).toFixed(2), stato, updatedAt: new Date() })
      .where(eq(tutorReimbursements.id, reimbursementId))
  })
}
