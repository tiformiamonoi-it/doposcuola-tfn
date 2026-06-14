/**
 * Colore per giorno della settimana, per dare vita alle "box" dei giorni nel calendario.
 *
 * Ogni giorno feriale ha la sua tinta morbida (come la vecchia webapp, ma più sobria):
 * Lun azzurro · Mar viola · Mer verde · Gio ambra · Ven rosa · Sab foglia di tè · Dom grigio.
 *
 * Restituisce classi Tailwind già pronte (scritte per intero, così Tailwind le conserva):
 *  - accent : colore del bordo-spina sinistro della scheda (usare con `border-l-4`)
 *  - tile   : sfondo sfumato della targhetta data
 *  - text   : colore del numero/giorno nella targhetta
 *  - ring   : bordo della targhetta
 *  - wash   : inizio sfumatura per l'alone leggero nell'intestazione (usare con `bg-gradient-to-r ... to-transparent`)
 */

const GIORNI = {
  0: { accent: 'border-l-slate-300',  tile: 'bg-gradient-to-br from-slate-50 to-slate-100',   text: 'text-slate-600',  ring: 'ring-slate-200',  wash: 'from-slate-50/60' },
  1: { accent: 'border-l-sky-400',    tile: 'bg-gradient-to-br from-sky-50 to-sky-100',       text: 'text-sky-700',    ring: 'ring-sky-200',    wash: 'from-sky-50/70' },
  2: { accent: 'border-l-violet-400', tile: 'bg-gradient-to-br from-violet-50 to-violet-100', text: 'text-violet-700', ring: 'ring-violet-200', wash: 'from-violet-50/70' },
  3: { accent: 'border-l-emerald-400',tile: 'bg-gradient-to-br from-emerald-50 to-emerald-100',text: 'text-emerald-700',ring: 'ring-emerald-200',wash: 'from-emerald-50/70' },
  4: { accent: 'border-l-amber-400',  tile: 'bg-gradient-to-br from-amber-50 to-amber-100',   text: 'text-amber-700',  ring: 'ring-amber-200',  wash: 'from-amber-50/70' },
  5: { accent: 'border-l-rose-400',   tile: 'bg-gradient-to-br from-rose-50 to-rose-100',     text: 'text-rose-700',   ring: 'ring-rose-200',   wash: 'from-rose-50/70' },
  6: { accent: 'border-l-teal-400',   tile: 'bg-gradient-to-br from-teal-50 to-teal-100',     text: 'text-teal-700',   ring: 'ring-teal-200',   wash: 'from-teal-50/70' },
} as const

export type TemaGiorno = (typeof GIORNI)[keyof typeof GIORNI]

export function coloreGiorno(dateStr: string): TemaGiorno {
  const d = new Date(dateStr).getDay() as keyof typeof GIORNI
  return GIORNI[d] ?? GIORNI[0]
}
