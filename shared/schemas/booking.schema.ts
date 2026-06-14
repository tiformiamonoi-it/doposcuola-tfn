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

export const AdminCreateBookingSchema = z.object({
  studentId:      z.string().nullable().optional(),
  studentName:    z.string().min(1, { message: 'Nome studente obbligatorio' }),
  studentSurname: z.string().min(1, { message: 'Cognome studente obbligatorio' }),
  studentPhone:   z.string().nullable().optional(),
  requestedDate:  z.string().datetime(),
  status:         z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']).optional().default('PENDING'),
  notes:          z.string().nullable().optional(),
  subjects:       z.array(z.string()).optional(),
})

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>
export type AdminCreateBookingInput = z.infer<typeof AdminCreateBookingSchema>

export const UpdateBookingSchema = z.object({
  dataDesiderata: z.string().datetime(),
  materie:        z.array(z.string().min(1)).min(1, { message: 'Seleziona almeno una materia' }),
  noteOrario:     z.string().max(500).optional(),
})

export type UpdateBookingInput = z.infer<typeof UpdateBookingSchema>

