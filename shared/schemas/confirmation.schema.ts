import { z } from 'zod'
import { giornoCivileValido } from '../giorno-civile'
import { VALORI_STATO_RIENTRO } from '../rientri'

/** Giorno civile 'AAAA-MM-GG' (mai timestamptz: la data-giorno non ha fuso orario). */
const giornoOpz = z
  .union([
    z.literal(''),
    z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida (formato AAAA-MM-GG)')
      // "2026-02-30" è ben formato ma non esiste: meglio un 422 chiaro che un 500 dal DB
      .refine(giornoCivileValido, 'Data inesistente (controlla giorno e mese)'),
  ])
  .transform((v) => (v.length > 0 ? v : null))
  .nullish()

/** Anno scolastico in forma '2026/2027'. */
const annoScolastico = z
  .string()
  .trim()
  .regex(/^\d{4}\/\d{4}$/, 'Anno scolastico non valido (formato 2026/2027)')

/** Flag che arriva dall'URL come stringa: '1'/'true' = acceso, tutto il resto spento. */
const flagQuery = z
  .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false'), z.literal('')])
  .default('0')
  .transform((v) => v === '1' || v === 'true')

// ─────────────────────────────────────────────
// GET /api/confirmations — filtri della lista (niente paginazione: ~100 righe)
// ─────────────────────────────────────────────
export const ListRientriQuerySchema = z.object({
  // Assente = l'anno scolastico corrente letto dalle impostazioni
  anno:   annoScolastico.optional(),
  stato:  z.enum(VALORI_STATO_RIENTRO, { message: 'Stato non valido' }).optional(),
  search: z.string().trim().max(100).optional(),

  // Solo chi ha fatto almeno una lezione negli ultimi 12 mesi
  soloAttiviRecenti: flagQuery,
  // Mostra anche chi non ha MAI fatto lezione (di default nascosti)
  includiMaiPartiti: flagQuery,
})

// ─────────────────────────────────────────────
// PUT /api/confirmations/:studentId — la risposta di un alunno
// ─────────────────────────────────────────────
export const SetRientroSchema = z.object({
  anno:  annoScolastico.optional(),
  stato: z.enum(VALORI_STATO_RIENTRO, { message: 'Stato non valido' }),
  note:  z.string().trim().max(2000, 'Le note non possono superare 2000 caratteri')
    .transform((v) => (v.length > 0 ? v : null)).nullish(),
  // Assente = ci mette il server la data di oggi quando serve
  dataRisposta: giornoOpz,
})

// ─────────────────────────────────────────────
// POST /api/confirmations/disattiva-non-rientrati
// ─────────────────────────────────────────────
export const DisattivaNonRientratiSchema = z.object({
  anno: annoScolastico.optional(),
})

export type ListRientriQuery       = z.infer<typeof ListRientriQuerySchema>
export type SetRientroInput        = z.infer<typeof SetRientroSchema>
export type DisattivaNonRientratiInput = z.infer<typeof DisattivaNonRientratiSchema>
