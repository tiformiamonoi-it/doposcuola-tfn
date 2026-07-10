import { db } from '../database/client'
import { accountingEntries, packages, packageRecharges, payments, students, lessonStudents } from '../database/schema'
import { and, count, desc, eq, getTableColumns } from 'drizzle-orm'
import type { CreatePackageInput, PackageQuery, RechargePackageInput, UpdatePackageInput } from '../../shared/schemas/package.schema'

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

  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)

  const stati: PackageStatus[] = []

  // REGOLA 1 — ESAURITO
  // Un pacchetto è esaurito se ha esaurito le ore, OPPURE se è mensile e ha esaurito i giorni
  if (oreResiduo <= 0 || (pkg.giorniResiduo !== undefined && pkg.giorniResiduo !== null && pkg.giorniResiduo <= 0)) {
    stati.push('ESAURITO')
  }

  // REGOLA 2 — SCADUTO
  let isScaduto = false
  if (pkg!.dataScadenza) {
    const scadenza = new Date(pkg!.dataScadenza)
    scadenza.setHours(0, 0, 0, 0)
    if (scadenza < oggi) {
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
      const scadenza = new Date(pkg!.dataScadenza)
      scadenza.setHours(0, 0, 0, 0)
      giorniAllaScadenza = Math.ceil((scadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24))
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

export async function createPackage(data: CreatePackageInput) {
  return await db.transaction(async (tx) => {
    const importoPagato  = data.pagamentoIniziale?.importo ?? 0
    const importoResiduo = data.prezzoTotale - importoPagato

    // Data di scadenza:
    //  - MENSILE: calcolata da dataInizio + giorni (se non fornita esplicitamente)
    //  - ORE / A_CONSUMO: usa quella inviata dal frontend (es. 15/06)
    let dataScadenza: Date | null = data.dataScadenza ?? null
    if (!dataScadenza && data.tipo === 'MENSILE' && data.giorniAcquistati) {
      dataScadenza = new Date(data.dataInizio)
      dataScadenza.setDate(dataScadenza.getDate() + data.giorniAcquistati)
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
        categoria:       'pacchetti',
        packageId:       pkg!.id,
        paymentId:       payment!.id,
        metodoPagamento: pag.metodoPagamento,
      })
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

export async function rechargePackage(id: string, data: RechargePackageInput) {
  return await db.transaction(async (tx) => {
    const [pkg] = await tx.select().from(packages).where(eq(packages.id, id)).limit(1)
    if (!pkg) throw new Error('Pacchetto non trovato')
    if (pkg.tipo !== 'A_CONSUMO') throw new Error('Solo i pacchetti a consumo possono essere ricaricati')
    if (pkg.stati.includes('CHIUSO')) throw new Error('Impossibile ricaricare un pacchetto CHIUSO')

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
        categoria:       'pacchetti',
        packageId:       pkg!.id,
        paymentId:       payment!.id,
        metodoPagamento: pag.metodoPagamento,
      })
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

    // Ricalcola gli stati con i nuovi valori
    const nuoviStati = computePackageStates({
      oreAcquistate:  String(nuovaOreAcquistate),
      oreResiduo:     String(nuovaOreResiduo),
      importoResiduo: String(nuovoImportoResiduo),
      dataScadenza:   pkg!.dataScadenza,
      sospeso:        pkg!.sospeso,
    })

    // Aggiorna il pacchetto
    const [updated] = await tx.update(packages).set({
      oreAcquistate:  String(nuovaOreAcquistate),
      oreResiduo:     String(nuovaOreResiduo),
      prezzoTotale:   String(nuovoPrezzoTotale),
      importoPagato:  String(nuovoImportoPagato),
      importoResiduo: String(nuovoImportoResiduo),
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
