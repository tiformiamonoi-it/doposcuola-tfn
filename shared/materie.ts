// LE MATERIE: due elenchi scritti nel codice, due mestieri diversi.
//
// La lista VERA — quella che conta — è quella che l'admin costruisce in
// Impostazioni → Materie & Tariffe (configurazione `materie` in system_configs).
// La leggono il portale famiglie quando si prenota, l'abbinamento con i tutor e
// il calendario delle giornate speciali. Gli elenchi qui sotto NON la sostituiscono.
//
//  • MATERIE_DEFAULT è il paracadute: entra in scena solo quando la lista
//    configurata è vuota o illeggibile (pattern `configs.materie ?? MATERIE_DEFAULT`),
//    per non mettere davanti a una famiglia una tendina vuota. Resta di undici voci
//    e non cresce: se crescesse, il portale finirebbe per offrire materie che il
//    Centro non ha mai deciso di offrire, e nessuno saprebbe perché.
//
//  • MATERIE_SUPERIORI è il catalogo di partenza: NON viene mostrato da nessuna
//    parte da solo. Lo usa una volta il bottone "Aggiungi le materie standard" in
//    Impostazioni, che copia nella lista vera quelle che mancano. Da quel momento
//    sono materie normalissime: si rinominano e si cancellano come le altre.
//
// DA DOVE VIENE L'ELENCO DELLE SUPERIORI. È il giro completo degli indirizzi
// italiani di scuola superiore — licei (classico, scientifico anche a scienze
// applicate, linguistico, scienze umane anche economico-sociale, artistico),
// istituti tecnici (economico: amministrazione-finanza-marketing e turismo;
// tecnologico: informatica, elettronica, meccanica, costruzioni, chimica e
// materiali) e istituti professionali (socio-sanitario, enogastronomia, servizi
// commerciali, manutenzione) — con i nomi come li dice una famiglia al telefono,
// non come li scrive il ministero sui programmi ("Diritto ed economia", non
// "Diritto ed economia politica"; "Igiene e cultura sanitaria", non "Igiene e
// cultura medico-sanitaria").
//
// NON è un elenco da prendere o lasciare: quello che al Centro non serve si toglie
// dalle Impostazioni con la ✕ accanto alla materia, e non torna più.
//
// ORDINE ALFABETICO, e non "le più richieste in alto". Con undici voci l'ordine per
// popolarità si legge a colpo d'occhio; con una quarantina no: chi cerca "Storia
// dell'arte" in mezzo a quaranta etichette la trova solo se sa dove guardare, e
// l'alfabeto è l'unico posto che tutti sanno già. In più il bottone AGGIUNGE in
// fondo senza riordinare, quindi le materie che il Centro usa da sempre restano
// dove stanno, in cima, e il catalogo si accoda sotto.

/** Il paracadute quando la lista configurata manca: undici materie, le più richieste. */
export const MATERIE_DEFAULT = [
  'Matematica', 'Fisica', 'Chimica', 'Italiano', 'Inglese',
  'Storia', 'Geografia', 'Latino', 'Greco', 'Scienze', 'Informatica',
]

/** Il catalogo completo delle superiori, offerto dal bottone "Aggiungi le materie standard". */
export const MATERIE_SUPERIORI = [
  'Accoglienza turistica',
  'Biologia',
  'Biotecnologie',
  'Chimica',
  'Chimica organica',
  'Cinese',
  'Costruzioni',
  'Cucina',
  'Design',
  'Diritto ed economia',
  'Disegno artistico',
  'Disegno tecnico',
  'Economia aziendale',
  'Elettrotecnica ed elettronica',
  'Estimo',
  'Filosofia',
  'Fisica',
  'Francese',
  'Geografia',
  'Grafica e multimedia',
  'Greco',
  'Igiene e cultura sanitaria',
  'Informatica',
  'Inglese',
  'Italiano',
  'Latino',
  'Matematica',
  'Meccanica e macchine',
  'Psicologia',
  'Russo',
  'Sala e vendita',
  'Scienza degli alimenti',
  'Scienze',
  'Scienze motorie',
  'Scienze umane',
  'Sistemi e automazione',
  'Sistemi e reti',
  'Spagnolo',
  'Storia',
  'Storia dell\'arte',
  'Tecnologie meccaniche',
  'Tedesco',
  'Telecomunicazioni',
  'Topografia',
]

/**
 * La materia ridotta all'osso per il confronto: niente maiuscole, niente accenti,
 * niente spazi doppi, apostrofo sempre quello dritto.
 *
 * Serve perché "Storia dell'Arte", "storia  dell'arte" e "Storia dell’arte"
 * (quest'ultima incollata da Word, con l'apostrofo tipografico) sono la stessa
 * materia scritta da tre persone diverse: senza questo passaggio il bottone le
 * riaggiungerebbe tutte e tre, e nel portale la famiglia si troverebbe la stessa
 * voce ripetuta.
 *
 * Nota: l'apostrofo si normalizza ma non si butta via, perché "dell'arte" e
 * "dellarte" non sono errori di battitura l'uno dell'altro — se un giorno qualcuno
 * scrivesse davvero la seconda, è giusto che si veda che è una voce a sé.
 */
export function materiaConfrontabile(v?: string | null): string {
  return (v ?? '')
    .normalize('NFD')                // "à" diventa "a" + il segno d'accento…
    .replace(/\p{Diacritic}/gu, '')  // …e il segno d'accento si butta via
    .toLowerCase()
    .replace(/[‘’ʼ]/g, '\'') // apostrofi "belli" → apostrofo normale
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Le materie del catalogo che MANCANO nella lista attuale, nell'ordine del catalogo.
 *
 * È volutamente una funzione che risponde "cosa manca" e non una che "sistema la
 * lista": chi la chiama può così dire prima all'utente quante e quali materie sta
 * per aggiungere, e solo dopo la conferma toccare la lista. Quelle già presenti non
 * vengono né riscritte né riordinate — il bottone aggiunge, non rifà.
 */
export function materieDaAggiungere(
  attuali: readonly string[],
  catalogo: readonly string[] = MATERIE_SUPERIORI,
): string[] {
  const gia = new Set(attuali.map(materiaConfrontabile))
  const mancanti: string[] = []

  for (const materia of catalogo) {
    const chiave = materiaConfrontabile(materia)
    if (!chiave || gia.has(chiave)) continue
    gia.add(chiave) // se un domani il catalogo si ritrovasse un doppione, non lo propaghiamo
    mancanti.push(materia)
  }

  return mancanti
}
