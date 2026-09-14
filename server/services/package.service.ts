import { db } from '../database/client'
import { accountingEntries, packages, packageRecharges, payments, students, lessonStudents, lessons, users, timeSlots } from '../database/schema'
import { and, asc, count, desc, eq, getTableColumns } from 'drizzle-orm'
import { oggiRomeStr, romeDateStr } from '../utils/tutor-time-window'
import { CAT } from '#shared/accounting-categories'
import { serveBollo } from '#shared/bollo'
import { calcolaDataScadenza } from '#shared/scadenza-pacchetto'
import { inCentesimi, inEuro } from '../utils/arrotondamenti'
import { registraBolloInTransazione, riferimentoBollo } from './bollo.service'
import type { CreatePackageInput, PackageQuery, RechargePackageInput, UpdatePackageInput } from '#shared/schemas/package.schema'

// ─────────────────────────────────────────────
// MARCA DA BOLLO SUL PAGAMENTO INIZIALE (F1)
//
// L'acconto che si incassa creando o ricaricando un pacchetto è un pagamento a
// tutti gli effetti: se supera 77,47 € ed è con fattura, vuole il suo bollo da 2 €.
//
// La spunta del modulo arriva come opzione a parte e non dentro i dati validati,
// perché lo schema del pacchetto (shared/schemas/package.schema.ts) è in mano a un
// altro intervento in corso e non va toccato adesso. Quando quel lavoro sarà chiuso,
// `aggiungiBollo` potrà entrare in InitialPaymentSchema e questa opzione sparire.
// Assente = bollo SÌ: sopra soglia con fattura è la regola, non l'eccezione.
// ─────────────────────────────────────────────
export type OpzioniPagamentoIniziale = { aggiungiBollo?: boolean }

// ─────────────────────────────────────────────
// MACCHINA A STATI DEI PACCHETTI
// Regole cristallizzate da DOCUMENTAZIONE_PROGETTO.md §4
// ─────────────────────────────────────────────

type PackageStatus =
  | 'ATTIVO'
  | 'DA_RINNOVARE'
  | 'SCADUTO'
  | 'ESAURITO'
  | 'DA_PAGARE'
  | 'PAGATO'
  | 'CHIUSO'
  | 'SOSPESO'

type PackageStateInput = {
  oreAcquistate: string
  oreResiduo:    string
  importoResiduo: string
  dataScadenza:  Date | null
  giorniResiduo?: number | null
  // Se true la macchina a stati restituisce sempre ['SOSPESO']: così nessun
  // percorso di scrittura (lezioni, pagamenti, ricariche) può "riattivare"
  // per errore un pacchetto sospeso sovrascrivendone gli stati.
  sospeso?: boolean | null
}

// Tolleranza centesimi per confronti floating point (evita 0.1+0.2=0.300...04)
const EPSILON = 0.001

export function computePackageStates(pkg: PackageStateInput): PackageStatus[] {
  if (pkg.sospeso) return ['SOSPESO']

  const oreResiduo    = parseFloat(pkg!.oreResiduo)
  const oreAcquistate = parseFloat(pkg!.oreAcquistate)
  const importoResiduo = parseFloat(pkg.importoResiduo)

  // Confronti per GIORNO CIVILE ITALIANO ('YYYY-MM-DD'), mai per istante: la scadenza
  // è salvata come timestamptz (a mezzanotte UTC, o a mezzanotte italiana per i dati
  // importati) e il troncamento nel fuso del server faceva scadere i pacchetti con
  // un giorno di anticipo. Il pacchetto vale TUTTO il giorno di scadenza.
  const oggiStr = oggiRomeStr()

  const stati: PackageStatus[] = []

  // REGOLA 1 — ESAURITO
  // Un pacchetto è esaurito se ha esaurito le ore, OPPURE se è mensile e ha esaurito i giorni
  if (oreResiduo <= 0 || (pkg.giorniResiduo !== undefined && pkg.giorniResiduo !== null && pkg.giorniResiduo <= 0)) {
    stati.push('ESAURITO')
  }

  // REGOLA 2 — SCADUTO
  let isScaduto = false
  if (pkg!.dataScadenza) {
    if (romeDateStr(new Date(pkg!.dataScadenza)) < oggiStr) {
      stati.push('SCADUTO')
      isScaduto = true
    }
  }

  // REGOLA 3 — ATTIVO (ore rimaste e non scaduto)
  const isEsaurito = stati.includes('ESAURITO')
  if (oreResiduo > 0 && !isScaduto) stati.push('ATTIVO')

  // REGOLA 4 — DA_RINNOVARE (solo se già ATTIVO)
  if (stati.includes('ATTIVO') && oreAcquistate > 0) {
    const percentuale = (oreResiduo / oreAcquistate) * 100

    let giorniAllaScadenza = Infinity
    if (pkg!.dataScadenza) {
      const scadenzaStr = romeDateStr(new Date(pkg!.dataScadenza))
      giorniAllaScadenza = Math.round((Date.parse(scadenzaStr) - Date.parse(oggiStr)) / (1000 * 60 * 60 * 24))
    }

    if (percentuale < 20 || giorniAllaScadenza <= 3) stati.push('DA_RINNOVARE')
  }

  // REGOLA 5 — DA_PAGARE / PAGATO (sempre uno dei due, mai entrambi)
  if (importoResiduo > EPSILON) {
    stati.push('DA_PAGARE')
  } else {
    stati.push('PAGATO')
  }

  // REGOLA 6 — CHIUSO (stato finale non modificabile: pagato + terminato)
  if (stati.includes('PAGATO') && (isScaduto || isEsaurito)) {
    stati.push('CHIUSO')
  }

  return stati
}

// Ricalcola e salva gli stati di un pacchetto nel DB.
// Chiamata da lesson.service dopo ogni scalamento ore.
export async function recomputeAndSavePackageStates(packageId: string) {
  const pkg = await getPackageById(packageId)
  if (!pkg) throw new Error(`Pacchetto ${packageId} non trovato`)

  // Se il pacchetto è sospeso, non ricalcoliamo gli stati automatici
  if (pkg.sospeso) return

  const newStati = computePackageStates({
    oreAcquistate:  pkg!.oreAcquistate,
    oreResiduo:     pkg!.oreResiduo,
    importoResiduo: pkg.importoResiduo,
    dataScadenza:   pkg!.dataScadenza,
    giorniResiduo:  pkg!.giorniResiduo,
  })

  await db.update(packages)
    .set({ stati: newStati, updatedAt: new Date() })
    .where(eq(packages.id, packageId))
}

// Helper interno: verifica e aggiorna gli stati se la data odierna li ha cambiati
async function refreshPackageStatesIfNeeded(pkg: any) {
  // Se il pacchetto è sospeso, manteniamo lo stato SOSPESO e non ricalcoliamo
  if (pkg.sospeso) {
    if (!pkg.stati?.includes('SOSPESO')) {
      const newStati: PackageStatus[] = ['SOSPESO']
      await db.update(packages).set({ stati: newStati, updatedAt: new Date() }).where(eq(packages.id, pkg.id))
      pkg.stati = newStati
    }
    return
  }

  const newStati = computePackageStates({
    oreAcquistate:  pkg.oreAcquistate,
    oreResiduo:     pkg.oreResiduo,
    importoResiduo: pkg.importoResiduo,
    dataScadenza:   pkg.dataScadenza,
    giorniResiduo:  pkg.giorniResiduo,
  })
  const oldStati = (pkg.stati as string[]) ?? []
  const same = newStati.length === oldStati.length && newStati.every(s => oldStati.includes(s))
  if (!same) {
    await db.update(packages).set({ stati: newStati, updatedAt: new Date() }).where(eq(packages.id, pkg.id))
    pkg.stati = newStati
  }
}

// ─────────────────────────────────────────────
// LIST  — GET /api/packages
// ─────────────────────────────────────────────

const STATI_VALIDI = ['ATTIVO', 'DA_RINNOVARE', 'SCADUTO', 'ESAURITO', 'DA_PAGARE', 'PAGATO', 'CHIUSO', 'SOSPESO']

export async function listPackages(query: PackageQuery) {
  const conditions = [
    query.studentId ? eq(packages.studentId, query.studentId) : undefined,
    query.tipo      ? eq(packages.tipo, query.tipo)           : undefined,
  ].filter(Boolean) as ReturnType<typeof eq>[]

  const where = conditions.length > 0 ? and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])) : undefined

  const parsedStati = (query.stati ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(s => STATI_VALIDI.includes(s))

  const selectPacchetti = () =>
    db.select({
      id: packages.id,
      studentId: packages.studentId,
      standardPackageId: packages.standardPackageId,
      nome: packages.nome,
      tipo: packages.tipo,
      oreAcquistate: packages.oreAcquistate,
      oreResiduo: packages.oreResiduo,
      orePerse: packages.orePerse,
      giorniAcquistati: packages.giorniAcquistati,
      giorniResiduo: packages.giorniResiduo,
      orarioGiornaliero: packages.orarioGiornaliero,
      tariffaOraria: packages.tariffaOraria,
      prezzoTotale: packages.prezzoTotale,
      importoPagato: packages.importoPagato,
      importoResiduo: packages.importoResiduo,
      dataInizio: packages.dataInizio,
      dataScadenza: packages.dataScadenza,
      stati: packages.stati,
      sospeso: packages.sospeso,
      note: packages.note,
      createdAt: packages.createdAt,
      updatedAt: packages.updatedAt,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
    })
      .from(packages)
      .leftJoin(students, eq(packages.studentId, students.id))
      .where(where)
      .orderBy(desc(packages.createdAt))

  // Ricalcola stati al volo per ogni pacchetto (senza scrivere nel DB in bulk)
  const conStatiFreschi = (pkg: any) => ({
    ...pkg,
    stati: computePackageStates({
      oreAcquistate:  pkg.oreAcquistate,
      oreResiduo:     pkg.oreResiduo,
      importoResiduo: pkg.importoResiduo,
      dataScadenza:   pkg.dataScadenza,
      giorniResiduo:  pkg.giorniResiduo,
      sospeso:        pkg.sospeso,
    }),
  })

  if (parsedStati.length > 0) {
    // Il filtro per stato lavora sugli stati RICALCOLATI, non sulla colonna salvata
    // (che può essere obsoleta, es. scadenza superata dopo l'ultima scrittura).
    // ponytail: fetch di tutte le righe + filtro in memoria — ok fino a qualche
    // migliaio di pacchetti; portare il calcolo stati in SQL se il volume cresce.
    const rows = (await selectPacchetti()).map(conStatiFreschi)
    const filtered = rows.filter(p => p.stati.some((s: PackageStatus) => parsedStati.includes(s)))
    const start = (query.page - 1) * query.limit
    return {
      data: filtered.slice(start, start + query.limit),
      meta: {
        page:       query.page,
        limit:      query.limit,
        total:      filtered.length,
        totalPages: Math.ceil(filtered.length / query.limit),
      },
    }
  }

  const [rows, [countRow]] = await Promise.all([
    selectPacchetti()
      .limit(query.limit)
      .offset((query.page - 1) * query.limit),
    db.select({ total: count() }).from(packages).where(where),
  ])

  return {
    data: rows.map(conStatiFreschi),
    meta: {
      page:       query.page,
      limit:      query.limit,
      total:      countRow!.total,
      totalPages: Math.ceil(countRow!.total / query.limit),
    },
  }
}

// ─────────────────────────────────────────────
// GET ONE  — GET /api/packages/:id
// ─────────────────────────────────────────────

export async function getPackageById(id: string) {
  const [pkg] = await db
    .select({
      ...getTableColumns(packages),
      studentFirstName: students.firstName,
      studentLastName:  students.lastName,
    })
    .from(packages)
    .leftJoin(students, eq(packages.studentId, students.id))
    .where(eq(packages.id, id))
    .limit(1)
  if (pkg) {
    await refreshPackageStatesIfNeeded(pkg)
  }
  return pkg ?? null
}

// ─────────────────────────────────────────────
// CREATE  — POST /api/packages
// Crea il pacchetto + eventuale pagamento iniziale nella stessa transazione atomica
// ─────────────────────────────────────────────

export async function createPackage(data: CreatePackageInput, opzioni?: OpzioniPagamentoIniziale) {
  return await db.transaction(async (tx) => {
    const importoPagato  = data.pagamentoIniziale?.importo ?? 0
    const importoResiduo = data.prezzoTotale - importoPagato

    // Data di scadenza:
    //  - MENSILE: dataInizio + 30 giorni di calendario (se non fornita esplicitamente).
    //    NON usare giorniAcquistati: quelli sono i giorni di LEZIONE compresi (es. 12),
    //    non la durata del pacchetto.
    //  - ORE / A_CONSUMO: usa quella inviata dal frontend (es. 15/06)
    let dataScadenza: Date | null = data.dataScadenza ?? null
    if (!dataScadenza && data.tipo === 'MENSILE') {
      dataScadenza = new Date(data.dataInizio)
      dataScadenza.setDate(dataScadenza.getDate() + 30)
    }

    // Calcola gli stati iniziali
    const stati = computePackageStates({
      oreAcquistate:  String(data.oreAcquistate),
      oreResiduo:     String(data.oreAcquistate),  // All'inizio residuo = acquistato
      importoResiduo: String(importoResiduo),
      dataScadenza,
      giorniResiduo:  data.giorniAcquistati ?? null,
    })

    // Inserisce il pacchetto
    const [pkg] = await tx.insert(packages).values({
      studentId:         data.studentId,
      standardPackageId: data.standardPackageId ?? null,
      nome:              data.nome,
      tipo:              data.tipo,
      oreAcquistate:     String(data.oreAcquistate),
      oreResiduo:        String(data.oreAcquistate),
      orePerse:          '0',
      giorniAcquistati:  data.giorniAcquistati  ?? null,
      giorniResiduo:     data.giorniAcquistati  ?? null,
      orarioGiornaliero: data.orarioGiornaliero ? String(data.orarioGiornaliero) : null,
      tariffaOraria:     data.tariffaOraria ? String(data.tariffaOraria) : null,
      prezzoTotale:      String(data.prezzoTotale),
      importoPagato:     String(importoPagato),
      importoResiduo:    String(importoResiduo),
      dataInizio:        data.dataInizio,
      dataScadenza,
      stati,
      sospeso: false,
      note: data.note ?? null,
    }).returning()

    // Se c'è un pagamento iniziale, lo registra + crea movimento contabile
    let initialPaymentId: string | null = null
    if (data.pagamentoIniziale && importoPagato > 0) {
      const pag = data.pagamentoIniziale

      const [payment] = await tx.insert(payments).values({
        packageId:       pkg!.id,
        importo:         String(pag.importo),
        tipoPagamento:   pag.tipoPagamento   ?? 'ACCONTO',
        metodoPagamento: pag.metodoPagamento,
        richiedeFattura: pag.richiedeFattura ?? false,
        dataPagamento:   pag.dataPagamento   ?? new Date(),
        riferimento:     pag.riferimento     ?? null,
        note:            pag.note            ?? null,
      }).returning()

      initialPaymentId = payment!.id

      await tx.insert(accountingEntries).values({
        tipo:            'ENTRATA',
        importo:         String(pag.importo),
        descrizione:     `Pagamento pacchetto: ${data.nome}`,
        categoria:       CAT.PACCHETTI,
        packageId:       pkg!.id,
        paymentId:       payment!.id,
        metodoPagamento: pag.metodoPagamento,
      })

      // Bollo dell'acconto: il nome dell'alunno serve solo per scrivere la
      // descrizione, quindi lo andiamo a prendere solo se il bollo serve davvero.
      if (opzioni?.aggiungiBollo !== false && serveBollo(pag.importo, pag.richiedeFattura ?? false)) {
        const [studente] = await tx
          .select({ firstName: students.firstName, lastName: students.lastName })
          .from(students)
          .where(eq(students.id, data.studentId))
          .limit(1)

        await registraBolloInTransazione(tx, {
          paymentId:       payment!.id,
          packageId:       pkg!.id,
          importoPagato:   pag.importo,
          richiedeFattura: pag.richiedeFattura ?? false,
          metodoPagamento: pag.metodoPagamento,
          data:            pag.dataPagamento ?? new Date(),
          riferimento:     riferimentoBollo(`${studente?.firstName ?? ''} ${studente?.lastName ?? ''}`, data.nome),
        })
      }
    }

    // Per i pacchetti A_CONSUMO la creazione è la PRIMA ricarica: la registriamo nel libretto
    if (data.tipo === 'A_CONSUMO' && data.tariffaOraria) {
      await tx.insert(packageRecharges).values({
        packageId:     pkg!.id,
        ore:           String(data.oreAcquistate),
        tariffaOraria: String(data.tariffaOraria),
        importo:       String(data.prezzoTotale),
        data:          data.dataInizio,
        paymentId:     initialPaymentId,
        note:          'Ricarica iniziale (creazione pacchetto)',
      })
    }

    return pkg
  })
}

// ─────────────────────────────────────────────
// UPDATE  — PUT /api/packages/:id
// Non permette modifiche se il pacchetto è CHIUSO
// Ricalcola gli stati dopo ogni modifica
// ─────────────────────────────────────────────

export async function updatePackage(id: string, data: UpdatePackageInput) {
  const existing = await getPackageById(id)
  if (!existing) return null

  if (existing.stati.includes('CHIUSO')) {
    throw new Error('Impossibile modificare un pacchetto nello stato CHIUSO')
  }

  const changes: Record<string, unknown> = { updatedAt: new Date() }

  // Il nome NON è mai modificabile: deriva sempre dal pacchetto standard (Impostazioni)
  if (data.tipo              !== undefined) changes.tipo              = data.tipo
  if (data.oreAcquistate     !== undefined) changes.oreAcquistate     = String(data.oreAcquistate)
  if (data.prezzoTotale      !== undefined) changes.prezzoTotale      = String(data.prezzoTotale)
  if (data.dataInizio        !== undefined) changes.dataInizio        = data.dataInizio
  if (data.dataScadenza      !== undefined) changes.dataScadenza      = data.dataScadenza ?? null
  if (data.giorniAcquistati  !== undefined) changes.giorniAcquistati  = data.giorniAcquistati ?? null
  if (data.orarioGiornaliero !== undefined) changes.orarioGiornaliero = data.orarioGiornaliero ? String(data.orarioGiornaliero) : null
  if (data.standardPackageId !== undefined) changes.standardPackageId = data.standardPackageId ?? null
  if (data.note              !== undefined) changes.note              = data.note ?? null
  if (data.sospeso           !== undefined) changes.sospeso           = data.sospeso

  // Ricalcola oreResiduo se cambia oreAcquistate
  if (data.oreAcquistate !== undefined) {
    const oldOre = parseFloat(existing.oreAcquistate)
    const diff = data.oreAcquistate - oldOre
    const newResiduo = Math.max(0, parseFloat(existing.oreResiduo) + diff)
    changes.oreResiduo = String(newResiduo)
    changes.avvisoOreInviatoAt = null // ore cambiate: l'avviso email torna eleggibile
  }
  if (data.dataScadenza !== undefined) {
    changes.avvisoScadenzaInviatoAt = null // scadenza cambiata: l'avviso email torna eleggibile
  }

  // Ricalcola giorniResiduo se cambia giorniAcquistati
  if (data.giorniAcquistati != null) {
    const oldGiorni = Number(existing.giorniAcquistati ?? 0)
    const diff = data.giorniAcquistati - oldGiorni
    const currentResiduo = Number(existing.giorniResiduo ?? existing.giorniAcquistati ?? 0)
    const newResiduo = Math.max(0, currentResiduo + diff)
    changes.giorniResiduo = newResiduo
  }

  // Ricalcola importoResiduo se cambia il prezzo totale (importoPagato resta invariato)
  const nuovoPrezzoTotale = data.prezzoTotale !== undefined
    ? data.prezzoTotale
    : parseFloat(existing.prezzoTotale)
  const importoPagato = parseFloat(existing.importoPagato)
  const nuovoImportoResiduo = Math.max(0, nuovoPrezzoTotale - importoPagato)
  changes.importoResiduo = String(nuovoImportoResiduo)

  // Giorni residui: se cambia giorniAcquistati lo aggiorniamo, altrimenti manteniamo l'esistente
  const nuoviGiorniResiduo = data.giorniAcquistati != null
    ? (changes.giorniResiduo as number | undefined) ?? existing.giorniResiduo
    : existing.giorniResiduo

  // Ricalcola SEMPRE gli stati con i valori finali (sospeso incluso): la macchina
  // a stati restituisce ['SOSPESO'] da sola se il flag finale è true.
  changes.stati = computePackageStates({
    oreAcquistate:  (changes.oreAcquistate as string | undefined) ?? existing.oreAcquistate,
    oreResiduo:     (changes.oreResiduo as string | undefined) ?? existing.oreResiduo,
    importoResiduo: String(nuovoImportoResiduo),
    dataScadenza:   (changes.dataScadenza as Date | null | undefined) !== undefined
      ? (changes.dataScadenza as Date | null)
      : existing.dataScadenza,
    giorniResiduo:  nuoviGiorniResiduo,
    sospeso:        data.sospeso ?? existing.sospeso,
  })

  const [updated] = await db.update(packages)
    .set(changes as Partial<typeof packages.$inferInsert>)
    .where(eq(packages.id, id))
    .returning()

  return updated ?? null
}

// ─────────────────────────────────────────────
// RICARICA — POST /api/packages/:id/recharge
// Aggiunge ore a un pacchetto A_CONSUMO + costo + (opzionale) pagamento.
// Tutto in una transazione atomica. Aggiorna il libretto e ricalcola gli stati.
// ─────────────────────────────────────────────

export async function rechargePackage(id: string, data: RechargePackageInput, opzioni?: OpzioniPagamentoIniziale) {
  return await db.transaction(async (tx) => {
    const [pkg] = await tx.select().from(packages).where(eq(packages.id, id)).limit(1)
    if (!pkg) throw new Error('Pacchetto non trovato')
    if (pkg.tipo !== 'A_CONSUMO') throw new Error('Solo i pacchetti a consumo possono essere ricaricati')

    // NIENTE blocco su CHIUSO (decisione Q24 del 14/09/2026).
    //
    // Un libretto che finisce le ore e viene saldato diventa da solo ESAURITO + PAGATO
    // + CHIUSO: la macchina a stati chiude tutti i pacchetti così. Ma per il libretto
    // quel momento è esattamente il momento della ricarica — è una tessera del
    // telefono, non un abbonamento che scade. Il vecchio controllo spegneva il tasto
    // "Ricarica" proprio quando serviva, mentre "Modifica pacchetto" (upgrade) le ore
    // le aggiungeva lo stesso: due tasti per la stessa cosa con regole opposte.
    // Qui non serve filtrare per tipo: la riga sopra ha già scartato tutto ciò che non
    // è A_CONSUMO, quindi il blocco su CHIUSO resta intatto per gli altri pacchetti
    // (updatePackage continua a rifiutarli).

    const tariffa = data.tariffaOraria ?? parseFloat(pkg!.tariffaOraria ?? '0')
    const importoRicarica = data.importo

    // Se c'è un pagamento iniziale parziale o totale
    const pag = data.pagamentoIniziale
    const paga = !!pag && pag.importo > 0
    const pagatoAggiunto = paga ? pag.importo : 0

    // Nuovi totali
    const nuovaOreAcquistate = parseFloat(pkg!.oreAcquistate) + data.ore
    const nuovaOreResiduo    = parseFloat(pkg!.oreResiduo)    + data.ore
    const nuovoPrezzoTotale  = parseFloat(pkg!.prezzoTotale)  + importoRicarica
    const nuovoImportoPagato = parseFloat(pkg!.importoPagato) + pagatoAggiunto
    const nuovoImportoResiduo = nuovoPrezzoTotale - nuovoImportoPagato

    // Pagamento opzionale + movimento contabile
    let paymentId: string | null = null
    if (paga) {
      const [payment] = await tx.insert(payments).values({
        packageId:       pkg!.id,
        importo:         String(pag.importo),
        tipoPagamento:   pag.tipoPagamento ?? 'INTEGRAZIONE',
        metodoPagamento: pag.metodoPagamento,
        richiedeFattura: pag.richiedeFattura ?? false,
        dataPagamento:   pag.dataPagamento ?? data.data,
        riferimento:     pag.riferimento ?? null,
        note:            pag.note ?? null,
      }).returning()
      paymentId = payment!.id

      await tx.insert(accountingEntries).values({
        tipo:            'ENTRATA',
        importo:         String(pag.importo),
        descrizione:     `Ricarica pacchetto: ${pkg!.nome}`,
        categoria:       CAT.PACCHETTI,
        packageId:       pkg!.id,
        paymentId:       payment!.id,
        metodoPagamento: pag.metodoPagamento,
      })

      // Anche la ricarica è un incasso: sopra 77,47 € con fattura vuole il suo bollo.
      if (opzioni?.aggiungiBollo !== false && serveBollo(pag.importo, pag.richiedeFattura ?? false)) {
        const [studente] = await tx
          .select({ firstName: students.firstName, lastName: students.lastName })
          .from(students)
          .where(eq(students.id, pkg!.studentId))
          .limit(1)

        await registraBolloInTransazione(tx, {
          paymentId:       payment!.id,
          packageId:       pkg!.id,
          importoPagato:   pag.importo,
          richiedeFattura: pag.richiedeFattura ?? false,
          metodoPagamento: pag.metodoPagamento,
          data:            pag.dataPagamento ?? data.data,
          riferimento:     riferimentoBollo(`${studente?.firstName ?? ''} ${studente?.lastName ?? ''}`, pkg!.nome),
        })
      }
    }

    // Riga nel libretto delle ricariche
    await tx.insert(packageRecharges).values({
      packageId:     pkg!.id,
      ore:           String(data.ore),
      tariffaOraria: String(tariffa),
      importo:       String(importoRicarica),
      data:          data.data,
      paymentId,
      note:          data.note ?? null,
    })

    // La ricarica riapre anche la SCADENZA, se era gia' passata.
    //
    // Togliere il blocco su CHIUSO non basta da solo: il libretto nasce con una
    // scadenza (il 15 giugno di fine anno scolastico, shared/scadenza-pacchetto.ts).
    // Con le ore azzerate lo stato torna ATTIVO appena si ricarica, ma se la data era
    // gia' passata il pacchetto resta SCADUTO -> e quindi di nuovo CHIUSO: la famiglia
    // paga, le ore entrano, e poi createLesson si rifiuta di scalarle perche' il
    // pacchetto risulta scaduto. Soldi presi e ore inutilizzabili: il caso peggiore.
    // Quindi: se al momento della ricarica la scadenza e' alle spalle, la si sposta al
    // prossimo 15 giugno. Non accorcia mai niente (si tocca solo una data gia' passata)
    // e vale solo per il libretto, che e' l'unico pacchetto che si ricarica.
    const scadenzaAttualeStr = pkg!.dataScadenza ? romeDateStr(new Date(pkg!.dataScadenza)) : null
    const dataRicaricaStr    = romeDateStr(new Date(data.data))
    let nuovaDataScadenza    = pkg!.dataScadenza
    if (scadenzaAttualeStr && scadenzaAttualeStr < dataRicaricaStr) {
      const prossima = calcolaDataScadenza('A_CONSUMO', dataRicaricaStr)
      if (prossima) nuovaDataScadenza = new Date(prossima)
    }

    // Ricalcola gli stati con i nuovi valori
    const nuoviStati = computePackageStates({
      oreAcquistate:  String(nuovaOreAcquistate),
      oreResiduo:     String(nuovaOreResiduo),
      importoResiduo: String(nuovoImportoResiduo),
      dataScadenza:   nuovaDataScadenza,
      sospeso:        pkg!.sospeso,
    })

    // Aggiorna il pacchetto
    const [updated] = await tx.update(packages).set({
      oreAcquistate:  String(nuovaOreAcquistate),
      oreResiduo:     String(nuovaOreResiduo),
      prezzoTotale:   String(nuovoPrezzoTotale),
      importoPagato:  String(nuovoImportoPagato),
      importoResiduo: String(nuovoImportoResiduo),
      dataScadenza:   nuovaDataScadenza,
      stati:          nuoviStati,
      // Ricarica: gli avvisi email tornano eleggibili
      avvisoOreInviatoAt:      null,
      avvisoScadenzaInviatoAt: null,
      updatedAt:      new Date(),
    }).where(eq(packages.id, pkg!.id)).returning()

    return updated
  })
}

// Restituisce lo storico ricariche di un pacchetto (più recenti in cima)
export async function getPackageRecharges(packageId: string) {
  return await db
    .select()
    .from(packageRecharges)
    .where(eq(packageRecharges.packageId, packageId))
    .orderBy(desc(packageRecharges.data))
}

// ─────────────────────────────────────────────
// ESTRATTO CONTO DEL LIBRETTO — GET /api/packages/:id/estratto-conto
// (decisione Q25 del 14/09/2026)
//
// Il libretto è un salvadanaio di ore: le ricariche lo riempiono, le lezioni lo
// svuotano. Finora la finestra "Libretto" mostrava solo metà della storia — le
// ricariche — e il conto non si poteva rifare a mano. Qui le due metà tornano
// insieme in un elenco unico, in ordine di data, con il saldo dopo ogni riga:
// esattamente come l'estratto conto della banca.
//
// Due scelte che vale la pena di spiegare:
//
// 1) le ore consumate NON si danno per scontate a 1 per lezione. Il valore vero è
//    quello scritto in `lesson_students.ore_scalate` al momento della lezione: oggi
//    createLesson ci mette sempre 1.0, ma i dati importati dal vecchio gestionale
//    possono avere altro, e se un giorno la regola cambierà l'estratto conto resterà
//    giusto senza che nessuno debba ricordarsi di venirlo a correggere qui.
//
// 2) le ore si sommano in CENTESIMI INTERI (regola F3, server/utils/arrotondamenti.ts).
//    Sono numeric(10,2) come gli euro e soffrono lo stesso difetto della virgola:
//    sommate una per una in JavaScript produrrebbero saldi tipo 8,999999999996.
// ─────────────────────────────────────────────

/** Una riga dell'estratto conto: o una ricarica (+ore) o una lezione (−ore). */
export type VoceLibretto = {
  id:          string
  tipo:        'RICARICA' | 'LEZIONE'
  data:        string   // giorno civile 'YYYY-MM-DD'
  ore:         number   // positivo per le ricariche, negativo per le lezioni
  saldo:       number   // saldo DOPO questa riga
  descrizione: string
  dettaglio:   string
  importo:     number | null   // solo ricariche
  pagata:      boolean | null  // solo ricariche: c'è un pagamento collegato?
}

export type EstrattoContoLibretto = {
  pacchetto: {
    id:            string
    nome:          string
    studente:      string
    tariffaOraria: number | null
    dataInizio:    Date
    dataScadenza:  Date | null
    stati:         string[]
    oreResiduo:    number
  }
  periodo:          { dal: string | null, al: string | null }
  voci:             VoceLibretto[]
  totaleRicaricate: number
  totaleConsumate:  number
  saldoFinale:      number   // quello che dice l'elenco
  saldoPacchetto:   number   // quello che dice packages.ore_residuo
  differenza:       number   // saldoFinale − saldoPacchetto (0 = tutto torna)
  avviso:           string | null
}

/** Ore scritte all'italiana ("9,5"), per i messaggi che legge la segreteria. */
function oreIt(n: number): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}

export async function getEstrattoContoLibretto(packageId: string): Promise<EstrattoContoLibretto> {
  const pkg = await getPackageById(packageId)
  if (!pkg) throw new Error('Pacchetto non trovato')
  if (pkg.tipo !== 'A_CONSUMO') {
    throw new Error(
      `L'estratto conto delle ore esiste solo per il libretto (pacchetto A CONSUMO). "${pkg.nome}" è un pacchetto ${pkg.tipo}: le sue ore sono comprate tutte all'inizio, non ci sono ricariche da mettere in fila.`,
    )
  }

  // Le due metà della storia, ciascuna dalla sua tabella
  const ricariche = await db
    .select()
    .from(packageRecharges)
    .where(eq(packageRecharges.packageId, packageId))
    .orderBy(asc(packageRecharges.data))

  const consumi = await db
    .select({
      id:             lessonStudents.id,
      oreScalate:     lessonStudents.oreScalate,
      createdAt:      lessonStudents.createdAt,
      data:           lessons.data,
      mezzaLezione:   lessons.mezzaLezione,
      tutorFirstName: users.firstName,
      tutorLastName:  users.lastName,
      oraInizio:      timeSlots.oraInizio,
      oraFine:        timeSlots.oraFine,
    })
    .from(lessonStudents)
    .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
    .innerJoin(users, eq(lessons.tutorId, users.id))
    .leftJoin(timeSlots, eq(lessons.timeSlotId, timeSlots.id))
    .where(eq(lessonStudents.packageId, packageId))
    .orderBy(asc(lessons.data))

  // Righe grezze, ancora senza saldo. `ordine` serve solo a decidere chi viene prima
  // a parità di giorno: la ricarica prima del consumo, perché nella realtà si paga e
  // poi si usa — altrimenti il saldo del giorno stesso comparirebbe negativo.
  type Grezza = Omit<VoceLibretto, 'saldo'> & { ordine: number, creata: number }

  const grezze: Grezza[] = []

  for (const r of ricariche) {
    const ore     = parseFloat(r.ore)
    const importo = parseFloat(r.importo)
    const tariffa = parseFloat(r.tariffaOraria)
    grezze.push({
      id:          r.id,
      tipo:        'RICARICA',
      data:        romeDateStr(new Date(r.data)),
      ore,
      descrizione: r.note?.trim() || 'Ricarica',
      dettaglio:   `${oreIt(ore)} ore a € ${tariffa.toFixed(2)}/h`,
      importo,
      pagata:      !!r.paymentId,
      ordine:      0,
      creata:      new Date(r.createdAt).getTime(),
    })
  }

  for (const c of consumi) {
    // Il valore che il database ha DAVVERO registrato, non "1 ora" dato per scontato
    const ore    = parseFloat(c.oreScalate)
    const orario = c.oraInizio && c.oraFine ? `${c.oraInizio}–${c.oraFine}` : null
    const pezzi  = [
      `tutor ${c.tutorFirstName ?? ''} ${c.tutorLastName ?? ''}`.trim(),
      orario,
      c.mezzaLezione ? 'mezza lezione' : null,
    ].filter(Boolean) as string[]
    grezze.push({
      id:          c.id,
      tipo:        'LEZIONE',
      data:        c.data,
      ore:         -ore,
      descrizione: 'Lezione',
      dettaglio:   pezzi.join(' · '),
      importo:     null,
      pagata:      null,
      ordine:      1,
      creata:      new Date(c.createdAt).getTime(),
    })
  }

  grezze.sort((a, b) =>
    a.data.localeCompare(b.data) || (a.ordine - b.ordine) || (a.creata - b.creata),
  )

  // Saldo progressivo in centesimi di ora (interi: niente code decimali)
  let saldoCent      = 0
  let ricaricateCent = 0
  let consumateCent  = 0

  const voci: VoceLibretto[] = grezze.map(({ ordine: _ordine, creata: _creata, ...v }) => {
    const cent = inCentesimi(v.ore)
    saldoCent += cent
    if (cent >= 0) ricaricateCent += cent
    else consumateCent -= cent
    return { ...v, saldo: inEuro(saldoCent) }
  })

  // ⚠️ Il controllo che rende onesto il documento: il saldo dell'elenco deve
  // coincidere con packages.ore_residuo, che è il numero su cui lavora tutto il resto
  // del gestionale. Se i due non coincidono NON si aggiusta niente di nascosto: si
  // scrive a chiare lettere che c'è una differenza. Un conto che non torna e lo dice
  // è utile; un conto che non torna e tace è un danno.
  const saldoFinale    = inEuro(saldoCent)
  const saldoPacchetto = parseFloat(pkg.oreResiduo)
  const differenza     = inEuro(saldoCent - inCentesimi(saldoPacchetto))

  const avviso = differenza === 0
    ? null
    : `Attenzione: questo elenco chiude a ${oreIt(saldoFinale)} ore, ma il pacchetto ne registra ${oreIt(saldoPacchetto)} — differenza di ${oreIt(Math.abs(differenza))} ${Math.abs(differenza) === 1 ? 'ora' : 'ore'}. Le ore buone sono quelle del pacchetto: prima di consegnare questo foglio alla famiglia, fai verificare il conto in segreteria.`

  return {
    pacchetto: {
      id:            pkg.id,
      nome:          pkg.nome,
      studente:      `${pkg.studentFirstName ?? ''} ${pkg.studentLastName ?? ''}`.trim(),
      tariffaOraria: pkg.tariffaOraria ? parseFloat(pkg.tariffaOraria) : null,
      dataInizio:    pkg.dataInizio,
      dataScadenza:  pkg.dataScadenza,
      stati:         pkg.stati,
      oreResiduo:    saldoPacchetto,
    },
    periodo: {
      dal: voci[0]?.data ?? null,
      al:  voci[voci.length - 1]?.data ?? null,
    },
    voci,
    totaleRicaricate: inEuro(ricaricateCent),
    totaleConsumate:  inEuro(consumateCent),
    saldoFinale,
    saldoPacchetto,
    differenza,
    avviso,
  }
}


// ─────────────────────────────────────────────
// DELETE — DELETE /api/packages/:id
// Un pacchetto si può eliminare SOLO se non ha pagamenti né lezioni collegate
// (altrimenti si perderebbe lo storico di soldi/ore reali già movimentati).
// ─────────────────────────────────────────────

export async function deletePackage(id: string) {
  const [pkg] = await db.select().from(packages).where(eq(packages.id, id)).limit(1)
  if (!pkg) throw new Error('Pacchetto non trovato')

  const [rowPagamenti] = await db.select({ n: count() }).from(payments).where(eq(payments.packageId, id))
  const [rowLezioni]   = await db.select({ n: count() }).from(lessonStudents).where(eq(lessonStudents.packageId, id))
  const numPagamenti = rowPagamenti?.n ?? 0
  const numLezioni   = rowLezioni?.n ?? 0

  if (numPagamenti > 0 || numLezioni > 0) {
    throw new Error(`Impossibile eliminare: il pacchetto ha ${numPagamenti} pagamento/i e ${numLezioni} lezione/i collegate.`)
  }

  await db.delete(packages).where(eq(packages.id, id))
  return { ok: true }
}
