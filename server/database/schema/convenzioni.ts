import { pgTable, text, date, timestamp, index } from 'drizzle-orm/pg-core'
import { cuid } from './common'

// LE CONVENZIONI con le attività partner (cartolibrerie, palestre…), mostrate alle
// famiglie nella pagina Sconti del portale. Le gestisce l'admin da Impostazioni → Sconti.
//
// Fino al 16/11/2026 stavano tutte in un JSON dentro system_configs ('sconti'), foto
// comprese: la riga si leggeva intera a ogni apertura del portale e diventava pesante
// già con poche convenzioni. La migrazione 0039 le ha copiate qui; la riga vecchia è
// rimasta come copia di sicurezza e non la legge più nessuno.
export const convenzioni = pgTable('convenzioni', {
  id:          text('id').primaryKey().$defaultFn(cuid),
  nome:        text('nome').notNull(),
  descrizione: text('descrizione').notNull(),
  // La foto, come data URI già ridotto nel browser (shared/immagini.ts). Non viaggia
  // mai negli elenchi: portale e Impostazioni la prendono da /api/immagini/convenzioni/<id>.
  immagine:    text('immagine'),
  // Facoltativi (blocco 2 del piano portale famiglie): vuoto = non si mostra
  categoria:   text('categoria'),
  citta:       text('citta'),
  sconto:      text('sconto'),          // l'etichetta corta, es. "−10%"
  indirizzo:   text('indirizzo'),       // serve al tasto "Apri in Mappe"
  orari:       text('orari'),
  telefono:    text('telefono'),
  // L'ultimo giorno valido, giorno civile (mai timestamptz, vedi students.dataNascita).
  // Vuoto = senza scadenza. Dal giorno dopo sparisce dal portale, non da Impostazioni.
  validaFino:  date('valida_fino', { mode: 'string' }),
  // Quando è stata aggiunta: il riepilogo serale annuncia solo le convenzioni più nuove
  // dell'ultimo annuncio (note-digest.service.ts), le notifiche del portale le mostrano
  // come "nuova convenzione". VUOTA solo per quelle nate prima che la data esistesse
  // (copiate dal JSON senza data): contano come già note, come prima.
  creataAt:    timestamp('creata_at', { withTimezone: true }).defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  validaFinoIdx: index('convenzioni_valida_fino_idx').on(t.validaFino),
  creataAtIdx:   index('convenzioni_creata_at_idx').on(t.creataAt),
}))
