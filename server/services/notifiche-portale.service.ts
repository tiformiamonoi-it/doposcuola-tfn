// LE NOTIFICHE DEL PORTALE FAMIGLIE (piano del 16/11/2026, sezione D).
//
// Niente tabella e niente postino: le voci si CALCOLANO al volo, a ogni apertura, da
// cose che esistono già (note, prenotazioni, comunicazioni, card, pacchetti,
// convenzioni, pagamenti). Non c'è niente da creare, consegnare o cancellare.
//
// "LETTE" è una data sola per persona, users.notifiche_viste_at: ogni voce più
// vecchia di quella data è letta, "Segna tutte come lette" la porta ad adesso.
// Per questo ogni voce ha UNA data, e per le voci calcolate (B, D, E, F) bisogna
// sceglierne una sensata: è spiegato voce per voce qui sotto.
//
// CHI VEDE COSA (tabella D del piano):
//   B domani lezione · C comunicazione · D card in sospensione ·
//   E card sospesa · G nuova convenzione       → genitore e studente
//   A nota · F pacchetto in scadenza · H pagamento → solo genitore
// PRIVACY ECONOMICA: allo STUDENTE non arrivano né F né H, e D/E non dicono mai il
// perché ("da saldare", "scaduto"): solo "chiedi in segreteria", come la pagina Card.
// Le voci escluse non vengono nemmeno calcolate, così non escono dal server.
//
// MAI IL NOME DEL TUTOR (deciso): la voce di una nota dice di chi parla, non chi l'ha
// scritta. Il testo arriva da getPortalNotes, che già firma "Segreteria"; qui la firma
// non viaggia proprio.
import { and, arrayContains, eq, gte, inArray, lte, not } from 'drizzle-orm'
import { db } from '../database/client'
import { bookings, bookingSubjects, packages, payments, students, users } from '../database/schema'
import { getPortalNotes } from './portal.service'
import { comunicazioniDelGenitore } from './comunicazioni.service'
import { statoCardStudenti } from './card.service'
import { motiviRinnovo } from './package.service'
import { pagamentiPortaleAttivi } from './pagamenti-portale.service'
import { convenzioniValide } from './convenzioni.service'
import { getPortalStudentIds } from '../utils/portal'
import { inizioGiornoRome, oggiRomeStr, romeDateStr } from '../utils/tutor-time-window'
import { aggiungiGiorni, giornoSuccessivo } from '#shared/giorno-civile'
import { GIORNI_MARGINE_CARD } from '#shared/card-studente'

// ponytail: si guardano solo gli ultimi 60 giorni. Una notifica è una cosa recente; oltre,
// note e comunicazioni restano nelle loro pagine. Se servisse lo storico intero, basta
// allungare qui (le letture sono già per alunno e per utente).
const FINESTRA_GIORNI = 60

// I filtri della pagina: Dai tutor (le note), Lezioni (domani c'è lezione), Avvisi (il resto)
export type CategoriaNotifica = 'TUTOR' | 'LEZIONI' | 'AVVISI'

export type NotificaPortale = {
  id: string                 // stabile tra un'apertura e l'altra: tipo + id della cosa
  categoria: CategoriaNotifica
  titolo: string
  testo: string
  data: Date                 // la data di riferimento: ordina l'elenco e decide "nuova"
  nuova: boolean
  link?: string
  immagine?: string          // indirizzo della foto (voce C), mai la foto stessa
}

// 'AAAA-MM-GG' → "giovedì 19 novembre" / "15 dicembre": a mezzogiorno UTC, così il fuso
// non sposta il giorno
const giornoEsteso = (g: string, conSettimana = false) => new Date(`${g}T12:00:00Z`).toLocaleDateString('it-IT', {
  timeZone: 'UTC', day: 'numeric', month: 'long', ...(conSettimana ? { weekday: 'long' } : {}),
})
const piuRecente = (a: Date, b: Date) => (a > b ? a : b)

export async function notifichePortale(user: { id: string; role: string }) {
  // L'admin in anteprima non ha figli né una data "viste fino a" da spostare
  if (!['GENITORE', 'STUDENTE'].includes(user.role)) return { voci: [] as NotificaPortale[], nuove: 0 }
  const perStudente = user.role === 'STUDENTE'

  const ids = await getPortalStudentIds(user)
  const oggi = oggiRomeStr()
  const domani = giornoSuccessivo(oggi)
  const inizioOggi = inizioGiornoRome(oggi)
  const daQuando = new Date(Date.now() - FINESTRA_GIORNI * 24 * 60 * 60 * 1000)
  const conAlunni = ids.length > 0

  const [utente, anagrafiche, note, lezioniDomani, comunicazioni, card, pacchetti, convenzioniOggi, conPagamenti] = await Promise.all([
    db.select({ viste: users.notificheVisteAt }).from(users).where(eq(users.id, user.id)).limit(1),
    conAlunni ? db.select({ id: students.id, firstName: students.firstName }).from(students).where(inArray(students.id, ids)) : [],
    // A solo al genitore: oggi le note dei tutor le legge lui, non l'alunno. Mostrarle
    // anche all'alunno è una scelta da fare apposta (in attesa di decisione del titolare).
    perStudente ? [] : getPortalNotes(ids),
    // B: le prenotazioni di DOMANI (giorno italiano). Il giorno di una prenotazione è la
    // data UTC di requestedDate (il portale salva le 12:00Z), come in matching/[date].get.ts.
    // Sono già confermate da quando nascono: CONFIRMED.
    conAlunni ? db.select({ id: bookings.id, studentId: bookings.studentId, createdAt: bookings.createdAt })
      .from(bookings)
      .where(and(
        inArray(bookings.studentId, ids),
        eq(bookings.status, 'CONFIRMED'),
        gte(bookings.requestedDate, new Date(`${domani}T00:00:00.000Z`)),
        lte(bookings.requestedDate, new Date(`${domani}T23:59:59.999Z`)),
      )) : [],
    comunicazioniDelGenitore(user.id),
    statoCardStudenti(ids),
    // F (solo genitore): i pacchetti che possono essere "da rinnovare"
    conAlunni && !perStudente ? db.select({
      id:            packages.id,
      studentId:     packages.studentId,
      oreAcquistate: packages.oreAcquistate,
      oreResiduo:    packages.oreResiduo,
      dataScadenza:  packages.dataScadenza,
      createdAt:     packages.createdAt,
      updatedAt:     packages.updatedAt,
    }).from(packages).where(and(
      inArray(packages.studentId, ids),
      eq(packages.sospeso, false),
      not(arrayContains(packages.stati, ['CHIUSO'])),
    )) : [],
    // G: solo quelle ancora valide (una scaduta non c'è più nel portale), senza foto
    convenzioniValide(oggi),
    // H (solo genitore), e solo se la sezione pagamenti è accesa in Impostazioni
    conAlunni && !perStudente ? pagamentiPortaleAttivi() : false,
  ])

  const nome = new Map(anagrafiche.map((s) => [s.id, s.firstName]))
  const voci: Omit<NotificaPortale, 'nuova'>[] = []

  // A. Le note, dalla data in cui la segreteria le ha rese visibili (approvataAt)
  for (const n of note) {
    voci.push({
      id: `nota:${n.id}`, categoria: 'TUTOR',
      titolo: `Nuova nota su ${n.student?.firstName ?? ''}`.trim(),
      testo: n.contenuto,
      data: n.approvataAt!,
      // La pagina delle note è solo del genitore (l'account studente non ce l'ha nel menu)
      link: perStudente ? undefined : '/portale/note',
    })
  }

  // B. Domani c'è lezione. DATA: la mezzanotte di oggi, perché la voce "nasce" quando la
  // lezione diventa di domani; se la prenotazione è stata fatta oggi, dal momento della
  // prenotazione (altrimenti chi ha già segnato tutto come letto stamattina non la vedrebbe nuova).
  if (lezioniDomani.length > 0) {
    const materie = await db.select({ bookingId: bookingSubjects.bookingId, name: bookingSubjects.name })
      .from(bookingSubjects).where(inArray(bookingSubjects.bookingId, lezioniDomani.map((b) => b.id)))
    for (const b of lezioniDomani) {
      const queste = materie.filter((m) => m.bookingId === b.id).map((m) => m.name)
      voci.push({
        id: `lezione:${b.id}`, categoria: 'LEZIONI',
        titolo: 'Domani c\'è lezione',
        testo: [nome.get(b.studentId!), giornoEsteso(domani, true), queste.join(', ')].filter(Boolean).join(' · '),
        data: piuRecente(inizioOggi, b.createdAt),
        link: '/portale',
      })
    }
  }

  // C. Le comunicazioni della segreteria ricevute da questo utente, da quando sono partite
  for (const c of comunicazioni) {
    voci.push({
      id: `comunicazione:${c.id}`, categoria: 'AVVISI', titolo: c.titolo, testo: c.testo, data: c.createdAt, link: '/portale/note',
      immagine: c.conImmagine ? `/api/immagini/comunicazioni/${c.id}` : undefined,
    })
  }

  // D ed E. La card, dalla regola unica (card.service.ts → shared/card-studente.ts).
  for (const [studentId, stato] of card) {
    const chi = nome.get(studentId) ?? ''
    // Senza validaFino non c'è un giorno da raccontare: o la card non si è mai accesa
    // (pacchetto a ore mai pagato, nessun pacchetto, alunno archiviato) o è "senza fine".
    // La pagina Card dice già com'è; una notifica serve quando qualcosa CAMBIA.
    if (!stato.validaFino) continue
    const daSaldare = stato.motivo === 'DA_SALDARE'
    if (stato.attiva && stato.inMargine) {
      // D. DATA: il primo giorno dei 15 di margine, cioè quando la card è entrata "in sospensione"
      voci.push({
        id: `card-margine:${studentId}:${stato.validaFino}`, categoria: 'AVVISI',
        titolo: `La card di ${chi} resta attiva fino al ${giornoEsteso(stato.validaFino)}`,
        testo: perStudente ? 'Chiedi in segreteria per non perderla.'
          : daSaldare ? 'Salda il pacchetto da pagare per non perderla.' : 'Rinnova il pacchetto per non perderla.',
        data: inizioGiornoRome(aggiungiGiorni(stato.validaFino, 1 - GIORNI_MARGINE_CARD)),
        link: '/portale/card',
      })
    } else if (!stato.attiva) {
      // E. DATA: il giorno dopo validaFino, il primo giorno di card sospesa
      voci.push({
        id: `card-sospesa:${studentId}:${stato.validaFino}`, categoria: 'AVVISI',
        titolo: `La card di ${chi} è sospesa`,
        testo: perStudente ? 'Chiedi in segreteria.'
          : daSaldare ? 'Salda il pacchetto e torna attiva da sola.' : 'Rinnova il pacchetto e torna attiva da sola.',
        data: inizioGiornoRome(aggiungiGiorni(stato.validaFino, 1)),
        link: '/portale/card',
      })
    }
  }

  // F. Pacchetto in scadenza / ore quasi finite (solo genitore), con la STESSA regola dello
  // stato DA_RINNOVARE e delle email 5 e 6 (motiviRinnovo in package.service.ts).
  // Non si dice quante ore restano: come l'email, "sta per esaurirsi" e basta.
  for (const p of pacchetti) {
    const { inScadenza, oreQuasiFinite } = motiviRinnovo(p)
    const chi = nome.get(p.studentId) ?? ''
    if (inScadenza) {
      const scadenza = romeDateStr(p.dataScadenza!)
      // DATA: il giorno in cui è entrato nei 3 giorni prima della scadenza (o la sua
      // creazione, se è nato già lì dentro)
      voci.push({
        id: `pacchetto-scadenza:${p.id}`, categoria: 'AVVISI',
        titolo: `Il pacchetto di ${chi} scade il ${scadenza.split('-').reverse().join('/')}`,
        testo: 'Contatta la segreteria per rinnovarlo.',
        data: piuRecente(inizioGiornoRome(aggiungiGiorni(scadenza, -3)), p.createdAt),
        link: '/portale',
      })
    } else if (oreQuasiFinite) {
      // DATA: l'ultima modifica del pacchetto, di solito la lezione che ha scalato le ore.
      // ponytail: il pacchetto non ricorda QUANDO è sceso sotto il 20%; con updatedAt la voce
      // torna "nuova" a ogni lezione successiva (le ore calano ancora). Per una data fissa
      // servirebbe una colonna, che il piano non prevede.
      voci.push({
        id: `pacchetto-ore:${p.id}`, categoria: 'AVVISI',
        titolo: `Il pacchetto di ${chi} sta per esaurirsi`,
        testo: 'Contatta la segreteria per una ricarica o un rinnovo.',
        data: p.updatedAt,
        link: '/portale',
      })
    }
  }

  // G. Le convenzioni nuove, dalla loro data di creazione, solo se ancora valide.
  // Quelle senza data sono nate prima che la data esistesse e contano come già note
  // (come nel riepilogo serale).
  for (const c of convenzioniOggi) {
    if (!c.creataAt) continue
    voci.push({
      id: `convenzione:${c.id}`, categoria: 'AVVISI',
      titolo: 'Nuova convenzione',
      testo: `${c.nome}: ${[c.sconto, c.descrizione].filter(Boolean).join(' ')}`,
      data: c.creataAt,
      link: '/portale/sconti',
    })
  }

  // H. I pagamenti registrati dalla segreteria (solo genitore, solo a sezione pagamenti accesa),
  // dal momento in cui sono stati registrati. Nessun importo: basta sapere che è arrivato.
  if (conPagamenti) {
    const righe = await db.select({ id: payments.id, createdAt: payments.createdAt, studentId: packages.studentId, pacchetto: packages.nome })
      .from(payments)
      .innerJoin(packages, eq(packages.id, payments.packageId))
      .where(and(inArray(packages.studentId, ids), gte(payments.createdAt, daQuando)))
    for (const r of righe) {
      voci.push({
        id: `pagamento:${r.id}`, categoria: 'AVVISI',
        titolo: 'Pagamento registrato',
        testo: `Abbiamo registrato un pagamento per ${nome.get(r.studentId) ?? ''} (${r.pacchetto}).`,
        data: r.createdAt,
        link: '/portale/pagamenti',
      })
    }
  }

  const viste = utente[0]?.viste ?? null
  const elenco = voci
    .filter((v) => v.data >= daQuando)
    .sort((a, b) => b.data.getTime() - a.data.getTime())
    .map((v) => ({ ...v, nuova: !viste || v.data > viste }))
  return { voci: elenco, nuove: elenco.filter((v) => v.nuova).length }
}

/** "Segna tutte come lette": la data "viste fino a" diventa adesso. */
export async function segnaNotificheLette(userId: string) {
  await db.update(users).set({ notificheVisteAt: new Date() }).where(eq(users.id, userId))
}
