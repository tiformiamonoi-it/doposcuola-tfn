// IL LIVELLO SCOLASTICO SI DEDUCE, NON SI CHIEDE.
//
// Perché nel database non c'è nessuna colonna "livello": la classe dell'alunno
// (students.classe) è già una lista controllata — '1ª Elementare'…'5ª Superiore',
// 'Università', 'Concorsi / Adulti' — e da lì il livello si legge da solo.
// Aggiungere una colonna avrebbe voluto dire reinserire a mano il dato per ~99
// alunni e poi ricordarsi di cambiarlo DUE volte a ogni passaggio di classe.
// Così invece si corregge la classe e il livello si sistema da sé.
//
// Metafora: è come dedurre la taglia della scarpa dal numero scritto dentro,
// invece di attaccarci sopra un'etichetta a parte che poi può dire il contrario.

export type LivelloScolastico = 'ELEMENTARI' | 'MEDIE' | 'SUPERIORI' | 'UNIVERSITA' | 'ALTRO'

// Testo ridotto all'osso per il confronto: niente maiuscole, niente accenti,
// niente ordinali "ª/°", spazi singoli. Serve perché nel gestionale convivono i
// valori puliti della tendina ('2ª Media') e il testo libero di quando la lista
// non c'era ancora ('II media', 'seconda  MEDIA', '2 media').
function semplifica(testo: string): string {
  return testo
    .normalize('NFD')                // "à" diventa "a" + il segno d'accento…
    .replace(/\p{Diacritic}/gu, '') // …e il segno d'accento si butta via
    .toLowerCase()
    .replace(/[ªº°]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Il livello scolastico ricavato dalla classe.
 *
 * Restituisce `null` quando la classe è vuota o non si capisce: NON esiste un
 * valore di ripiego. Chi legge deve poter distinguere "non lo sappiamo" da
 * "sappiamo che non sono le medie" — un default silenzioso trasformerebbe un
 * dato mancante in un dato sbagliato, e nessuno se ne accorgerebbe.
 */
export function livelloDaClasse(classe: string | null | undefined): LivelloScolastico | null {
  if (!classe) return null
  const t = semplifica(classe)
  if (!t) return null

  // Ordine importante: si cerca la PAROLA della scuola, non il numero.
  // 'universita' prima di 'superiore' non serve (sono parole diverse), ma
  // 'elementare' va cercata prima di 'media' perché nessuna delle due contiene
  // l'altra: qui l'ordine è solo di leggibilità.
  if (t.includes('elementar') || t.includes('primaria')) return 'ELEMENTARI'
  if (t.includes('media') || t.includes('medie')) return 'MEDIE'
  // 'liceo' sì, 'istituto' NO: "Istituto Comprensivo" sono elementari e medie —
  // riconoscerlo come superiori sarebbe una risposta sbagliata data con sicurezza.
  if (t.includes('superior') || t.includes('liceo')) return 'SUPERIORI'
  if (t.includes('universita') || t.includes('ateneo')) return 'UNIVERSITA'

  // 'Concorsi / Adulti' e simili: sappiamo che non è una scuola dell'obbligo,
  // ed è un'informazione vera — diversa dal non sapere niente.
  if (t.includes('concors') || t.includes('adulti')) return 'ALTRO'

  return null
}

export function etichettaLivello(l: LivelloScolastico): string {
  switch (l) {
    case 'ELEMENTARI': return 'Elementari'
    case 'MEDIE':      return 'Medie'
    case 'SUPERIORI':  return 'Superiori'
    case 'UNIVERSITA': return 'Università'
    case 'ALTRO':      return 'Concorsi / Adulti'
  }
}
