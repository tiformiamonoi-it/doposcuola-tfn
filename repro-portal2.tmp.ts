// Riproduce ESATTAMENTE le query drizzle di createPortalAccount (sola lettura + rollback)
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from './server/database/client'
import { users, students } from './server/database/schema'

async function main() {
  const email = 'test-repro@example.com'

  console.log('1) findFirst users per email...')
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  })
  console.log('   OK, existing =', existing ? existing.email : 'nessuno')

  console.log('2) getPortalAccess (findFirst students con relazione portalUser)...')
  const student = await db.query.students.findFirst({
    where: eq(students.id, 'cmqi4mbmd0001zvz6u46he76l'),
    columns: { id: true, portalUserId: true, abilitatoPrenotazioneOnline: true },
    with: {
      portalUser: {
        columns: { id: true, email: true, firstName: true, lastName: true, active: true },
      },
    },
  })
  console.log('   OK, student =', JSON.stringify(student))

  console.log('3) transazione insert+update (rollback)...')
  try {
    await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({
        email: email.toLowerCase(),
        password: 'x',
        firstName: 'Test',
        lastName: 'Repro',
        role: 'GENITORE',
        active: true,
      }).returning()
      console.log('   insert OK:', user?.email)
      await tx.update(students)
        .set({ portalUserId: user!.id, updatedAt: new Date() })
        .where(eq(students.id, 'cmqi4mbmd0001zvz6u46he76l'))
      console.log('   update OK — ora rollback')
      throw new Error('ROLLBACK_VOLUTO')
    })
  } catch (e: any) {
    if (e.message !== 'ROLLBACK_VOLUTO') throw e
    console.log('   rollback eseguito')
  }
  console.log('TUTTO OK — il bug non è nelle query DB')
  process.exit(0)
}

main().catch((err) => {
  console.error('ERRORE REALE:', err.constructor?.name, '-', err.message)
  if (err.cause) console.error('CAUSA:', err.cause)
  process.exit(1)
})
