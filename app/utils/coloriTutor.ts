/**
 * "Corsie" colorate per i tutor nella griglia del calendario.
 *
 * Come le corsie di una piscina: ogni tutor ha il suo colore, sempre lo stesso.
 * Serve a distinguere a colpo d'occhio le righe della griglia (tutor) e a collegare
 * visivamente gli studenti al loro tutor (le targhette prendono la stessa tinta).
 *
 * Il colore è scelto in modo deterministico dall'id del tutor: stabile fra ricariche.
 * Le classi sono scritte per intero (niente interpolazione) così Tailwind le conserva.
 */

const CORSIE = [
  { border: 'border-rose-400',    avatarBg: 'bg-rose-100',    avatarText: 'text-rose-700',    chip: 'bg-rose-50 text-rose-800 ring-rose-200' },
  { border: 'border-amber-400',   avatarBg: 'bg-amber-100',   avatarText: 'text-amber-700',   chip: 'bg-amber-50 text-amber-800 ring-amber-200' },
  { border: 'border-emerald-400', avatarBg: 'bg-emerald-100', avatarText: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  { border: 'border-sky-400',     avatarBg: 'bg-sky-100',     avatarText: 'text-sky-700',     chip: 'bg-sky-50 text-sky-800 ring-sky-200' },
  { border: 'border-violet-400',  avatarBg: 'bg-violet-100',  avatarText: 'text-violet-700',  chip: 'bg-violet-50 text-violet-800 ring-violet-200' },
  { border: 'border-fuchsia-400', avatarBg: 'bg-fuchsia-100', avatarText: 'text-fuchsia-700', chip: 'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200' },
  { border: 'border-teal-400',    avatarBg: 'bg-teal-100',    avatarText: 'text-teal-700',    chip: 'bg-teal-50 text-teal-800 ring-teal-200' },
  { border: 'border-indigo-400',  avatarBg: 'bg-indigo-100',  avatarText: 'text-indigo-700',  chip: 'bg-indigo-50 text-indigo-800 ring-indigo-200' },
] as const

export type CorsiaTutor = (typeof CORSIE)[number]

export function corsiaTutor(seed: string): CorsiaTutor {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  return CORSIE[h % CORSIE.length]!
}
