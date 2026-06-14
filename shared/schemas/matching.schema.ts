import { z } from 'zod'

export const AssignTutorSlotSchema = z.object({
  subjectId: z.string().min(1, { message: 'subjectId richiesto' }),
  tutorId:   z.string().nullable().optional(),
  slot:      z.string().nullable().optional(),
})

export type AssignTutorSlotInput = z.infer<typeof AssignTutorSlotSchema>
