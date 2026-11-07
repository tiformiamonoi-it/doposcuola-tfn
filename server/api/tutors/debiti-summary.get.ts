import { db } from '../../database/client'
import { sql } from 'drizzle-orm'
import { sqlMesiCompenso } from '../../services/tutor.service'
import { meseDiOggi, mesiPrima, primoGiornoDelMese } from '#shared/compenso-tutor'
import { arrotonda } from '#shared/arrotondamenti'

export default defineEventHandler(async () => {
  // Mesi 'AAAA-MM' del calendario ITALIANO: con new Date() sul server (UTC) nella
  // prima ora del giorno 1 la finestra guardava ancora il mese prima.
  // Finestra: il mese in corso e gli 11 prima (es. dicembre → da gennaio).
  const meseOggi = meseDiOggi()
  const meseDa   = mesiPrima(meseOggi, 11)

  // La griglia mese-per-mese è LA STESSA dell'elenco tutor (sqlMesiCompenso, in
  // tutor.service.ts): il fisso mensile vale dal suo mese di partenza al suo ultimo
  // mese, conta anche nei mesi senza lezioni e diventa dovuto dal 1° del mese dopo —
  // quindi nel mese in corso un tutor a fisso non porta niente in "totale_mese". Se questo riepilogo avesse una sua copia del
  // calcolo, la dashboard e la pagina Tutor direbbero due totali diversi.
  const [row] = (await db.execute(sql`
    WITH ${sqlMesiCompenso(meseDa, meseOggi, meseOggi)},
    monthly_payments AS (
      SELECT tutor_id,
             DATE_TRUNC('month', mese)::date AS mese,
             COALESCE(SUM(importo::numeric), 0) AS pagato,
             BOOL_OR(status = 'PRO_BONO') AS pro_bono
      FROM tutor_payments
      WHERE mese >= ${primoGiornoDelMese(meseDa)}::date
        AND mese <  (${primoGiornoDelMese(meseOggi)}::date + INTERVAL '1 month')
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
           COALESCE(SUM(CASE WHEN mese =  ${primoGiornoDelMese(meseOggi)}::date THEN residuo ELSE 0 END), 0)::text AS totale_mese,
           -- Il totale lo somma Postgres (numeric, esatto), non JavaScript
           COALESCE(SUM(residuo), 0)::text AS totale
    FROM debiti
  `)) as any[]

  const r = row ?? {}
  return {
    tutorsConDebiti:    Number(r.tutor_count ?? 0),
    totaleArretrati:    arrotonda(r.totale_arretrati),
    totaleMeseCorrente: arrotonda(r.totale_mese),
    totale:             arrotonda(r.totale),
  }
})
