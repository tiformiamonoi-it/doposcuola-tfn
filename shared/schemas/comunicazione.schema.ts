import { z } from 'zod'

// Comunicazioni a tutte le famiglie: lo stesso schema vale per l'invio vero e per
// "Invia una prova a me", così la prova controlla esattamente ciò che partirà.
export const ComunicazioneTipoEnum = z.enum(['INFORMATIVA', 'PROMOZIONALE'])

export const ComunicazioneSchema = z.object({
  // trim: un titolo fatto solo di spazi non è un titolo
  titolo: z.string().trim()
    .min(1, { message: 'Scrivi il titolo' })
    .max(150, { message: 'Il titolo può avere al massimo 150 caratteri' }),
  testo: z.string().trim()
    .min(1, { message: 'Scrivi il testo' })
    .max(5000, { message: 'Il testo può avere al massimo 5000 caratteri' }),
  tipo: ComunicazioneTipoEnum,
})

export type ComunicazioneTipo = z.infer<typeof ComunicazioneTipoEnum>
export type ComunicazioneInput = z.infer<typeof ComunicazioneSchema>
