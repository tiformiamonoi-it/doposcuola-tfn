// Avvisi email ai genitori per pacchetti in esaurimento (ore) o in scadenza (data).
// L'avviso va a TUTTI i genitori collegati con account attivo (student_parents);
// se l'alunno non ne ha nessuno si usa l'email di contatto in anagrafica.
// Soglie identiche allo stato DA_RINNOVARE: ore residue < 20%, scadenza entro 3 giorni.
// Dedup tramite packages.avvisoOreInviatoAt / avvisoScadenzaInviatoAt
// (azzerati da ricarica o modifica di ore/scadenza in package.service.ts).
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { packages, students, studentParents, users } from '../database/schema'
import { randomUUID } from 'node:crypto'
import { sendEmail, emailAvvisoPacchetto, notificaInvioDiMassa, tipoEmailAttivo } from '../utils/email'
import { motiviRinnovo } from './package.service'

// ponytail: cap 50 pacchetti/run — ben sotto il limite Brevo (300/giorno); il resto passa al giro dopo
const MAX_PER_RUN = 50

export async function runPackageAlerts() {
  // GLI INTERRUTTORI (Impostazioni → Email), chiesti una volta all'inizio: un tipo
  // spento non entra nemmeno nella ricerca, così non occupa i 50 posti del giro
  // e non riempie il registro di righe "spenta". Nascono spenti tutti e due.
  const [oreAttivi, scadenzaAttivi] = await Promise.all([
    tipoEmailAttivo('AVVISO_ORE'),
    tipoEmailAttivo('AVVISO_SCADENZA'),
  ])
  if (!oreAttivi && !scadenzaAttivi) {
    // Stessa forma del riepilogo serale spento: nel registro del cron "non doveva
    // partire" non deve somigliare a "è andato storto qualcosa".
    return {
      processati: 0, inviati: 0, emailInviate: 0,
      saltato: true,
      motivo: 'Gli avvisi sui pacchetti (o l\'invio di tutte le email) sono spenti nelle Impostazioni: nessuna email inviata',
    }
  }

  const rows = await db.select({
    id:                      packages.id,
    nome:                    packages.nome,
    oreAcquistate:           packages.oreAcquistate,
    oreResiduo:              packages.oreResiduo,
    dataScadenza:            packages.dataScadenza,
    avvisoOreInviatoAt:      packages.avvisoOreInviatoAt,
    avvisoScadenzaInviatoAt: packages.avvisoScadenzaInviatoAt,
    studentId:               students.id,
    studentFirstName:        students.firstName,
    studentLastName:         students.lastName,
    parentEmail:             students.parentEmail,
    parentName:              students.parentName,
  })
    .from(packages)
    .innerJoin(students, eq(packages.studentId, students.id))
    // Pre-selezione LARGA: la decisione vera la prende motiviRinnovo() qui sotto, a
    // giorni italiani. Il margine di un giorno per parte copre lo sfasamento tra
    // istante UTC e giorno civile; i pacchetti esauriti o scaduti da più di un giorno
    // restano fuori, così non occupano i 50 posti del giro senza mai ricevere nulla.
    .where(and(
      eq(packages.sospeso, false),
      sql`NOT ('CHIUSO' = ANY(${packages.stati}))`,
      sql`${packages.oreAcquistate}::numeric > 0`,
      sql`${packages.oreResiduo}::numeric > 0`,
      sql`(${packages.dataScadenza} IS NULL OR ${packages.dataScadenza} >= now() - interval '1 day')`,
      or(
        // Ore quasi esaurite
        oreAttivi ? and(
          isNull(packages.avvisoOreInviatoAt),
          sql`${packages.oreResiduo}::numeric / ${packages.oreAcquistate}::numeric < 0.20`,
        ) : undefined,
        // In scadenza entro 3 giorni (4 di pre-selezione)
        scadenzaAttivi ? and(
          isNull(packages.avvisoScadenzaInviatoAt),
          sql`${packages.dataScadenza} IS NOT NULL`,
          sql`${packages.dataScadenza} <= now() + interval '4 days'`,
        ) : undefined,
      ),
    ))
    .limit(MAX_PER_RUN)

  // Una sola query per tutti gli alunni coinvolti: email dei genitori con account attivo
  const studentIds = [...new Set(rows.map((r) => r.studentId))]
  const parentRows = studentIds.length
    ? await db.select({ studentId: studentParents.studentId, email: users.email, nome: sql<string>`${users.firstName} || ' ' || ${users.lastName}` })
        .from(studentParents)
        .innerJoin(users, eq(studentParents.parentUserId, users.id))
        .where(and(inArray(studentParents.studentId, studentIds), eq(users.active, true)))
    : []

  type Destinatario = { email: string; nome: string | null }
  const emailPerStudente = new Map<string, Destinatario[]>()
  for (const p of parentRows) {
    const lista = emailPerStudente.get(p.studentId) ?? []
    if (!lista.some((d) => d.email === p.email)) lista.push({ email: p.email, nome: p.nome })
    emailPerStudente.set(p.studentId, lista)
  }

  let inviati = 0
  let emailInviate = 0
  // Un giro = un invio nel registro email, con una sola notifica alla fine
  const invioId = randomUUID()

  // Invia lo stesso avviso a ogni destinatario (sendEmail accetta un solo `to`).
  // L'avviso conta come inviato se almeno un destinatario lo ha ricevuto.
  async function inviaATutti(
    destinatari: Destinatario[],
    tipo: 'AVVISO_ORE' | 'AVVISO_SCADENZA',
    contenuto: { subject: string; html: string },
  ) {
    let almenoUno = false
    for (const d of destinatari) {
      const { sent } = await sendEmail({ to: d.email, tipo, nomeDestinatario: d.nome, invioId, ...contenuto })
      if (sent) { almenoUno = true; emailInviate++ }
    }
    return almenoUno
  }

  for (const row of rows) {
    // Destinatari: tutti i genitori con account attivo; in mancanza, l'email in anagrafica
    const genitori = emailPerStudente.get(row.studentId) ?? []
    const destinatari: Destinatario[] = genitori.length > 0
      ? genitori
      : (row.parentEmail ? [{ email: row.parentEmail, nome: row.parentName }] : [])
    if (destinatari.length === 0) continue

    const nomeStudente = `${row.studentFirstName} ${row.studentLastName}`
    // Ricontrollo completo in JS con la STESSA regola dello stato DA_RINNOVARE
    // (giorni italiani, solo pacchetti attivi): un pacchetto scaduto non riceve nulla
    const rinnovo = motiviRinnovo(row)
    const oreQuasiEsaurite = oreAttivi && row.avvisoOreInviatoAt === null && rinnovo.oreQuasiFinite
    const inScadenza = scadenzaAttivi && row.avvisoScadenzaInviatoAt === null && rinnovo.inScadenza

    const flags: Record<string, Date> = {}

    if (oreQuasiEsaurite) {
      const sent = await inviaATutti(destinatari, 'AVVISO_ORE', emailAvvisoPacchetto({
        nomeStudente,
        nomePacchetto: row.nome,
        tipoAvviso: 'ore',
      }))
      if (sent) { flags.avvisoOreInviatoAt = new Date(); inviati++ }
    }

    if (inScadenza) {
      const sent = await inviaATutti(destinatari, 'AVVISO_SCADENZA', emailAvvisoPacchetto({
        nomeStudente,
        nomePacchetto: row.nome,
        tipoAvviso: 'scadenza',
        dataScadenza: row.dataScadenza!.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' }),
      }))
      if (sent) { flags.avvisoScadenzaInviatoAt = new Date(); inviati++ }
    }

    // Marca SOLO gli avvisi realmente inviati: se Brevo non è configurato/fallisce, si ritenta al giro dopo
    if (Object.keys(flags).length > 0) {
      await db.update(packages).set(flags).where(eq(packages.id, row.id))
    }
  }

  await notificaInvioDiMassa(invioId, 'Avvisi pacchetto')
  return { processati: rows.length, inviati, emailInviate }
}
