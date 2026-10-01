// ─────────────────────────────────────────────
// TARIFFE SPECIALI DEI TUTOR — il quaderno delle regole e il calcolo del compenso.
//
// Qui sta L'UNICA formula del compenso di una lezione: la usano la creazione, la
// modifica, lo strumento "Ricalcola lezioni" e l'anteprima delle finestre del
// calendario. Due copie della formula vorrebbero dire, prima o poi, un'anteprima che
// promette una cifra e una lezione salvata con un'altra.
//
// Come si sceglie la tariffa (piano docs/PIANO-AZIONE-tariffe-speciali.md):
//  1. compenso forzato sulla lezione → vince su tutto;
//  2. altrimenti, per OGNI alunno, la regola più precisa che gli corrisponde
//     (alunno pesa 4, tutor 2, fasce 1; a parità vince il "valida dal" più recente),
//     o il listino del tipo di lezione se non ce n'è; si paga la PIÙ ALTA;
//  3. mezza lezione: dal listino resta la tabella fissa TARIFFE_MEZZA (come sempre);
//     da regola o forzatura è metà tariffa arrotondata per difetto ai 50 centesimi.
// ─────────────────────────────────────────────
import { db } from '../database/client'
import { tutorTariffeSpeciali, users, students } from '../database/schema'
import { and, desc, eq, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm'
import { TARIFFE_MEZZA, type TipoLezione } from '#shared/tariffe'
import type { TariffaSpecialeInput, TariffeSpecialiQuery } from '#shared/schemas/tariffe-speciali.schema'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type RegolaTariffa = {
  id:            string
  tutorId:       string | null
  studentId:     string | null
  timeSlotIds:   string[]
  tariffaOraria: string
  validaDal:     string
  nota:          string | null
  createdAt:     Date
  // Per l'elenco e per la descrizione dell'anteprima ("Simona · Giulia · 09:00–10:00")
  tutorNome:     string | null
  studenteNome:  string | null
  fasce:         string | null
}

// Le regole con i nomi già pronti, in UNA query: le fasce diventano "09:00–10:00, …"
// con una sottoquery sulla piccola tabella time_slots.
// `where` facoltativo: senza, carica tutto (lo strumento di ricalcolo, l'elenco completo).
export async function caricaRegole(ex: typeof db | Tx = db, where?: SQL): Promise<RegolaTariffa[]> {
  return ex
    .select({
      id:            tutorTariffeSpeciali.id,
      tutorId:       tutorTariffeSpeciali.tutorId,
      studentId:     tutorTariffeSpeciali.studentId,
      timeSlotIds:   tutorTariffeSpeciali.timeSlotIds,
      tariffaOraria: tutorTariffeSpeciali.tariffaOraria,
      validaDal:     tutorTariffeSpeciali.validaDal,
      nota:          tutorTariffeSpeciali.nota,
      createdAt:     tutorTariffeSpeciali.createdAt,
      tutorNome:     sql<string | null>`case when ${users.id} is null then null else ${users.firstName} || ' ' || ${users.lastName} end`,
      studenteNome:  sql<string | null>`case when ${students.id} is null then null else ${students.firstName} || ' ' || ${students.lastName} end`,
      fasce:         sql<string | null>`(select string_agg(left(ts.ora_inizio, 5) || '–' || left(ts.ora_fine, 5), ', ' order by ts.ora_inizio)
                                         from time_slots ts where ts.id = any(${tutorTariffeSpeciali.timeSlotIds}))`,
    })
    .from(tutorTariffeSpeciali)
    .leftJoin(users, eq(tutorTariffeSpeciali.tutorId, users.id))
    .leftJoin(students, eq(tutorTariffeSpeciali.studentId, students.id))
    .where(where)
    .orderBy(desc(tutorTariffeSpeciali.validaDal), desc(tutorTariffeSpeciali.createdAt))
}

// Solo le regole che POSSONO valere per le lezioni di questo tutor, con questi alunni,
// in questo giorno: è il filtro della creazione/modifica/anteprima (gli indici su
// tutor_id e student_id lo tengono veloce anche con tante regole).
export function whereRegolePerLezione(tutorId: string, studentIds: string[], data: string): SQL | undefined {
  return and(
    or(isNull(tutorTariffeSpeciali.tutorId), eq(tutorTariffeSpeciali.tutorId, tutorId)),
    studentIds.length > 0
      ? or(isNull(tutorTariffeSpeciali.studentId), inArray(tutorTariffeSpeciali.studentId, studentIds))
      : isNull(tutorTariffeSpeciali.studentId),
    lte(tutorTariffeSpeciali.validaDal, data),
  )
}

// La regola più precisa per UN alunno (null = nessuna, vale il listino).
function regolaPerAlunno(regole: RegolaTariffa[], tutorId: string, studentId: string, timeSlotId: string, data: string) {
  let migliore: RegolaTariffa | null = null
  let pesoMigliore = -1
  for (const r of regole) {
    if (r.tutorId && r.tutorId !== tutorId) continue
    if (r.studentId && r.studentId !== studentId) continue
    if (r.timeSlotIds.length > 0 && !r.timeSlotIds.includes(timeSlotId)) continue
    // Date 'AAAA-MM-GG': il confronto fra stringhe è il confronto fra giorni
    if (r.validaDal > data) continue
    const peso = (r.studentId ? 4 : 0) + (r.tutorId ? 2 : 0) + (r.timeSlotIds.length > 0 ? 1 : 0)
    if (peso > pesoMigliore || (peso === pesoMigliore && r.validaDal > migliore!.validaDal)) {
      migliore = r
      pesoMigliore = peso
    }
  }
  return migliore
}

function oreDiLezione(oraInizio: string, oraFine: string): number {
  const [h1, m1] = oraInizio.split(':').map(Number) as [number, number]
  const [h2, m2] = oraFine.split(':').map(Number) as [number, number]
  return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60
}

// 10 → "10", 8.5 → "8,50": come si scrive un prezzo a voce
function euro(n: number): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })
}

export type FonteCompenso = 'LISTINO' | 'REGOLA' | 'FORZATO'

export type EsitoCompenso = {
  compenso:      number        // euro della lezione (già moltiplicati per la durata o mezza)
  tariffaOraria: number        // €/ora usata
  fonte:         FonteCompenso
  regolaId:      string | null
  descrizione:   string        // "10 €/h — tariffa speciale Simona Rossi · Giulia Bianchi · 09:00–10:00"
}

export type LezionePerCompenso = {
  tutorId:         string
  timeSlotId:      string
  data:            string
  studentIds:      string[]
  tipo:            TipoLezione
  mezzaLezione:    boolean
  oraInizio:       string
  oraFine:         string
  compensoForzato: number | null
}

// LA FORMULA. Pura: niente database, le regole arrivano già caricate (una volta per
// operazione, mai una query per alunno o per lezione).
export function calcolaCompensoLezione(
  l: LezionePerCompenso,
  listino: Record<TipoLezione, number>,
  regole: RegolaTariffa[],
): EsitoCompenso {
  let tariffa: number
  let fonte: FonteCompenso
  let regola: RegolaTariffa | null = null

  if (l.compensoForzato != null) {
    tariffa = l.compensoForzato
    fonte   = 'FORZATO'
  } else {
    // Gruppo con alunni a tariffe diverse: si paga la più alta (decisione D2).
    // A parità fra regola e listino si tiene la regola, così l'anteprima dice da dove viene.
    // Si parte da -1 e non dal listino: una regola può anche essere PIÙ BASSA del listino.
    tariffa = -1
    for (const sid of l.studentIds) {
      const r = regolaPerAlunno(regole, l.tutorId, sid, l.timeSlotId, l.data)
      const t = r ? Number(r.tariffaOraria) : listino[l.tipo]
      if (t > tariffa || (r && !regola && t === tariffa)) {
        tariffa = t
        regola  = r
      }
    }
    if (tariffa < 0) tariffa = listino[l.tipo] // lezione senza alunni: listino
    fonte = regola ? 'REGOLA' : 'LISTINO'
  }

  // Mezza lezione: dal listino la tabella fissa di sempre (mezza MAXI = 4,00, non 4,25);
  // da regola o forzatura metà tariffa per difetto ai 50 centesimi: 9 → 4,50, 8,50 → 4,00.
  // floor(t/2 ÷ 0,5) × 0,5 è la stessa cosa di floor(t) ÷ 2.
  const compenso = l.mezzaLezione
    ? (fonte === 'LISTINO' ? TARIFFE_MEZZA[l.tipo] : Math.floor(tariffa) / 2)
    : tariffa * oreDiLezione(l.oraInizio, l.oraFine)

  let descrizione: string
  if (fonte === 'FORZATO') {
    descrizione = `${euro(tariffa)} €/h — compenso forzato`
  } else if (regola) {
    const chi = [regola.tutorNome, regola.studenteNome, regola.fasce].filter(Boolean).join(' · ')
    descrizione = `${euro(tariffa)} €/h — tariffa speciale ${chi}`
  } else {
    descrizione = `${euro(tariffa)} €/h — listino ${l.tipo.toLowerCase()}`
  }
  if (l.mezzaLezione) descrizione += ' (mezza lezione)'

  return {
    compenso:      Math.round(compenso * 100) / 100,
    tariffaOraria: tariffa,
    fonte,
    regolaId:      regola?.id ?? null,
    descrizione,
  }
}

// ─────────────────────────────────────────────
// CRUD — /api/tariffe-speciali
// Creare, cambiare o cancellare una regola NON tocca le lezioni già salvate.
// ─────────────────────────────────────────────

export async function listTariffeSpeciali(q: TariffeSpecialiQuery) {
  return caricaRegole(db, and(
    q.tutorId   ? eq(tutorTariffeSpeciali.tutorId, q.tutorId) : undefined,
    q.studentId ? eq(tutorTariffeSpeciali.studentId, q.studentId) : undefined,
  ))
}

function valori(data: TariffaSpecialeInput) {
  return {
    tutorId:       data.tutorId ?? null,
    studentId:     data.studentId ?? null,
    // Senza doppioni: la stessa fascia spuntata due volte non cambia niente
    timeSlotIds:   [...new Set(data.timeSlotIds)],
    tariffaOraria: data.tariffaOraria.toFixed(2),
    validaDal:     data.validaDal,
    nota:          data.nota || null,
  }
}

export async function createTariffaSpeciale(data: TariffaSpecialeInput, createdBy: string) {
  const [riga] = await db.insert(tutorTariffeSpeciali)
    .values({ ...valori(data), createdBy })
    .returning()
  return riga
}

export async function updateTariffaSpeciale(id: string, data: TariffaSpecialeInput) {
  const [riga] = await db.update(tutorTariffeSpeciali)
    .set({ ...valori(data), updatedAt: new Date() })
    .where(eq(tutorTariffeSpeciali.id, id))
    .returning()
  return riga ?? null
}

export async function deleteTariffaSpeciale(id: string) {
  const [riga] = await db.delete(tutorTariffeSpeciali)
    .where(eq(tutorTariffeSpeciali.id, id))
    .returning({ id: tutorTariffeSpeciali.id })
  return riga ?? null
}
