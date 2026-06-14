import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { db } from '../database/client'
import { users, students } from '../database/schema'
import type { CreatePortalAccessInput } from '#shared/schemas/portal-user.schema'

function generateTempPassword(length = 10): string {
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
    throw createError({ statusCode: 404, statusMessage: 'Studente non trovato' })
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
      throw createError({
        statusCode: 409,
        statusMessage: 'Questa email è usata da un account staff. Usa un\'altra email per il genitore.',
      })
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

  return await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email:     input.email.toLowerCase(),
      password:  hashedPassword,
      firstName: input.firstName,
      lastName:  input.lastName,
      role:      'GENITORE',
      active:    true,
    }).returning()

    await tx.update(students)
      .set({ portalUserId: user.id, updatedAt: new Date() })
      .where(eq(students.id, input.studentId))

    const { password: _pw, ...safeUser } = user
    return { ok: true, user: safeUser, tempPassword, alreadyExisted: false as const }
  })
}

// Genera e imposta una nuova password temporanea
export async function resetPortalPassword(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Account non trovato' })
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  await db.update(users)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, userId))

  return { tempPassword }
}

// Aggiorna il flag abilitatoPrenotazioneOnline
export async function updatePrenotazioneFlag(studentId: string, abilitato: boolean) {
  const [updated] = await db.update(students)
    .set({ abilitatoPrenotazioneOnline: abilitato, updatedAt: new Date() } as any)
    .where(eq(students.id, studentId))
    .returning()
  return updated
}
