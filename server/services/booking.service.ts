import { eq, desc, or, inArray } from 'drizzle-orm'
import { db } from '../database/client'
import { bookings, bookingSubjects, students, closureDates, systemConfigs, packages } from '../database/schema'
import { computePackageStates } from './package.service'
import { SUPPLEMENTO_SPECIALE } from '#shared/tariffe'
import type { CreateBookingInput, UpdateBookingStatusInput } from '#shared/schemas/booking.schema'

// ─────────────────────────────────────────────
// MATERIE SPECIALI
// Config in Impostazioni:
//   'materie_speciali'  = ["Inglese", …]                          (quali materie sono speciali)
//   'giornate_speciali' = { "2026-07-14": ["Inglese", "Spagnolo"], … }  (calendario UNICO: PIÙ materie per giorno)
// Regole:
//   - nelle giornate prefissate si possono prenotare più materie speciali, senza supplemento;
//   - fuori dalla giornata prefissata scatta il supplemento (€10) e se ne può richiedere UNA sola,
//     che diventa un aumento del pacchetto SOLO dopo l'OK di ADMIN/SUPER_TUTOR.
// ─────────────────────────────────────────────

// Valore unico in #shared/tariffe (lo usano anche le pagine per i testi);
// qui in forma stringa per la colonna numeric del DB.
const SUPPLEMENTO_STR = SUPPLEMENTO_SPECIALE.toFixed(2)

// Normalizza il valore di un giorno in array (tollera il vecchio formato "una materia per giorno").
function toArrayMaterie(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string')
  if (typeof v === 'string' && v) return [v]
  return []
}

export async function getConfigMaterieSpeciali() {
  const rows = await db
    .select({ key: systemConfigs.key, value: systemConfigs.value })
    .from(systemConfigs)
    .where(inArray(systemConfigs.key, ['materie_speciali', 'giornate_speciali']))

  let speciali: string[] = []
  const giornate: Record<string, string[]> = {}
  try {
    const v = JSON.parse(rows.find((r) => r.key === 'materie_speciali')?.value || '[]')
    if (Array.isArray(v)) speciali = v
  } catch { /* config assente o malformata: nessuna materia speciale */ }
  try {
    const v = JSON.parse(rows.find((r) => r.key === 'giornate_speciali')?.value || '{}')
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [data, materie] of Object.entries(v)) giornate[data] = toArrayMaterie(materie)
    }
  } catch { /* idem */ }

  return { speciali, giornate }
}

// Decisione pura (testabile): dato l'elenco delle speciali, il calendario, le materie
// scelte e la data, ritorna il supplemento o null. Errore se >1 speciale è fuori data.
export function decidiSupplemento(
  speciali: string[],
  giornate: Record<string, string[]>,
  materie: string[],
  dateStr: string,
): string | null {
  const scelte = materie.filter((m) => speciali.includes(m))
  if (scelte.length === 0) return null

  const materieDelGiorno = giornate[dateStr] ?? []
  const fuoriData = scelte.filter((m) => !materieDelGiorno.includes(m))
  if (fuoriData.length > 1) {
    throw new Error('Puoi prenotare una sola materia speciale fuori dalle sue giornate prefissate')
  }
  return fuoriData.length === 1 ? SUPPLEMENTO_STR : null
}

// Ritorna il supplemento ('10.00') se c'è una materia speciale prenotata FUORI dalla sua
// giornata prefissata, null altrimenti. Le materie speciali prenotate nella loro giornata
// non hanno limite né supplemento; fuori data se ne può richiedere UNA sola.
export async function valutaMaterieSpeciali(materie: string[], dateStr: string): Promise<string | null> {
  const { speciali, giornate } = await getConfigMaterieSpeciali()
  return decidiSupplemento(speciali, giornate, materie, dateStr)
}

// Applica il supplemento della prenotazione al pacchetto dello studente:
// +€ sul prezzo totale (quindi importo da pagare), stati ricalcolati, nota sul pacchetto.
// Da chiamare SOLO dopo l'OK di ADMIN/SUPER_TUTOR (guardia nell'endpoint).
export async function applicaSupplementoAlPacchetto(bookingId: string) {
  return await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
    if (!booking) throw new Error('Prenotazione non trovata')

    const importo = parseFloat(booking.supplemento ?? '0')
    if (!importo) throw new Error('Questa prenotazione non ha un supplemento da applicare')
    if (booking.supplementoApplicatoAt) throw new Error('Supplemento già applicato al pacchetto')
    if (!booking.studentId) throw new Error('Prenotazione senza studente collegato in anagrafica')

    // Pacchetto ATTIVO più recente (in mancanza, il più recente non chiuso)
    const pkgs = await tx.select().from(packages)
      .where(eq(packages.studentId, booking.studentId))
      .orderBy(desc(packages.createdAt))
    const pkg = pkgs.find((p) => p.stati.includes('ATTIVO') && !p.stati.includes('CHIUSO'))
      ?? pkgs.find((p) => !p.stati.includes('CHIUSO'))
    if (!pkg) throw new Error('Nessun pacchetto attivo su cui applicare il supplemento')

    const nuovoPrezzo  = parseFloat(pkg.prezzoTotale) + importo
    const nuovoResiduo = nuovoPrezzo - parseFloat(pkg.importoPagato)
    const nuoviStati = computePackageStates({
      oreAcquistate:  pkg.oreAcquistate,
      oreResiduo:     pkg.oreResiduo,
      importoResiduo: String(nuovoResiduo),
      dataScadenza:   pkg.dataScadenza,
      sospeso:        pkg.sospeso,
    })

    const dataLez = new Date(booking.requestedDate).toLocaleDateString('it-IT')
    const nota = `+€${importo.toFixed(2)} supplemento lezione speciale del ${dataLez}`

    await tx.update(packages).set({
      prezzoTotale:   String(nuovoPrezzo),
      importoResiduo: String(nuovoResiduo),
      stati:          nuoviStati,
      note:           pkg.note ? `${pkg.note}\n${nota}` : nota,
      updatedAt:      new Date(),
    }).where(eq(packages.id, pkg.id))

    const [updated] = await tx.update(bookings).set({
      supplementoApplicatoAt: new Date(),
      supplementoPackageId:   pkg.id,
      updatedAt:              new Date(),
    }).where(eq(bookings.id, bookingId)).returning()

    return { booking: updated, packageId: pkg.id, packageNome: pkg.nome }
  })
}

// Crea una prenotazione dal portale famiglie
export async function createBooking(input: CreateBookingInput, userId: string) {
  const student = await db.query.students.findFirst({
    where: eq(students.id, input.studentId),
    columns: { firstName: true, lastName: true, studentPhone: true }
  })

  if (!student) {
    throw new Error('Studente non trovato')
  }

  const dateObj = new Date(input.dataDesiderata)
  
  // 1. Controllo Domenica (0 = Domenica)
  if (dateObj.getDay() === 0) {
    throw new Error('Impossibile prenotare di Domenica')
  }

  // 2. Controllo Chiusure (colonna date 'YYYY-MM-DD': confronto diretto, niente fusi)
  const targetDateStr = dateObj.toISOString().split('T')[0]
  const isClosed = await db.query.closureDates.findFirst({
    where: eq(closureDates.date, targetDateStr!)
  })
  
  if (isClosed) {
    throw new Error('Il centro è chiuso in questa data')
  }

  // Materie speciali: max 1 per giornata; fuori data → supplemento €10 (da approvare)
  const supplemento = await valutaMaterieSpeciali(input.materie, targetDateStr!)

  return await db.transaction(async (tx) => {
    const [booking] = await tx.insert(bookings).values({
      userId,
      studentId:      input.studentId,
      studentName:    student.firstName,
      studentSurname: student.lastName,
      studentPhone:   student.studentPhone ?? '',
      requestedDate:  dateObj,
      notes:          input.noteOrario ?? null,
      status:         'CONFIRMED',
      supplemento,
    }).returning()

    if (!booking) throw new Error('Inserimento prenotazione fallito')

    if (input.materie.length > 0) {
      await tx.insert(bookingSubjects).values(
        input.materie.map((m) => ({
          name:      m,
          bookingId: booking.id,
        }))
      )
    }

    return booking
  })
}

// Lista prenotazioni del portale per STUDENTI collegati (genitore o studente stesso):
// così le prenotazioni fatte dallo studente restano visibili alla famiglia e viceversa.
// L'OR su userId copre le prenotazioni storiche senza studentId valorizzato.
export async function listBookingsForPortalByStudents(studentIds: string[], userId: string) {
  return await db.query.bookings.findMany({
    where: or(
      studentIds.length > 0 ? inArray(bookings.studentId, studentIds) : undefined,
      eq(bookings.userId, userId),
    ),
    orderBy: [desc(bookings.createdAt)],
    with: {
      subjects: {
        with: {
          assignedTutor: {
            columns: { firstName: true, lastName: true }
          }
        }
      },
    }
  })
}

// Lista prenotazioni per l'admin, filtrabili per studente (usa bookings.studentId)
export async function listBookingsForAdmin(studentId?: string) {
  return await db.query.bookings.findMany({
    where: studentId ? eq(bookings.studentId, studentId) : undefined,
    orderBy: [desc(bookings.createdAt)],
    with: {
      subjects: { columns: { name: true } },
      user:     { columns: { firstName: true, lastName: true, email: true } },
      student:  { columns: { firstName: true, lastName: true } },
    },
  })
}

// Conferma o cancella una prenotazione (solo ADMIN)
export async function updateBookingStatus(id: string, input: UpdateBookingStatusInput) {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, id),
  })

  if (!booking) {
    throw new Error('Prenotazione non trovata')
  }

  const [updated] = await db.update(bookings)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(bookings.id, id))
    .returning()

  return updated
}
