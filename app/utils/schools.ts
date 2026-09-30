// Liste centralizzate scuole e classi
// Usate in: studenti/index.vue, studenti/[id].vue, WizardNuovoStudente.vue

export const SCUOLE_TRAPANI = [
  // Istituti superiori — comune di Trapani (nomi reali)
  'Liceo Classico "L. Ximenes" - Trapani',
  'Liceo Scientifico "V. Fardella" - Trapani',
  'Liceo "Rosina Salvo" (Scienze Umane / LES / Linguistico) - Trapani',
  'Liceo Artistico "M. Buonarroti" - Trapani',
  'ITE "S. Calvino" - Trapani',
  'ITI "L. da Vinci" - Trapani',
  'ITT "G.B. Amico" (Geometri) - Trapani',
  'ITN "Marino Torre" (Nautico) - Trapani',
  'IPSIA "C. Monteleone" - Trapani',
  // Superiori zona limitrofa
  'IISS "Sciascia e Bufalino" - Erice',
  'Istituto Alberghiero "I. e V. Florio" - Erice',
  'Liceo "G. G. Adria" - Marsala',
  'ITIS "P. Gentili" - Marsala',
  'ITC "A. Lombardo" - Marsala',
  // Istituti comprensivi (elementari e medie)
  'I.C. "S. Borsellino-Ajello" - Trapani',
  'I.C. "G. Mazzini" - Trapani',
  'I.C. "E. De Amicis" - Trapani',
  'I.C. "G. Garibaldi" - Trapani',
  'I.C. "L. Da Vinci" - Trapani',
  'I.C. "G. Petrosino" - Petrosino (TP)',
  'I.C. di Erice',
  'I.C. di Paceco',
  'I.C. di Valderice',
]

export const CLASSI_LISTA = [
  '1ª Elementare', '2ª Elementare', '3ª Elementare', '4ª Elementare', '5ª Elementare',
  '1ª Media', '2ª Media', '3ª Media',
  '1ª Superiore', '2ª Superiore', '3ª Superiore', '4ª Superiore', '5ª Superiore',
  'Università', 'Concorsi / Adulti',
]

// ─── Classe e scuola dei figli nei Contatti ───
// Nel database (contact_figli.classe_scuola) è UN campo di testo solo; nel modulo
// sono due tendine come nella scheda studente, e si salvano unite:
// "2ª Media · I.C. di Erice". Così niente modifiche al database, e ovunque il
// testo si mostra (scheda, elenco, Excel, ricerca) si legge già "classe · scuola".

export function uniscClasseScuola(classe?: string | null, scuola?: string | null): string {
  return [classe?.trim(), scuola?.trim()].filter(Boolean).join(' · ')
}

// "2ª media", "2 media", "2° media", "II media", "seconda media", "3 liceo", "5 sup"…
// (niente lookbehind: i Safari vecchi non lo capiscono e romperebbero la pagina)
const RE_CLASSE = /(^|[^\p{L}\d])(?:([1-5])\s*[ªº°^ao]?|(iii|ii|iv|i|v)|(prim|second|terz|quart|quint)[ao])\s*(elementar[ei]|primaria|medi[ae]|superior[ei]|sup\.?|liceo)(?!\p{L})/iu
const ORDINALI: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, prim: 1, second: 2, terz: 3, quart: 4, quint: 5 }
const togliBordi = (s: string) => s.replace(/^[\s·,;/|–-]+|[\s·,;/|–-]+$/g, '')

/**
 * Il contrario di uniscClasseScuola, che capisce anche il testo libero dei
 * contatti di prima ("seconda media Mazzini" → "2ª Media" + "Mazzini").
 * Se la classe non si riconosce, tutto il testo finisce nella scuola: non si perde nulla.
 */
export function separaClasseScuola(testo: string | null | undefined): { classe: string, scuola: string } {
  const t = (testo ?? '').trim()
  if (!t) return { classe: '', scuola: '' }

  // Già scritto con la tendina (anche con maiuscole diverse)
  const pronta = CLASSI_LISTA.find((c) => t.toLowerCase().startsWith(c.toLowerCase()))
  if (pronta) return { classe: pronta, scuola: togliBordi(t.slice(pronta.length)) }

  const m = RE_CLASSE.exec(t)
  if (m) {
    const n = m[2] ? Number(m[2]) : ORDINALI[(m[3] ?? m[4] ?? '').toLowerCase()]
    const liv = m[5]!.toLowerCase()
    const grado = /^(elementar|primaria)/.test(liv) ? 'Elementare' : liv.startsWith('medi') ? 'Media' : 'Superiore'
    const classe = `${n}ª ${grado}`
    if (CLASSI_LISTA.includes(classe)) {
      // "3 liceo scientifico": "liceo" dice anche la scuola, quindi resta nel testo
      const inizio = m.index + m[1]!.length
      const fine = m.index + m[0].length - (liv === 'liceo' ? m[5]!.length : 0)
      // "Mazzini - 2 media - Trapani" → "Mazzini - Trapani"; "Mazzini (2 media)" → "Mazzini"
      const resto = `${t.slice(0, inizio)} ${t.slice(fine)}`
        .replace(/\(\s*\)/g, '')
        .replace(/([·,;/|–-])\s*[·,;/|–-]/g, '$1')
        .replace(/\s{2,}/g, ' ')
      return { classe, scuola: togliBordi(resto) }
    }
  }

  if (/^universit/i.test(t)) return { classe: 'Università', scuola: /^universit[àa]'?$/i.test(t) ? '' : t }
  return { classe: '', scuola: t }
}
