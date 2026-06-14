import { z } from 'zod'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../../database/client'
import { users, students } from '../../database/schema'

const loginSchema = z.object({
  email:    z.string().email('Email non valida'),
  password: z.string().min(1, 'Password obbligatoria'),
})

export default defineEventHandler(async (event) => {
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

  // Per GENITORE: carica gli ID degli studenti collegati (supporto fratelli)
  let linkedStudentIds: string[] | undefined
  if (user.role === 'GENITORE') {
    const linked = await db.query.students.findMany({
      where: eq(students.portalUserId, user.id),
      columns: { id: true },
    })
    linkedStudentIds = linked.map((s) => s.id)
  }

  await setUserSession(event, {
    user: {
      id:               user.id,
      email:            user.email,
      firstName:        user.firstName,
      lastName:         user.lastName,
      role:             user.role,
      linkedStudentIds,
    },
  })

  return {
    ok: true,
    redirectTo: user.role === 'GENITORE' ? '/portale' : (user.role === 'TUTOR' ? '/area-tutor' : '/'),
  }
})
