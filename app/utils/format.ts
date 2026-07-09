// Formattazione date centralizzata
// Usata in: pacchetti, contabilita, lezioni, studenti, componenti vari

// Giorno civile corrente in Italia (Europe/Rome), formato 'YYYY-MM-DD'.
// NON usare new Date().toISOString().slice(0,10): quella è la data UTC e tra
// mezzanotte e le ~2 di notte italiane restituisce ancora "ieri".
export function oggiISO(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date())
}

export function formatData(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDataOra(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDataEstesa(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}
