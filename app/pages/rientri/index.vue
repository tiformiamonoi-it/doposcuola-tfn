<template>
  <div class="space-y-6">

    <!-- ═══ INTESTAZIONE ═══ -->
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">Rientri {{ anno }}</h2>
        <p class="text-sm text-slate-500 mt-0.5">
          {{ quandoSiComincia }} ·
          <span class="font-semibold text-slate-700">{{ testoConfermati }}</span> finora<template v-if="kpi.nuoviDaContatti > 0"> — {{ testoNuoviDaContatti }}</template>
          <!-- I nuovi dai Contatti sono GIÀ dentro i confermati: qui si spiega perché non si sommano -->
          <StatHelp
            v-if="kpi.nuoviDaContatti > 0"
            text="I nuovi iscritti arrivati dai Contatti diventano alunni, quindi sono già compresi nei confermati: non vanno sommati."
          />
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <!-- Storico: gli anni passati si guardano, non si modificano -->
        <USelect
          v-if="anni.length > 1"
          v-model="annoScelto"
          :items="anniItems"
          class="w-40"
          aria-label="Anno scolastico da consultare"
        />
        <UButton
          v-if="!soloLettura && kpi.nonTornano > 0"
          variant="soft"
          color="neutral"
          icon="i-heroicons-user-minus"
          @click="chiediDisattivazione"
        >
          Disattiva chi non torna ({{ kpi.nonTornano }})
        </UButton>
      </div>
    </div>

    <!-- ═══ AVVISO: si sta guardando un anno passato ═══ -->
    <UAlert
      v-if="soloLettura"
      color="neutral"
      variant="subtle"
      icon="i-heroicons-eye"
      :title="`Stai guardando l'appello dell'anno ${anno}: è solo consultazione.`"
    />

    <!-- ═══ CARD DI RIEPILOGO (cliccabili = filtro rapido) ═══ -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="card in cards"
        :key="card.key"
        class="relative bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm px-5 py-4 transition-all duration-150 hover:shadow-md"
        :class="card.attiva ? 'ring-2 ring-tfn-400 shadow-md' : ''"
      >
        <button
          type="button"
          class="w-full text-left"
          :aria-pressed="card.attiva"
          :title="card.attiva ? 'Togli questo filtro' : 'Mostra solo questi alunni'"
          @click="card.onClick()"
        >
          <p class="text-sm text-slate-500 pr-6">{{ card.label }}</p>
          <p class="text-2xl font-bold leading-none mt-1.5" :class="card.classe">{{ card.valore }}</p>
          <!-- Sotto i confermati: quanti hanno detto sì ma non hanno il pacchetto -->
          <p
            v-if="card.key === 'confermati'"
            class="text-xs mt-1.5 flex items-center gap-1"
            :class="kpi.confermatiSenzaPacchetto > 0 ? 'text-red-600 font-medium' : 'text-slate-400'"
          >
            di cui {{ kpi.confermatiSenzaPacchetto }} senza pacchetto
            <StatHelp text="Hanno detto sì ma non hanno ancora scelto il pacchetto: sono quelli da richiamare." />
          </p>
        </button>
        <span class="absolute top-3 right-3"><StatHelp :text="card.aiuto" /></span>
      </div>
    </div>

    <!-- ═══ FILTRI ═══ -->
    <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
      <UInput
        v-model="ricerca"
        icon="i-heroicons-magnifying-glass"
        placeholder="Cerca nome, cognome, telefono…"
        class="w-full sm:w-80"
        aria-label="Cerca fra gli alunni"
      />
      <USelect
        v-model="filtroStato"
        :items="STATI_RIENTRO_FILTRO_ITEMS"
        class="w-full sm:w-48"
        aria-label="Filtra per stato della risposta"
      />
      <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
        <USwitch v-model="soloAttiviRecenti" aria-label="Mostra solo chi ha fatto lezione quest'anno" />
        Solo chi ha fatto lezione quest'anno
      </label>
      <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
        <USwitch v-model="includiMaiPartiti" aria-label="Mostra anche chi non ha mai iniziato" />
        Mostra anche chi non ha mai iniziato
      </label>
    </div>

    <!-- ═══ CARICAMENTO (prima volta) ═══ -->
    <div v-if="(pending || !data) && righe.length === 0" class="space-y-3">
      <USkeleton v-for="n in 5" :key="n" class="h-16 w-full rounded-2xl" />
    </div>

    <!-- ═══ LISTA ═══ -->
    <template v-else-if="righe.length > 0">

      <!-- ─── MOBILE: cartoline ─── -->
      <div class="lg:hidden space-y-3">
        <div
          v-for="r in righe"
          :key="r.studentId"
          class="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-4 space-y-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-slate-900 truncate">{{ nomeAlunno(r) }}</p>
              <p v-if="classeScuola(r)" class="text-xs text-slate-400 truncate">{{ classeScuola(r) }}</p>
            </div>
            <div class="text-right shrink-0">
              <UBadge :color="coloreStatoRientro(r.stato)" variant="soft" size="sm">
                {{ labelStatoRientro(r.stato) }}
              </UBadge>
              <p v-if="r.dataRisposta" class="text-[11px] text-slate-400 mt-1">{{ formatGiorno(r.dataRisposta) }}</p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span v-if="r.ultimaLezione" class="text-slate-500">ult. lezione {{ formatMeseAnno(r.ultimaLezione) }}</span>
            <span v-else class="text-slate-400">mai iniziato</span>
            <UBadge v-if="r.haPacchettoAttivo" color="success" variant="subtle" size="sm">
              ha il pacchetto{{ r.pacchettoNome ? `: ${r.pacchettoNome}` : '' }}
            </UBadge>
            <UBadge v-else color="neutral" variant="subtle" size="sm">nessun pacchetto</UBadge>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              v-if="telefonoUtile(r)" icon="i-heroicons-phone" size="sm" variant="soft" color="neutral"
              :to="linkTelefono(telefonoUtile(r))" title="Chiama" aria-label="Chiama"
            />
            <UButton
              v-if="telefonoUtile(r)" icon="i-heroicons-chat-bubble-left-ellipsis" size="sm" variant="soft" color="success"
              :to="linkWhatsapp(telefonoUtile(r))" target="_blank" title="WhatsApp" aria-label="Scrivi su WhatsApp"
            />
            <!-- Ha detto sì ma non ha ancora il pacchetto: lo si crea da qui -->
            <UButton
              v-if="puoCrearePacchetto(r)"
              icon="i-heroicons-cube" size="xs" variant="soft" color="primary"
              title="Crea il pacchetto per questo alunno"
              @click="() => apriCreaPacchetto(r)"
            >
              Crea pacchetto
            </UButton>
            <UButton
              v-if="!soloLettura"
              icon="i-heroicons-pencil-square" size="sm" variant="ghost" color="neutral" class="ml-auto"
              :title="r.note ? 'Modifica la nota' : 'Aggiungi una nota'"
              :aria-label="r.note ? 'Modifica la nota' : 'Aggiungi una nota'"
              @click="() => apriNota(r)"
            />
          </div>

          <p v-if="r.note" class="text-xs text-slate-500 bg-slate-50 rounded-lg px-2 py-1.5">{{ r.note }}</p>

          <div v-if="!soloLettura" class="grid grid-cols-3 gap-2">
            <UButton
              v-for="risposta in RISPOSTE_RAPIDE"
              :key="risposta.value"
              size="sm"
              block
              :color="coloreStatoRientro(risposta.value)"
              :variant="r.stato === risposta.value ? 'solid' : 'outline'"
              :loading="inSalvataggio === `${r.studentId}|${risposta.value}`"
              @click="() => rispondi(r, risposta.value)"
            >
              {{ risposta.label }}
            </UButton>
          </div>
        </div>
      </div>

      <!-- ─── DESKTOP: tabella ─── -->
      <UCard :ui="{ body: 'p-0' }" class="overflow-hidden hidden lg:block">
        <UTable
          :data="righe"
          :columns="colonne"
          :loading="pending"
          class="w-full"
          :ui="{
            th: 'bg-slate-50 text-slate-600 font-semibold py-3 px-4 text-sm',
            td: 'py-3 px-4 align-middle',
            tr: 'hover:bg-slate-50/80 transition-colors',
          }"
        >
          <template #alunno-cell="{ row }">
            <div>
              <p class="font-semibold text-slate-900">{{ nomeAlunno(row.original) }}</p>
              <p v-if="classeScuola(row.original)" class="text-xs text-slate-400 truncate max-w-[16rem]">
                {{ classeScuola(row.original) }}
              </p>
            </div>
          </template>

          <template #lezione-cell="{ row }">
            <span v-if="row.original.ultimaLezione" class="text-sm text-slate-600">
              {{ formatMeseAnno(row.original.ultimaLezione) }}
            </span>
            <span v-else class="text-sm text-slate-400">mai</span>
          </template>

          <template #pacchetto-cell="{ row }">
            <UBadge v-if="row.original.haPacchettoAttivo" color="success" variant="subtle" class="max-w-[14rem] truncate">
              ha il pacchetto{{ row.original.pacchettoNome ? `: ${row.original.pacchettoNome}` : '' }}
            </UBadge>
            <UBadge v-else color="neutral" variant="subtle">nessun pacchetto</UBadge>
          </template>

          <template #contatti-cell="{ row }">
            <div class="flex items-center gap-1">
              <UButton
                v-if="telefonoUtile(row.original)" icon="i-heroicons-phone" size="xs" variant="ghost" color="neutral"
                :to="linkTelefono(telefonoUtile(row.original))" title="Chiama" aria-label="Chiama"
              />
              <UButton
                v-if="telefonoUtile(row.original)" icon="i-heroicons-chat-bubble-left-ellipsis" size="xs" variant="ghost" color="success"
                :to="linkWhatsapp(telefonoUtile(row.original))" target="_blank" title="WhatsApp" aria-label="Scrivi su WhatsApp"
              />
              <span v-if="!telefonoUtile(row.original)" class="text-sm text-slate-400">—</span>
            </div>
          </template>

          <template #stato-cell="{ row }">
            <div>
              <UBadge :color="coloreStatoRientro(row.original.stato)" variant="soft">
                {{ labelStatoRientro(row.original.stato) }}
              </UBadge>
              <p v-if="row.original.dataRisposta" class="text-[11px] text-slate-400 mt-1">
                {{ formatGiorno(row.original.dataRisposta) }}
              </p>
            </div>
          </template>

          <template #risposta-cell="{ row }">
            <div class="flex items-center justify-end gap-1.5">
              <template v-if="!soloLettura">
                <UButton
                  v-for="risposta in RISPOSTE_RAPIDE"
                  :key="risposta.value"
                  size="xs"
                  :color="coloreStatoRientro(risposta.value)"
                  :variant="row.original.stato === risposta.value ? 'solid' : 'outline'"
                  :loading="inSalvataggio === `${row.original.studentId}|${risposta.value}`"
                  @click="() => rispondi(row.original, risposta.value)"
                >
                  {{ risposta.label }}
                </UButton>
                <UButton
                  icon="i-heroicons-pencil-square" size="xs" variant="ghost"
                  :color="row.original.note ? 'primary' : 'neutral'"
                  :title="row.original.note ? row.original.note : 'Aggiungi una nota'"
                  :aria-label="row.original.note ? 'Modifica la nota' : 'Aggiungi una nota'"
                  @click="() => apriNota(row.original)"
                />
              </template>
              <!-- Sola lettura: la nota non si modifica, ma si deve poter leggere -->
              <UIcon
                v-else-if="row.original.note"
                name="i-heroicons-chat-bubble-bottom-center-text"
                class="w-4 h-4 text-slate-400"
                :title="row.original.note"
              />
              <!-- Ha detto sì ma non ha ancora il pacchetto: lo si crea da qui -->
              <UButton
                v-if="puoCrearePacchetto(row.original)"
                icon="i-heroicons-cube" size="xs" variant="soft" color="primary"
                title="Crea il pacchetto per questo alunno"
                @click="() => apriCreaPacchetto(row.original)"
              >
                Crea pacchetto
              </UButton>
            </div>
          </template>
        </UTable>
      </UCard>
    </template>

    <!-- ═══ NESSUN RISULTATO ═══ -->
    <div v-else class="py-12 text-center bg-white rounded-2xl ring-1 ring-slate-200">
      <UIcon name="i-heroicons-clipboard-document-check" class="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p class="text-slate-500 text-sm">
        {{ conFiltri
          ? 'Nessun alunno con questi filtri. Prova a cancellare la ricerca o a rimettere «Stato: tutti».'
          : 'Nessun alunno attivo in elenco. Controlla che in Studenti ci sia qualcuno attivo.' }}
      </p>
    </div>

    <!-- ═══ RIGA INFORMATIVA: chi è nascosto perché non ha mai iniziato ═══ -->
    <!-- Serve a far tornare i conti: le card contano TUTTI gli attivi, la lista no -->
    <p v-if="!includiMaiPartiti && kpi.maiPartiti > 0" class="text-sm text-slate-500 flex flex-wrap items-center justify-center gap-1">
      <UIcon name="i-heroicons-eye-slash" class="w-4 h-4 shrink-0" />
      {{ testoMaiPartiti }}
      <UButton variant="link" color="primary" size="sm" class="p-0" @click="() => { includiMaiPartiti = true }">
        {{ kpi.maiPartiti === 1 ? 'mostralo' : 'mostrali' }}
      </UButton>
    </p>

    <!-- ═══ RIGA INFORMATIVA: il ponte con i Contatti ═══ -->
    <p v-if="kpi.inTrattativa > 0" class="text-center text-sm text-slate-500">
      <UIcon name="i-heroicons-information-circle" class="w-4 h-4 align-text-bottom" />
      In Contatti ci sono {{ kpi.inTrattativa }}
      {{ kpi.inTrattativa === 1 ? 'persona in trattativa non ancora iscritta' : 'persone in trattativa non ancora iscritte' }}
      <NuxtLink to="/contatti?tab=doposcuola&stato=IN_TRATTATIVA" class="text-tfn-600 hover:underline font-medium">→</NuxtLink>
    </p>

    <!-- ═══ FINESTRA DELLA NOTA ═══ -->
    <UModal v-model:open="modalNotaAperta" :title="`Nota su ${nomeAlunno(rigaInNota)}`" :ui="{ content: 'max-w-lg' }">
      <template #body>
        <UFormField label="Nota" description="Es. «Richiamare dopo il 15», «vuole solo matematica»">
          <UTextarea v-model="testoNota" :rows="4" class="w-full" placeholder="Scrivi qui…" />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" @click="() => { modalNotaAperta = false }">Annulla</UButton>
          <UButton :loading="salvandoNota" @click="salvaNota">Salva</UButton>
        </div>
      </template>
    </UModal>

    <!-- ═══ CREA PACCHETTO — un solo modale per tutta la pagina ═══ -->
    <ModalCreaPacchetto
      v-model:open="modalPacchettoAperto"
      :student-id="rigaPacchetto?.studentId"
      :student-name="nomeAlunno(rigaPacchetto)"
      @refresh="dopoPacchettoCreato"
    />

    <!-- ═══ FINE APPELLO: disattiva chi non torna ═══ -->
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
// Pagina Rientri: l'appello di inizio anno. L'elenco degli alunni attivi con la
// risposta che ci hanno dato, i numeri delle card e i filtri arrivano da UNA
// sola chiamata a /api/confirmations.
import { labelStatoRientro } from '#shared/rientri'
import type { StatoRientro } from '#shared/rientri'
import {
  STATI_RIENTRO_FILTRO_ITEMS, RISPOSTE_RAPIDE, KPI_RIENTRI_VUOTI,
  coloreStatoRientro, formatMeseAnno, formatGiornoEsteso,
  nomeAlunno, classeScuola, telefonoUtile,
} from '~/utils/rientri'
import type { RigaRientro, KpiRientri, RispostaRientri } from '~/utils/rientri'
import { NESSUN_FILTRO, formatGiorno, linkTelefono, linkWhatsapp } from '~/utils/contatti'
import ConfirmDialog from '~/components/ConfirmDialog.vue'

definePageMeta({ middleware: ['admin-or-super'] })

const toast = useToast()

// ─── Filtri ───────────────────────────────────
const ricerca           = ref('')
const ricercaApplicata  = ref('')
const filtroStato       = ref<string>(NESSUN_FILTRO)
const soloAttiviRecenti = ref(false)
// Di default i "mai partiti" restano nascosti: non ha senso chiamarli per primi
const includiMaiPartiti = ref(false)

// La ricerca parte 300 ms dopo l'ultimo tasto: niente chiamata a ogni lettera
let timerRicerca: ReturnType<typeof setTimeout> | null = null
watch(ricerca, (testo) => {
  if (timerRicerca) clearTimeout(timerRicerca)
  timerRicerca = setTimeout(() => { ricercaApplicata.value = testo.trim() }, 300)
})
onBeforeUnmount(() => { if (timerRicerca) clearTimeout(timerRicerca) })

// Anno che si sta guardando: vuoto = quello corrente delle impostazioni
const annoSelezionato = ref('')

// ─── Una sola chiamata: elenco + numeri delle card + anno corrente ───
const { data, pending, refresh } = useLazyFetch<RispostaRientri>('/api/confirmations', {
  server: false,
  query: computed(() => ({
    anno:              annoSelezionato.value || undefined,
    stato:             filtroStato.value === NESSUN_FILTRO ? undefined : filtroStato.value,
    search:            ricercaApplicata.value || undefined,
    soloAttiviRecenti: soloAttiviRecenti.value ? '1' : undefined,
    includiMaiPartiti: includiMaiPartiti.value ? '1' : undefined,
  })),
})

// Copia locale: i tre bottoni la aggiornano subito, senza ricaricare la pagina
const righe = ref<RigaRientro[]>([])
const kpi   = ref<KpiRientri>({ ...KPI_RIENTRI_VUOTI })
const anno         = ref('')
const annoCorrente = ref('')
const anni         = ref<string[]>([])
const inizio = ref('')

watchEffect(() => {
  righe.value  = (data.value?.items ?? []).map((r) => ({ ...r }))
  kpi.value    = { ...KPI_RIENTRI_VUOTI, ...(data.value?.kpi ?? {}) }
  anno.value         = data.value?.anno ?? ''
  annoCorrente.value = data.value?.annoCorrente ?? ''
  anni.value         = data.value?.anni ?? []
  inizio.value = data.value?.inizio ?? ''
})

// ─── Storico: gli anni passati si guardano soltanto ───
const anniItems = computed(() => anni.value.map((a) => ({ label: a, value: a })))

// Il menu mostra sempre un anno, anche quando nessuno l'ha ancora scelto a mano
const annoScelto = computed({
  get: () => annoSelezionato.value || anno.value,
  set: (v: string) => { annoSelezionato.value = v },
})

const soloLettura = computed(() => {
  const scelto = annoSelezionato.value || annoCorrente.value
  return Boolean(annoCorrente.value && scelto !== annoCorrente.value)
})

const conFiltri = computed(() => Boolean(
  ricercaApplicata.value || filtroStato.value !== NESSUN_FILTRO || soloAttiviRecenti.value,
))

// "Si comincia lunedì 14 settembre"
const quandoSiComincia = computed(() =>
  inizio.value ? `Si comincia ${formatGiornoEsteso(inizio.value)}` : 'Primo giorno di lezione non ancora impostato',
)

// "42 ragazzi confermati" — il numero che conta, in grassetto
const testoConfermati = computed(() => {
  const n = kpi.value.confermati
  return `${n} ${n === 1 ? 'ragazzo confermato' : 'ragazzi confermati'}`
})

// "di cui 7 arrivati dai Contatti": NON è una somma, sono già dentro i confermati
const testoNuoviDaContatti = computed(() => {
  const n = kpi.value.nuoviDaContatti
  return `di cui ${n} ${n === 1 ? 'arrivato' : 'arrivati'} dai Contatti`
})

// Riga che spiega perché i numeri delle card sono più alti delle righe a schermo
const testoMaiPartiti = computed(() => {
  const n = kpi.value.maiPartiti
  return n === 1
    ? "C'è anche 1 alunno che non ha mai fatto lezione, nascosto per non intasare l'appello —"
    : `Ci sono anche ${n} alunni che non hanno mai fatto lezione, nascosti per non intasare l'appello —`
})

// ─── Badge del menu: sempre allineato ai "da sentire" dell'anno CORRENTE ───
// (guardando uno storico i numeri sono di un altro anno: il pallino non si tocca)
const badgeRientri = useState<number>('rientri-pending-count', () => 0)
watchEffect(() => { if (!soloLettura.value) badgeRientri.value = kpi.value.daSentire })

// ─── Card di riepilogo: un click accende il filtro, un altro lo spegne ───
function alternaStato(valore: string) {
  filtroStato.value = filtroStato.value === valore ? NESSUN_FILTRO : valore
}

const cards = computed(() => [
  {
    key: 'daSentire',
    label: 'Da sentire',
    valore: kpi.value.daSentire,
    classe: kpi.value.daSentire > 0 ? 'text-red-600' : 'text-slate-900',
    attiva: filtroStato.value === 'DA_SENTIRE',
    aiuto: 'Alunni attivi a cui non hai ancora segnato nessuna risposta per questo anno. È lo stesso numero del pallino rosso nel menu.',
    onClick: () => alternaStato('DA_SENTIRE'),
  },
  {
    key: 'confermati',
    label: 'Confermati',
    valore: kpi.value.confermati,
    classe: 'text-emerald-600',
    attiva: filtroStato.value === 'CONFERMATO',
    aiuto: 'Ti hanno detto che tornano. Attenzione: aver confermato non vuol dire aver già preso il pacchetto.',
    onClick: () => alternaStato('CONFERMATO'),
  },
  {
    key: 'inForse',
    label: 'In forse',
    valore: kpi.value.inForse,
    classe: 'text-amber-600',
    attiva: filtroStato.value === 'IN_FORSE',
    aiuto: 'Ci stanno pensando: da richiamare fra qualche giorno.',
    onClick: () => alternaStato('IN_FORSE'),
  },
  {
    key: 'nonTornano',
    label: 'Non tornano',
    valore: kpi.value.nonTornano,
    classe: 'text-slate-900',
    attiva: filtroStato.value === 'NON_TORNA',
    aiuto: "Hanno detto che quest'anno non vengono. A fine appello si potranno disattivare tutti insieme.",
    onClick: () => alternaStato('NON_TORNA'),
  },
])

// ─── Colonne della tabella (desktop) ───
const colonne = [
  { id: 'alunno',    header: 'Alunno' },
  { id: 'lezione',   header: 'Ultima lezione' },
  { id: 'pacchetto', header: 'Pacchetto' },
  { id: 'contatti',  header: 'Contatti' },
  { id: 'stato',     header: 'Stato' },
  { id: 'risposta',  header: '' },
]

// ─── I tre bottoni: salvano subito e aggiornano i numeri in tempo reale ───
const inSalvataggio = ref<string | null>(null)

// Sposta di uno i contatori delle card quando una risposta cambia
function spostaContatori(riga: RigaRientro, da: StatoRientro, a: StatoRientro) {
  const campo: Record<StatoRientro, keyof KpiRientri> = {
    DA_SENTIRE: 'daSentire',
    CONFERMATO: 'confermati',
    IN_FORSE:   'inForse',
    NON_TORNA:  'nonTornano',
  }
  kpi.value[campo[da]] = Math.max(0, kpi.value[campo[da]] - 1)
  kpi.value[campo[a]]  = kpi.value[campo[a]] + 1

  // "Confermati senza pacchetto" segue solo chi il pacchetto non ce l'ha
  if (!riga.haPacchettoAttivo) {
    if (da === 'CONFERMATO') kpi.value.confermatiSenzaPacchetto = Math.max(0, kpi.value.confermatiSenzaPacchetto - 1)
    if (a === 'CONFERMATO')  kpi.value.confermatiSenzaPacchetto = kpi.value.confermatiSenzaPacchetto + 1
  }
}

async function rispondi(riga: RigaRientro, stato: StatoRientro) {
  // Premere di nuovo il bottone già acceso non fa nulla; sugli anni passati nemmeno
  if (soloLettura.value || riga.stato === stato || inSalvataggio.value) return

  // Chiave "alunno|risposta": la rotellina gira solo sul bottone premuto
  inSalvataggio.value = `${riga.studentId}|${stato}`
  const precedente = riga.stato
  try {
    const res = await $fetch<{ data: { stato: StatoRientro; dataRisposta: string | null; note: string | null } }>(
      `/api/confirmations/${riga.studentId}`,
      { method: 'PUT', body: { stato } },
    )
    riga.stato        = res.data?.stato ?? stato
    riga.dataRisposta = res.data?.dataRisposta ?? null
    spostaContatori(riga, precedente, riga.stato)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'Non è stato possibile salvare la risposta', color: 'error' })
  } finally {
    inSalvataggio.value = null
  }
}

// ─── Nota sulla riga ───
const modalNotaAperta = ref(false)
const rigaInNota      = ref<RigaRientro | null>(null)
const testoNota       = ref('')
const salvandoNota    = ref(false)

function apriNota(riga: RigaRientro) {
  rigaInNota.value = riga
  testoNota.value  = riga.note ?? ''
  modalNotaAperta.value = true
}

async function salvaNota() {
  const riga = rigaInNota.value
  if (!riga || soloLettura.value) return

  salvandoNota.value = true
  try {
    // Stesso sportello dei tre bottoni: si rimanda lo stato attuale e la nota nuova
    const res = await $fetch<{ data: { note: string | null } }>(`/api/confirmations/${riga.studentId}`, {
      method: 'PUT',
      body: { stato: riga.stato, note: testoNota.value },
    })
    riga.note = res.data?.note ?? null
    modalNotaAperta.value = false
    toast.add({ title: 'Nota salvata', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'Non è stato possibile salvare la nota', color: 'error' })
  } finally {
    salvandoNota.value = false
  }
}

// ─── Crea pacchetto dalla riga ───
// Un solo modale per tutta la pagina: cambia solo l'alunno che gli passiamo.
const modalPacchettoAperto = ref(false)
const rigaPacchetto        = ref<RigaRientro | null>(null)

// Il bottone compare solo su chi ha detto sì e il pacchetto non ce l'ha ancora
const puoCrearePacchetto = (r: RigaRientro): boolean =>
  !soloLettura.value && r.stato === 'CONFERMATO' && !r.haPacchettoAttivo

function apriCreaPacchetto(riga: RigaRientro) {
  rigaPacchetto.value = riga
  modalPacchettoAperto.value = true
}

// Il modale si chiude e avvisa da solo: qui basta rileggere la lista, così la
// riga passa a "ha il pacchetto" e la card rossa scende di uno.
async function dopoPacchettoCreato() {
  await refresh()
}

// ─── Fine appello: chi non torna esce dagli alunni attivi ───
const { confirmOpen, confirmTitle, confirmDescription, confirmLabel, confirmColor, confirmLoading, chiediConferma, eseguiConferma } = useConfirm()

function chiediDisattivazione() {
  const n = kpi.value.nonTornano
  if (soloLettura.value || n === 0) return

  chiediConferma(
    {
      title: `Disattivare ${n} ${n === 1 ? 'alunno' : 'alunni'}?`,
      description:
        'Gli alunni che hanno detto di non tornare escono dall\'elenco degli attivi. '
        + 'Le loro schede, i pacchetti e lo storico restano: puoi riattivarli quando vuoi dalla loro scheda.\n\n'
        + 'Da qui in poi spariranno da questo elenco e la card «Non tornano» tornerà a 0: è normale, non hai perso niente.',
      confirmLabel: 'Disattiva',
      confirmColor: 'warning',
      // La finestra resta aperta con la rotellina finché l'operazione non finisce
      attendi: true,
    },
    async () => {
      try {
        const res = await $fetch<{ disattivati: number; nomi: string[] }>(
          '/api/confirmations/disattiva-non-rientrati',
          { method: 'POST', body: {} },
        )
        const quanti = res?.disattivati ?? 0
        toast.add({
          title: quanti === 1 ? '1 alunno disattivato' : `${quanti} alunni disattivati`,
          description: 'Le schede e lo storico restano: si riattivano dalla scheda dell\'alunno.',
          color: 'success',
        })
        await refresh()
      } catch (err: any) {
        toast.add({ title: err?.data?.statusMessage ?? 'Non è stato possibile disattivare gli alunni', color: 'error' })
        // Rilancio: la finestra resta aperta e si può riprovare
        throw err
      }
    },
  )
}
</script>
