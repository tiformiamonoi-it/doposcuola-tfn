import { getDashboard } from '../../services/accounting.service'

// GET /api/accounting/dashboard
// Cruscotto finanziario aggregato. Restituisce:
//   cashFlow.totale            — CONTANTI, BONIFICO, ALTRO, totale (da inizio attività)
//   cashFlow.ultimi30Giorni    — stessi dati limitati agli ultimi 30 giorni
//   fattureInAttesa.count      — numero di fatture richieste ma non ancora emesse
//   fattureInAttesa.lista      — dettaglio di ogni fattura in attesa
//   margineUltimi30Giorni      — entrate, uscite, margine netto (30 gg)
export default defineEventHandler(async (_event) => {
  return getDashboard()
})
