import { z } from 'zod'

// Usato dal form pubblico /prenota e ri-validato dal server in /api/contact
export const PublicContactSchema = z.object({
  nomeStudente:  z.string().min(1, { message: 'Nome studente obbligatorio' }).max(200),
  classeScuola:  z.string().max(200).optional(),
  materie:       z.string().min(1, { message: 'Specifica almeno una materia' }).max(500),
  contatto:      z.string().min(1, { message: 'Telefono o email obbligatorio' }).max(200),
  note:          z.string().max(1000).optional(),
  // GDPR art. 13: il form raccoglie dati (anche di minori) → presa visione obbligatoria
  privacyAccettata: z.boolean().refine((v) => v === true, {
    message: "Devi confermare di aver letto l'informativa privacy",
  }),
})

export type PublicContactInput = z.infer<typeof PublicContactSchema>
