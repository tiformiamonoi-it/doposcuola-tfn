// LA REGOLA DEL FISSO MENSILE DEI TUTOR, SCRITTA UNA VOLTA SOLA.
//
// Un tutor si paga in due modi: A ORE (ogni lezione porta il suo compenso) oppure
// a FISSO MENSILE — una cifra uguale tutti i mesi, qualunque cosa succeda.
//
// Il punto è che il fisso non è mai esistito "da sempre": quasi tutti partono a ore
// e passano al fisso a un certo punto dell'anno. Fino al 14/09/2026 il gestionale
// non lo sapeva e applicava il fisso a OGNI mese in cui il tutor avesse fatto
// lezione, passato compreso: un tutor pagato a ore da settembre a dicembre e messo
// a 500 € oggi risultava creditore di 500 € anche per settembre, ottobre, novembre
// e dicembre. Arretrati che non sono mai esistiti. Da lì nascono la colonna
// tutor_profiles.forfait_dal e questo file.
//
// La domanda a cui rispondiamo qui è UNA SOLA:
//    «per questo mese, a questo tutor, si devono il fisso o le ore?»
// Ci passano tutte le strade che mostrano un compenso — l'elenco dei tutor, la
// scheda del singolo, le statistiche, il riepilogo debiti — e anche il frontend.
// Se la regola stesse scritta in tre posti, un giorno qualcuno ne cambierebbe uno
// solo e le tre schermate tornerebbero a dire tre numeri diversi: è esattamente il
// difetto che questo file esiste per chiudere.

import { oggiISO } from './giorno-civile'

/** Mese civile 'AAAA-MM': la chiave con cui si ragiona qui dentro. */
export type MeseCivile = string

/** Il mese in corso in Italia (Europe/Rome), 'AAAA-MM'. */
export function meseDiOggi(): MeseCivile {
  return oggiISO().slice(0, 7)
}

/** Formato 'AAAA-MM' con un mese che esiste davvero (01-12). */
export function meseValido(mese: string | null | undefined): boolean {
  if (typeof mese !== 'string') return false
  const m = /^(\d{4})-(\d{2})$/.exec(mese.trim())
  if (!m) return false
  const numeroMese = Number(m[2])
  return numeroMese >= 1 && numeroMese <= 12
}

/**
 * Il mese di un giorno civile: '2026-09-14' → '2026-09'.
 * Accetta anche un 'AAAA-MM' già pronto (lo restituisce com'è).
 * Taglia una stringa, non costruisce mai una Date: così nessun fuso orario può
 * spostare un 1° del mese al mese precedente.
 */
export function meseDiGiorno(giorno: string): MeseCivile {
  return giorno.slice(0, 7)
}

/**
 * Il primo giorno del mese, 'AAAA-MM' → 'AAAA-MM-01'.
 * È la forma in cui il mese di partenza del fisso finisce a database: la colonna
 * è un giorno civile (`date`), e il giorno che ci scriviamo è sempre il primo.
 */
export function primoGiornoDelMese(mese: MeseCivile): string {
  return `${mese.slice(0, 7)}-01`
}

/** 'settembre 2026' — per le scritte dell'interfaccia. */
export function etichettaMese(mese: MeseCivile): string {
  const anno = Number(mese.slice(0, 4))
  const m    = Number(mese.slice(5, 7))
  if (!anno || !m) return mese
  // Data costruita e letta in UTC: con un fuso a ovest di Greenwich il 1° del mese
  // diventerebbe l'ultimo del mese prima, e l'etichetta direbbe il mese sbagliato.
  return new Date(Date.UTC(anno, m - 1, 1))
    .toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Quel tanto che serve sapere di un tutor per rispondere alla domanda.
 * I tipi sono larghi apposta: gli stessi dati arrivano da Drizzle (stringhe
 * `numeric`), dalle risposte JSON dell'API e dai moduli dell'interfaccia.
 */
export interface ProfiloCompensoTutor {
  modalitaPagamento: string | null | undefined
  importoForfait:    string | number | null | undefined
  /** Primo giorno del mese da cui vale il fisso ('AAAA-MM-01'), o null */
  forfaitDal:        string | null | undefined
}

/**
 * L'importo del fisso, se c'è ed è un numero sensato. Altrimenti null.
 * Un tutor segnato FORFAIT ma senza importo (o con 0) non è davvero a fisso: si
 * continua a pagarlo a ore, com'è sempre stato.
 */
export function importoFisso(t: ProfiloCompensoTutor): number | null {
  if (t.modalitaPagamento !== 'FORFAIT') return null
  if (t.importoForfait === null || t.importoForfait === undefined || t.importoForfait === '') return null
  const n = typeof t.importoForfait === 'number' ? t.importoForfait : parseFloat(String(t.importoForfait))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * DA QUALE MESE vale il fisso ('AAAA-MM'), oppure null se il tutor non è a fisso.
 *
 * ⚠️ LA REGOLA DEI DATI VECCHI: se il tutor risulta a fisso ma nessuno ha mai
 * indicato il mese di partenza (`forfaitDal` vuoto — sono i profili salvati prima
 * del 14/09/2026, che non possiamo andare a controllare uno per uno), il fisso vale
 * DAL MESE CORRENTE IN AVANTI, mai per i mesi passati. È la scelta che rende
 * impossibile il difetto anche su quei profili: nel dubbio non si inventano
 * arretrati, si lasciano i mesi passati come sono stati pagati davvero, a ore.
 */
export function meseInizioFisso(t: ProfiloCompensoTutor, oggiMese: MeseCivile = meseDiOggi()): MeseCivile | null {
  if (importoFisso(t) === null) return null
  const dal = typeof t.forfaitDal === 'string' ? meseDiGiorno(t.forfaitDal.trim()) : ''
  return meseValido(dal) ? dal : oggiMese
}

/**
 * LA DOMANDA: per il mese `mese` ('AAAA-MM'), a questo tutor si deve il fisso?
 * Restituisce l'importo del fisso se sì, null se quel mese va pagato a ore.
 *
 * Il confronto fra mesi è un confronto fra stringhe 'AAAA-MM': funziona perché il
 * formato è a lunghezza fissa e ordinato ('2026-09' < '2026-10'), e non tira in
 * ballo nessuna Date né nessun fuso orario.
 */
export function fissoDelMese(
  t: ProfiloCompensoTutor,
  mese: MeseCivile,
  oggiMese: MeseCivile = meseDiOggi(),
): number | null {
  const inizio = meseInizioFisso(t, oggiMese)
  if (inizio === null) return null
  return meseDiGiorno(mese) >= inizio ? importoFisso(t) : null
}

/**
 * I mesi che devono comparire ANCHE SE NON C'È STATA NESSUNA LEZIONE, da `daMese` a
 * `aMese` compresi (entrambi 'AAAA-MM').
 *
 * Seconda decisione di Alessandro del 14/09/2026: un fisso mensile per definizione
 * non dipende dalle lezioni fatte. Se un tutor a fisso non lavora per un mese
 * (malattia, mese fermo), quel mese gli è dovuto lo stesso e deve comparire
 * nell'elenco dei compensi — prima non compariva affatto, perché l'elenco nasceva
 * dalle lezioni. Per i tutor a ore non cambia niente: restituisce una lista vuota.
 */
export function mesiDovutiAFisso(
  t: ProfiloCompensoTutor,
  daMese: MeseCivile,
  aMese: MeseCivile,
  oggiMese: MeseCivile = meseDiOggi(),
): MeseCivile[] {
  const inizio = meseInizioFisso(t, oggiMese)
  if (inizio === null) return []

  const partenza = inizio > daMese ? inizio : daMese
  if (partenza > aMese) return []

  const mesi: MeseCivile[] = []
  let anno = Number(partenza.slice(0, 4))
  let mese = Number(partenza.slice(5, 7))
  // Ciclo sui numeri anno/mese, non su una Date: sommare "un mese" a una data è la
  // classica operazione che scivola (31 gennaio + 1 mese) e qui non serve.
  for (let giro = 0; giro < 600; giro++) {
    const chiave = `${anno}-${String(mese).padStart(2, '0')}`
    if (chiave > aMese) break
    mesi.push(chiave)
    mese++
    if (mese > 12) { mese = 1; anno++ }
  }
  return mesi
}
