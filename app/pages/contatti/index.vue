<template>
  <div class="space-y-6">

    <!-- ═══ INTESTAZIONE ═══ -->
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">Contatti</h2>
        <p class="text-sm text-slate-500 mt-0.5">Chi ci ha scritto o chiamato, da ricontattare</p>
      </div>
      <div class="flex items-center gap-2">
        <UTooltip text="Carica una lista di contatti preparata in Excel">
          <UButton icon="i-heroicons-arrow-up-tray" variant="soft" color="neutral" @click="apriImport">
            Importa CSV
          </UButton>
        </UTooltip>
        <UTooltip text="Scarica in Excel i contatti di questa scheda con i filtri attivi">
          <UButton
            icon="i-heroicons-arrow-down-tray" variant="soft" color="neutral"
            :loading="esportando" @click="esportaCsv"
          >
            Esporta CSV
          </UButton>
        </UTooltip>
        <UButton icon="i-heroicons-plus" @click="apriNuovo">Nuovo contatto</UButton>
      </div>
    </div>

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
          :title="card.attiva ? 'Togli questo filtro' : 'Mostra solo questi contatti'"
          @click="card.onClick()"
        >
          <p class="text-sm text-slate-500 pr-6">{{ card.label }}</p>
          <p class="text-2xl font-bold leading-none mt-1.5" :class="card.classe">{{ card.valore }}</p>
        </button>
        <span class="absolute top-3 right-3"><StatHelp :text="card.aiuto" /></span>
      </div>
    </div>

    <!-- ═══ LE DUE TAB (cassetti) ═══ -->
    <UTabs
      :model-value="tab"
      :items="tabItems"
      :content="false"
      :ui="{ list: 'overflow-x-auto', trigger: 'shrink-0' }"
      @update:model-value="cambiaTab"
    />

    <!-- ═══ FILTRI ═══ -->
    <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
      <UInput
        v-model="ricerca"
        icon="i-heroicons-magnifying-glass"
        placeholder="Cerca nome, telefono, email, profilo social, studente, azienda…"
        class="w-full sm:w-80"
        aria-label="Cerca fra i contatti"
      />
      <USelect v-model="filtroStato" :items="STATI_FILTRO_ITEMS" class="w-full sm:w-48" aria-label="Filtra per stato" />
      <USelect v-model="filtroCanale" :items="CANALI_FILTRO_ITEMS" class="w-full sm:w-48" aria-label="Filtra per fonte" />
      <!-- "Chi è" esiste solo nel cassetto Doposcuola -->
      <USelect
        v-if="tab === 'DOPOSCUOLA'"
        v-model="filtroRuolo"
        :items="RUOLI_DOPOSCUOLA_FILTRO_ITEMS"
        class="w-full sm:w-48"
        aria-label="Filtra per chi è: possibili studenti o possibili tutor"
      />
      <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
        <USwitch v-model="soloDaRicontattare" aria-label="Mostra solo i contatti da ricontattare" />
        Solo da ricontattare
      </label>
      <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
        <USwitch v-model="mostraArchiviati" aria-label="Mostra anche i contatti archiviati" />
        Mostra archiviati
      </label>
    </div>

    <!-- ═══ CARICAMENTO (prima volta) ═══ -->
    <div v-if="(pending || !data) && contatti.length === 0" class="space-y-3">
      <USkeleton v-for="n in 5" :key="n" class="h-16 w-full rounded-2xl" />
    </div>

    <!-- ═══ LISTA ═══ -->
    <template v-else-if="contatti.length > 0">

      <!-- ─── MOBILE: cartoline ─── -->
      <div class="lg:hidden space-y-3">
        <div
          v-for="c in contatti"
          :key="c.id"
          class="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-4 space-y-2"
          :class="c.archiviatoAt ? 'opacity-60' : ''"
        >
          <button type="button" class="w-full text-left" @click="apriScheda(c.id)">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-semibold text-slate-900 truncate">
                  {{ nomeContatto(c) }}
                  <UBadge v-if="c.doposcuolaRuolo === 'TUTOR'" color="info" variant="subtle" size="xs">Tutor</UBadge>
                </p>
                <p v-if="sottotitoloContatto(c)" class="text-xs text-slate-400 truncate">
                  ↳ {{ sottotitoloContatto(c) }}
                </p>
              </div>
              <UBadge :color="coloreStato(c.stato)" variant="soft" size="sm">{{ labelStato(c.stato) }}</UBadge>
            </div>
            <div class="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
              <UBadge color="neutral" variant="subtle" size="sm">{{ labelCanale(c.canaleOrigine) }}</UBadge>
              <UBadge v-if="c.archiviatoAt" color="neutral" variant="soft" size="sm">Archiviato</UBadge>
              <span v-if="c.prossimoRicontatto" :class="ricontattoScaduto(c, oggi) ? 'text-red-600 font-medium' : ''">
                <UIcon v-if="ricontattoScaduto(c, oggi)" name="i-heroicons-exclamation-circle" class="w-4 h-4 align-text-bottom" />
                Richiamare il {{ formatGiorno(c.prossimoRicontatto) }}
              </span>
            </div>
            <!-- Chi ci scrive solo in chat social: il profilo è il suo recapito -->
            <p v-if="c.socialLink" class="flex items-center gap-1 mt-2 text-xs text-slate-500 min-w-0">
              <UIcon name="i-heroicons-at-symbol" class="w-3.5 h-3.5 shrink-0" />
              <span class="truncate">{{ etichettaSocial(c.socialLink) }}</span>
            </p>
          </button>

          <div class="flex items-center gap-2 pt-1">
            <UButton
              v-if="c.telefono" icon="i-heroicons-phone" size="sm" variant="soft" color="neutral"
              :to="linkTelefono(c.telefono)" title="Chiama" aria-label="Chiama"
            />
            <UButton
              v-if="c.telefono" icon="i-heroicons-chat-bubble-left-ellipsis" size="sm" variant="soft" color="success"
              :to="linkWhatsapp(c.telefono)" target="_blank" title="WhatsApp" aria-label="Scrivi su WhatsApp"
            />
            <UButton
              v-if="c.email" icon="i-heroicons-envelope" size="sm" variant="soft" color="neutral"
              :to="linkEmail(c.email)" title="Email" aria-label="Manda una email"
            />
            <UButton
              v-if="linkSocial(c.socialLink, c.canaleOrigine)"
              icon="i-heroicons-at-symbol" size="sm" variant="soft" color="neutral"
              :to="linkSocial(c.socialLink, c.canaleOrigine) ?? undefined" target="_blank"
              title="Apri la chat/profilo" aria-label="Apri la chat o il profilo social"
            />
            <UButton
              icon="i-heroicons-pencil-square" size="sm" variant="ghost" color="neutral" class="ml-auto"
              title="Modifica" aria-label="Modifica il contatto" @click="apriModifica(c)"
            />
            <UButton
              :icon="c.archiviatoAt ? 'i-heroicons-arrow-uturn-left' : 'i-heroicons-archive-box-arrow-down'"
              size="sm" variant="ghost" color="neutral"
              :title="c.archiviatoAt ? 'Ripristina' : 'Archivia'"
              :aria-label="c.archiviatoAt ? 'Ripristina il contatto' : 'Archivia il contatto'"
              @click="chiediArchiviazione(c)"
            />
          </div>
        </div>
      </div>

      <!-- ─── DESKTOP: tabella ─── -->
      <UCard :ui="{ body: 'p-0' }" class="overflow-hidden hidden lg:block">
        <UTable
          :data="contatti"
          :columns="colonne"
          :loading="pending"
          class="w-full"
          :ui="{
            th: 'bg-slate-50 text-slate-600 font-semibold py-3 px-4 text-sm',
            td: 'py-3 px-4 align-middle',
            tr: 'hover:bg-slate-50/80 transition-colors cursor-pointer',
          }"
          @select="onRigaSelezionata"
        >
          <template #nome-cell="{ row }">
            <div :class="row.original.archiviatoAt ? 'opacity-60' : ''">
              <p class="font-semibold text-slate-900">
                {{ nomeContatto(row.original) }}
                <UBadge v-if="row.original.doposcuolaRuolo === 'TUTOR'" color="info" variant="subtle" size="xs">Tutor</UBadge>
              </p>
              <p v-if="sottotitoloContatto(row.original)" class="text-xs text-slate-400 truncate max-w-[16rem]">
                ↳ {{ sottotitoloContatto(row.original) }}
              </p>
              <UBadge v-if="row.original.archiviatoAt" color="neutral" variant="soft" size="xs" class="mt-1">
                Archiviato
              </UBadge>
            </div>
          </template>

          <template #contatti-cell="{ row }">
            <div class="flex items-center gap-1">
              <div class="text-sm flex-1 min-w-0">
                <!-- Il trattino serve solo se non c'è proprio nessun recapito -->
                <div v-if="row.original.telefono" class="text-slate-700">{{ row.original.telefono }}</div>
                <div v-else-if="!row.original.socialLink" class="text-slate-700">—</div>
                <div class="text-slate-400 text-xs truncate max-w-[12rem]">{{ row.original.email ?? '' }}</div>
                <div
                  v-if="row.original.socialLink"
                  class="text-slate-500 text-xs flex items-center gap-1 min-w-0 max-w-[12rem]"
                >
                  <UIcon name="i-heroicons-at-symbol" class="w-3.5 h-3.5 shrink-0" />
                  <span class="truncate">{{ etichettaSocial(row.original.socialLink) }}</span>
                </div>
              </div>
              <UButton
                v-if="row.original.telefono" icon="i-heroicons-phone" size="xs" variant="ghost" color="neutral"
                :to="linkTelefono(row.original.telefono)" title="Chiama" aria-label="Chiama"
              />
              <UButton
                v-if="row.original.telefono" icon="i-heroicons-chat-bubble-left-ellipsis" size="xs" variant="ghost" color="success"
                :to="linkWhatsapp(row.original.telefono)" target="_blank" title="WhatsApp" aria-label="Scrivi su WhatsApp"
              />
              <UButton
                v-if="row.original.email" icon="i-heroicons-envelope" size="xs" variant="ghost" color="neutral"
                :to="linkEmail(row.original.email)" title="Email" aria-label="Manda una email"
              />
              <UButton
                v-if="linkSocial(row.original.socialLink, row.original.canaleOrigine)"
                icon="i-heroicons-at-symbol" size="xs" variant="ghost" color="neutral"
                :to="linkSocial(row.original.socialLink, row.original.canaleOrigine) ?? undefined" target="_blank"
                title="Apri la chat/profilo" aria-label="Apri la chat o il profilo social"
              />
            </div>
          </template>

          <template #fonte-cell="{ row }">
            <UBadge color="neutral" variant="subtle">{{ labelCanale(row.original.canaleOrigine) }}</UBadge>
          </template>

          <template #stato-cell="{ row }">
            <UBadge :color="coloreStato(row.original.stato)" variant="soft">{{ labelStato(row.original.stato) }}</UBadge>
          </template>

          <template #ultimo-cell="{ row }">
            <span class="text-sm text-slate-600">{{ formatQuando(row.original.ultimoContattoAt) }}</span>
          </template>

          <template #ricontatto-cell="{ row }">
            <span
              v-if="row.original.prossimoRicontatto"
              class="text-sm inline-flex items-center gap-1"
              :class="ricontattoScaduto(row.original, oggi) ? 'text-red-600 font-semibold' : 'text-slate-600'"
            >
              <UIcon v-if="ricontattoScaduto(row.original, oggi)" name="i-heroicons-exclamation-circle" class="w-4 h-4" />
              {{ formatGiorno(row.original.prossimoRicontatto) }}
            </span>
            <span v-else class="text-sm text-slate-400">—</span>
          </template>

          <template #azioni-cell="{ row }">
            <div class="flex items-center justify-end gap-1">
              <UButton
                icon="i-heroicons-arrow-right" size="xs" variant="ghost" color="neutral"
                title="Apri la scheda" aria-label="Apri la scheda" @click="apriScheda(row.original.id)"
              />
              <UButton
                icon="i-heroicons-pencil-square" size="xs" variant="ghost" color="neutral"
                title="Modifica" aria-label="Modifica il contatto" @click="apriModifica(row.original)"
              />
              <UButton
                :icon="row.original.archiviatoAt ? 'i-heroicons-arrow-uturn-left' : 'i-heroicons-archive-box-arrow-down'"
                size="xs" variant="ghost" color="neutral"
                :title="row.original.archiviatoAt ? 'Ripristina' : 'Archivia'"
                :aria-label="row.original.archiviatoAt ? 'Ripristina il contatto' : 'Archivia il contatto'"
                @click="chiediArchiviazione(row.original)"
              />
            </div>
          </template>
        </UTable>
      </UCard>

      <!-- ─── PAGINAZIONE ─── -->
      <div v-if="meta.totalPages > 1" class="flex flex-col sm:flex-row justify-between items-center gap-3 py-2">
        <p class="text-sm text-slate-500">
          Pagina {{ meta.page }} di {{ meta.totalPages }} ({{ totale }} contatti)
        </p>
        <UPagination
          v-model:page="pagina"
          :total="totale"
          :items-per-page="PER_PAGINA"
        />
      </div>
    </template>

    <!-- ═══ NESSUN RISULTATO ═══ -->
    <div v-else class="py-12 text-center bg-white rounded-2xl ring-1 ring-slate-200">
      <UIcon name="i-heroicons-phone-arrow-down-left" class="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p class="text-slate-500 text-sm">
        {{ conFiltri
          ? 'Nessun contatto con questi filtri. Prova a cancellare la ricerca o a rimettere «Stato: tutti».'
          : 'Nessun contatto ancora. Premi «Nuovo contatto» per aggiungere la prima persona che vi ha scritto o chiamato.' }}
      </p>
    </div>

    <!-- ═══ FINESTRE ═══ -->
    <ContattiModalContatto
      v-model:open="modalContattoAperta"
      :tipo="tab"
      :contatto="contattoInModifica"
      @saved="dopoSalvataggio"
    />

    <ContattiSchedaContatto
      v-model:open="schedaAperta"
      :contact-id="contattoApertoId"
      @changed="ricarica"
    />

    <ContattiModalImportCsv
      v-model:open="modalImportAperta"
      :tipo-default="tab"
      @imported="ricarica"
    />

    <ConfirmDialog
      :open="contattoDaArchiviare !== null"
      :title="contattoDaArchiviare?.archiviatoAt ? 'Ripristinare il contatto?' : 'Archiviare il contatto?'"
      :description="contattoDaArchiviare?.archiviatoAt
        ? 'Il contatto torna nella lista normale.'
        : 'Il contatto sparisce dalla lista ma non viene cancellato: puoi ritrovarlo con la spunta «Mostra archiviati».'"
      :confirm-label="contattoDaArchiviare?.archiviatoAt ? 'Ripristina' : 'Archivia'"
      :confirm-color="contattoDaArchiviare?.archiviatoAt ? 'primary' : 'warning'"
      :loading="operazioneInCorso"
      @update:open="(v: boolean) => { if (!v) contattoDaArchiviare = null }"
      @confirm="confermaArchiviazione"
    />

  </div>
</template>

<script setup lang="ts">
// Pagina Contatti (mini-CRM): due cassetti (Doposcuola / Marketing), le card di
// riepilogo cliccabili, i filtri e la lista. Tutto arriva da UNA sola chiamata
// a /api/contacts, che porta con sé anche i numeri delle card.
import { labelStato, labelCanale, labelTipo, labelRuoloMarketing, labelRuoloDoposcuola } from '#shared/contatti'
import type { TipoContatto } from '#shared/contatti'
import {
  STATI_FILTRO_ITEMS, CANALI_FILTRO_ITEMS, RUOLI_DOPOSCUOLA_FILTRO_ITEMS, NESSUN_FILTRO,
  nomeContatto, sottotitoloContatto, formatGiorno, formatQuando,
  ricontattoScaduto, coloreStato, linkTelefono, linkWhatsapp, linkEmail,
  linkSocial, etichettaSocial,
} from '~/utils/contatti'
import type { Contatto, KpiContatti } from '~/utils/contatti'

definePageMeta({ middleware: ['admin-or-super'] })

const route  = useRoute()
const router = useRouter()
const toast  = useToast()

const PER_PAGINA = 50

// Il giorno di oggi si calcola una volta sola e si riusa su tutte le righe
const oggi = oggiISO()

// ─── Tab attiva, ricordata nell'indirizzo (?tab=marketing) ───
const tab = ref<TipoContatto>(route.query.tab === 'marketing' ? 'MARKETING' : 'DOPOSCUOLA')

// ─── Filtri ───────────────────────────────────
const ricerca            = ref('')
const ricercaApplicata   = ref('')
// Si può arrivare da un link già filtrato (es. dai Rientri: ?stato=IN_TRATTATIVA);
// un valore non riconosciuto viene ignorato invece di svuotare la lista.
const statoDaUrl = STATI_FILTRO_ITEMS.some((s) => s.value === route.query.stato)
  ? String(route.query.stato)
  : NESSUN_FILTRO
const filtroStato        = ref<string>(statoDaUrl)
const filtroCanale       = ref<string>(NESSUN_FILTRO)
// "Chi è": possibili studenti / possibili tutor (solo cassetto Doposcuola)
const filtroRuolo        = ref<string>(NESSUN_FILTRO)
const soloDaRicontattare = ref(false)
const soloConvertitiMese = ref(false)
const mostraArchiviati   = ref(false)
const pagina             = ref(1)

// La ricerca parte 300 ms dopo l'ultimo tasto: niente chiamata a ogni lettera
let timerRicerca: ReturnType<typeof setTimeout> | null = null
watch(ricerca, (testo) => {
  if (timerRicerca) clearTimeout(timerRicerca)
  timerRicerca = setTimeout(() => {
    ricercaApplicata.value = testo.trim()
    pagina.value = 1
  }, 300)
})
onBeforeUnmount(() => { if (timerRicerca) clearTimeout(timerRicerca) })

// Cambiando cassetto si riparte da pagina 1 e senza filtro di stato
watch(tab, (nuovo) => {
  pagina.value = 1
  filtroStato.value = NESSUN_FILTRO
  // "Chi è" vale solo per il Doposcuola: cambiando cassetto si azzera
  filtroRuolo.value = NESSUN_FILTRO
  soloConvertitiMese.value = false
  const query = { ...route.query }
  if (nuovo === 'MARKETING') query.tab = 'marketing'
  else delete query.tab
  router.replace({ query })
})

// Frecce avanti/indietro del browser: l'indirizzo comanda la tab
watch(() => route.query.tab, (valore) => {
  const daUrl: TipoContatto = valore === 'marketing' ? 'MARKETING' : 'DOPOSCUOLA'
  if (daUrl !== tab.value) tab.value = daUrl
})

// Tornando a filtri più larghi la pagina 1 evita di finire su una pagina vuota
watch([filtroStato, filtroCanale, filtroRuolo, soloDaRicontattare, soloConvertitiMese, mostraArchiviati], () => { pagina.value = 1 })

// "Convertiti nel mese" non può convivere con un altro stato o con "solo da
// ricontattare" (darebbe sempre una lista vuota): scegliendo quelli, si spegne.
watch([filtroStato, soloDaRicontattare], ([stato, daRicontattare]) => {
  if (stato !== NESSUN_FILTRO || daRicontattare) soloConvertitiMese.value = false
})

// I filtri attivi, in un posto solo: li usano sia la lista sia l'esportazione in Excel
const filtriAttivi = computed(() => ({
  tipo:              tab.value,
  stato:             filtroStato.value === NESSUN_FILTRO ? undefined : filtroStato.value,
  canale:            filtroCanale.value === NESSUN_FILTRO ? undefined : filtroCanale.value,
  ruolo:             (tab.value === 'DOPOSCUOLA' && filtroRuolo.value !== NESSUN_FILTRO) ? filtroRuolo.value : undefined,
  search:            ricercaApplicata.value || undefined,
  daRicontattare:    soloDaRicontattare.value ? '1' : undefined,
  convertitiMese:    soloConvertitiMese.value ? '1' : undefined,
  includiArchiviati: mostraArchiviati.value ? '1' : undefined,
}))

// ─── Una sola chiamata: lista + totali + numeri delle card ───
const { data, pending, refresh } = useLazyFetch('/api/contacts', {
  server: false,
  query: computed(() => ({
    ...filtriAttivi.value,
    page:              pagina.value,
    pageSize:          PER_PAGINA,
  })),
})

const KPI_VUOTI: KpiContatti = {
  nuovi: 0, daRicontattareOggi: 0, inTrattativa: 0, convertitiMese: 0,
  totaleDoposcuola: 0, totaleMarketing: 0, totaleTutorDoposcuola: 0,
}

const contatti = computed<Contatto[]>(() => (data.value?.items ?? []) as Contatto[])
const totale   = computed(() => data.value?.total ?? 0)
const meta     = computed(() => data.value?.meta ?? { page: 1, pageSize: PER_PAGINA, totalPages: 1 })
const kpi      = computed<KpiContatti>(() => (data.value?.kpi ?? KPI_VUOTI) as KpiContatti)

const conFiltri = computed(() => Boolean(
  ricercaApplicata.value
  || filtroStato.value !== NESSUN_FILTRO
  || filtroCanale.value !== NESSUN_FILTRO
  || filtroRuolo.value !== NESSUN_FILTRO
  || soloDaRicontattare.value
  || soloConvertitiMese.value,
))

// ─── Le due tab, con quanti contatti contengono ───
const tabItems = computed(() => [
  { label: `Doposcuola (${kpi.value.totaleDoposcuola})`, value: 'DOPOSCUOLA' },
  { label: `Marketing (${kpi.value.totaleMarketing})`,   value: 'MARKETING' },
])

function cambiaTab(valore: string | number) {
  tab.value = valore === 'MARKETING' ? 'MARKETING' : 'DOPOSCUOLA'
}

// ─── Card di riepilogo: un click accende il filtro, un altro lo spegne ───
// Le card sono alternative fra loro: accendendone una, le altre si spengono.
function alternaStato(valore: string) {
  filtroStato.value = filtroStato.value === valore ? NESSUN_FILTRO : valore
  soloDaRicontattare.value = false
  soloConvertitiMese.value = false
}

const cards = computed(() => [
  {
    key: 'nuovi',
    label: 'Nuovi',
    valore: kpi.value.nuovi,
    classe: 'text-slate-900',
    attiva: filtroStato.value === 'NUOVO',
    aiuto: 'Quante persone di questo cassetto sono ancora in stato «Nuovo»: le hai ricevute ma non le hai ancora lavorate. Cliccando qui vedi solo loro.',
    onClick: () => alternaStato('NUOVO'),
  },
  {
    key: 'daRicontattare',
    label: 'Da ricontattare oggi',
    valore: kpi.value.daRicontattareOggi,
    classe: kpi.value.daRicontattareOggi > 0 ? 'text-red-600' : 'text-slate-900',
    attiva: soloDaRicontattare.value,
    aiuto: 'Persone con il promemoria «richiamare» di oggi o già scaduto, che non sono ancora convertite o perse. È lo stesso numero del pallino rosso nel menu.',
    onClick: () => {
      soloDaRicontattare.value = !soloDaRicontattare.value
      filtroStato.value = NESSUN_FILTRO
      soloConvertitiMese.value = false
    },
  },
  {
    key: 'inTrattativa',
    label: 'In trattativa',
    valore: kpi.value.inTrattativa,
    classe: 'text-slate-900',
    attiva: filtroStato.value === 'IN_TRATTATIVA',
    aiuto: 'Persone con cui la conversazione è avviata: stai concordando prezzi, orari o una prova. Cliccando qui vedi solo loro.',
    onClick: () => alternaStato('IN_TRATTATIVA'),
  },
  {
    key: 'convertiti',
    label: 'Convertiti nel mese',
    valore: kpi.value.convertitiMese,
    classe: 'text-emerald-600',
    attiva: soloConvertitiMese.value,
    aiuto: 'Quanti sono diventati clienti dal primo giorno di questo mese a oggi. Cliccando qui vedi solo i convertiti di questo mese.',
    onClick: () => {
      soloConvertitiMese.value = !soloConvertitiMese.value
      filtroStato.value = NESSUN_FILTRO
      soloDaRicontattare.value = false
    },
  },
])

// ─── Colonne della tabella (desktop) ───
const colonne = [
  { id: 'nome',       header: 'Nome' },
  { id: 'contatti',   header: 'Contatti' },
  { id: 'fonte',      header: 'Fonte' },
  { id: 'stato',      header: 'Stato' },
  { id: 'ultimo',     header: 'Ultimo contatto' },
  { id: 'ricontatto', header: 'Prossimo ricontatto' },
  { id: 'azioni',     header: '' },
]

// ─── Badge del menu: si riallinea dopo ogni operazione ───
const badgeContatti = useState<number>('contatti-pending-count', () => 0)

async function aggiornaBadge() {
  try {
    const res = await $fetch<{ count: number }>('/api/contacts/pending-count')
    badgeContatti.value = res.count
  } catch {
    // Il badge è un di più: se non risponde, la pagina funziona lo stesso
  }
}

async function ricarica() {
  await Promise.all([refresh(), aggiornaBadge()])
}

// ─── Esporta in Excel (tab attiva + filtri attivi, tutte le pagine) ───
const esportando = ref(false)

// Nel file scriviamo le etichette in italiano, non i codici del database
const perGiorno = (v: string | null) => (v ? formatGiorno(v) : '')
const perQuando = (v: string | null) => (v ? formatQuando(v) : '')
// La colonna "Ruolo" dice due cose diverse nei due cassetti: "Possibile studente"/
// "Possibile tutor" nel Doposcuola, "Cliente"/"Partner" nel Marketing.
// Nel file basta la parola secca: la spiegazione fra parentesi serve solo a schermo.
const perRuolo = (c: Contatto) => (
  c.tipo === 'DOPOSCUOLA'
    ? labelRuoloDoposcuola(c.doposcuolaRuolo)
    : (c.marketingRuolo ? labelRuoloMarketing(c.marketingRuolo).replace(/\s*\(.*$/, '') : '')
)

async function esportaCsv() {
  esportando.value = true
  try {
    // Si scaricano tutte le pagine, 200 contatti alla volta
    const righe: Contatto[] = []
    let page = 1
    let totalPages = 1
    do {
      const res = await $fetch<{ items: Contatto[]; meta: { totalPages: number } }>('/api/contacts', {
        query: { ...filtriAttivi.value, page, pageSize: 200 },
      })
      righe.push(...(res.items ?? []))
      totalPages = res.meta?.totalPages ?? 1
      page++
    } while (page <= totalPages)

    const intestazione = [
      'Tipo', 'Nome', 'Cognome', 'Telefono', 'Email', 'Profilo social', 'Fonte', 'Stato',
      'Prossimo ricontatto', 'Ultimo contatto', 'Nome studente', 'Classe/Scuola',
      'Materie', 'Attività/Azienda', 'Servizio', 'Ruolo', 'Privacy informata',
      'Note', 'Inserito il',
    ]

    const corpo = righe.map((c) => [
      labelTipo(c.tipo),
      c.nome ?? '',
      c.cognome ?? '',
      c.telefono ?? '',
      c.email ?? '',
      c.socialLink ?? '',
      labelCanale(c.canaleOrigine),
      labelStato(c.stato),
      perGiorno(c.prossimoRicontatto),
      perQuando(c.ultimoContattoAt),
      c.nomeStudente ?? '',
      c.classeScuola ?? '',
      c.materie ?? '',
      c.azienda ?? '',
      c.servizioInteresse ?? '',
      perRuolo(c),
      c.privacyInformata ? 'Sì' : 'No',
      c.note ?? '',
      perQuando(c.createdAt),
    ])

    const nomeTab = tab.value === 'MARKETING' ? 'marketing' : 'doposcuola'
    scaricaCsv(`contatti-${nomeTab}-${oggi}.csv`, righeInCsv(intestazione, corpo))
    toast.add({ title: `Esportati ${righe.length} contatti`, color: 'success' })
  } catch {
    toast.add({ title: 'Non è stato possibile creare il file', color: 'error' })
  } finally {
    esportando.value = false
  }
}

// ─── Importa da Excel ───
const modalImportAperta = ref(false)

function apriImport() {
  modalImportAperta.value = true
}

// ─── Nuovo / modifica ───
const modalContattoAperta = ref(false)
const contattoInModifica  = ref<Contatto | null>(null)

function apriNuovo() {
  contattoInModifica.value = null
  modalContattoAperta.value = true
}

function apriModifica(c: Contatto) {
  contattoInModifica.value = c
  modalContattoAperta.value = true
}

async function dopoSalvataggio() {
  await ricarica()
}

// ─── Scheda laterale ───
const schedaAperta     = ref(false)
const contattoApertoId = ref<string | null>(null)

function apriScheda(id: string) {
  contattoApertoId.value = id
  schedaAperta.value = true
}

// Click su una riga della tabella (i click su bottoni e link sono già esclusi da UTable)
function onRigaSelezionata(_evento: Event, riga: { original: Contatto }) {
  apriScheda(riga.original.id)
}

// ─── Archivia / ripristina dalla lista ───
const contattoDaArchiviare = ref<Contatto | null>(null)
const operazioneInCorso    = ref(false)

function chiediArchiviazione(c: Contatto) {
  contattoDaArchiviare.value = c
}

async function confermaArchiviazione() {
  const c = contattoDaArchiviare.value
  if (!c) return
  operazioneInCorso.value = true
  try {
    if (c.archiviatoAt) {
      await $fetch(`/api/contacts/${c.id}/ripristina`, { method: 'POST' })
      toast.add({ title: 'Contatto ripristinato', color: 'success' })
    } else {
      await $fetch(`/api/contacts/${c.id}`, { method: 'DELETE' })
      toast.add({ title: 'Contatto archiviato', color: 'success' })
    }
    contattoDaArchiviare.value = null
    await ricarica()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'Operazione non riuscita', color: 'error' })
  } finally {
    operazioneInCorso.value = false
  }
}
</script>
