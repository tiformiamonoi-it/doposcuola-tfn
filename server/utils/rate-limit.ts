// Rate limiting condiviso tra le istanze serverless: i contatori stanno nel database.
// Finestra fissa: il primo tentativo apre la finestra, i successivi la riempiono,
// scaduta la finestra il contatore riparte da 1.
import { lt, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { rateLimits } from '../database/schema'

export async function rateLimitExceeded(key: string, max = 3, windowMs = 10 * 60 * 1000): Promise<boolean> {
  // Una sola query atomica: due richieste contemporanee (anche su istanze diverse)
  // si mettono in fila sulla stessa riga e non possono passare entrambe.
  // Nel SET "rate_limits.*" è la riga vecchia: se è scaduta si riparte da capo.
  const scaduta = sql`${rateLimits.expiresAt} <= now()`
  try {
    const [riga] = await db.insert(rateLimits)
      .values({
        key,
        count: 1,
        windowStart: sql`now()`,
        expiresAt: sql`now() + ${windowMs}::integer * interval '1 millisecond'`,
      })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count:       sql`CASE WHEN ${scaduta} THEN 1 ELSE ${rateLimits.count} + 1 END`,
          windowStart: sql`CASE WHEN ${scaduta} THEN now() ELSE ${rateLimits.windowStart} END`,
          expiresAt:   sql`CASE WHEN ${scaduta} THEN excluded.expires_at ELSE ${rateLimits.expiresAt} END`,
        },
      })
      .returning({ count: rateLimits.count })
    return riga!.count > max
  } catch (err) {
    // Database irraggiungibile: si lascia passare. Bloccare vorrebbe dire chiudere
    // fuori tutti dal login proprio mentre il sito ha già un problema; e senza
    // database login e recupero password falliscono comunque più avanti.
    console.error(`Rate limit non verificabile (${key.split(':')[0]}), richiesta lasciata passare:`, err)
    return false
  }
}

// Chiamata dal cron giornaliero: via le righe con la finestra già chiusa.
export async function pulisciRateLimitScaduti(): Promise<number> {
  const cancellate = await db.delete(rateLimits)
    .where(lt(rateLimits.expiresAt, sql`now()`))
    .returning({ key: rateLimits.key })
  return cancellate.length
}
