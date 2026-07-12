// Diritti GDPR dell'interessato:
// - anonymizeStudent  → art. 17 (cancellazione): svuota i dati identificativi ma
//   conserva pacchetti/pagamenti/contabilità (obbligo fiscale 10 anni, art. 2220 c.c.)
// - exportStudentData → art. 15/20 (accesso/portabilità): dump JSON dei dati dello studente
import { db } from '../database/client'
import { students, studentNotes, bookings, users, packages, payments, packageRecharges, lessons, lessonStudents } from '../database/schema'
import { and, eq, ne, inArray } from 'drizzle-orm'

export async function anonymizeStudent(id: string) {
  const [student] = await db.select().from(students).where(eq(students.id, id)).limit(1)
  if (!student) throw new Error('Studente non trovato')

  return db.transaction(async (tx) => {
    // Note didattiche: eliminate (nessun obbligo di conservazione)
    const noteEliminate = await tx.delete(studentNotes)
      .where(eq(studentNotes.studentId, id))
      .returning({ id: studentNotes.id })

    // Prenotazioni: via i dati denormalizzati (nome, cognome, telefono, note libere)
    const prenotazioni = await tx.update(bookings)
      .set({ studentName: 'Studente', studentSurname: 'Anonimizzato', studentPhone: '', notes: null, updatedAt: new Date() })
      .where(eq(bookings.studentId, id))
      .returning({ id: bookings.id })

    // Account personale dello studente: disattivato e anonimizzato (email fittizia unica)
    if (student.studentUserId) {
      await tx.update(users).set({
        active:    false,
        email:     `anonimizzato-${student.studentUserId}@anonimo.invalid`,
        firstName: 'Studente',
        lastName:  'Anonimizzato',
        phone:     null,
        updatedAt: new Date(),
      }).where(eq(users.id, student.studentUserId))
    }

    // Account portale del genitore: anonimizzato solo se non è collegato ad altri figli
    let accountGenitoreAnonimizzato = false
    if (student.portalUserId) {
      const [altroFiglio] = await tx.select({ id: students.id }).from(students)
        .where(and(eq(students.portalUserId, student.portalUserId), ne(students.id, id)))
        .limit(1)
      if (!altroFiglio) {
        await tx.update(users).set({
          active:    false,
          email:     `anonimizzato-${student.portalUserId}@anonimo.invalid`,
          firstName: 'Genitore',
          lastName:  'Anonimizzato',
          phone:     null,
          updatedAt: new Date(),
        }).where(eq(users.id, student.portalUserId))
        accountGenitoreAnonimizzato = true
      }
    }

    // Anagrafica studente: svuotata. Pacchetti/pagamenti/contabilità NON si toccano
    // (conservazione obbligatoria per legge), ma non rimandano più a una persona identificabile.
    await tx.update(students).set({
      firstName: 'Studente',
      lastName:  'Anonimizzato',
      classe: null, scuola: null, studentPhone: null, studentEmail: null,
      parentName: null, parentEmail: null, parentPhone: null, parentIndirizzo: null,
      parentCitta: null, parentCap: null, parentCF: null, parentPIva: null,
      note: null, bisogniSpeciali: null,
      active: false,
      abilitatoPrenotazioneOnline: false,
      updatedAt: new Date(),
    }).where(eq(students.id, id))

    return {
      noteEliminate:            noteEliminate.length,
      prenotazioniAnonimizzate: prenotazioni.length,
      accountGenitoreAnonimizzato,
    }
  })
}

export async function exportStudentData(id: string) {
  const [student] = await db.select().from(students).where(eq(students.id, id)).limit(1)
  if (!student) throw new Error('Studente non trovato')

  const [pacchetti, prenotazioni, noteFamiglia, lezioni] = await Promise.all([
    db.select().from(packages).where(eq(packages.studentId, id)),
    db.select().from(bookings).where(eq(bookings.studentId, id)),
    db.select().from(studentNotes)
      .where(and(eq(studentNotes.studentId, id), eq(studentNotes.visibilita, 'FAMIGLIA'))),
    db.select({ data: lessons.data, tipo: lessons.tipo, oreScalate: lessonStudents.oreScalate })
      .from(lessonStudents)
      .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
      .where(eq(lessonStudents.studentId, id)),
  ])

  const pkgIds = pacchetti.map((p) => p.id)
  const [pagamenti, ricariche] = pkgIds.length
    ? await Promise.all([
        db.select().from(payments).where(inArray(payments.packageId, pkgIds)),
        db.select().from(packageRecharges).where(inArray(packageRecharges.packageId, pkgIds)),
      ])
    : [[], []]

  return {
    esportatoIl:              new Date().toISOString(),
    studente:                 student,
    pacchetti,
    pagamenti,
    ricariche,
    prenotazioni,
    lezioni,
    noteVisibiliAllaFamiglia: noteFamiglia,
  }
}
