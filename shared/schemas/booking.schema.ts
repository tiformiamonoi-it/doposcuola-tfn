import { z } from 'zod'

export const CreateBookingSchema = z.object({
  studentId:      z.string().min(1),
  dataDesiderata: z.string().datetime(),
  materie:        z.array(z.string().min(1)).min(1, { message: 'Seleziona almeno una materia' }),
  noteOrario:     z.string().max(500).optional(),
})

export const UpdateBookingStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED']),
  note:   z.string().max(500).optional(),
})

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>
