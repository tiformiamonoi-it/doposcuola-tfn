import { z } from 'zod'

export const NoteVisibilitaEnum = z.enum(['INTERNA', 'FAMIGLIA'])

export const CreateNoteSchema = z.object({
  studentId: z.string().min(1, { message: 'ID studente richiesto' }),
  contenuto: z.string().min(1, { message: 'Il contenuto della nota non può essere vuoto' }),
  visibilita: NoteVisibilitaEnum.default('INTERNA'),
  lessonId: z.string().optional()
})

export const UpdateNoteSchema = z.object({
  contenuto: z.string().min(1, { message: 'Il contenuto della nota non può essere vuoto' }).optional(),
  visibilita: NoteVisibilitaEnum.optional()
})

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>
export type UpdateNoteInput = z.infer<typeof UpdateNoteSchema>
