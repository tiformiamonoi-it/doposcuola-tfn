import { db } from '../../database/client'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const now = new Date()
  const rangeStart = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
  const rangeEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const p2 = (s: string | null) => Number(parseFloat(s ?? '0').toFixed(2))

  const [row] = (await db.execute(sql`
    WITH monthly_lessons AS (
      SELECT tutor_id,
             DATE_TRUNC('month', data) AS mese,
             FLOOR(COALESCE(SUM(compenso_tutor::numeric), 0)) AS compenso_calcolato
      FROM lessons
      WHERE data >= ${rangeStart.toISOString().slice(0, 10)}
        AND data <= ${rangeEnd.toISOString().slice(0, 10)}
      GROUP BY tutor_id, DATE_TRUNC('month', data)
    ),
    monthly_payments AS (
      SELECT tutor_id,
             DATE_TRUNC('month', mese) AS mese,
             COALESCE(SUM(importo::numeric), 0) AS pagato,
             BOOL_OR(status = 'PRO_BONO') AS pro_bono
      FROM tutor_payments
      WHERE mese >= ${rangeStart.toISOString()}
        AND mese <= ${rangeEnd.toISOString()}
      GROUP BY tutor_id, DATE_TRUNC('month', mese)
    ),
    debiti AS (
      SELECT ml.tutor_id, ml.mese,
             (ml.compenso_calcolato - COALESCE(mp.pagato, 0)) AS residuo
      FROM monthly_lessons ml
      LEFT JOIN monthly_payments mp ON ml.tutor_id = mp.tutor_id AND ml.mese = mp.mese
      WHERE ml.compenso_calcolato > COALESCE(mp.pagato, 0)
        AND NOT COALESCE(mp.pro_bono, false)
    )
    SELECT COUNT(DISTINCT tutor_id)::int AS tutor_count,
           COALESCE(SUM(CASE WHEN mese < DATE_TRUNC('month', NOW()) THEN residuo ELSE 0 END), 0)::text AS totale_arretrati,
           COALESCE(SUM(CASE WHEN mese = DATE_TRUNC('month', NOW()) THEN residuo ELSE 0 END), 0)::text  AS totale_mese
    FROM debiti
  `)) as any[]

  const r = row ?? {}
  return {
    tutorsConDebiti:    Number(r.tutor_count ?? 0),
    totaleArretrati:    p2(r.totale_arretrati),
    totaleMeseCorrente: p2(r.totale_mese),
    totale:             p2(String(parseFloat(r.totale_arretrati ?? '0') + parseFloat(r.totale_mese ?? '0'))),
  }
})
