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
    <UModal v-model:open="modalCreaAperto" title="Nuovo Pacchetto" :ui="{ width: 'max-w-xl' }">
      <template #body>
        <div class="space-y-4">

          <!-- Scegli template (se ci sono pacchetti standard) -->
          <template v-if="templateOptions.length > 0">
            <UFormField label="Scegli template (opzionale)">
              <div class="flex gap-2 w-full items-center">
                <USelectMenu
                  v-model="templateSelezionato"
                  :items="templateOptions"
                  searchable
                  value-attribute="value"
                  placeholder="Seleziona un pacchetto standard..."
                  class="flex-1"
                  @update:model-value="applicaTemplate"
                />
                <UButton
                  v-if="nuovo.standardPackageId"
                  variant="ghost"
                  color="neutral"
                  icon="i-heroicons-x-mark"
                  @click="applicaTemplate(null); templateSelezionato = ''"
                  title="Scollega template e personalizza"
                />
              </div>
            </UFormField>
            <USeparator label="oppure compila manualmente" />
          </template>

          <!-- Studente -->
          <UFormField label="Studente" required>
            <USelectMenu
              v-model="studenteSelezionato"
              :items="studenteOptions"
              searchable
              value-attribute="value"
              placeholder="Cerca per cognome, nome, classe..."
              class="w-full"
              @update:model-value="onStudenteSelezionato"
            />
          </UFormField>

          <UFormField label="Nome pacchetto" required>
            <UInput v-model="nuovo.nome" :disabled="!!nuovo.standardPackageId" placeholder="Es: 10 ore Matematica" class="w-full" />
          </UFormField>

          <!-- Tipo pacchetto -->
          <UFormField label="Tipo" required>
            <USelect
              v-model="nuovo.tipo"
              :items="[{ label: 'Pacchetto ORE', value: 'ORE' }, { label: 'Pacchetto MENSILE', value: 'MENSILE' }, { label: 'Pacchetto A CONSUMO', value: 'A_CONSUMO' }]"
              class="w-full"
              :disabled="!!nuovo.standardPackageId"
              @change="aggiornaDatiScadenza"
            />
          </UFormField>

          <!-- ORE: ore inserite direttamente -->
          <UFormField v-if="nuovo.tipo === 'ORE'" label="Ore acquistate" required>
            <UInputNumber v-model="nuovo.oreAcquistate" :min="0.5" :step="0.5" class="w-full" :disabled="!!nuovo.standardPackageId" />
          </UFormField>

          <!-- MENSILE: giorni × ore/giorno → ore totali calcolate automaticamente -->
          <template v-else-if="nuovo.tipo === 'MENSILE'">
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Giorni acquistati" required>
                <UInputNumber v-model="nuovo.giorniAcquistati" :min="1" :step="1" class="w-full" :disabled="!!nuovo.standardPackageId" />
              </UFormField>
              <UFormField label="Ore al giorno (max)" required>
                <UInputNumber v-model="nuovo.orarioGiornaliero" :min="0.5" :step="0.5" class="w-full" :disabled="!!nuovo.standardPackageId" />
              </UFormField>
            </div>
            <UFormField label="Ore totali incluse">
              <UInputNumber :model-value="nuovo.oreAcquistate" disabled class="w-full" />
              <template #description>
                <span class="text-xs text-slate-400">
                  Calcolato automaticamente: {{ nuovo.giorniAcquistati || 0 }} giorni × {{ nuovo.orarioGiornaliero || 0 }} ore = <strong>{{ nuovo.oreAcquistate }} ore</strong>
                </span>
              </template>
            </UFormField>
          </template>

          <!-- A_CONSUMO: tariffa oraria -->
          <div v-else-if="nuovo.tipo === 'A_CONSUMO'">
            <UFormField label="Tariffa oraria (€/h)" required>
              <UInputNumber v-model="nuovo.tariffaOraria" :min="1" :step="0.5" class="w-full" />
            </UFormField>
            <div class="text-xs text-slate-500 mt-2">
              Le ore iniziali verranno calcolate come: <strong>{{ (nuovo.prezzoTotale / (nuovo.tariffaOraria || 1)).toFixed(1) }}</strong>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="nuovo.tipo === 'A_CONSUMO' ? 'Prima ricarica base (€)' : 'Prezzo totale (€)'" required>
              <UInputNumber v-model="nuovo.prezzoTotale" :min="0" :step="10" class="w-full" />
            </UFormField>
            <UFormField label="Data inizio" required>
              <UInput v-model="nuovo.dataInizio" type="date" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="Data scadenza">
            <UInput v-model="nuovo.dataScadenza" type="date" class="w-full" />
            <template #description>
              <span class="text-xs text-slate-400">
                Auto: ORE → 15/06/{{ annoScadenzaOre }}, MENSILE → fine mese corrente
              </span>
            </template>
          </UFormField>

          <USeparator label="Pagamento iniziale (opzionale)" />

          <UFormField label="Acconto subito (€)">
            <UInputNumber v-model="nuovo.accontoImporto" :min="0" :step="10" class="w-full" />
          </UFormField>

          <div v-if="nuovo.accontoImporto > 0" class="grid grid-cols-2 gap-4">
            <UFormField label="Metodo pagamento" required>
              <USelect
                v-model="nuovo.accontoMetodo"
                :items="[
                  { label: 'Contanti', value: 'CONTANTI' },
                  { label: 'Bonifico', value: 'BONIFICO' },
                  { label: 'POS', value: 'POS' },
                  { label: 'Assegno', value: 'ASSEGNO' },
                ]"
                class="w-full"
              />
            </UFormField>
            <UFormField label="">
              <div class="flex items-center gap-2 mt-6">
                <UCheckbox v-model="nuovo.accontoFattura" label="Richiede fattura" />
              </div>
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="modalCreaAperto = false">Annulla</UButton>
          <UButton :loading="salvando" @click="creaPacchetto">Salva Pacchetto</UButton>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL RINNOVO BULK ─── -->
    <UModal v-model:open="modalBulkAperto" title="Rinnovo Massivo Pacchetti" :ui="{ width: 'max-w-xl' }">
      <template #body>
        <div class="space-y-4">
          <div class="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
            Stai per creare un nuovo pacchetto per i <strong>{{ selectedPacchetti.length }}</strong> alunni selezionati.
          </div>
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
          
          <div v-if="datiBulk.templateScelto">
            <div class="p-3 border border-slate-200 rounded-lg text-sm space-y-1 mb-4 bg-slate-50">
              <div class="font-medium">{{ datiBulk.templateScelto.nome }}</div>
              <div class="text-slate-500">
                Tipo: {{ datiBulk.templateScelto.tipo }} | Prezzo: €{{ parseFloat(datiBulk.templateScelto.prezzoStandard).toFixed(0) }}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Data inizio">
                <UInput v-model="datiBulk.dataInizio" type="date" class="w-full" />
              </UFormField>
              <UFormField label="Data scadenza">
                <UInput v-model="datiBulk.dataScadenza" type="date" class="w-full" />
              </UFormField>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="modalBulkAperto = false">Annulla</UButton>
          <UButton :loading="salvandoBulk" :disabled="!datiBulk.templateScelto" @click="eseguiBulkRenew">Rinnova Tutti</UButton>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL NUOVO PAGAMENTO ─── -->
    <ModalPagamentoPacchetto
      v-model:open="modalPagamentoAperto"
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

// ─── Calcolo date scadenza ───
const oggi = new Date()

function calcolaDataScadenza(tipo: 'ORE' | 'MENSILE' | 'A_CONSUMO', startStr?: string): string {
  const baseDate = startStr ? new Date(startStr) : new Date(nuovo?.dataInizio || oggi.toISOString())
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

const annoScadenzaOre = computed(() => {
  const baseDate = nuovo?.dataInizio ? new Date(nuovo.dataInizio) : oggi
  const m = baseDate.getMonth()
  const d = baseDate.getDate()
  return (m > 5 || (m === 5 && d > 15)) ? baseDate.getFullYear() + 1 : baseDate.getFullYear()
})

function aggiornaDatiScadenza() {
  nuovo.dataScadenza = calcolaDataScadenza(nuovo.tipo, nuovo.dataInizio)
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
  query: { active: 'true', limit: 1000, sortBy: 'lastName', sortDir: 'asc' },
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

function formatData(d: string | Date) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Azioni dropdown per ogni riga ───
const pacchettoSelezionato = ref<any>(null)
const modalPagamentoAperto = ref(false)
const modalRicaricaAperto  = ref(false)
const modalLibrettoAperto  = ref(false)

function aprirePagamento(row: any) {
  pacchettoSelezionato.value = row
  modalPagamentoAperto.value = true
}

function azioniPacchetto(row: any) {
  const azioni = [
    { label: 'Registra pagamento', icon: 'i-heroicons-banknotes', onSelect: () => aprirePagamento(row) },
  ]
  if (row.tipo === 'A_CONSUMO') {
    azioni.push({ label: 'Ricarica', icon: 'i-heroicons-plus-circle', onSelect: () => { pacchettoSelezionato.value = row; modalRicaricaAperto.value = true } })
    azioni.push({ label: 'Libretto', icon: 'i-heroicons-list-bullet', onSelect: () => { pacchettoSelezionato.value = row; modalLibrettoAperto.value = true } })
  }
  return [azioni]
}

// ─── Modal crea pacchetto ───
const modalCreaAperto    = ref(false)
const salvando           = ref(false)
const studenteSelezionato = ref<string>('')
const templateSelezionato = ref<string>('')

const nuovo = reactive({
  studentId:         studentIdQuery ?? '',
  nome:              '',
  tipo:              'ORE' as 'ORE' | 'MENSILE' | 'A_CONSUMO',
  oreAcquistate:     10,
  prezzoTotale:      0,
  dataInizio:        new Date().toISOString().slice(0, 10),
  // Passiamo la data esplicita: durante l'init di `nuovo` la funzione non deve
  // leggere `nuovo.dataInizio` (sarebbe nel temporal dead zone → ReferenceError)
  dataScadenza:      calcolaDataScadenza('ORE', new Date().toISOString().slice(0, 10)),
  giorniAcquistati:  12,
  orarioGiornaliero: 3,
  accontoImporto:    0,
  accontoMetodo:     'CONTANTI' as string,
  accontoFattura:    false,
  tariffaOraria:     10,
  standardPackageId: '',
})

// Per i pacchetti MENSILI le ore totali sono SEMPRE giorni × ore/giorno (read-only)
watch(
  () => [nuovo.tipo, nuovo.giorniAcquistati, nuovo.orarioGiornaliero, nuovo.prezzoTotale, nuovo.tariffaOraria],
  () => {
    if (nuovo.tipo === 'MENSILE') {
      nuovo.oreAcquistate = (nuovo.giorniAcquistati || 0) * (nuovo.orarioGiornaliero || 0)
    } else if (nuovo.tipo === 'A_CONSUMO') {
      nuovo.oreAcquistate = nuovo.tariffaOraria > 0 ? Number((nuovo.prezzoTotale / nuovo.tariffaOraria).toFixed(2)) : 0
    }
  },
)

watch(
  () => nuovo.dataInizio,
  (newVal) => {
    if (newVal) {
      nuovo.dataScadenza = calcolaDataScadenza(nuovo.tipo, newVal)
    }
  }
)

async function onStudenteSelezionato(val: any) {
  const id = val ? (typeof val === 'string' ? val : val.value) : ''
  nuovo.studentId = id
  
  if (id) {
    try {
      // Quando seleziona lo studente, cerchiamo l'ultimo pacchetto dal server per aggiornare la data inizio
      const storici = await $fetch(`/api/packages?studentId=${id}&limit=50`) as any
      const pkgList = storici.data || []
      const pkgAttivi = pkgList.filter((p: any) => p.stati.includes('ATTIVO') || p.stati.includes('DA_RINNOVARE'))
      
      if (pkgAttivi.length > 0) {
        const maxScadenza = pkgAttivi.reduce((max: Date, p: any) => {
          if (!p.dataScadenza) return max
          const d = new Date(p.dataScadenza)
          return d > max ? d : max
        }, new Date(0))
        
        if (maxScadenza > new Date(0)) {
          const nextDay = new Date(maxScadenza)
          nextDay.setDate(nextDay.getDate() + 1)
          nuovo.dataInizio = nextDay.toISOString().slice(0, 10)
        }
      }
    } catch (e) {
      // ignora errori
    }
  }
}

function apriModalCrea() {
  let initDataInizio = new Date().toISOString().slice(0, 10)
  
  if (studentIdQuery) {
    studenteSelezionato.value = studentIdQuery
    // Trova l'ultimo pacchetto attivo per continuare da lì
    const pkgAttivi = pacchetti.value.filter((p: any) => p.stati.includes('ATTIVO') || p.stati.includes('DA_RINNOVARE'))
    if (pkgAttivi.length > 0) {
      const maxScadenza = pkgAttivi.reduce((max: Date, p: any) => {
        if (!p.dataScadenza) return max
        const d = new Date(p.dataScadenza)
        return d > max ? d : max
      }, new Date(0))
      
      if (maxScadenza > new Date(0)) {
        const nextDay = new Date(maxScadenza)
        nextDay.setDate(nextDay.getDate() + 1)
        initDataInizio = nextDay.toISOString().slice(0, 10)
      }
    }
  } else {
    studenteSelezionato.value = ''
  }

  Object.assign(nuovo, {
    studentId: studentIdQuery ?? '',
    nome: '', tipo: 'ORE', oreAcquistate: 10, prezzoTotale: 0,
    dataInizio: initDataInizio,
    dataScadenza: calcolaDataScadenza('ORE', initDataInizio),
    giorniAcquistati: 12, orarioGiornaliero: 3,
    accontoImporto: 0, accontoMetodo: 'CONTANTI', accontoFattura: false,
    tariffaOraria: 10, standardPackageId: '',
  })
  templateSelezionato.value = ''
  modalCreaAperto.value = true
}

function applicaTemplate(val: any) {
  if (!val) {
    nuovo.standardPackageId = ''
    return
  }
  const templateId = typeof val === 'string' ? val : val.value
  const opt = templateOptions.value.find((t: any) => t.value === templateId)
  if (!opt?.raw) return
  const t = opt.raw
  nuovo.standardPackageId  = t.id
  nuovo.nome             = t.nome
  nuovo.tipo             = t.tipo
  nuovo.oreAcquistate    = parseFloat(t.oreIncluse)
  nuovo.prezzoTotale     = parseFloat(t.prezzoStandard)
  if (t.giorniInclusi)     nuovo.giorniAcquistati  = t.giorniInclusi
  if (t.orarioGiornaliero) nuovo.orarioGiornaliero = parseFloat(t.orarioGiornaliero)
  if (t.tipo === 'A_CONSUMO') {
    nuovo.tariffaOraria = parseFloat(t.tariffaOraria)
  }
  nuovo.dataScadenza = calcolaDataScadenza(t.tipo)
}

async function creaPacchetto() {
  if (!nuovo.studentId) {
    toast.add({ title: 'Seleziona uno studente', color: 'warning', icon: 'i-heroicons-exclamation-circle' })
    return
  }
  salvando.value = true
  try {
    const body: any = {
      studentId:     nuovo.studentId,
      nome:          nuovo.nome,
      tipo:          nuovo.tipo,
      oreAcquistate: nuovo.oreAcquistate,
      prezzoTotale:  nuovo.prezzoTotale,
      dataInizio:    nuovo.dataInizio,
      standardPackageId: nuovo.standardPackageId || undefined,
    }
    if (nuovo.dataScadenza) body.dataScadenza = nuovo.dataScadenza
    if (nuovo.tipo === 'MENSILE') {
      body.giorniAcquistati  = nuovo.giorniAcquistati
      body.orarioGiornaliero = nuovo.orarioGiornaliero
    } else if (nuovo.tipo === 'A_CONSUMO') {
      body.tariffaOraria = nuovo.tariffaOraria
    }
    if (nuovo.accontoImporto > 0) {
      body.pagamentoIniziale = {
        importo:         nuovo.accontoImporto,
        metodoPagamento: nuovo.accontoMetodo,
        richiedeFattura: nuovo.accontoFattura,
      }
    }

    await $fetch('/api/packages', { method: 'POST', body })
    toast.add({ title: 'Pacchetto creato', color: 'success', icon: 'i-heroicons-check-circle' })
    modalCreaAperto.value = false
    refresh()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile creare il pacchetto', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Bulk Renew Logic ───
const modalBulkAperto = ref(false)
const salvandoBulk = ref(false)

const datiBulk = reactive({
  templateSelezionato: '',
  templateScelto: null as any,
  dataInizio: new Date().toISOString().slice(0, 10),
  dataScadenza: ''
})

function apriModalBulk() {
  datiBulk.templateSelezionato = ''
  datiBulk.templateScelto = null
  datiBulk.dataInizio = new Date().toISOString().slice(0, 10)
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
    datiBulk.dataScadenza = calcolaDataScadenza(opt.raw.tipo)
  }
}

async function eseguiBulkRenew() {
  if (!datiBulk.templateScelto) return
  salvandoBulk.value = true
  
  // Rimuovi eventuali duplicati se per errore lo stesso alunno è selezionato 2 volte
  const uniqueStudents = new Set<string>()
  const validPackages = selectedPacchetti.value.filter(p => {
    if (uniqueStudents.has(p.studentId)) return false
    uniqueStudents.add(p.studentId)
    return true
  })

  const packagesPayload = validPackages.map(p => {
    const t = datiBulk.templateScelto
    return {
      studentId: p.studentId,
      nome: t.nome,
      tipo: t.tipo,
      oreAcquistate: parseFloat(t.oreIncluse),
      prezzoTotale: parseFloat(t.prezzoStandard),
      giorniAcquistati: t.giorniInclusi ? t.giorniInclusi : undefined,
      orarioGiornaliero: t.orarioGiornaliero ? parseFloat(t.orarioGiornaliero) : undefined,
      tariffaOraria: t.tipo === 'A_CONSUMO' ? parseFloat(t.tariffaOraria) : undefined,
      dataInizio: datiBulk.dataInizio,
      dataScadenza: datiBulk.dataScadenza || undefined,
      standardPackageId: t.id
    }
  })

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

