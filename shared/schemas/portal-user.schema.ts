import { z } from 'zod'
import { DataNascitaOpz } from './data-nascita'

export const CreatePortalAccessSchema = z.object({
  studentId: z.string().min(1),
  email:     z.string().email({ message: 'Email non valida' }),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  // Etichetta libera del legame con l'alunno: "Padre", "Madre", "Tutore legale"…
  relazione: z.string().max(50).optional(),
  // Recapito e data di nascita del genitore. Per il PRIMO genitore il telefono sta
  // già su students.parentPhone (serve alla fatturazione); per il SECONDO l'unico
  // posto dove può stare è il suo account, quindi vanno accettati anche qui.
  phone:       z.union([
    z.string().trim().regex(/^[\d\s+\-().]{7,20}$/, 'Numero di telefono non valido'),
    z.literal(''),
  ]).transform((v) => (v.length > 0 ? v : null)).nullish(),
  dataNascita: DataNascitaOpz,
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
