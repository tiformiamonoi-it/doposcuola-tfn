<template>
  <div class="space-y-6">

    <div>
      <h2 class="font-heading text-xl font-bold text-slate-900">Segnala un'assenza</h2>
      <p class="text-sm text-slate-500 mt-1">
        Dicci i giorni in cui <strong>non</strong> verrà: così la segreteria organizza la giornata
        senza aspettarlo.
      </p>
    </div>

    <!-- Per quale figlio (solo se ce n'è più di uno) -->
    <UCard v-if="studenti.length > 1">
      <label for="assenza-figlio" class="block text-sm font-medium text-slate-700 mb-1">Per quale figlio?</label>
      <USelect
        id="assenza-figlio"
        v-model="studentIdScelto"
        :items="studenti.map((s) => ({ label: `${s.firstName} ${s.lastName}`, value: s.id }))"
        placeholder="Scegli…"
        class="w-full"
      />
    </UCard>

    <!--
      IL CARTELLO CHE SPIEGA DOVE SI TROVA. Cambia in base al livello scolastico,
      che NON è salvato da nessuna parte: si deduce dalla classe scritta in
      segreteria. Quando la classe manca o è scritta in un modo che non
      riconosciamo il livello è `null` e qui NON si indovina: si mostrano tutte e
      due le strade e si lascia scegliere alla famiglia, che lo sa meglio di noi.
    -->
    <UCard v-if="studentIdScelto" :class="livelloScelto === 'MEDIE' ? 'border border-emerald-200 bg-emerald-50/50' : ''">
      <div class="flex items-start gap-3">
        <UIcon
          :name="livelloScelto === 'MEDIE' ? 'i-heroicons-hand-raised' : 'i-heroicons-information-circle'"
          class="w-5 h-5 mt-0.5 shrink-0"
          :class="livelloScelto === 'MEDIE' ? 'text-emerald-600' : 'text-slate-400'"
        />
        <div class="text-sm text-slate-700 space-y-2">
          <template v-if="livelloScelto === 'MEDIE'">
            <p>
              <strong>{{ nomeScelto }} è alle medie: il posto ce l'ha sempre.</strong>
              Non serve prenotare giorno per giorno — basta avvisarci quando non viene.
            </p>
            <p class="text-slate-500">
              Se in un giorno particolare vuoi comunque chiedere una lezione su una materia
              precisa, puoi farlo lo stesso.
            </p>
          </template>
          <template v-else-if="livelloScelto === null">
            <p>
              <strong>Nella scheda di {{ nomeScelto }} non risulta la classe</strong>, quindi non
              sappiamo dirti se per lui funziona il posto fisso (medie) o la prenotazione
              (superiori). Puoi fare tutte e due le cose da qui.
            </p>
            <p class="text-slate-500">
              Se ce lo dici, la segreteria completa la scheda e questa pagina si sistema da sola.
            </p>
          </template>
          <template v-else>
            <p>
              Per {{ nomeScelto }} di solito si <strong>prenota</strong> la lezione. Se avevi già
              prenotato e alla fine non viene, segnalalo qui: è il modo più rapido per avvisarci.
            </p>
          </template>

          <!-- Decisione Q9: il bottone per prenotare resta SEMPRE, per tutti. -->
          <UButton
            to="/portale/prenota"
            :color="livelloScelto === 'MEDIE' ? 'neutral' : 'primary'"
            :variant="livelloScelto === 'MEDIE' ? 'outline' : 'solid'"
            size="sm"
            icon="i-heroicons-calendar-days"
          >
            Prenota una lezione
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- ═══ SCEGLI I GIORNI ═══ -->
    <UCard>
      <template #header>
        <span class="font-medium text-slate-800">In quali giorni non viene?</span>
      </template>

      <p class="text-xs text-slate-500 mb-3">
        Tocca i giorni: puoi sceglierne anche più di uno. La domenica il Centro è chiuso e non compare.
      </p>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button
          v-for="g in prossimiGiorni"
          :key="g.data"
          type="button"
          class="px-3 py-2 rounded-lg border text-left transition-colors"
          :class="giorniScelti.includes(g.data)
            ? 'border-tfn-500 bg-tfn-50 text-tfn-700 font-medium'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'"
          :aria-pressed="giorniScelti.includes(g.data)"
          :aria-label="`${g.etichettaLunga}${giaSegnalati.includes(g.data) ? ' — già segnalato' : ''}`"
          @click="alternaGiorno(g.data)"
        >
          <span class="block text-sm capitalize">{{ g.etichetta }}</span>
          <span class="block text-[11px] text-slate-400">
            {{ g.oggi ? 'oggi' : (g.domani ? 'domani' : g.mese) }}
            <span v-if="giaSegnalati.includes(g.data)" class="text-emerald-600 font-medium">· già segnalato</span>
          </span>
        </button>
      </div>

      <!-- Un giorno più lontano di tre settimane (la gita di maggio) -->
      <div class="mt-4">
        <label for="assenza-altro-giorno" class="block text-xs font-medium text-slate-600 mb-1">
          Un altro giorno, più avanti
        </label>
        <div class="flex gap-2">
          <UInput
            id="assenza-altro-giorno"
            v-model="altroGiorno"
            type="date"
            :min="oggiIt"
            class="flex-1"
          />
          <UButton color="neutral" variant="soft" :disabled="!altroGiorno" @click="aggiungiAltroGiorno">
            Aggiungi
          </UButton>
        </div>
      </div>

      <!-- I giorni scelti fuori dall'elenco qui sopra, per poterli togliere -->
      <div v-if="giorniSceltiFuoriElenco.length" class="mt-3 flex flex-wrap gap-2">
        <span
          v-for="g in giorniSceltiFuoriElenco"
          :key="g"
          class="inline-flex items-center gap-1 text-xs bg-tfn-50 text-tfn-700 border border-tfn-200 rounded-full pl-3 pr-1 py-1"
        >
          {{ dataLunga(g) }}
          <UButton
            icon="i-heroicons-x-mark"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="`Togli il giorno ${dataLunga(g)}`"
            @click="alternaGiorno(g)"
          />
        </span>
      </div>

      <!--
        PRENOTAZIONE E ASSENZA NELLO STESSO GIORNO. Sono due frasi diverse
        («vorrei una lezione» / «non vengo») e il gestionale non ne cancella una
        per conto suo: sarebbe il classico automatismo che un giorno butta via la
        cosa sbagliata. Qui si dice soltanto che c'è, e si lascia scegliere.
      -->
      <div
        v-if="giorniConPrenotazione.length"
        class="mt-4 text-sm rounded-lg p-3 border bg-slate-50 border-slate-200 text-slate-700"
      >
        <p class="font-medium flex items-center gap-1.5">
          <UIcon name="i-heroicons-calendar-days" class="w-4 h-4 shrink-0 text-slate-400" />
          C'è già una lezione prenotata
        </p>
        <p class="mt-1 capitalize">{{ giorniConPrenotazione.map(dataLunga).join(' · ') }}</p>
        <p class="mt-1 normal-case text-slate-500">
          Segnalando l'assenza avvisi la segreteria, e va benissimo così. Se vuoi togliere anche la
          prenotazione, fallo dalla pagina <NuxtLink to="/portale/prenota" class="underline">Prenota</NuxtLink>.
        </p>
      </div>

      <!-- Il motivo, facoltativo -->
      <div class="mt-4">
        <label for="assenza-motivo" class="block text-xs font-medium text-slate-600 mb-1">
          Motivo <span class="font-normal text-slate-400">(facoltativo)</span>
        </label>
        <UInput
          id="assenza-motivo"
          v-model="motivo"
          placeholder="Es. ha la febbre, visita medica…"
          maxlength="200"
          class="w-full"
        />
      </div>

      <!--
        L'AVVISO DELLE 10. Dopo quell'ora l'assenza si registra lo stesso — non si
        perde mai un'informazione vera — ma la giornata in segreteria è già
        organizzata, quindi conviene anche una telefonata. L'orologio qui è quello
        del telefono: è un avviso, non un controllo. Chi decide davvero se
        l'assenza è "fuori tempo" è il server, con l'ora italiana.
      -->
      <div
        v-if="oggiEDopoLeDieci"
        class="mt-4 text-sm rounded-lg p-3 border bg-amber-50 border-amber-200 text-amber-800"
      >
        <p class="font-medium flex items-center gap-1.5">
          <UIcon name="i-heroicons-clock" class="w-4 h-4 shrink-0" />
          Per oggi è tardi: sono passate le {{ ORA_LIMITE_ASSENZA_TESTO }}
        </p>
        <p class="mt-1">
          Puoi segnalarla lo stesso e resterà scritta, ma la giornata è già organizzata:
          conviene avvisare anche a voce.
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <UButton
            v-if="linkWhatsApp"
            :to="linkWhatsApp"
            target="_blank"
            rel="noopener noreferrer"
            color="warning"
            variant="solid"
            size="xs"
            icon="i-heroicons-chat-bubble-left-right"
          >
            Scrivi in segreteria
          </UButton>
          <UButton
            v-if="numeroTelefono"
            :to="`tel:${numeroTelefono}`"
            color="warning"
            variant="outline"
            size="xs"
            icon="i-heroicons-phone"
          >
            Chiama la segreteria
          </UButton>
        </div>
      </div>

      <template #footer>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p class="text-xs text-slate-500">
            <template v-if="giorniScelti.length === 0">Nessun giorno scelto.</template>
            <template v-else>
              {{ giorniScelti.length === 1 ? '1 giorno scelto' : `${giorniScelti.length} giorni scelti` }}.
              Avvisare non toglie niente dal pacchetto.
            </template>
          </p>
          <UButton
            color="primary"
            :loading="invio"
            :disabled="giorniScelti.length === 0 || !studentIdScelto"
            icon="i-heroicons-paper-airplane"
            class="justify-center"
            @click="invia"
          >
            Segnala l'assenza
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- ═══ GIÀ SEGNALATE ═══ -->
    <UCard>
      <template #header>
        <span class="font-medium text-slate-800">Assenze già segnalate</span>
      </template>

      <div v-if="pendingAssenze" class="py-6 flex justify-center">
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-slate-300 animate-spin" />
      </div>

      <template v-else>
        <p v-if="prossime.length === 0 && passate.length === 0" class="text-sm text-slate-400 py-2">
          Non hai ancora segnalato nessuna assenza.
        </p>

        <!-- Da oggi in avanti: si possono ancora disdire -->
        <ul v-if="prossime.length" class="divide-y divide-slate-100">
          <li v-for="a in prossime" :key="a.id" class="py-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-800 capitalize">{{ dataLunga(a.data) }}</p>
              <p class="text-xs text-slate-500">
                {{ nomeDi(a.studentId) }}<template v-if="a.motivo"> · {{ a.motivo }}</template>
              </p>
              <p v-if="a.oltreIlTermine" class="text-xs text-amber-600 mt-0.5">
                Segnalata dopo le {{ ORA_LIMITE_ASSENZA_TESTO }}
              </p>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-heroicons-arrow-uturn-left"
              :aria-label="`Annulla l'assenza di ${nomeDi(a.studentId)} del ${dataLunga(a.data)}`"
              @click="chiediAnnullamento(a)"
            >
              Alla fine viene
            </UButton>
          </li>
        </ul>

        <!-- Storico breve: sola lettura, i giorni passati non si riscrivono -->
        <div v-if="passate.length" class="mt-4 pt-3 border-t border-slate-100">
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ultime settimane</p>
          <ul class="space-y-1">
            <li v-for="a in passate" :key="a.id" class="text-xs text-slate-500 capitalize">
              {{ dataLunga(a.data) }} — {{ nomeDi(a.studentId) }}
              <span v-if="a.motivo" class="normal-case">· {{ a.motivo }}</span>
            </li>
          </ul>
        </div>
      </template>
    </UCard>

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
      :confirm-label="confirmLabel"
      :confirm-color="confirmColor"
      :loading="confirmLoading"
      @confirm="eseguiConferma"
    />
  </div>
</template>

<script setup lang="ts">
// LA PRENOTAZIONE AL CONTRARIO (voce G1 del piano).
//
// Alle superiori la famiglia dice quando VIENE. Alle medie il posto c'è sempre e
// l'unica cosa che manca alla segreteria è sapere quando NON viene: questa pagina
// è quel "non viene". Il bottone per prenotare resta comunque, per tutti
// (decisione Q9): chi vuole prenotare lo fa, non gli si toglie niente.
//
// ⚠️ Segnalare un'assenza NON scala ore, giorni o importi dal pacchetto
// (decisione Q12). Avvisare deve essere gratis, altrimenti nessuno avvisa.
import { ref, computed } from 'vue'
import { livelloDaClasse } from '#shared/livello-scolastico'
import { ORA_LIMITE_ASSENZA, ORA_LIMITE_ASSENZA_TESTO } from '#shared/assenze'
import ConfirmDialog from '~/components/ConfirmDialog.vue'

definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Assenze — Portale Famiglie' })

const toast = useToast()
const { confirmOpen, confirmTitle, confirmDescription, confirmLabel, confirmColor, confirmLoading, chiediConferma, eseguiConferma } = useConfirm()

interface StudentePortale { id: string; firstName: string; lastName: string; classe: string | null }
interface AssenzaPortale {
  id: string; studentId: string; data: string; motivo: string | null; oltreIlTermine: boolean
}

// ─── I figli collegati ───
const { data: studentiRes } = useLazyFetch<StudentePortale[]>('/api/portal/students')
const studenti = computed(() => studentiRes.value ?? [])

const studentIdManuale = ref<string>('')
// Con un figlio solo non si sceglie niente: si parte già da lui.
const studentIdScelto = computed<string>({
  get: () => studentIdManuale.value || studenti.value[0]?.id || '',
  set: (v) => { studentIdManuale.value = v },
})

const studenteScelto = computed(() => studenti.value.find((s) => s.id === studentIdScelto.value) ?? null)
const nomeScelto = computed(() => studenteScelto.value?.firstName ?? 'tuo figlio')

// Il livello NON è salvato: si deduce dalla classe, e può essere `null`
// ("non lo sappiamo"), che è diverso da "non sono le medie".
const livelloScelto = computed(() => livelloDaClasse(studenteScelto.value?.classe))

function nomeDi(studentId: string) {
  const s = studenti.value.find((x) => x.id === studentId)
  return s ? `${s.firstName} ${s.lastName}`.trim() : 'Alunno'
}

// ─── Assenze già segnalate ───
const { data: assenzeRes, pending: pendingAssenze, refresh: ricaricaAssenze } =
  useLazyFetch<{ oggi: string; prossime: AssenzaPortale[]; passate: AssenzaPortale[] }>('/api/portal/assenze')

const prossime = computed(() => assenzeRes.value?.prossime ?? [])
const passate  = computed(() => assenzeRes.value?.passate ?? [])

// I giorni già segnalati PER IL FIGLIO SCELTO: servono a mettere l'etichetta
// "già segnalato" sui bottoni, così nessuno avvisa due volte pensando di doverlo fare.
const giaSegnalati = computed(() =>
  prossime.value.filter((a) => a.studentId === studentIdScelto.value).map((a) => a.data),
)

// ─── Le chiusure del Centro (Natale, ponti): quei giorni non si segnalano ───
// Per un account STUDENTE questa chiamata non risponde (è riservata al genitore):
// in quel caso l'elenco resta vuoto e si mostrano tutti i giorni feriali. Non è un
// problema: segnalare un'assenza in un giorno di chiusura non fa danni a nessuno.
const { data: chiusureRes } = useLazyFetch<Array<{ date: string }>>('/api/portal/closures')
const chiusure = computed(() => (chiusureRes.value ?? []).map((c) => c.date))

// ─── L'orologio italiano, letto dal telefono ───
// Serve solo per l'avviso "è tardi": la decisione vera la prende il server.
function oraItaliana() {
  const parti = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const p = (t: string) => parti.find((x) => x.type === t)?.value ?? '00'
  return { giorno: `${p('year')}-${p('month')}-${p('day')}`, ora: parseInt(p('hour'), 10) }
}

const adesso = ref(oraItaliana())
const oggiIt = computed(() => adesso.value.giorno)

// ─── I giorni proponibili: tre settimane feriali in avanti ───
// Un elenco di bottoni grandi invece di un calendario: le famiglie useranno
// questa pagina dal telefono, in piedi, di corsa. Chi ha bisogno di una data più
// lontana la scrive nella casella qui sotto.
const prossimiGiorni = computed(() => {
  const out: Array<{ data: string; etichetta: string; etichettaLunga: string; mese: string; oggi: boolean; domani: boolean }> = []
  const [y, m, d] = oggiIt.value.split('-').map(Number)
  if (!y || !m || !d) return out

  for (let i = 0; out.length < 15 && i < 30; i++) {
    // Mezzogiorno e non mezzanotte: a mezzanotte un'ora di fuso sposta il giorno.
    const giorno = new Date(y, m - 1, d + i, 12)
    if (giorno.getDay() === 0) continue // domenica: il Centro è chiuso
    const iso = `${giorno.getFullYear()}-${String(giorno.getMonth() + 1).padStart(2, '0')}-${String(giorno.getDate()).padStart(2, '0')}`
    if (chiusure.value.includes(iso)) continue

    out.push({
      data: iso,
      etichetta: giorno.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' }),
      etichettaLunga: giorno.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
      mese: giorno.toLocaleDateString('it-IT', { month: 'short' }),
      oggi: iso === oggiIt.value,
      domani: false,
    })
  }

  // "domani" è il primo giorno dopo oggi: si marca dopo, perché la domenica e le
  // chiusure possono averlo saltato (il "domani" di sabato è lunedì).
  const primoDopoOggi = out.find((g) => g.data > oggiIt.value)
  if (primoDopoOggi) primoDopoOggi.domani = true

  return out
})

// ─── La scelta ───
const giorniScelti = ref<string[]>([])
const altroGiorno = ref('')
const motivo = ref('')
const invio = ref(false)

function alternaGiorno(data: string) {
  const i = giorniScelti.value.indexOf(data)
  if (i === -1) giorniScelti.value.push(data)
  else giorniScelti.value.splice(i, 1)
}

function aggiungiAltroGiorno() {
  const g = altroGiorno.value
  if (!g) return
  if (g < oggiIt.value) {
    toast.add({ title: 'Giorno già passato', description: 'Si può avvisare solo per oggi o per i giorni futuri.', color: 'warning' })
    return
  }
  if (!giorniScelti.value.includes(g)) giorniScelti.value.push(g)
  altroGiorno.value = ''
}

// I giorni scelti che non hanno un bottone nell'elenco: senza questo, una data
// aggiunta a mano risulterebbe scelta senza che si veda da nessuna parte.
const giorniSceltiFuoriElenco = computed(() => {
  const inElenco = new Set(prossimiGiorni.value.map((g) => g.data))
  return giorniScelti.value.filter((g) => !inElenco.has(g)).sort()
})

const oggiEDopoLeDieci = computed(() =>
  giorniScelti.value.includes(oggiIt.value) && adesso.value.ora >= ORA_LIMITE_ASSENZA,
)

// ─── Prenotazioni già fatte negli stessi giorni ───
// Non si cancellano da sole: si dice solo che ci sono (vedi il riquadro nel
// template). Le prenotazioni annullate non contano, ovviamente.
const { data: prenotazioniRes } = useLazyFetch<Array<{ studentId: string | null; requestedDate: string; status: string }>>('/api/portal/bookings')

const giorniConPrenotazione = computed(() => {
  const prenotati = new Set(
    (prenotazioniRes.value ?? [])
      .filter((b) => b.status !== 'CANCELLED' && b.studentId === studentIdScelto.value)
      .map((b) => String(b.requestedDate).slice(0, 10)),
  )
  return giorniScelti.value.filter((g) => prenotati.has(g)).sort()
})

function dataLunga(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d, 12).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ─── Segreteria: WhatsApp e telefono, per l'avviso "è tardi" ───
const { data: configs } = useLazyFetch<{ whatsapp_numero?: string }>('/api/portal/configs')
const numeroTelefono = computed(() => (configs.value?.whatsapp_numero ?? '').trim())
const linkWhatsApp = computed(() => {
  const n = numeroTelefono.value.replace(/\D/g, '')
  if (!n) return ''
  const testo = encodeURIComponent(`Ciao, ${nomeScelto.value} oggi non viene.`)
  return `https://wa.me/${n}?text=${testo}`
})

// ─── Invio ───
async function invia() {
  if (giorniScelti.value.length === 0 || !studentIdScelto.value) return

  // L'orologio si rilegge adesso: la pagina può essere rimasta aperta dalle 9:50.
  adesso.value = oraItaliana()

  invio.value = true
  try {
    const res = await $fetch<{ segnalate: number; inRitardo: number; giaPresenti: number; nonRegistrate: Array<{ data: string; errore?: string }> }>(
      '/api/portal/assenze',
      {
        method: 'POST',
        body: {
          studentId: studentIdScelto.value,
          giorni:    [...giorniScelti.value],
          motivo:    motivo.value.trim() || undefined,
        },
      },
    )

    const quanti = res.segnalate === 1 ? '1 giorno segnalato' : `${res.segnalate} giorni segnalati`
    toast.add({
      title: quanti,
      description: res.inRitardo > 0
        ? `Grazie per l'avviso. Per oggi è tardi: se puoi, avvisa anche la segreteria a voce.`
        : 'Grazie per l\'avviso: il pacchetto non viene toccato.',
      color: res.inRitardo > 0 ? 'warning' : 'success',
      icon: 'i-heroicons-check-circle',
    })

    if (res.nonRegistrate.length > 0) {
      toast.add({
        title: 'Alcuni giorni non sono stati registrati',
        description: res.nonRegistrate.map((n) => `${dataLunga(n.data)}: ${n.errore ?? 'non registrato'}`).join(' · '),
        color: 'warning',
      })
    }

    giorniScelti.value = []
    motivo.value = ''
    await ricaricaAssenze()
  } catch (e: any) {
    toast.add({
      title: 'Non è stato possibile segnalare l\'assenza',
      description: e?.data?.statusMessage ?? 'Riprova fra poco, oppure avvisa la segreteria.',
      color: 'error',
    })
  } finally {
    invio.value = false
  }
}

// ─── Annullamento ("alla fine viene") ───
// Niente confirm() del browser: una finestra vera, leggibile anche da telefono.
function chiediAnnullamento(a: AssenzaPortale) {
  chiediConferma(
    {
      title: 'Alla fine viene?',
      description: `Togliamo l'assenza di ${nomeDi(a.studentId)} di ${dataLunga(a.data)}.\n\n`
        + 'La segreteria lo aspetterà di nuovo in quel giorno.',
      confirmLabel: 'Sì, viene',
      confirmColor: 'primary',
      attendi: true,
    },
    () => annulla(a),
  )
}

async function annulla(a: AssenzaPortale) {
  try {
    await $fetch(`/api/portal/assenze/${a.id}`, { method: 'DELETE' })
    toast.add({ title: 'Assenza annullata', description: `${nomeDi(a.studentId)} è di nuovo atteso.`, color: 'success' })
    await ricaricaAssenze()
  } catch (e: any) {
    toast.add({
      title: 'Non è stato possibile annullare',
      description: e?.data?.statusMessage ?? 'Riprova fra poco.',
      color: 'error',
    })
    throw e // la finestra resta aperta: si può riprovare
  }
}
</script>
