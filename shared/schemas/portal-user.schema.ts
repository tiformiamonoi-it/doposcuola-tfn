import { z } from 'zod'

export const CreatePortalAccessSchema = z.object({
  studentId: z.string().min(1),
  email:     z.string().email({ message: 'Email non valida' }),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  // Etichetta libera del legame con l'alunno: "Padre", "Madre", "Tutore legale"…
  relazione: z.string().max(50).optional(),
})

export const ResetPortalPasswordSchema = z.object({
  userId: z.string().min(1),
})

export const UpdatePortalFlagSchema = z.object({
  abilitatoPrenotazioneOnline: z.boolean(),
})

export type CreatePortalAccessInput = z.infer<typeof CreatePortalAccessSchema>
export type ResetPortalPasswordInput = z.infer<typeof ResetPortalPasswordSchema>
export type UpdatePortalFlagInput = z.infer<typeof UpdatePortalFlagSchema>
