import { and, eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { db } from '../database/client'
import { users, students } from '../database/schema'
import { sendEmail, emailBenvenutoCredenziali } from '../utils/email'
import type { CreatePortalAccessInput } from '#shared/schemas/portal-user.schema'

export function generateTempPassword(length = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomInt(chars.length))
  }
  return result
}

// Controlla se uno studente ha già un account portale
export async function getPortalAccess(studentId: string) {
  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
    columns: { id: true, portalUserId: true, abilitatoPrenotazioneOnline: true },
    with: {
      portalUser: {
        columns: { id: true, email: true, firstName: true, lastName: true, active: true }
      }
    }
  })

  if (!student) {
    throw new Error('Studente non trovato')
  }

  return student
}

// Crea un nuovo account GENITORE o, se l'email esiste già, restituisce
// una richiesta di conferma senza fare nulla (force=false).
// Con force=true collega lo studente all'account esistente senza cambiare la password.
export async function createPortalAccount(input: CreatePortalAccessInput, force = false) {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  })

  if (existing) {
    if (existing.role !== 'GENITORE') {
      throw new Error('Questa email è usata da un account staff. Usa un\'altra email per il genitore.')
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

    // force=true: collega lo studente all'account esistente, PASSWORD INVARIATA
    await db.update(students)
      .set({ portalUserId: existing.id, updatedAt: new Date() })
      .where(eq(students.id, input.studentId))

    const { password: _pw, ...safeUser } = existing
    return { ok: true, user: safeUser, alreadyExisted: true as const }
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  const created = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email:     input.email.toLowerCase(),
      password:  hashedPassword,
      firstName: input.firstName,
      lastName:  input.lastName,
      role:      'GENITORE',
      active:    true,
      // Niente obbligo di cambio password per le famiglie (scelta del titolare, 10/07/2026)
    }).returning()

    if (!user) throw new Error('Inserimento utente portale fallito')

    await tx.update(students)
      .set({ portalUserId: user.id, updatedAt: new Date() })
      .where(eq(students.id, input.studentId))

    const { password: _pw, ...safeUser } = user
    return { ok: true, user: safeUser, tempPassword, alreadyExisted: false as const }
  })

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
    .set({ password: hashedPassword, updatedAt: new Date() })
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
