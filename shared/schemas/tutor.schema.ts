// shared/schemas/tutor.schema.ts
import { z } from 'zod'

// ─── Crea Tutor ───────────────────────────────
export const CreateTutorSchema = z.object({
  firstName:         z.string({ message: 'Nome obbligatorio' }).min(1).max(100).trim(),
  lastName:          z.string({ message: 'Cognome obbligatorio' }).min(1).max(100).trim(),
  email:             z.string({ message: 'Email obbligatoria' }).email('Email non valida').toLowerCase().trim(),
  password:          z.string({ message: 'Password obbligatoria' }).min(8, 'Password: almeno 8 caratteri'),
  phone:             z.string().regex(/^[\d\s+\-().]{7,20}$/, 'Telefono non valido').optional().nullable(),
  modalitaPagamento: z.enum(['ORE', 'FORFAIT']).default('ORE'),
  importoForfait:    z.string().optional().nullable(),
})
export type CreateTutorInput = z.infer<typeof CreateTutorSchema>

// ─── Aggiorna Tutor ───────────────────────────
export const UpdateTutorSchema = z.object({
  firstName:         z.string().min(1).max(100).trim().optional(),
  lastName:          z.string().min(1).max(100).trim().optional(),
  email:             z.string().email('Email non valida').toLowerCase().trim().optional(),
  phone:             z.string().optional().nullable(),
  indirizzo:         z.string().optional().nullable(),
  citta:             z.string().max(100).optional().nullable(),
  cap:               z.string().max(10).optional().nullable(),
  codiceFiscale:     z.string().max(20).optional().nullable(),
  partitaIva:        z.string().max(20).optional().nullable(),
  materie:           z.array(z.string()).optional(),
  noteInterne:       z.string().optional().nullable(),
  modalitaPagamento: z.enum(['ORE', 'FORFAIT']).optional(),
  importoForfait:    z.string().optional().nullable(),
  active:            z.boolean().optional(),
})
export type UpdateTutorInput = z.infer<typeof UpdateTutorSchema>

// ─── Filtri lista ─────────────────────────────
export const TutorQuerySchema = z.object({
  search:      z.string().optional(),
  active:      z.enum(['true', 'false']).optional(),
  daLiquidare: z.enum(['true', 'false']).optional(),
})
export type TutorQuery = z.infer<typeof TutorQuerySchema>

// ─── Liquida mese ─────────────────────────────
export const PayTutorSchema = z.object({
  mese:    z.string({ message: 'Mese obbligatorio' }),
  importo: z.string({ message: 'Importo obbligatorio' }),
  metodo:  z.enum(['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']),
  proBono: z.boolean().default(false),
  note:    z.string().optional(),
})
export type PayTutorInput = z.infer<typeof PayTutorSchema>

// ─── Rimborso spese ───────────────────────────
export const CreateReimbursementSchema = z.object({
  importo:       z.string({ message: 'Importo obbligatorio' }),
  descrizione:   z.string({ message: 'Descrizione obbligatoria' }).min(1),
  dataRichiesta: z.string().optional(),
  note:          z.string().optional(),
})
export type CreateReimbursementInput = z.infer<typeof CreateReimbursementSchema>

export const PayReimbursementSchema = z.object({
  importoPagamento: z.string({ message: 'Importo pagamento obbligatorio' }),
  metodo:           z.enum(['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']),
  note:             z.string().optional(),
})
export type PayReimbursementInput = z.infer<typeof PayReimbursementSchema>
