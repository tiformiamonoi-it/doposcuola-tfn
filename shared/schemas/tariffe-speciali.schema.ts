/**
 * shared/schemas/tariffe-speciali.schema.ts
 * "La Dogana" per le tariffe speciali dei tutor e per l'anteprima del compenso.
 */
import { z } from 'zod'
import { giornoCivileValido } from '../giorno-civile'

const giorno = z.string().refine(giornoCivileValido, 'La data non è valida')

// Tariffa oraria in euro: positiva e con un tetto, così un "1000" battuto per sbaglio
// al posto di "10,00" non passa.
const euroOra = z.number({ message: 'Indica una cifra in euro' })
  .positive('La cifra deve essere maggiore di zero')
  .max(500, 'La cifra sembra troppo alta: controlla')

// ─── Una regola (crea / modifica: si manda sempre la regola intera) ───
export const TariffaSpecialeSchema = z.object({
  tutorId:       z.string().cuid2('Tutor non valido').nullable().optional(),
  studentId:     z.string().cuid2('Alunno non valido').nullable().optional(),
  timeSlotIds:   z.array(z.string().cuid2('Fascia oraria non valida')).max(50).default([]),
  tariffaOraria: euroOra,
  validaDal:     giorno,
  nota:          z.string().trim().max(300, 'La nota non può superare 300 caratteri').nullable().optional(),
}).refine(
  // Una regola "tutti, sempre" sarebbe il listino: deve dire almeno CHI o QUANDO.
  d => !!d.tutorId || !!d.studentId || d.timeSlotIds.length > 0,
  { message: 'Indica almeno un tutor, un alunno o una fascia oraria', path: ['tutorId'] },
)

export const TariffeSpecialiQuerySchema = z.object({
  tutorId:   z.string().cuid2().optional(),
  studentId: z.string().cuid2().optional(),
})

// ─── Anteprima del compenso (finestre del calendario) ───
// Una o più lezioni dello stesso tutor nello stesso giorno: la finestra "Creazione
// multipla" ne manda una per fascia in UNA chiamata sola.
// `lessonId` = lezione già salvata che si sta modificando: il server applica la stessa
// regola della modifica ("se non cambia niente che conti, il compenso resta").
export const AnteprimaCompensoSchema = z.object({
  tutorId: z.string().cuid2('Tutor non valido'),
  data:    giorno,
  lezioni: z.array(z.object({
    lessonId:        z.string().cuid2().optional(),
    timeSlotId:      z.string().cuid2('Fascia oraria non valida'),
    studentIds:      z.array(z.string().cuid2()).max(10),
    forzaGruppo:     z.boolean().default(false),
    mezzaLezione:    z.boolean().default(false),
    compensoForzato: euroOra.nullable().optional(),
  })).min(1).max(30),
})

export type TariffaSpecialeInput    = z.infer<typeof TariffaSpecialeSchema>
export type TariffeSpecialiQuery    = z.infer<typeof TariffeSpecialiQuerySchema>
export type AnteprimaCompensoInput  = z.infer<typeof AnteprimaCompensoSchema>
