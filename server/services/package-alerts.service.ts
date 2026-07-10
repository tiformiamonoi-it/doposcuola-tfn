// Avvisi email al genitore per pacchetti in esaurimento (ore) o in scadenza (data).
// Soglie identiche allo stato DA_RINNOVARE: ore residue < 20%, scadenza entro 3 giorni.
// Dedup tramite packages.avvisoOreInviatoAt / avvisoScadenzaInviatoAt
// (azzerati da ricarica o modifica di ore/scadenza in package.service.ts).
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { packages, students, users } from '../database/schema'
import { sendEmail, emailAvvisoPacchetto } from '../utils/email'

// ponytail: cap 50 email/run — ben sotto il limite Brevo (300/giorno); il resto passa al giro dopo
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
    studentFirstName:        students.firstName,
    studentLastName:         students.lastName,
    parentEmail:             students.parentEmail,
    portalEmail:             users.email,
  })
    .from(packages)
    .innerJoin(students, eq(packages.studentId, students.id))
    .leftJoin(users, eq(students.portalUserId, users.id))
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

  let inviati = 0

  for (const row of rows) {
    // Destinatario: account portale, altrimenti l'email genitore in anagrafica
    const to = row.portalEmail ?? row.parentEmail
    if (!to) continue

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
      const { sent } = await sendEmail({
        to,
        ...emailAvvisoPacchetto({
          nomeStudente,
          nomePacchetto: row.nome,
          tipoAvviso: 'ore',
          oreResiduo: row.oreResiduo,
        }),
      })
      if (sent) { flags.avvisoOreInviatoAt = new Date(); inviati++ }
    }

    if (inScadenza) {
      const { sent } = await sendEmail({
        to,
        ...emailAvvisoPacchetto({
          nomeStudente,
          nomePacchetto: row.nome,
          tipoAvviso: 'scadenza',
          dataScadenza: row.dataScadenza!.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' }),
        }),
      })
      if (sent) { flags.avvisoScadenzaInviatoAt = new Date(); inviati++ }
    }

    // Marca SOLO gli avvisi realmente inviati: se Brevo non è configurato/fallisce, si ritenta al giro dopo
    if (Object.keys(flags).length > 0) {
      await db.update(packages).set(flags).where(eq(packages.id, row.id))
    }
  }

  return { processati: rows.length, inviati }
}
