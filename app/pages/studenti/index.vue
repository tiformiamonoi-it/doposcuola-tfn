<template>
  <div class="space-y-6">

    <!-- Intestazione pagina -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">Studenti</h2>
        <p class="text-sm text-slate-500 mt-0.5">{{ meta?.total ?? 0 }} studenti totali</p>
      </div>
      <UButton
        icon="i-heroicons-plus"
        @click="wizardAperto = true"
      >
        Nuovo Studente
      </UButton>
    </div>

    <!-- Tessere di riepilogo (cliccabili = filtro rapido) -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <button
        v-for="t in tessere"
        :key="t.key"
        type="button"
        @click="filtraDaTessera(t.key)"
        class="group text-left bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm px-5 py-4 flex items-center gap-4 transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
        :class="tesseraAttiva === t.key ? `ring-2 ${ACCENTI[t.accento]!.attivo} shadow-md` : ''"
      >
        <div
          class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          :class="[ACCENTI[t.accento]!.iconBg, ACCENTI[t.accento]!.iconText]"
        >
          <UIcon :name="t.icon" class="w-6 h-6" />
        </div>
        <div class="min-w-0">
          <p class="text-2xl font-bold leading-none" :class="ACCENTI[t.accento]!.valore">{{ t.valore }}</p>
          <p class="text-sm text-slate-500 mt-1 truncate">{{ t.label }}</p>
        </div>
      </button>
    </div>

    <!-- Filtri -->
    <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        placeholder="Cerca per nome, cognome o email..."
        class="w-full sm:w-64"
        @input="onSearch"
      />
      <USelect
        v-model="filtroAttivo"
        :items="[
          { label: 'Tutti', value: 'all' },
          { label: 'Attivi', value: 'true' },
          { label: 'Inattivi', value: 'false' },
        ]"
        class="w-full sm:w-32"

      />
      <USelect
        v-model="filtroPacchetto"
        :items="[
          { label: 'Stato pacchetto: Tutti', value: 'all' },
          { label: 'Da pagare', value: 'DA_PAGARE' },
          { label: 'Da rinnovare', value: 'DA_RINNOVARE' },
          { label: 'Attivo', value: 'ATTIVO' },
          { label: 'Scaduto', value: 'SCADUTO' },
          { label: 'Nessun pacchetto', value: 'NESSUNO' },
        ]"
        class="w-full sm:w-48"

      />
      <UCheckbox
        v-model="nascondiInattivi"
        label="Nascondi senza pacchetto/inattivi"

      />
    </div>



    <!-- Griglia studenti -->
    <div v-if="pending && studenti.length === 0" class="py-12 flex justify-center">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-slate-300 animate-spin" />
    </div>

    <div v-else-if="studenti.length > 0">

    <!-- ─── MOBILE: cartoline verticali ─── -->
    <div class="lg:hidden space-y-3">
      <NuxtLink
        v-for="s in studenti"
        :key="s.id"
        :to="`/studenti/${s.id}`"
        class="block bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-4 active:bg-slate-50 transition-colors"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            :class="[coloreAvatar(s.id || (s.lastName + s.firstName)).bg, coloreAvatar(s.id || (s.lastName + s.firstName)).text]"
          >
            {{ inizialiDa(s.firstName, s.lastName) }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-slate-900 truncate">{{ s.lastName }} {{ s.firstName }}</p>
            <p class="text-xs text-slate-400 truncate">
              {{ [s.classe, s.scuola].filter(Boolean).join(' · ') || s.studentEmail || s.parentEmail || '—' }}
            </p>
          </div>
          <UBadge :color="s.statusColor" variant="soft" size="md" :ui="{ rounded: 'rounded-lg' }">
            {{ s.globalStatus }}
          </UBadge>
        </div>
      </NuxtLink>
    </div>

    <!-- ─── DESKTOP: tabella ─── -->
    <UCard
      :ui="{ body: { padding: 'p-0' }, rounded: 'rounded-2xl', ring: 'ring-1 ring-slate-200', shadow: 'shadow-sm' }"
      class="overflow-hidden hidden lg:block"
    >
      <UTable
        :columns="columns"
        :data="studenti"
        :loading="pending"
        class="w-full"
        :ui="{
          th: 'bg-slate-50 text-slate-600 font-semibold py-3 px-4 text-sm',
          td: 'py-3 px-4 relative align-middle',
          tr: 'hover:bg-slate-50/80 transition-colors',
        }"
      >
        <template #studente-cell="{ row }">
          <!-- Trattino di stato: sottile, arrotondato, uno per riga -->
          <div class="absolute left-0 top-2 bottom-2 w-1 rounded-r-full" :class="{
            'bg-emerald-500': row.original.statusColor === 'success',
            'bg-amber-400':   row.original.statusColor === 'warning',
            'bg-rose-500':    row.original.statusColor === 'error',
            'bg-slate-300':   row.original.statusColor === 'neutral',
          }"></div>
          <NuxtLink :to="`/studenti/${row.original.id}`" class="flex items-center gap-3 pl-2 group/std">
            <!-- Avatar a iniziali -->
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              :class="[coloreAvatar(row.original.id || (row.original.lastName + row.original.firstName)).bg, coloreAvatar(row.original.id || (row.original.lastName + row.original.firstName)).text]"
            >
              {{ inizialiDa(row.original.firstName, row.original.lastName) }}
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-slate-900 group-hover/std:text-tfn-600 transition-colors truncate">
                {{ row.original.lastName }} {{ row.original.firstName }}
              </p>
              <p v-if="row.original.parentEmail || row.original.studentEmail" class="text-xs text-slate-400 truncate">
                {{ row.original.studentEmail || row.original.parentEmail }}
              </p>
            </div>
          </NuxtLink>
        </template>

      <template #globalStatus-cell="{ row }">
        <UBadge
          :color="row.original.statusColor"
          variant="soft"
          size="md"
          :ui="{ rounded: 'rounded-lg', font: 'font-medium tracking-wide text-sm px-3 py-1' }"
        >
          {{ row.original.globalStatus }}
        </UBadge>
      </template>

      <template #parentName-cell="{ row }">
        <div class="truncate max-w-[150px]" :title="row.original.parentName || row.original.parentEmail">
          {{ row.original.parentName || row.original.parentEmail || '—' }}
        </div>
      </template>

        <template #scuola-cell="{ row }">
          <div class="truncate max-w-[150px]" :title="row.original.scuola">
            {{ row.original.scuola || '—' }}
          </div>
        </template>
      </UTable>
    </UCard>

    </div>

    <!-- Stato vuoto -->
    <div v-else-if="!pending" class="py-12 text-center bg-white rounded-xl border border-slate-200">
      <UIcon name="i-heroicons-users" class="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p class="text-slate-500 text-sm">Nessuno studente trovato</p>
    </div>

    <!-- Paginazione -->
    <div v-if="meta && meta.totalPages > 1" class="flex justify-between items-center py-4">
      <div class="text-sm text-slate-500">
        Pagina {{ meta.page }} di {{ meta.totalPages }} ({{ meta.total }} totali)
      </div>
      <UPagination
        v-model:page="pagina"
        :total="meta.total"
        :items-per-page="20"
        @update:page="onPageChange"
      />
    </div>

    <!-- ─── WIZARD NUOVO STUDENTE ─── -->
    <WizardNuovoStudente v-model:open="wizardAperto" @refresh="caricaStudenti" />

  </div>
</template>

<script setup lang="ts">
import { inizialiDa, coloreAvatar } from '~/utils/avatar'

definePageMeta({ middleware: ['admin-or-super'] })

const router = useRouter()
const toast = useToast()

import { SCUOLE_TRAPANI, CLASSI_LISTA } from '~/utils/schools'

const columns = [
  { id: 'studente', accessorKey: 'lastName', header: 'Studente' },
  { id: 'classe', accessorKey: 'classe', header: 'Classe' },
  { id: 'scuola', accessorKey: 'scuola', header: 'Scuola' },
  { id: 'parentName', accessorKey: 'parentName', header: 'Contatto (Genitore/Email)' },
  { id: 'globalStatus', accessorKey: 'globalStatus', header: 'Stato' },
]

// ─── Stato filtri ───
const search = ref('')
const filtroAttivo = ref('all')
const filtroPacchetto = ref('all')
const nascondiInattivi = ref(true)
const pagina = ref(1)
let searchTimer: ReturnType<typeof setTimeout> | null = null

// ─── Fetch studenti ───
const { data, pending, refresh } = useLazyFetch('/api/students', {
  query: computed(() => ({
    search:  search.value   || undefined,
    active:  filtroAttivo.value === 'all' ? undefined : filtroAttivo.value,
    packageStatus: filtroPacchetto.value === 'all' ? undefined : filtroPacchetto.value,
    hideInactive: nascondiInattivi.value ? 'true' : undefined,
    page:    pagina.value,
    limit:   20,
    sortBy:  'lastName',
    sortDir: 'asc',
  })),
  watch: [pagina, filtroAttivo, filtroPacchetto, nascondiInattivi],
})

const studenti = computed(() => data.value?.data ?? [])
const meta     = computed(() => data.value?.meta)

// ─── Statistiche per le tessere di riepilogo ───
const { data: statsData, refresh: refreshStats } = useLazyFetch('/api/students/stats', {
  default: () => ({ total: 0, attivi: 0, daPagare: 0, daRinnovare: 0 }),
})
const stats = computed(() => statsData.value ?? { total: 0, attivi: 0, daPagare: 0, daRinnovare: 0 })

// Stile per ogni "accento" colore (classi statiche → Tailwind le tiene).
const ACCENTI: Record<string, { iconBg: string; iconText: string; valore: string; attivo: string }> = {
  tfn:     { iconBg: 'bg-tfn-50',     iconText: 'text-tfn-600',     valore: 'text-slate-900', attivo: 'ring-tfn-400' },
  emerald: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', valore: 'text-slate-900', attivo: 'ring-emerald-400' },
  rose:    { iconBg: 'bg-rose-50',    iconText: 'text-rose-600',    valore: 'text-rose-600',  attivo: 'ring-rose-400' },
  amber:   { iconBg: 'bg-amber-50',   iconText: 'text-amber-600',   valore: 'text-amber-600', attivo: 'ring-amber-400' },
}

const tessere = computed(() => [
  { key: 'totali',      label: 'Studenti totali', valore: stats.value.total,       icon: 'i-heroicons-users',        accento: 'tfn'     },
  { key: 'attivi',      label: 'Attivi',          valore: stats.value.attivi,      icon: 'i-heroicons-check-circle', accento: 'emerald' },
  { key: 'daPagare',    label: 'Da pagare',       valore: stats.value.daPagare,    icon: 'i-heroicons-banknotes',    accento: 'rose'    },
  { key: 'daRinnovare', label: 'Da rinnovare',    valore: stats.value.daRinnovare, icon: 'i-heroicons-arrow-path',    accento: 'amber'   },
])

// Quale tessera è "accesa" in base ai filtri attivi.
const tesseraAttiva = computed(() => {
  if (filtroPacchetto.value === 'DA_PAGARE')    return 'daPagare'
  if (filtroPacchetto.value === 'DA_RINNOVARE') return 'daRinnovare'
  if (filtroPacchetto.value !== 'all')          return null
  if (filtroAttivo.value === 'true')            return 'attivi'
  if (filtroAttivo.value === 'all' && !search.value) return 'totali'
  return null
})

function filtraDaTessera(key: string) {
  // Cliccare la tessera già attiva la "spegne" → torna a Tutti.
  const giaAttiva = tesseraAttiva.value === key
  filtroAttivo.value = 'all'
  filtroPacchetto.value = 'all'
  pagina.value = 1
  if (!giaAttiva) {
    if (key === 'attivi')      filtroAttivo.value = 'true'
    if (key === 'daPagare')    filtroPacchetto.value = 'DA_PAGARE'
    if (key === 'daRinnovare') filtroPacchetto.value = 'DA_RINNOVARE'
  }
}

function caricaStudenti() {
  refresh()
  refreshStats()
}

function onPageChange(newPage: number) {
  pagina.value = newPage
  refresh()
}

function onRowClick(row: any) {
  router.push(`/studenti/${row.id}`)
}

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pagina.value = 1
    refresh()
  }, 350)
}


// ─── Wizard crea ───
const wizardAperto = ref(false)
</script>
