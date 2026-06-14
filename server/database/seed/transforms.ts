/**
 * Decodificatori di campo (da stringa COPY → tipo atteso da Drizzle) e
 * trasformazioni riga-vecchia → oggetto pronto per db.insert, una per tabella.
 */

/** timestamp senza fuso ("2026-01-09 16:57:43.785") → Date, preservando il valore a parete (UTC). */
export function toDate(v: string | null): Date | null {
  if (v === null) return null
  return new Date(v.replace(' ', 'T') + 'Z')
}

/** Variante non-null per colonne NOT NULL (lancia se manca, così l'errore è esplicito). */
export function toDateReq(v: string | null): Date {
  const d = toDate(v)
  if (d === null) throw new Error('Timestamp obbligatorio mancante')
  return d
}

/** 't'/'f' → boolean. */
export function toBool(v: string | null): boolean {
  return v === 't'
}

/** Letterale array PostgreSQL "{Matematica,Fisica}" → ['Matematica','Fisica']. */
export function toArray(v: string | null): string[] {
  if (v === null || v === '{}') return []
  const inner = v.replace(/^\{|\}$/g, '')
  if (inner === '') return []
  // gestisce elementi opzionalmente racchiusi tra virgolette doppie
  return inner.match(/"([^"]*)"|[^,]+/g)?.map((e) => e.replace(/^"|"$/g, '')) ?? []
}

type Row = Record<string, string | null>

/**
 * Lo schema nuovo ha spostato `mezzaLezione` da lesson_students (per studente) a lessons (per lezione).
 * Costruiamo lessonId → true se almeno uno studente di quella lezione era a mezza lezione.
 */
export function buildMezzaLezioneMap(lessonStudents: Row[]): Map<string, boolean> {
  const m = new Map<string, boolean>()
  for (const r of lessonStudents) {
    const id = r.lessonId!
    if (toBool(r.mezzaLezione)) m.set(id, true)
    else if (!m.has(id)) m.set(id, false)
  }
  return m
}

export const tx = {
  users: (r: Row) => ({
    id: r.id!, email: r.email!, password: r.password ?? '',
    firstName: r.firstName!, lastName: r.lastName!,
    role: r.role as any, phone: r.phone,
    active: toBool(r.active), createdAt: toDateReq(r.createdAt), updatedAt: toDateReq(r.updatedAt),
  }),

  tutor_profiles: (r: Row) => ({
    id: r.id!, userId: r.userId!,
    indirizzo: r.indirizzo, citta: r.citta, cap: r.cap,
    codiceFiscale: r.codiceFiscale, partitaIva: r.partitaIva,
    materie: toArray(r.materie), noteInterne: r.noteInterne,
    modalitaPagamento: 'ORE' as const, importoForfait: null,
    createdAt: toDateReq(r.createdAt), updatedAt: toDateReq(r.updatedAt),
  }),

  students: (r: Row) => ({
    id: r.id!, firstName: r.firstName!, lastName: r.lastName!,
    classe: r.classe, scuola: r.scuola,
    studentPhone: r.studentPhone, studentEmail: r.studentEmail,
    parentName: r.parentName, parentEmail: r.parentEmail, parentPhone: r.parentPhone,
    parentIndirizzo: r.parentIndirizzo, parentCitta: r.parentCitta, parentCap: r.parentCap,
    parentCF: r.parentCF, parentPIva: r.parentPIva,
    active: toBool(r.active), note: r.note, bisogniSpeciali: r.bisogniSpeciali,
    portalUserId: null, abilitatoPrenotazioneOnline: false,
    createdAt: toDateReq(r.createdAt), updatedAt: toDateReq(r.updatedAt),
  }),

  student_referrals: (r: Row) => ({
    id: r.id!, referredId: r.referredId!, referrerId: r.referrerId!,
    createdAt: toDateReq(r.createdAt),
  }),

  standard_packages: (r: Row) => ({
    id: r.id!, nome: r.nome!, descrizione: r.descrizione,
    tipo: r.tipo as any, categoria: r.categoria!,
    oreIncluse: r.oreIncluse!, giorniInclusi: r.giorniInclusi === null ? null : Number(r.giorniInclusi),
    orarioGiornaliero: r.orarioGiornaliero, prezzoStandard: r.prezzoStandard!,
    tariffaOraria: null, active: toBool(r.active),
    createdAt: toDateReq(r.createdAt), updatedAt: toDateReq(r.updatedAt),
  }),

  packages: (r: Row) => ({
    id: r.id!, studentId: r.studentId!, standardPackageId: r.standardPackageId,
    nome: r.nome!, tipo: r.tipo as any,
    oreAcquistate: r.oreAcquistate!, oreResiduo: r.oreResiduo!, orePerse: r.orePerse ?? '0',
    giorniAcquistati: r.giorniAcquistati === null ? null : Number(r.giorniAcquistati),
    giorniResiduo: r.giorniResiduo === null ? null : Number(r.giorniResiduo),
    orarioGiornaliero: r.orarioGiornaliero, tariffaOraria: null,
    prezzoTotale: r.prezzoTotale!, importoPagato: r.importoPagato ?? '0', importoResiduo: r.importoResiduo!,
    dataInizio: toDateReq(r.dataInizio), dataScadenza: toDate(r.dataScadenza),
    stati: toArray(r.stati) as any, note: r.note,
    createdAt: toDateReq(r.createdAt), updatedAt: toDateReq(r.updatedAt),
  }),

  payments: (r: Row) => ({
    id: r.id!, packageId: r.packageId!, importo: r.importo!,
    tipoPagamento: r.tipoPagamento as any, metodoPagamento: r.metodoPagamento as any,
    richiedeFattura: toBool(r.richiedeFattura), dataPagamento: toDateReq(r.dataPagamento),
    riferimento: r.riferimento, note: r.note,
    createdAt: toDateReq(r.createdAt), updatedAt: toDateReq(r.updatedAt),
  }),

  time_slots: (r: Row) => ({
    id: r.id!, oraInizio: r.oraInizio!, oraFine: r.oraFine!, descrizione: r.descrizione,
    active: toBool(r.active), createdAt: toDateReq(r.createdAt), updatedAt: toDateReq(r.updatedAt),
  }),

  lessons: (r: Row, mezza: Map<string, boolean>) => ({
    id: r.id!, tutorId: r.tutorId!, timeSlotId: r.timeSlotId!,
    data: toDateReq(r.data), tipo: r.tipo as any,
    mezzaLezione: mezza.get(r.id!) ?? false, forzaGruppo: toBool(r.forzaGruppo),
    compensoTutor: r.compensoTutor, note: r.note,
    createdAt: toDateReq(r.createdAt), updatedAt: toDateReq(r.updatedAt),
  }),

  lesson_students: (r: Row) => ({
    id: r.id!, lessonId: r.lessonId!, studentId: r.studentId!, packageId: r.packageId!,
    oreScalate: r.oreScalate ?? '1.0', createdAt: toDateReq(r.createdAt),
  }),

  accounting_entries: (r: Row) => ({
    id: r.id!, tipo: r.tipo as any, importo: r.importo!, descrizione: r.descrizione!,
    categoria: r.categoria, data: toDateReq(r.data),
    packageId: r.packageId, lessonId: r.lessonId,
    paymentId: r.paymentId, tutorPaymentId: r.tutorPaymentId, reimbursementId: r.reimbursementId,
    metodoPagamento: r.metodoPagamento as any, fatturaEmessa: toBool(r.fatturaEmessa), note: r.note,
    createdAt: toDateReq(r.createdAt), updatedAt: toDateReq(r.updatedAt),
  }),

  tutor_payments: (r: Row) => ({
    id: r.id!, tutorId: r.tutorId!, mese: toDateReq(r.mese), importo: r.importo!,
    dataPagamento: toDateReq(r.dataPagamento), metodo: r.metodo as any, status: r.status as any,
    note: r.note, createdAt: toDateReq(r.createdAt), updatedAt: toDateReq(r.updatedAt),
  }),

  tutor_reimbursements: (r: Row) => ({
    id: r.id!, tutorId: r.tutorId!, importo: r.importo!, importoPagato: r.importoPagato ?? '0',
    descrizione: r.descrizione!, dataRichiesta: toDateReq(r.dataRichiesta), dataPagamento: toDate(r.dataPagamento),
    stato: r.stato as any, metodo: r.metodo as any, note: r.note,
    createdAt: toDateReq(r.createdAt), updatedAt: toDateReq(r.updatedAt),
  }),

  tutor_availabilities: (r: Row) => ({
    id: r.id!, userId: r.userId!, date: toDateReq(r.date), notes: r.notes,
    createdAt: toDateReq(r.createdAt),
  }),

  closure_dates: (r: Row) => ({
    id: r.id!, date: toDateReq(r.date), description: r.description, createdAt: toDateReq(r.createdAt),
  }),

  system_configs: (r: Row) => ({
    id: r.id!, key: r.key!, value: r.value!, description: r.description, category: r.category,
    createdAt: toDateReq(r.createdAt), updatedAt: toDateReq(r.updatedAt),
  }),
}
