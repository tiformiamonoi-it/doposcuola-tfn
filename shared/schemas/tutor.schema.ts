// shared/schemas/tutor.schema.ts
import { z } from 'zod'

// Gli importi arrivano da <UInput type="number">, che restituisce un NUMERO appena
// l'utente tocca il campo (Nuxt UI, Input.vue → looseToNumber) e una stringa se resta
// com'era: accettiamo entrambi (e la virgola italiana) normalizzando a stringa decimale,
// che è il formato delle colonne `numeric` a DB.
const ImportoSchema = z.union([z.string(), z.number()])
  .transform(v => String(v).trim().replace(',', '.'))
  .refine(v => Number.isFinite(parseFloat(v)), 'Importo non valido')

// ─── Crea Tutor ───────────────────────────────
export const CreateTutorSchema = z.object({
  firstName:         z.string({ message: 'Nome obbligatorio' }).min(1, 'Nome obbligatorio').max(100).trim(),
  lastName:          z.string({ message: 'Cognome obbligatorio' }).min(1, 'Cognome obbligatorio').max(100).trim(),
  email:             z.string({ message: 'Email obbligatoria' }).email('Email non valida').toLowerCase().trim(),
  password:          z.string({ message: 'Password obbligatoria' }).min(8, 'Password: almeno 8 caratteri'),
  phone:             z.string().regex(/^[\d\s+\-().]{7,20}$/, 'Telefono non valido').optional().nullable(),
  role:              z.enum(['TUTOR', 'ADMIN', 'SUPER_TUTOR']).default('TUTOR'),
  modalitaPagamento: z.enum(['ORE', 'FORFAIT']).default('ORE'),
  importoForfait:    z.coerce.string().optional().nullable(),
})
export type CreateTutorInput = z.infer<typeof CreateTutorSchema>

// ─── Aggiorna Tutor ───────────────────────────
export const UpdateTutorSchema = z.object({
  firstName:         z.string().min(1).max(100).trim().optional(),
  lastName:          z.string().min(1).max(100).trim().optional(),
  email:             z.string().email('Email non valida').toLowerCase().trim().optional(),
  phone:             z.string().optional().nullable(),
  // Reset password da parte dell'admin (todo 2.5): viene hashata nel service
  password:          z.string().min(8, 'Password: almeno 8 caratteri').optional(),
  role:              z.enum(['TUTOR', 'ADMIN', 'SUPER_TUTOR']).optional(),
  indirizzo:         z.string().optional().nullable(),
  citta:             z.string().max(100).optional().nullable(),
  cap:               z.string().max(10).optional().nullable(),
  codiceFiscale:     z.string().max(20).optional().nullable(),
  partitaIva:        z.string().max(20).optional().nullable(),
  materie:           z.array(z.string()).optional(),
  noteInterne:       z.string().optional().nullable(),
  modalitaPagamento: z.enum(['ORE', 'FORFAIT']).optional(),
  importoForfait:    z.coerce.string().optional().nullable(),
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
  importo: ImportoSchema,
  metodo:  z.enum(['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']),
  proBono: z.boolean().default(false),
  note:    z.string().optional(),
})
export type PayTutorInput = z.infer<typeof PayTutorSchema>

// ─── Rimborso spese ───────────────────────────
export const CreateReimbursementSchema = z.object({
  importo:       ImportoSchema,
  descrizione:   z.string({ message: 'Descrizione obbligatoria' }).min(1),
  dataRichiesta: z.string().optional(),
  note:          z.string().optional(),
})
export type CreateReimbursementInput = z.infer<typeof CreateReimbursementSchema>

export const PayReimbursementSchema = z.object({
  importoPagamento: ImportoSchema,
  metodo:           z.enum(['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']),
  note:             z.string().optional(),
})
export type PayReimbursementInput = z.infer<typeof PayReimbursementSchema>
