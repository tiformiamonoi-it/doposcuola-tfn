import { z } from 'zod'

const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/

export const CreateTimeSlotSchema = z.object({
  oraInizio:   z.string().regex(timeRegex, 'Formato ora inizio non valido (HH:MM)'),
  oraFine:     z.string().regex(timeRegex, 'Formato ora fine non valido (HH:MM)'),
  descrizione: z.string().optional().nullable(),
  active:      z.boolean().default(true),
})
export type CreateTimeSlotInput = z.infer<typeof CreateTimeSlotSchema>

export const UpdateTimeSlotSchema = CreateTimeSlotSchema.partial()
export type UpdateTimeSlotInput = z.infer<typeof UpdateTimeSlotSchema>
