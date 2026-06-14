/**
 * Avatar "a iniziali" per la lista studenti.
 *
 * Niente foto: mostriamo un cerchietto con le iniziali (es. "MR") e un colore
 * sempre uguale per la stessa persona. Il colore è scelto in modo deterministico
 * dal nome, così l'occhio riconosce subito lo studente scorrendo la lista.
 */

// Palette morbida: sfondo chiaro + testo scuro, leggibile e non aggressivo.
const PALETTE = [
  { bg: 'bg-rose-100',    text: 'text-rose-700' },
  { bg: 'bg-amber-100',   text: 'text-amber-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-sky-100',     text: 'text-sky-700' },
  { bg: 'bg-violet-100',  text: 'text-violet-700' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
  { bg: 'bg-teal-100',    text: 'text-teal-700' },
  { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
] as const

export function inizialiDa(firstName?: string | null, lastName?: string | null): string {
  const a = firstName?.trim()?.[0] ?? ''
  const b = lastName?.trim()?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

export function coloreAvatar(seed: string): { bg: string; text: string } {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  return PALETTE[h % PALETTE.length]!
}
