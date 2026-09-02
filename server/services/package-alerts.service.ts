// Avvisi email ai genitori per pacchetti in esaurimento (ore) o in scadenza (data).
// L'avviso va a TUTTI i genitori collegati con account attivo (student_parents);
// se l'alunno non ne ha nessuno si usa l'email di contatto in anagrafica.
// Soglie identiche allo stato DA_RINNOVARE: ore residue < 20%, scadenza entro 3 giorni.
// Dedup tramite packages.avvisoOreInviatoAt / avvisoScadenzaInviatoAt
// (azzerati da ricarica o modifica di ore/scadenza in package.service.ts).
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { packages, students, studentParents, users } from '../database/schema'
import { sendEmail, emailAvvisoPacchetto } from '../utils/email'

// ponytail: cap 50 pacchetti/run — ben sotto il limite Brevo (300/giorno); il resto passa al giro dopo
const MAX_PER_RUN = 50

export async function runPackageAlerts() {
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
  })
    .from(packages)
    .innerJoin(students, eq(packages.studentId, students.id))
    .where(and(
      eq(packages.sospeso, false),
      sql`NOT ('CHIUSO' = ANY(${packages.stati}))`,
      or(
        // Ore quasi esaurite (ma non a zero: a zero il pacchetto è ESAURITO, non serve avviso)
        and(
          isNull(packages.avvisoOreInviatoAt),
          sql`${packages.oreAcquistate}::numeric > 0`,
          sql`${packages.oreResiduo}::numeric > 0`,
          sql`${packages.oreResiduo}::numeric / ${packages.oreAcquistate}::numeric < 0.20`,
        ),
        // In scadenza entro 3 giorni
        and(
          isNull(packages.avvisoScadenzaInviatoAt),
          sql`${packages.dataScadenza} IS NOT NULL`,
          sql`${packages.dataScadenza} >= now()`,
          sql`${packages.dataScadenza} <= now() + interval '3 days'`,
        ),
      ),
    ))
    .limit(MAX_PER_RUN)

  // Una sola query per tutti gli alunni coinvolti: email dei genitori con account attivo
  const studentIds = [...new Set(rows.map((r) => r.studentId))]
  const parentRows = studentIds.length
    ? await db.select({ studentId: studentParents.studentId, email: users.email })
        .from(studentParents)
        .innerJoin(users, eq(studentParents.parentUserId, users.id))
        .where(and(inArray(studentParents.studentId, studentIds), eq(users.active, true)))
    : []

  const emailPerStudente = new Map<string, string[]>()
  for (const p of parentRows) {
    const lista = emailPerStudente.get(p.studentId) ?? []
    if (!lista.includes(p.email)) lista.push(p.email)
    emailPerStudente.set(p.studentId, lista)
  }

  let inviati = 0
  let emailInviate = 0

  // Invia lo stesso avviso a ogni destinatario (sendEmail accetta un solo `to`).
  // L'avviso conta come inviato se almeno un destinatario lo ha ricevuto.
  async function inviaATutti(destinatari: string[], contenuto: { subject: string; html: string }) {
    let almenoUno = false
    for (const to of destinatari) {
      const { sent } = await sendEmail({ to, ...contenuto })
      if (sent) { almenoUno = true; emailInviate++ }
    }
    return almenoUno
  }

  for (const row of rows) {
    // Destinatari: tutti i genitori con account attivo; in mancanza, l'email in anagrafica
    const genitori = emailPerStudente.get(row.studentId) ?? []
    const destinatari = genitori.length > 0 ? genitori : (row.parentEmail ? [row.parentEmail] : [])
    if (destinatari.length === 0) continue

    const nomeStudente = `${row.studentFirstName} ${row.studentLastName}`
    // Ricontrollo completo in JS: la riga può essere entrata nel result per l'altra condizione
    const acquistate = parseFloat(row.oreAcquistate)
    const residue = parseFloat(row.oreResiduo)
    const oreQuasiEsaurite = row.avvisoOreInviatoAt === null
      && acquistate > 0 && residue > 0 && residue / acquistate < 0.20
    const inScadenza = row.avvisoScadenzaInviatoAt === null
      && row.dataScadenza !== null
      && row.dataScadenza.getTime() >= Date.now()
      && row.dataScadenza.getTime() <= Date.now() + 3 * 24 * 60 * 60 * 1000

    const flags: Record<string, Date> = {}

    if (oreQuasiEsaurite) {
      const sent = await inviaATutti(destinatari, emailAvvisoPacchetto({
        nomeStudente,
        nomePacchetto: row.nome,
        tipoAvviso: 'ore',
      }))
      if (sent) { flags.avvisoOreInviatoAt = new Date(); inviati++ }
    }

    if (inScadenza) {
      const sent = await inviaATutti(destinatari, emailAvvisoPacchetto({
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

  return { processati: rows.length, inviati, emailInviate }
}
