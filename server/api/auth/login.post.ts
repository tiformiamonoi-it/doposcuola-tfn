import { z } from 'zod'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../../database/client'
import { users, students } from '../../database/schema'
import { TERMS_VERSION, PRIVACY_STUDENTE_VERSION } from '#shared/legal'
import { rateLimitExceeded } from '../../utils/rate-limit'

const loginSchema = z.object({
  email:    z.string().email('Email non valida'),
  password: z.string().min(1, 'Password obbligatoria'),
})

export default defineEventHandler(async (event) => {
  // Anti brute-force: max 10 tentativi ogni 10 minuti per IP
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'sconosciuto'
  if (rateLimitExceeded(`login:${ip}`, 10)) {
    throw createError({ statusCode: 429, message: 'Troppi tentativi: riprova tra qualche minuto' })
  }

  const body = await readValidatedBody(event, loginSchema.parse)

  const user = await db.query.users.findFirst({
    where: eq(users.email, body.email.toLowerCase()),
  })

  // Messaggio generico — non rivela se l'email esiste o no
  if (!user || !user.active) {
    throw createError({ statusCode: 401, message: 'Credenziali non valide' })
  }

  const valid = await bcrypt.compare(body.password, user.password)
  if (!valid) {
    throw createError({ statusCode: 401, message: 'Credenziali non valide' })
  }

  // GENITORE: figli collegati (supporto fratelli). STUDENTE: sé stesso.
  let linkedStudentIds: string[] | undefined
  if (user.role === 'GENITORE' || user.role === 'STUDENTE') {
    const linked = await db.query.students.findMany({
      where: eq(user.role === 'GENITORE' ? students.portalUserId : students.studentUserId, user.id),
      columns: { id: true },
    })
    linkedStudentIds = linked.map((s) => s.id)
  }

  // GENITORE: termini + privacy; STUDENTE: privacy studente
  const termsAccepted = user.role === 'GENITORE'
    ? user.termsAcceptedVersion === TERMS_VERSION
    : user.role === 'STUDENTE'
      ? user.termsAcceptedVersion === PRIVACY_STUDENTE_VERSION
      : true

  await setUserSession(event, {
    user: {
      id:                 user.id,
      email:              user.email,
      firstName:          user.firstName,
      lastName:           user.lastName,
      role:               user.role,
      linkedStudentIds,
      mustChangePassword: user.mustChangePassword,
      termsAccepted,
      tutorialVisto: user.tutorialVisto,
    },
  })

  let redirectTo = ['GENITORE', 'STUDENTE'].includes(user.role) ? '/portale' : (user.role === 'TUTOR' ? '/area-tutor' : '/')
  if (user.mustChangePassword) redirectTo = '/cambio-password'
  else if (!termsAccepted) redirectTo = '/portale/accetta-termini'

  return { ok: true, redirectTo }
})
