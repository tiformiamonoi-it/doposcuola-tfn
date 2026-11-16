// PAGAMENTI NEL PORTALE, per ora solo con bonifico (piano del 16/11/2026, sezione C).
//
// Il portale non incassa niente: mostra quanto resta da saldare e i dati per il
// bonifico. Il pagamento risulta quando la segreteria lo registra, come oggi.
//
// PRIVACY ECONOMICA: tutto questo è solo per il GENITORE. Lo STUDENTE non riceve
// mai importi né pacchetti da saldare (lo controlla l'endpoint, vedi
// server/api/portal/pagamenti.get.ts): i soldi sono un'informazione della famiglia.
import { inArray } from 'drizzle-orm'
import { db } from '../database/client'
import { packages, students, systemConfigs } from '../database/schema'
import { romeDateStr } from '../utils/tutor-time-window'
import { arrotonda, restaDaPagare } from '#shared/arrotondamenti'
import { interruttoreAcceso } from '#shared/email'
import { CHIAVE_BONIFICO_IBAN, CHIAVE_BONIFICO_INTESTATARIO, INTERRUTTORE_PAGAMENTI_PORTALE } from '#shared/pagamenti-portale'

async function leggiConfig() {
  const righe = await db.select({ key: systemConfigs.key, value: systemConfigs.value })
    .from(systemConfigs)
    .where(inArray(systemConfigs.key, [INTERRUTTORE_PAGAMENTI_PORTALE.chiave, CHIAVE_BONIFICO_INTESTATARIO, CHIAVE_BONIFICO_IBAN]))
  const valore = (k: string) => righe.find((r) => r.key === k)?.value ?? ''
  return {
    attivi:       interruttoreAcceso(valore(INTERRUTTORE_PAGAMENTI_PORTALE.chiave), INTERRUTTORE_PAGAMENTI_PORTALE.seAssente),
    intestatario: valore(CHIAVE_BONIFICO_INTESTATARIO).trim(),
    iban:         valore(CHIAVE_BONIFICO_IBAN).replace(/\s/g, '').toUpperCase(),
  }
}

/** L'interruttore "Pagamenti nel portale" (Impostazioni → Pagamenti). Serve anche alle notifiche. */
export async function pagamentiPortaleAttivi(): Promise<boolean> {
  return (await leggiConfig()).attivi
}

// LA CAUSALE, composta da sola perché la segreteria riconosca il bonifico a colpo d'occhio:
//   MENSILE         → "Mensile novembre 2026 – Nome Cognome" (il mese è quello di inizio)
//   ORE / A_CONSUMO → "<nome del pacchetto> dal 01/10/2026 – Nome Cognome": un pacchetto a
//                     ore non ha un mese, e la data d'inizio lo distingue da un altro con lo stesso nome.
function causale(p: { tipo: string; nome: string; dataInizio: Date }, alunno: string): string {
  if (p.tipo === 'MENSILE') {
    const mese = p.dataInizio.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', month: 'long', year: 'numeric' })
    return `Mensile ${mese} – ${alunno}`
  }
  const dal = romeDateStr(p.dataInizio).split('-').reverse().join('/')
  return `${p.nome} dal ${dal} – ${alunno}`
}

/**
 * Cosa vede il GENITORE nella sezione pagamenti. A interruttore spento si risponde
 * solo { attivi: false }: nessun importo, nessun IBAN, nemmeno nella risposta grezza.
 */
export async function getPagamentiPortale(studentIds: string[]) {
  const config = await leggiConfig()
  if (!config.attivi) return { attivi: false as const }

  const [anagrafiche, righe] = studentIds.length === 0 ? [[], []] : await Promise.all([
    db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
      .from(students).where(inArray(students.id, studentIds)),
    db.select({
      id:             packages.id,
      studentId:      packages.studentId,
      nome:           packages.nome,
      tipo:           packages.tipo,
      dataInizio:     packages.dataInizio,
      importoResiduo: packages.importoResiduo,
    }).from(packages).where(inArray(packages.studentId, studentIds)),
  ])

  const figli = anagrafiche.map((s) => {
    const alunno = `${s.firstName} ${s.lastName}`
    return {
      studentId: s.id,
      nome:      s.firstName,
      // "Qualcosa da saldare" = almeno un centesimo di residuo, la regola di arrotondamenti.ts.
      // Anche i pacchetti scaduti: un debito vecchio è proprio quello che frena la card.
      pacchetti: righe
        .filter((p) => p.studentId === s.id && restaDaPagare(p.importoResiduo))
        .sort((a, b) => a.dataInizio.getTime() - b.dataInizio.getTime())
        .map((p) => ({ id: p.id, nome: p.nome, importo: arrotonda(p.importoResiduo), causale: causale(p, alunno) })),
    }
  })

  return { attivi: true as const, intestatario: config.intestatario, iban: config.iban, figli }
}
