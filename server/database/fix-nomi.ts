/**
 * MANUTENZIONE — Uniforma i nomi di tutor/staff e alunni in formato "Nome Proprio"
 * (corregge nomi tutti MAIUSCOLI o tutti minuscoli, spazi doppi, ecc.).
 * Sistema anche i nomi copiati nelle prenotazioni, così il matching li mostra puliti.
 *
 * Uso:
 *   npx tsx server/database/fix-nomi.ts            → SIMULAZIONE: mostra cosa cambierebbe, non tocca il DB
 *   npx tsx server/database/fix-nomi.ts --apply    → APPLICA le correzioni al database
 */
import 'dotenv/config'
import { db } from './client'
import { users, students, bookings } from './schema'
import { eq } from 'drizzle-orm'
import { nomeProprio } from '../utils/nomi'

const APPLY = process.argv.includes('--apply')

async function main() {
  console.log(APPLY ? '🛠️  APPLICAZIONE correzioni…\n' : '🔍 SIMULAZIONE (nessuna modifica al DB)…\n')

  let corretti = 0

  // 1. Tutti gli account (tutor, admin, genitori, studenti con accesso)
  const utenti = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, role: users.role })
    .from(users)

  for (const u of utenti) {
    const nuovoNome = nomeProprio(u.firstName)
    const nuovoCognome = nomeProprio(u.lastName)
    if (nuovoNome !== u.firstName || nuovoCognome !== u.lastName) {
      corretti++
      console.log(`  👤 ${u.role.padEnd(8)} "${u.firstName} ${u.lastName}" → "${nuovoNome} ${nuovoCognome}"`)
      if (APPLY) {
        await db.update(users)
          .set({ firstName: nuovoNome, lastName: nuovoCognome, updatedAt: new Date() })
          .where(eq(users.id, u.id))
      }
    }
  }

  // 2. Alunni (anagrafica) + nome del genitore
  const alunni = await db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, parentName: students.parentName })
    .from(students)

  for (const s of alunni) {
    const nuovoNome = nomeProprio(s.firstName)
    const nuovoCognome = nomeProprio(s.lastName)
    const nuovoGenitore = s.parentName ? nomeProprio(s.parentName) : s.parentName
    if (nuovoNome !== s.firstName || nuovoCognome !== s.lastName || nuovoGenitore !== s.parentName) {
      corretti++
      console.log(`  🎒 ALUNNO   "${s.firstName} ${s.lastName}" (gen. ${s.parentName ?? '—'}) → "${nuovoNome} ${nuovoCognome}" (gen. ${nuovoGenitore ?? '—'})`)
      if (APPLY) {
        await db.update(students)
          .set({ firstName: nuovoNome, lastName: nuovoCognome, parentName: nuovoGenitore, updatedAt: new Date() })
          .where(eq(students.id, s.id))
      }
    }
  }

  // 3. Nomi copiati nelle prenotazioni (compaiono nei badge del matching)
  const pren = await db.select({ id: bookings.id, studentName: bookings.studentName, studentSurname: bookings.studentSurname })
    .from(bookings)

  for (const b of pren) {
    const nuovoNome = nomeProprio(b.studentName)
    const nuovoCognome = nomeProprio(b.studentSurname)
    if (nuovoNome !== b.studentName || nuovoCognome !== b.studentSurname) {
      corretti++
      console.log(`  📅 PRENOT.  "${b.studentName} ${b.studentSurname}" → "${nuovoNome} ${nuovoCognome}"`)
      if (APPLY) {
        await db.update(bookings)
          .set({ studentName: nuovoNome, studentSurname: nuovoCognome, updatedAt: new Date() })
          .where(eq(bookings.id, b.id))
      }
    }
  }

  if (corretti === 0) {
    console.log('✅ Tutto a posto: nessun nome da correggere.')
  } else if (APPLY) {
    console.log(`\n✅ ${corretti} nomi corretti nel database.`)
  } else {
    console.log(`\nℹ️  ${corretti} nomi da correggere. Questa era solo una simulazione. Per applicare davvero:`)
    console.log('   npm run db:fix-nomi:apply')
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Errore durante la correzione dei nomi:', err)
  process.exit(1)
})
