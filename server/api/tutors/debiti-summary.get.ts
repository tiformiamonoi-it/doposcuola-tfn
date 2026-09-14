import { db } from '../../database/client'
import { sql } from 'drizzle-orm'
import { sqlMesiCompenso } from '../../services/tutor.service'
import { meseDiOggi, primoGiornoDelMese } from '#shared/compenso-tutor'

export default defineEventHandler(async () => {
  const now = new Date()
  const rangeStart = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
  const rangeEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const p2 = (s: string | null) => Number(parseFloat(s ?? '0').toFixed(2))
  // Mesi 'AAAA-MM': la griglia dei compensi ragiona per mesi, non per giorni.
  const meseOggi = meseDiOggi()
  const meseDa   = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, '0')}`

  // La griglia mese-per-mese è LA STESSA dell'elenco tutor (sqlMesiCompenso, in
  // tutor.service.ts): il fisso mensile vale dal suo mese di partenza in poi e conta
  // anche nei mesi senza lezioni. Se questo riepilogo avesse una sua copia del
  // calcolo, la dashboard e la pagina Tutor direbbero due totali diversi.
  const [row] = (await db.execute(sql`
    WITH ${sqlMesiCompenso(meseDa, meseOggi, meseOggi)},
    monthly_payments AS (
      SELECT tutor_id,
             DATE_TRUNC('month', mese)::date AS mese,
             COALESCE(SUM(importo::numeric), 0) AS pagato,
             BOOL_OR(status = 'PRO_BONO') AS pro_bono
      FROM tutor_payments
      WHERE mese >= ${rangeStart.toISOString()}
        AND mese <= ${rangeEnd.toISOString()}
      GROUP BY tutor_id, DATE_TRUNC('month', mese)::date
    ),
    debiti AS (
      SELECT mc.tutor_id, mc.mese,
             (mc.compenso_calcolato - COALESCE(mp.pagato, 0)) AS residuo
      FROM mesi_compenso mc
      LEFT JOIN monthly_payments mp ON mc.tutor_id = mp.tutor_id AND mc.mese = mp.mese
      WHERE mc.compenso_calcolato > COALESCE(mp.pagato, 0)
        AND NOT COALESCE(mp.pro_bono, false)
    )
    SELECT COUNT(DISTINCT tutor_id)::int AS tutor_count,
           COALESCE(SUM(CASE WHEN mese <  ${primoGiornoDelMese(meseOggi)}::date THEN residuo ELSE 0 END), 0)::text AS totale_arretrati,
           COALESCE(SUM(CASE WHEN mese =  ${primoGiornoDelMese(meseOggi)}::date THEN residuo ELSE 0 END), 0)::text AS totale_mese
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
