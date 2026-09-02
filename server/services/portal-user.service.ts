import { and, asc, eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { db } from '../database/client'
import { users, students, studentParents } from '../database/schema'
import { sendEmail, emailBenvenutoCredenziali } from '../utils/email'
import type { CreatePortalAccessInput } from '#shared/schemas/portal-user.schema'

// Violazione di un vincolo unico Postgres (23505). Con `constraint` si restringe
// a un vincolo specifico (es. l'indice unico su student_parents).
function isUniqueViolation(err: any, constraint?: string): boolean {
  const causa = err?.cause ?? err
  if (err?.code !== '23505' && causa?.code !== '23505') return false
  if (!constraint) return true
  const nome = err?.constraint_name ?? err?.constraint ?? causa?.constraint_name ?? causa?.constraint
  return typeof nome === 'string' && nome.includes(constraint)
}

export function generateTempPassword(length = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomInt(chars.length))
  }
  return result
}

// Elenco dei genitori con accesso al portale collegati a uno studente
// (più di uno: es. genitori separati, ognuno con il proprio login).
export async function getPortalAccess(studentId: string) {
  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
    columns: { id: true, abilitatoPrenotazioneOnline: true },
  })

  if (!student) {
    throw new Error('Studente non trovato')
  }

  const links = await db.query.studentParents.findMany({
    where: eq(studentParents.studentId, studentId),
    orderBy: [asc(studentParents.createdAt)],
    with: {
      parentUser: {
        columns: { id: true, email: true, firstName: true, lastName: true, active: true },
      },
    },
  })

  const parents = links.map((link) => ({
    linkId:    link.id,
    relazione: link.relazione,
    id:        link.parentUser.id,
    email:     link.parentUser.email,
    firstName: link.parentUser.firstName,
    lastName:  link.parentUser.lastName,
    active:    link.parentUser.active,
  }))

  return {
    id:                          student.id,
    abilitatoPrenotazioneOnline: student.abilitatoPrenotazioneOnline,
    parents,
  }
}

// AGGIUNGE un genitore allo studente (non sostituisce quelli già collegati).
// Se l'email esiste già come GENITORE non ancora collegato a questo alunno, restituisce
// una richiesta di conferma senza fare nulla (force=false); con force=true crea solo il
// collegamento, senza cambiare la password dell'account esistente.
export async function createPortalAccount(input: CreatePortalAccessInput, force = false) {
  const studente = await db.query.students.findFirst({
    where: eq(students.id, input.studentId),
    columns: { id: true },
  })
  if (!studente) throw new Error('Studente non trovato')

  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  })

  if (existing) {
    if (existing.role !== 'GENITORE') {
      throw new Error('Questa email è usata da un account staff. Usa un\'altra email per il genitore.')
    }

    // Già collegato a QUESTO alunno: niente da fare (gli altri figli non c'entrano)
    const giaCollegato = await db.query.studentParents.findFirst({
      where: and(
        eq(studentParents.studentId, input.studentId),
        eq(studentParents.parentUserId, existing.id),
      ),
      columns: { id: true },
    })
    if (giaCollegato) {
      throw new Error('Questo genitore è già collegato a questo alunno.')
    }

    if (!force) {
      // Segnala al frontend che serve conferma — non fa nulla
      return {
        requiresConfirmation: true as const,
        existingUser: {
          id:        existing.id,
          email:     existing.email,
          firstName: existing.firstName,
          lastName:  existing.lastName,
        },
      }
    }

    // force=true: collega l'account esistente a questo alunno, PASSWORD INVARIATA
    try {
      await db.insert(studentParents).values({
        studentId:    input.studentId,
        parentUserId: existing.id,
        relazione:    input.relazione ?? null,
      })
    } catch (err: any) {
      // Rete di sicurezza sull'indice unico (studentId, parentUserId): due richieste in parallelo
      if (isUniqueViolation(err, 'student_parents')) throw new Error('Questo genitore è già collegato a questo alunno.')
      throw err
    }

    const { password: _pw, ...safeUser } = existing
    return { ok: true, user: safeUser, alreadyExisted: true as const }
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  let created
  try {
    created = await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({
        email:     input.email.toLowerCase(),
        password:  hashedPassword,
        firstName: input.firstName,
        lastName:  input.lastName,
        role:      'GENITORE',
        active:    true,
        // GDPR: la password temporanea vista dalla segreteria vale solo per il primo accesso (13/07/2026)
        mustChangePassword: true,
      }).returning()

      if (!user) throw new Error('Inserimento utente portale fallito')

      await tx.insert(studentParents).values({
        studentId:    input.studentId,
        parentUserId: user.id,
        relazione:    input.relazione ?? null,
      })

      const { password: _pw, ...safeUser } = user
      return { ok: true, user: safeUser, tempPassword, alreadyExisted: false as const }
    })
  } catch (err: any) {
    // Corsa fra due richieste con la stessa email: messaggio chiaro invece di un errore Postgres
    if (isUniqueViolation(err, 'student_parents')) throw new Error('Questo genitore è già collegato a questo alunno.')
    if (isUniqueViolation(err)) throw new Error('Questa email è già usata da un altro account.')
    throw err
  }

  // Dopo la transazione: benvenuto con credenziali (non blocca mai la creazione)
  const { sent } = await sendEmail({
    to: created.user.email,
    ...emailBenvenutoCredenziali({ nome: created.user.firstName, email: created.user.email, tempPassword }),
  })

  return { ...created, emailInviata: sent }
}

// Crea l'account personale dello STUDENTE (solo prenotazioni).
// Attivo di default; il consenso del genitore è registrato con timestamp.
export async function createStudentAccount(input: { studentId: string; email: string; firstName: string; lastName: string }) {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  })
  if (existing) {
    throw new Error('Questa email è già usata da un altro account. Usa un\'email personale dello studente.')
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  const created = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email:     input.email.toLowerCase(),
      password:  hashedPassword,
      firstName: input.firstName,
      lastName:  input.lastName,
      role:      'STUDENTE',
      active:    true,
      mustChangePassword: true,
      consensoGenitoreAt: new Date(), // il genitore ha autorizzato (spunta obbligatoria in UI)
    }).returning()

    if (!user) throw new Error('Creazione account studente fallita')

    await tx.update(students)
      .set({ studentUserId: user.id, updatedAt: new Date() })
      .where(eq(students.id, input.studentId))

    const { password: _pw, ...safeUser } = user
    return { ok: true as const, user: safeUser, tempPassword }
  })

  const { sent } = await sendEmail({
    to: created.user.email,
    ...emailBenvenutoCredenziali({ nome: created.user.firstName, email: created.user.email, tempPassword }),
  })

  return { ...created, emailInviata: sent }
}

// Scollega UN genitore da UNO studente (es. account creato con email sbagliata,
// oppure genitore che non deve più avere accesso).
// Se dopo lo scollegamento quel genitore non ha più nessun altro figlio collegato,
// l'account viene eliminato del tutto (come faceva la vecchia deletePortalAccount);
// se ha ancora altri figli resta attivo e gli altri collegamenti non si toccano.
// Se il genitore ha prenotazioni o altri dati collegati, il DB blocca la cancellazione:
// giusto così — lo storico non si elimina, si può solo disattivare l'account.
export async function unlinkParent(studentId: string, parentUserId: string) {
  try {
    return await db.transaction(async (tx) => {
      const [link] = await tx.delete(studentParents)
        .where(and(
          eq(studentParents.studentId, studentId),
          eq(studentParents.parentUserId, parentUserId),
        ))
        .returning({ id: studentParents.id })

      if (!link) throw new Error('Collegamento genitore non trovato')

      // Restano altri figli collegati a questo genitore? Se sì l'account non si tocca.
      const altroFiglio = await tx.query.studentParents.findFirst({
        where: eq(studentParents.parentUserId, parentUserId),
        columns: { id: true },
      })
      if (altroFiglio) {
        return { ok: true, scollegato: true as const, accountEliminato: false }
      }

      const deleted = await tx.delete(users)
        .where(and(eq(users.id, parentUserId), eq(users.role, 'GENITORE')))
        .returning({ id: users.id })
      if (deleted.length === 0) throw new Error('Account portale non trovato')

      return { ok: true, scollegato: true as const, accountEliminato: true }
    })
  } catch (err: any) {
    if (err?.code === '23503' || err?.cause?.code === '23503') {
      throw new Error('Il genitore ha prenotazioni o altri dati collegati: non si può eliminare l\'account.')
    }
    throw err
  }
}

// Attiva/disattiva l'account studente (users.active): disattivo = niente login né prenotazioni
export async function setStudentAccountActive(userId: string, active: boolean) {
  const [updated] = await db.update(users)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.role, 'STUDENTE')))
    .returning()
  if (!updated) throw new Error('Account studente non trovato')
  return { ok: true, active: updated.active }
}

// Genera e imposta una nuova password temporanea
export async function resetPortalPassword(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!user) {
    throw new Error('Account non trovato')
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  await db.update(users)
    .set({ password: hashedPassword, mustChangePassword: true, updatedAt: new Date() })
    .where(eq(users.id, userId))

  const { sent } = await sendEmail({
    to: user.email,
    ...emailBenvenutoCredenziali({ nome: user.firstName, email: user.email, tempPassword }),
  })

  return { tempPassword, emailInviata: sent }
}

// Aggiorna il flag abilitatoPrenotazioneOnline
export async function updatePrenotazioneFlag(studentId: string, abilitato: boolean) {
  const [updated] = await db.update(students)
    .set({ abilitatoPrenotazioneOnline: abilitato, updatedAt: new Date() } as any)
    .where(eq(students.id, studentId))
    .returning()
  return updated
}
