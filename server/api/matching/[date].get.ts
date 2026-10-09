import { eq, and, gte, lte, ne, inArray, arrayOverlaps } from 'drizzle-orm'
import { db } from '../../database/client'
import * as tables from '../../database/schema'
import { giornoFeriale, tutorDUfficio } from '../../services/disponibilita-tutor.service'
import { getConfigMaterieSpeciali } from '../../services/booking.service'
import { livelloDaClasse } from '#shared/livello-scolastico'
import { primaQuelloCheScade, type TipoPacchetto } from '#shared/scadenza-pacchetto'
import type { BadgePrenotazione } from '#shared/matching'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') throw createError({ statusCode: 403, message: 'Forbidden' })

  const dateParam = getRouterParam(event, 'date')
  if (!dateParam) throw createError({ statusCode: 400, message: 'Data mancante' })

  const targetDate = dateParam.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw createError({ statusCode: 400, message: 'Data non valida (formato richiesto: YYYY-MM-DD)' })
  }

  // 1. Troviamo i Tutor Disponibili per questo giorno
  const availabilities = await db.query.tutorAvailabilities.findMany({
    where: eq(tables.tutorAvailabilities.date, targetDate),
    with: {
      user: {
        columns: { id: true, firstName: true, lastName: true, phone: true, active: true },
        with: {
          tutorProfile: true
        }
      }
    }
  })

  // Un tutor archiviato può avere ancora disponibilità segnate nei giorni futuri:
  // nel tabellone non deve comparire (le sue righe restano nel database, innocue).
  const tutors = availabilities.filter(a => a.user.active).map(a => ({
    id: a.user.id,
    name: `${a.user.firstName} ${a.user.lastName}`,
    phone: a.user.phone,
    notes: a.notes || '',
    subjects: a.user.tutorProfile?.materie || [],
    // Ha una riga di disponibilità → l'admin può toglierla dal giorno
    rimovibile: true,
  }))

  // Tutor d'ufficio dal lunedì al venerdì, anche senza aver spuntato niente (salvo
  // chiusure del centro): i FORFAIT e i "sempre disponibili" senza assenza quel giorno.
  // La regola sta in disponibilita-tutor.service.ts, la stessa del calendario del tutor.
  if (giornoFeriale(targetDate)) {
    const chiusura = await db.query.closureDates.findFirst({
      where: eq(tables.closureDates.date, targetDate),
    })
    if (!chiusura) {
      for (const t of await tutorDUfficio(targetDate)) {
        if (!tutors.some(x => x.id === t.id)) {
          tutors.push({
            id: t.id,
            name: `${t.firstName} ${t.lastName}`,
            phone: t.phone,
            notes: '',
            subjects: t.materie || [],
            // Il sempre disponibile si toglie dal giorno (diventa un'assenza);
            // il FORFAIT no: col fisso mensile lun-ven c'è sempre.
            rimovibile: !t.forfait,
          })
        }
      }
    }
  }

  // 2. Troviamo le Prenotazioni (Bookings) per questo giorno
  // Le date delle prenotazioni sono timestamp: usiamo il range del giorno in UTC
  // per evitare slittamenti di fuso orario (la data inserita è già YYYY-MM-DD).
  const dayStart = new Date(`${targetDate}T00:00:00.000Z`)
  const dayEnd   = new Date(`${targetDate}T23:59:59.999Z`)
  const dayBookings = await db.query.bookings.findMany({
    where: and(
      gte(tables.bookings.requestedDate, dayStart),
      lte(tables.bookings.requestedDate, dayEnd),
      ne(tables.bookings.status, 'CANCELLED')
    ),
    with: {
      subjects: {
        with: {
          assignedTutor: {
            columns: { id: true, firstName: true, lastName: true }
          }
        }
      }
    }
  })

  // Il supplemento sta sulla PRENOTAZIONE, ma riguarda solo la materia speciale fuori
  // data (stessa regola di decidiSupplemento): lo mostriamo solo su quel badge.
  const { speciali, giornate } = await getConfigMaterieSpeciali()
  const materieDelGiorno = giornate[targetDate] ?? []
  const fuoriData = (materia: string) => speciali.includes(materia) && !materieDelGiorno.includes(materia)

  // Gruppi della colonna "Da assegnare" (D2): classe e pacchetto in corso di ogni alunno,
  // con DUE sole query per tutto il giorno (inArray), non una per targhetta.
  const idAlunni = [...new Set(dayBookings.map(b => b.studentId).filter((id): id is string => !!id))]
  const [schede, pacchetti] = idAlunni.length === 0 ? [[], []] : await Promise.all([
    db.select({ id: tables.students.id, classe: tables.students.classe })
      .from(tables.students)
      .where(inArray(tables.students.id, idAlunni)),
    db.select({
      studentId:    tables.packages.studentId,
      tipo:         tables.packages.tipo,
      stati:        tables.packages.stati,
      dataScadenza: tables.packages.dataScadenza,
      createdAt:    tables.packages.createdAt,
    })
      .from(tables.packages)
      .where(and(
        inArray(tables.packages.studentId, idAlunni),
        arrayOverlaps(tables.packages.stati, ['ATTIVO', 'DA_RINNOVARE']),
      )),
  ])
  const livelloDi = new Map(schede.map(s => [s.id, livelloDaClasse(s.classe)]))
  // Il pacchetto "in corso": fra gli ATTIVI quello che scade prima (D3); se non ce n'è
  // uno attivo, fra quelli DA_RINNOVARE con la stessa regola.
  const tipoPacchettoDi = new Map<string, TipoPacchetto>()
  for (const stato of ['ATTIVO', 'DA_RINNOVARE'] as const) {
    const candidati = pacchetti.filter(p => p.stati.includes(stato)).sort(primaQuelloCheScade)
    for (const p of candidati) {
      if (!tipoPacchettoDi.has(p.studentId)) tipoPacchettoDi.set(p.studentId, p.tipo)
    }
  }

  // Formattiamo le prenotazioni in "Badges" come nel .old
  const badges: BadgePrenotazione[] = []
  dayBookings.forEach(b => {
    // Se nessuna materia corrisponde (impostazioni cambiate dopo la prenotazione) va sul
    // primo badge: un supplemento da approvare non deve sparire.
    const conSupplemento = b.subjects.some(s => fuoriData(s.name))
      ? (s: { name: string }) => fuoriData(s.name)
      : (s: { name: string }) => s === b.subjects[0]
    b.subjects.forEach(subjectRel => {
      const haSupplemento = !!b.supplemento && conSupplemento(subjectRel)
      badges.push({
        subjectId: subjectRel.id,
        bookingId: b.id,
        // Serve alla pagina per riconoscere lo stesso alunno (N4, regola in shared/matching.ts)
        studentId: b.studentId,
        studentName: b.studentName,
        studentSurname: b.studentSurname,
        studentPhone: b.studentPhone,
        subject: subjectRel.name,
        notes: b.notes,
        assignedTutorId: subjectRel.assignedTutorId,
        assignedSlot: subjectRel.assignedSlot,
        isAssigned: !!subjectRel.assignedTutorId && !!subjectRel.assignedSlot,
        // Lezione speciale fuori data: supplemento €10 da approvare (o già applicato)
        supplemento: haSupplemento ? parseFloat(b.supplemento!) : 0,
        supplementoApplicato: haSupplemento && !!b.supplementoApplicatoAt,
        livello: b.studentId ? livelloDi.get(b.studentId) ?? null : null,
        tipoPacchetto: b.studentId ? tipoPacchettoDi.get(b.studentId) ?? null : null,
      })
    })
  })

  // 3. Slot orari reali dal database (ordinati per ora inizio)
  const timeSlotsList = await db.query.timeSlots.findMany({
    orderBy: (ts, { asc }) => [asc(ts.oraInizio)]
  })

  // Solo le fasce attive. Una fascia disattivata resta però se quel giorno c'è ancora un
  // alunno assegnato lì: senza colonna finirebbe fra i "da assegnare" per sbaglio.
  const fasceUsate = new Set(badges.map(b => b.assignedSlot).filter(Boolean))
  const slots = timeSlotsList
    .filter(ts => ts.active || fasceUsate.has(`${ts.oraInizio}-${ts.oraFine}`))
    .map(ts => ({
      id: `${ts.oraInizio}-${ts.oraFine}`,
      label: `${ts.oraInizio} - ${ts.oraFine}`
    }))

  return {
    date: dateParam,
    tutors,
    badges,
    slots
  }
})
