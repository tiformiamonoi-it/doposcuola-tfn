import { z } from 'zod'

// Used client-side only — no backend endpoint
export const PublicContactSchema = z.object({
  nomeStudente:  z.string().min(1, { message: 'Nome studente obbligatorio' }).max(200),
  classeScuola:  z.string().max(200).optional(),
  materie:       z.string().min(1, { message: 'Specifica almeno una materia' }).max(500),
  contatto:      z.string().min(1, { message: 'Telefono o email obbligatorio' }).max(200),
  note:          z.string().max(1000).optional(),
})

export type PublicContactInput = z.infer<typeof PublicContactSchema>
