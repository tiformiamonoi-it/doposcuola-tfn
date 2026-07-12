<template>
  <div class="space-y-6">

    <!-- Intestazione -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">Pacchetti</h2>
        <p class="text-sm text-slate-500 mt-0.5">{{ meta?.total ?? 0 }} pacchetti totali</p>
      </div>
      <UButton icon="i-heroicons-plus" @click="apriModalCrea">Nuovo Pacchetto</UButton>
    </div>

    <!-- Filtri -->
    <div class="flex flex-wrap gap-3">
      <USelectMenu
        v-model="filtroStati"
        :items="opzioniStati"
        multiple
        placeholder="Filtra per stato..."
        class="w-72"
        @change="caricaPacchetti"
      />
      <USelect
        v-model="filtroTipo"
        :items="[
          { label: 'Tutti i tipi', value: 'all' },
          { label: 'Pacchetto ORE', value: 'ORE' },
          { label: 'Pacchetto MENSILE', value: 'MENSILE' },
        ]"
        class="w-44"
        @change="caricaPacchetti"
      />
    </div>

    <!-- Bulk Action Bar -->
    <div v-if="selectedPacchetti.length > 0" class="bg-tfn-50 p-3 rounded-lg flex items-center justify-between mb-4 border border-tfn-100">
      <span class="text-sm font-medium text-tfn-700">{{ selectedPacchetti.length }} pacchetti selezionati</span>
      <div class="flex gap-2">
        <UButton color="neutral" variant="ghost" @click="deselezionaTutto">Deseleziona</UButton>
        <UButton color="primary" icon="i-heroicons-arrow-path-rounded-square" @click="apriModalBulk">Rinnovo Multiplo</UButton>
      </div>
    </div>

    <div v-if="!pending && pacchetti.length === 0" class="py-12 text-center">
      <UIcon name="i-heroicons-cube" class="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p class="text-slate-500 text-sm">Nessun pacchetto trovato</p>
    </div>

    <div v-else-if="pacchetti.length > 0">

    <!-- ─── MOBILE: cartoline verticali ─── -->
    <div class="lg:hidden space-y-3">
      <div
        v-for="p in pacchetti"
        :key="p.id"
        class="block bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-4 relative"
      >
        <!-- Riga di stato colorata -->
        <div class="absolute left-0 top-3 bottom-3 w-1 rounded-r-full" :class="{
          'bg-emerald-500': pacchettoStatusColor(p.stati) === 'success',
          'bg-amber-400':   pacchettoStatusColor(p.stati) === 'warning',
          'bg-rose-500':    pacchettoStatusColor(p.stati) === 'error',
          'bg-slate-300':   pacchettoStatusColor(p.stati) === 'neutral',
        }"></div>

        <!-- Header: Avatar + Studente + Dropdown Azioni -->
        <div class="flex items-center justify-between gap-3 pl-2 mb-3">
          <NuxtLink :to="`/studenti/${p.studentId}`" class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              :class="[coloreAvatar(p.studentId || (p.studentLastName + p.studentFirstName)).bg, coloreAvatar(p.studentId || (p.studentLastName + p.studentFirstName)).text]"
            >
              {{ inizialiDa(p.studentFirstName, p.studentLastName) }}
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-slate-900 truncate">{{ p.studentLastName }} {{ p.studentFirstName }}</p>
            </div>
          </NuxtLink>
          <UDropdownMenu :items="azioniPacchetto(p)">
            <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" color="neutral" size="sm" />
          </UDropdownMenu>
        </div>

        <!-- Info Pacchetto -->
        <div class="pl-2 space-y-2">
          <div class="flex justify-between items-start gap-2">
            <div>
              <div class="font-medium text-slate-800 text-sm">{{ p.nome }}</div>
              <div class="text-xs text-slate-500">{{ p.tipo }}</div>
            </div>
            <!-- Stati -->
            <div class="flex flex-wrap gap-1 justify-end">
              <StatoBadge v-for="s in riassumiStati(p.stati)" :key="s" :stato="s" :pacchetto="p" />
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-2 text-sm mt-2 p-2 bg-slate-50 rounded-lg">
            <div>
              <span class="text-slate-500 text-[11px] uppercase tracking-wide block">Residuo</span>
              <span class="font-medium text-slate-700">
                <template v-if="p.tipo === 'ORE'">
                  {{ parseFloat(p.oreResiduo) }} / {{ parseFloat(p.oreAcquistate) }} h
                </template>
                <template v-else-if="p.tipo === 'MENSILE'">
                  {{ p.giorniResiduo ?? 0 }} / {{ p.giorniAcquistati ?? 0 }} gg
                </template>
                <template v-else-if="p.tipo === 'A_CONSUMO'">
                  {{ parseFloat(p.oreResiduo) }} h
                </template>
              </span>
            </div>
            <div>
              <span class="text-slate-500 text-[11px] uppercase tracking-wide block">Scadenza</span>
              <span class="font-medium text-slate-700">{{ p.dataScadenza ? formatData(p.dataScadenza) : '—' }}</span>
            </div>
          </div>

          <div v-if="parseFloat(p.importoResiduo) > 0" class="mt-2 text-sm flex items-center gap-2">
            <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 text-orange-500" />
            <span class="text-orange-600 font-semibold">Da pagare: € {{ parseFloat(p.importoResiduo).toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── DESKTOP: Tabella pacchetti ─── -->
    <UCard 
      :ui="{ body: { padding: 'p-0' }, rounded: 'rounded-2xl', ring: 'ring-1 ring-slate-200', shadow: 'shadow-sm' }" 
      class="overflow-hidden hidden lg:block"
    >
      <UTable
        v-model:row-selection="rowSelection"
        :data="pacchetti"
        :columns="colonne"
        :loading="pending"
        class="w-full"
        :ui="{
          th: 'bg-slate-50 text-slate-600 font-semibold py-3 px-4 text-sm',
          td: 'py-3 px-4 relative align-middle',
          tr: 'hover:bg-slate-50/80 transition-colors',
        }"
      >
        <!-- Studente -->
        <template #studente-cell="{ row }">
          <!-- Trattino di stato: sottile, arrotondato, uno per riga -->
          <div class="absolute left-0 top-2 bottom-2 w-1 rounded-r-full" :class="{
            'bg-emerald-500': pacchettoStatusColor(row.original.stati) === 'success',
            'bg-amber-400':   pacchettoStatusColor(row.original.stati) === 'warning',
            'bg-rose-500':    pacchettoStatusColor(row.original.stati) === 'error',
            'bg-slate-300':   pacchettoStatusColor(row.original.stati) === 'neutral',
          }"></div>
          <NuxtLink :to="`/studenti/${row.original.studentId}`" class="font-semibold text-slate-900 hover:text-tfn-600 transition-colors truncate block pl-2" @click.stop>
            {{ row.original.studentLastName ?? '' }} {{ row.original.studentFirstName ?? '' }}
            <span v-if="!row.original.studentLastName" class="text-slate-400 font-mono text-xs">{{ row.original.studentId?.slice(0, 8) }}…</span>
          </NuxtLink>
        </template>

        <!-- Nome pacchetto -->
        <template #nome-cell="{ row }">
          <div>
            <div class="font-medium text-slate-800 text-sm">{{ row.original.nome }}</div>
            <UBadge color="neutral" variant="outline" size="xs">{{ row.original.tipo }}</UBadge>
          </div>
        </template>

        <template #residuo-cell="{ row }">
          <div class="text-sm">
            <div class="font-medium text-slate-800">
              <template v-if="row.original.tipo === 'ORE'">
                {{ parseFloat(row.original.oreResiduo) }} / {{ parseFloat(row.original.oreAcquistate) }} ore
              </template>
              <template v-else-if="row.original.tipo === 'MENSILE'">
                {{ row.original.giorniResiduo ?? 0 }} / {{ row.original.giorniAcquistati ?? 0 }} giorni
              </template>
              <template v-else-if="row.original.tipo === 'A_CONSUMO'">
                {{ parseFloat(row.original.oreResiduo) }} ore (libretto)
              </template>
            </div>
            <div class="text-xs text-slate-400">
              <template v-if="row.original.tipo === 'ORE' || row.original.tipo === 'A_CONSUMO'">
                {{ progressoOre(row.original) }}%
              </template>
              <template v-else-if="row.original.tipo === 'MENSILE'">
                ({{ parseFloat(row.original.oreAcquistate) - parseFloat(row.original.oreResiduo) }} ore cons.)
              </template>
            </div>
          </div>
        </template>

        <!-- Importo residuo -->
        <template #importoR-cell="{ row }">
          <span :class="parseFloat(row.original.importoResiduo) > 0 ? 'text-orange-600 font-semibold' : 'text-slate-400'">
            € {{ parseFloat(row.original.importoResiduo).toFixed(2) }}
          </span>
        </template>

        <!-- Scadenza -->
        <template #scadenza-cell="{ row }">
          <span class="text-slate-600 text-sm">{{ row.original.dataScadenza ? formatData(row.original.dataScadenza) : '—' }}</span>
        </template>

        <!-- Stati -->
        <template #stati-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <StatoBadge v-for="s in riassumiStati(row.original.stati)" :key="s" :stato="s" :pacchetto="row.original" />
          </div>
        </template>

        <!-- Azioni -->
        <template #azioni-cell="{ row }">
          <UDropdownMenu :items="azioniPacchetto(row.original)">
            <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" size="xs" @click.stop />
          </UDropdownMenu>
        </template>
      </UTable>

      <div v-if="meta && meta.totalPages > 1" class="flex justify-between items-center py-4">
        <div class="text-sm text-slate-500">
          Pagina {{ meta.page }} di {{ meta.totalPages }} ({{ meta.total }} totali)
        </div>
        <UPagination
          v-model:page="pagina"
          :total="meta.total"
          :items-per-page="20"
          @update:page="caricaPacchetti"
        />
      </div>
    </UCard>
    </div>

    <!-- ─── MODAL CREA PACCHETTO ─── -->
    <ModalCreaPacchetto
      v-model:open="modalCreaAperto"
      :student-id="studentIdQuery || undefined"
      :student-name="route.query.studentName as string | undefined"
      @refresh="caricaPacchetti"
    />

    <!-- ─── MODAL RINNOVO BULK ─── -->
    <!-- ─── MODAL RINNOVO BULK ─── -->
    <UModal v-model:open="modalBulkAperto" title="Rinnovo Massivo Pacchetti" :ui="{ width: 'max-w-3xl' }">
      <template #body>
        <div class="space-y-6">
          <URadioGroup
            v-model="datiBulk.modalita"
            :items="[
              { value: 'INTELLIGENTE', label: 'Rinnovo Intelligente (Consigliato)', description: 'Ciascun alunno riceverà una copia esatta del pacchetto selezionato.' },
              { value: 'TEMPLATE', label: 'Applica Template', description: 'Tutti gli alunni selezionati riceveranno lo stesso pacchetto standard.' }
            ]"
          />

          <div v-if="datiBulk.modalita === 'TEMPLATE'" class="mt-4">
            <UFormField label="Seleziona Template da applicare" required>
              <USelectMenu
                v-model="datiBulk.templateSelezionato"
                :items="templateOptions"
                searchable
                value-attribute="value"
                placeholder="Seleziona un pacchetto standard..."
                class="w-full"
                @update:model-value="applicaTemplateBulk"
              />
            </UFormField>
          </div>

          <USeparator />

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Data Inizio">
              <UInput v-model="datiBulk.dataInizio" type="date" class="w-full" />
            </UFormField>
            <div v-if="datiBulk.modalita === 'TEMPLATE' && datiBulk.templateScelto" class="flex items-end">
              <div class="text-xs text-slate-500 mb-2">Scadenza: {{ formatData(datiBulk.dataScadenza) }}</div>
            </div>
          </div>

          <div v-if="anteprimaBulk.length > 0">
            <div class="text-sm font-medium mb-2">Riepilogo dei {{ anteprimaBulk.length }} pacchetti in creazione:</div>
            <ul class="text-xs space-y-2 max-h-48 overflow-y-auto bg-slate-50 p-2 rounded border border-slate-200">
              <li v-for="p in anteprimaBulk" :key="p.studentId" class="flex justify-between items-center p-1 border-b border-slate-100 last:border-0">
                <div>
                  <strong>{{ p.studentName }}</strong>: {{ p.nome }} <br/>
                  <span class="text-slate-500">{{ p.tipo }} | {{ p.tipo === 'MENSILE' ? p.giorniAcquistati + ' gg' : p.oreAcquistate + ' ore' }} | €{{ p.prezzoTotale }}</span>
                </div>
                <div class="text-right text-slate-500 text-[11px]">
                  Scadenza:<br/>{{ p.dataScadenza ? formatData(p.dataScadenza) : 'n/d' }}
                </div>
              </li>
            </ul>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="modalBulkAperto = false">Annulla</UButton>
          <UButton 
            :loading="salvandoBulk" 
            :disabled="datiBulk.modalita === 'TEMPLATE' && !datiBulk.templateScelto" 
            @click="eseguiBulkRenew"
          >
            Conferma e Rinnova
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL NUOVO PAGAMENTO ─── -->
    <ModalPagamentoPacchetto
      v-model:open="modalPagamentoAperto"
      :pacchetto="pacchettoSelezionato"
      @refresh="caricaPacchetti"
    />

    <!-- ─── MODAL MODIFICA PACCHETTO ─── -->
    <ModalModificaPacchetto
      v-model:open="modalModificaAperto"
      :pacchetto="pacchettoSelezionato"
      @refresh="caricaPacchetti"
    />

    <!-- ─── MODAL RICARICA E LIBRETTO ─── -->
    <ModalRicaricaPacchetto
      v-model:open="modalRicaricaAperto"
      :pacchetto="pacchettoSelezionato"
      @refresh="caricaPacchetti"
    />

    <ModalLibrettoRicariche
      v-model:open="modalLibrettoAperto"
      :pacchetto="pacchettoSelezionato"
    />

  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['admin-or-super'] })

import { h, resolveComponent } from 'vue'
import { riassumiStati } from '~/utils/statiPacchetto'
import { inizialiDa, coloreAvatar } from '~/utils/avatar'
import { oggiISO, formatData  } from '~/utils/format'

function pacchettoStatusColor(stati: string[]) {
  if (!stati || stati.length === 0) return 'neutral'
  if (stati.includes('SCADUTO') || stati.includes('ESAURITO')) return 'error'
  if (stati.includes('DA_RINNOVARE') || stati.includes('DA_PAGARE')) return 'warning'
  if (stati.includes('ATTIVO')) return 'success'
  return 'neutral'
}

const route = useRoute()
const toast = useToast()

const rowSelection = ref<Record<string, boolean>>({})
const selectedPacchetti = computed(() => {
  return pacchetti.value.filter((_, index) => rowSelection.value[index])
})

// Deseleziona
function deselezionaTutto() {
  rowSelection.value = {}
}


// ─── Filtri ───
const filtroStati = ref<string[]>([])
const filtroTipo  = ref('all')
const pagina      = ref(1)

const opzioniStati = [
  { label: 'Attivo',       value: 'ATTIVO' },
  { label: 'Da rinnovare', value: 'DA_RINNOVARE' },
  { label: 'Da pagare',    value: 'DA_PAGARE' },
  { label: 'Scaduto',      value: 'SCADUTO' },
  { label: 'Esaurito',     value: 'ESAURITO' },
  { label: 'Pagato',       value: 'PAGATO' },
  { label: 'Chiuso',       value: 'CHIUSO' },
  { label: 'Sospeso',      value: 'SOSPESO' },
]

const studentIdQuery = route.query.studentId as string | undefined

// ─── Fetch pacchetti ───
const { data, pending, refresh } = useLazyFetch('/api/packages', {
  query: computed(() => ({
    studentId: studentIdQuery || undefined,
    stati:     filtroStati.value.length > 0 ? filtroStati.value.join(',') : undefined,
    tipo:      filtroTipo.value === 'all' ? undefined : filtroTipo.value,
    page:      pagina.value,
    limit:     20,
  })),
  watch: false,
})

const pacchetti = computed(() => data.value?.data ?? [])
const meta      = computed(() => data.value?.meta)

function caricaPacchetti() { pagina.value = 1; refresh() }

// ─── Fetch studenti per selector ───
const { data: studentiData } = useLazyFetch('/api/students', {
  query: { active: 'true', limit: 1000, sortBy: 'lastName', sortDir: 'asc', light: 'true' },
})

const studenteOptions = computed(() => {
  const options = (studentiData.value?.data ?? []).map((s: any) => ({
    label: `${s.lastName} ${s.firstName}${s.classe ? ' — ' + s.classe : ''}${s.scuola ? ', ' + s.scuola : ''}`,
    value: s.id,
  }))

  // Se l'id in query non è nelle opzioni (es. studente non ancora caricato), aggiungiamo un'opzione fake col nome passato in query
  if (studentIdQuery && !options.find((o: any) => o.value === studentIdQuery)) {
    const nomeQuery = route.query.studentName as string
    if (nomeQuery) {
      options.unshift({ label: nomeQuery, value: studentIdQuery })
    }
  }

  return options
})

// ─── Fetch template pacchetti standard ───
const { data: templatesData } = useLazyFetch('/api/standard-packages')

const templateOptions = computed(() =>
  (templatesData.value ?? []).map((t: any) => ({
    label: t.tipo === 'A_CONSUMO' 
      ? `${t.nome} — A CONSUMO, €${parseFloat(t.tariffaOraria).toFixed(2)}/h (Base €${parseFloat(t.prezzoStandard).toFixed(0)})`
      : `${t.nome} — ${t.tipo}, ${t.oreIncluse} ore, €${parseFloat(t.prezzoStandard).toFixed(0)}`,
    value: t.id,
    raw: t,
  }))
)

// ─── Colonne tabella ───
const UCheckbox = resolveComponent('UCheckbox')

const colonne = [
  {
    id: 'select',
    header: ({ table }: any) => h(UCheckbox, {
      modelValue: table.getIsAllPageRowsSelected(),
      indeterminate: table.getIsSomePageRowsSelected(),
      'onUpdate:modelValue': (value: boolean) => table.toggleAllPageRowsSelected(!!value),
      ariaLabel: 'Seleziona tutti'
    }),
    cell: ({ row }: any) => h(UCheckbox, {
      modelValue: row.getIsSelected(),
      'onUpdate:modelValue': (value: boolean) => row.toggleSelected(!!value),
      ariaLabel: 'Seleziona riga'
    })
  },
  { id: 'studente',      accessorKey: 'studentId',      header: 'Studente' },
  { id: 'nome',          accessorKey: 'nome',            header: 'Pacchetto' },
  { id: 'residuo',       accessorKey: 'oreResiduo',      header: 'Ore / Giorni residui' },
  { id: 'importoR',      accessorKey: 'importoResiduo',  header: 'Residuo €' },
  { id: 'scadenza',      accessorKey: 'dataScadenza',    header: 'Scadenza' },
  { id: 'stati',         accessorKey: 'stati',           header: 'Stato' },
  { id: 'azioni',        accessorKey: 'id',              header: '' },
]

function progressoOre(row: any) {
  const tot = parseFloat(row.oreAcquistate)
  const res = parseFloat(row.oreResiduo)
  if (tot === 0) return 0
  return Math.round((res / tot) * 100)
}



// ─── Azioni dropdown per ogni riga ───
const pacchettoSelezionato = ref<any>(null)
const modalPagamentoAperto = ref(false)
const modalModificaAperto  = ref(false)
const modalRicaricaAperto  = ref(false)
const modalLibrettoAperto  = ref(false)

function aprirePagamento(row: any) {
  pacchettoSelezionato.value = row
  modalPagamentoAperto.value = true
}

function azioniPacchetto(row: any) {
  const azioni = [
    { label: 'Dettagli pacchetto', icon: 'i-heroicons-document-magnifying-glass', onSelect: () => navigateTo(`/pacchetti/${row.id}`) },
    { label: 'Modifica pacchetto', icon: 'i-heroicons-pencil', onSelect: () => { pacchettoSelezionato.value = row; modalModificaAperto.value = true } },
    { label: 'Registra pagamento', icon: 'i-heroicons-banknotes', disabled: row.stati?.includes('PAGATO'), onSelect: () => aprirePagamento(row) },
  ]
  if (row.tipo === 'A_CONSUMO') {
    azioni.push({ label: 'Ricarica', icon: 'i-heroicons-plus-circle', onSelect: () => { pacchettoSelezionato.value = row; modalRicaricaAperto.value = true } })
    azioni.push({ label: 'Libretto', icon: 'i-heroicons-list-bullet', onSelect: () => { pacchettoSelezionato.value = row; modalLibrettoAperto.value = true } })
  }
  if (row.sospeso) {
    azioni.push({ label: 'Riattiva', icon: 'i-heroicons-play-circle', onSelect: () => toggleSospeso(row, false) })
  } else {
    azioni.push({ label: 'Sospendi', icon: 'i-heroicons-pause-circle', onSelect: () => toggleSospeso(row, true) })
  }
  return [azioni]
}

// ─── Modal crea pacchetto ───
const modalCreaAperto = ref(false)

function apriModalCrea() {
  modalCreaAperto.value = true
}

// ─── Bulk Renew Logic ───
const modalBulkAperto = ref(false)
const salvandoBulk = ref(false)

const oggi = new Date()

function calcolaDataScadenza(tipo: 'ORE' | 'MENSILE' | 'A_CONSUMO', startStr?: string): string {
  const baseDate = startStr ? new Date(startStr) : new Date(datiBulk?.dataInizio || oggi.toISOString())
  if (tipo === 'ORE' || tipo === 'A_CONSUMO') {
    const m = baseDate.getMonth()
    const d = baseDate.getDate()
    const anno = (m > 5 || (m === 5 && d > 15)) ? baseDate.getFullYear() + 1 : baseDate.getFullYear()
    return `${anno}-06-15`
  } else {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  }
}

const datiBulk = reactive({
  modalita: 'INTELLIGENTE' as 'INTELLIGENTE' | 'TEMPLATE',
  templateSelezionato: '',
  templateScelto: null as any,
  dataInizio: oggiISO(),
  dataScadenza: ''
})

const anteprimaBulk = computed(() => {
  const uniqueStudents = new Set<string>()
  const validPackages = selectedPacchetti.value.filter((p: any) => {
    if (uniqueStudents.has(p.studentId)) return false
    uniqueStudents.add(p.studentId)
    return true
  })

  return validPackages.map((p: any) => {
    const studentName = `${p.studentLastName ?? ''} ${p.studentFirstName ?? ''}`.trim() || p.studentId.slice(0, 8)
    if (datiBulk.modalita === 'TEMPLATE' && datiBulk.templateScelto) {
      const t = datiBulk.templateScelto
      return {
        studentId: p.studentId,
        studentName,
        nome: t.nome,
        tipo: t.tipo,
        oreAcquistate: parseFloat(t.oreIncluse),
        prezzoTotale: parseFloat(t.prezzoStandard),
        giorniAcquistati: t.giorniInclusi,
        orarioGiornaliero: t.orarioGiornaliero ? parseFloat(t.orarioGiornaliero) : undefined,
        tariffaOraria: t.tipo === 'A_CONSUMO' ? parseFloat(t.tariffaOraria) : undefined,
        dataInizio: datiBulk.dataInizio,
        dataScadenza: calcolaDataScadenza(t.tipo, datiBulk.dataInizio),
        standardPackageId: t.id
      }
    } else {
      // INTELLIGENTE
      let oreAcq = parseFloat(p.oreAcquistate)
      if (p.tipo === 'MENSILE') {
        oreAcq = (p.giorniAcquistati || 12) * (p.orarioGiornaliero || 3)
      }
      const parts = p.nome.split(' - Rinnovo')
      const baseNome = parts[0]
      return {
        studentId: p.studentId,
        studentName,
        nome: `${baseNome} - Rinnovo`,
        tipo: p.tipo,
        oreAcquistate: oreAcq,
        prezzoTotale: parseFloat(p.prezzoTotale),
        giorniAcquistati: p.giorniAcquistati,
        orarioGiornaliero: p.orarioGiornaliero ? parseFloat(p.orarioGiornaliero) : undefined,
        tariffaOraria: p.tariffaOraria ? parseFloat(p.tariffaOraria) : undefined,
        dataInizio: datiBulk.dataInizio,
        dataScadenza: calcolaDataScadenza(p.tipo, datiBulk.dataInizio),
        standardPackageId: p.standardPackageId || undefined
      }
    }
  })
})

function apriModalBulk() {
  datiBulk.modalita = 'INTELLIGENTE'
  datiBulk.templateSelezionato = ''
  datiBulk.templateScelto = null
  datiBulk.dataInizio = oggiISO()
  datiBulk.dataScadenza = calcolaDataScadenza('ORE')
  modalBulkAperto.value = true
}

function applicaTemplateBulk(val: any) {
  if (!val) {
    datiBulk.templateScelto = null
    return
  }
  const templateId = typeof val === 'string' ? val : val.value
  const opt = templateOptions.value.find((t: any) => t.value === templateId)
  if (opt?.raw) {
    datiBulk.templateScelto = opt.raw
    datiBulk.dataScadenza = calcolaDataScadenza(opt.raw.tipo, datiBulk.dataInizio)
  }
}

watch(() => datiBulk.dataInizio, (newVal) => {
  if (datiBulk.modalita === 'TEMPLATE' && datiBulk.templateScelto) {
    datiBulk.dataScadenza = calcolaDataScadenza(datiBulk.templateScelto.tipo, newVal)
  }
})

async function toggleSospeso(row: any, val: boolean) {
  try {
    await $fetch(`/api/packages/${row.id}`, {
      method: 'PUT',
      body: { sospeso: val },
    })
    toast.add({ title: val ? 'Pacchetto sospeso' : 'Pacchetto riattivato', color: 'success' })
    caricaPacchetti()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Operazione non riuscita', color: 'error' })
  }
}

async function eseguiBulkRenew() {
  if (datiBulk.modalita === 'TEMPLATE' && !datiBulk.templateScelto) return
  if (anteprimaBulk.value.length === 0) return
  
  salvandoBulk.value = true
  
  const packagesPayload = anteprimaBulk.value.map(p => ({
    studentId: p.studentId,
    nome: p.nome,
    tipo: p.tipo,
    oreAcquistate: p.oreAcquistate,
    prezzoTotale: p.prezzoTotale,
    giorniAcquistati: p.giorniAcquistati,
    orarioGiornaliero: p.orarioGiornaliero,
    tariffaOraria: p.tariffaOraria,
    dataInizio: p.dataInizio,
    dataScadenza: p.dataScadenza || undefined,
    standardPackageId: p.standardPackageId
  }))

  try {
    await $fetch('/api/packages/bulk', {
      method: 'POST',
      body: { packages: packagesPayload }
    })
    toast.add({ title: `${packagesPayload.length} pacchetti creati!`, color: 'success' })
    modalBulkAperto.value = false
    deselezionaTutto()
    caricaPacchetti()
  } catch(err: any) {
    toast.add({ title: 'Errore bulk', description: err.message, color: 'error' })
  } finally {
    salvandoBulk.value = false
  }
}

// Modal pagamento estratto come componente.
</script>

