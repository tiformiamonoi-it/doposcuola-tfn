import { z } from 'zod'
import { giornoCivileValido } from '../giorno-civile'
import { problemaImmagine } from '../immagini'

// Una convenzione dal modulo di Impostazioni → Sconti (crea e "Correggi").
// I campi facoltativi lasciati vuoti diventano null: nel portale non compaiono.
const facoltativo = (max: number) =>
  z.string().trim().max(max, { message: `Al massimo ${max} caratteri` }).nullish().transform((v) => v || null)

export const ConvenzioneSchema = z.object({
  nome:        z.string().trim().min(1, { message: 'Scrivi il nome' }).max(200, { message: 'Il nome può avere al massimo 200 caratteri' }),
  descrizione: z.string().trim().min(1, { message: 'Scrivi la descrizione' }).max(2000, { message: 'La descrizione può avere al massimo 2000 caratteri' }),
  categoria:   facoltativo(100),
  citta:       facoltativo(100),
  sconto:      facoltativo(50),
  indirizzo:   facoltativo(255),
  orari:       facoltativo(255),
  telefono:    facoltativo(30),
  validaFino:  z.string().nullish().transform((v) => v || null)
    .refine((v) => v === null || giornoCivileValido(v), { message: 'Data non valida' }),
  // La foto, già ridotta nel browser: qui si ricontrollano formato e peso (shared/immagini.ts).
  // Assente (undefined) = in una correzione resta quella di prima; null = si toglie.
  immagine: z.string().nullable().optional().superRefine((v, ctx) => {
    const problema = problemaImmagine(v)
    if (problema) ctx.addIssue({ code: 'custom', message: problema.charAt(0).toUpperCase() + problema.slice(1) })
  }),
})

export type ConvenzioneInput = z.infer<typeof ConvenzioneSchema>
