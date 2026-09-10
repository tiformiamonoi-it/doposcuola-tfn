// Formattazione date centralizzata
// Usata in: pacchetti, contabilita, lezioni, studenti, componenti vari

// Giorno civile corrente in Italia (Europe/Rome), formato 'YYYY-MM-DD'.
// La funzione vive in shared/giorno-civile.ts perché serve identica anche al
// server (i compleanni del campanellino si calcolano lì). Qui è solo ri-esportata
// per nome — la forma che l'auto-import di Nuxt riconosce — così nei template si
// continua a scrivere oggiISO() senza import espliciti, esattamente come prima.
export { oggiISO } from '#shared/giorno-civile'

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

// Importo in formato italiano ('1.234,56') — il simbolo € lo mette il template
export function formatImporto(n: number | string | null | undefined): string {
  return (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
