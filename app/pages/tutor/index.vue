<template>
  <div class="space-y-6">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">Tutor</h2>
        <p class="text-sm text-slate-500 mt-0.5">Gestione del personale docente</p>
      </div>
      <UButton icon="i-heroicons-plus" @click="modalCreaAperto = true">
        Nuovo Tutor
      </UButton>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <UCard>
        <div class="text-2xl font-bold text-slate-900">{{ kpi.tutoriAttivi }}</div>
        <div class="text-xs text-slate-500 mt-0.5">Tutor attivi</div>
      </UCard>
      <UCard>
        <div class="text-2xl font-bold" :class="kpi.daLiquidare > 0 ? 'text-warning-600' : 'text-slate-900'">
          {{ kpi.daLiquidare }}
        </div>
        <div class="text-xs text-slate-500 mt-0.5">Da liquidare</div>
      </UCard>
      <UCard>
        <div class="text-2xl font-bold" :class="kpi.totaleDovuto > 0 ? 'text-error-600' : 'text-slate-900'">
          € {{ kpi.totaleDovuto.toFixed(2) }}
        </div>
        <div class="text-xs text-slate-500 mt-0.5">Totale dovuto</div>
      </UCard>
      <UCard>
        <div class="text-2xl font-bold text-slate-900">€ {{ kpi.mediaLiquidazione.toFixed(2) }}</div>
        <div class="text-xs text-slate-500 mt-0.5">Media mensile</div>
      </UCard>
    </div>

    <!-- Filtri -->
    <div class="flex flex-wrap gap-3 items-center">
      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        placeholder="Cerca per nome o email..."
        class="w-72"
        @input="onSearch"
      />
      <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
        <USwitch v-model="soloLiquidare" @update:model-value="caricaTutor" />
        Solo da liquidare
      </label>
    </div>

    <!-- Tabella -->
    <UCard :ui="{ body: 'p-0' }">
      <UTable :data="tutors" :columns="colonne" :loading="pending">

        <template #nome-cell="{ row }">
          <NuxtLink
            :to="`/tutor/${row.original.id}`"
            class="font-medium text-slate-900 hover:text-tfn-600"
          >
            {{ row.original.lastName }} {{ row.original.firstName }}
          </NuxtLink>
        </template>

        <template #contatti-cell="{ row }">
          <div class="text-sm">
            <div class="text-slate-700">{{ row.original.email }}</div>
            <div class="text-slate-400 text-xs">{{ row.original.phone ?? '—' }}</div>
          </div>
        </template>

        <template #oreMese-cell="{ row }">
          <span class="text-slate-700">{{ row.original.numLezioniMese }} lez.</span>
        </template>

        <template #compenso-cell="{ row }">
          <span class="font-medium">€ {{ row.original.compensoCalcolato }}</span>
        </template>

        <template #daLiquidare-cell="{ row }">
          <UBadge
            v-if="row.original.compensoResiduo > 0.01"
            color="error"
            variant="subtle"
          >
            € {{ row.original.compensoResiduo.toFixed(2) }}
          </UBadge>
          <span v-else class="text-slate-400 text-sm">—</span>
        </template>

        <template #arretrati-cell="{ row }">
          <UBadge
            v-if="row.original.mesiArretrati > 0"
            color="warning"
            variant="subtle"
          >
            {{ row.original.mesiArretrati }} mes{{ row.original.mesiArretrati === 1 ? 'e' : 'i' }}
          </UBadge>
          <span v-else class="text-slate-400 text-sm">—</span>
        </template>

        <template #stato-cell="{ row }">
          <UBadge :color="row.original.active ? 'success' : 'neutral'" variant="subtle">
            {{ row.original.active ? 'Attivo' : 'Inattivo' }}
          </UBadge>
        </template>

        <template #azioni-cell="{ row }">
          <UDropdownMenu :items="azioniTutor(row.original)">
            <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" size="xs" @click.stop />
          </UDropdownMenu>
        </template>

      </UTable>

      <div v-if="!pending && tutors.length === 0" class="py-12 text-center">
        <UIcon name="i-heroicons-academic-cap" class="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p class="text-slate-500 text-sm">Nessun tutor trovato</p>
      </div>
    </UCard>

    <!-- Modal Crea Tutor -->
    <UModal v-model:open="modalCreaAperto" title="Nuovo Tutor" :ui="{ width: 'max-w-lg' }">
      <template #body>
        <UForm :state="nuovoTutor" class="space-y-4" @submit="creaTutor">
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="firstName" label="Nome" required>
              <UInput v-model="nuovoTutor.firstName" placeholder="Marco" class="w-full" />
            </UFormField>
            <UFormField name="lastName" label="Cognome" required>
              <UInput v-model="nuovoTutor.lastName" placeholder="Rossi" class="w-full" />
            </UFormField>
          </div>
          <UFormField name="email" label="Email (per il login)" required>
            <UInput v-model="nuovoTutor.email" type="email" placeholder="marco@email.it" class="w-full" />
          </UFormField>
          <UFormField name="password" label="Password iniziale" required>
            <UInput v-model="nuovoTutor.password" type="password" placeholder="min. 8 caratteri" class="w-full" />
          </UFormField>
          <UFormField name="phone" label="Telefono">
            <UInput v-model="nuovoTutor.phone" placeholder="+39 333 1234567" class="w-full" />
          </UFormField>
          <UFormField name="modalitaPagamento" label="Modalità compenso">
            <USelect
              v-model="nuovoTutor.modalitaPagamento"
              :items="[{ label: 'A ore (tariffa oraria)', value: 'ORE' }, { label: 'Forfait mensile', value: 'FORFAIT' }]"
              class="w-full"
            />
          </UFormField>
          <UFormField v-if="nuovoTutor.modalitaPagamento === 'FORFAIT'" name="importoForfait" label="Importo forfait (€)">
            <UInput v-model="nuovoTutor.importoForfait" type="number" placeholder="500" class="w-full" />
          </UFormField>

          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalCreaAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvando">Crea Tutor</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal Liquida Mese -->
    <UModal v-model:open="modalLiquidaAperto" title="Liquida mese" :ui="{ width: 'max-w-md' }">
      <template #body>
        <UForm :state="datiLiquida" class="space-y-4" @submit="liquidaTutor">
          <div class="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
            Tutor: <span class="font-semibold">{{ tutorSelezionato?.lastName }} {{ tutorSelezionato?.firstName }}</span>
          </div>
          <UFormField name="mese" label="Mese di riferimento">
            <UInput v-model="datiLiquida.mese" type="month" class="w-full" />
          </UFormField>
          <UFormField name="importo" label="Importo (€)">
            <UInput v-model="datiLiquida.importo" type="number" step="0.01" class="w-full" />
          </UFormField>
          <UFormField name="metodo" label="Metodo pagamento">
            <USelect
              v-model="datiLiquida.metodo"
              :items="metodiPagamento"
              class="w-full"
            />
          </UFormField>
          <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <UCheckbox v-model="datiLiquida.proBono" />
            Pro Bono (nessun pagamento, nessuna registrazione contabile)
          </label>
          <UFormField name="note" label="Note">
            <UTextarea v-model="datiLiquida.note" class="w-full" :rows="2" />
          </UFormField>
          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalLiquidaAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvando">Conferma Liquidazione</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['admin-or-super'] })

const toast = useToast()

// ─── Filtri ───────────────────────────────────
const search        = ref('')
const soloLiquidare = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const filterQuery = computed(() => ({
  search:      search.value || undefined,
  daLiquidare: soloLiquidare.value ? 'true' : undefined,
}))

// ─── Fetch ────────────────────────────────────
const { data, pending, refresh } = useLazyFetch('/api/tutors', {
  query: filterQuery,
  default: () => ({ data: [], kpi: { tutoriAttivi: 0, daLiquidare: 0, totaleDovuto: 0, mediaLiquidazione: 0 } }),
})

const tutors = computed(() => data.value?.data ?? [])
const kpi    = computed(() => data.value?.kpi ?? { tutoriAttivi: 0, daLiquidare: 0, totaleDovuto: 0, mediaLiquidazione: 0 })

function onSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => caricaTutor(), 300)
}
function caricaTutor() { refresh() }

// ─── Colonne UTable v4 ────────────────────────
const colonne = [
  { id: 'nome',        header: 'Tutor' },
  { id: 'contatti',    header: 'Contatti' },
  { id: 'oreMese',     header: 'Lez. mese' },
  { id: 'compenso',    header: 'Compenso' },
  { id: 'daLiquidare', header: 'Da liquidare' },
  { id: 'arretrati',   header: 'Arretrati' },
  { id: 'stato',       header: 'Stato' },
  { id: 'azioni',      header: '' },
]

// ─── Metodi pagamento ─────────────────────────
const metodiPagamento = [
  { label: 'Contanti',  value: 'CONTANTI' },
  { label: 'Bonifico',  value: 'BONIFICO' },
  { label: 'POS',       value: 'POS' },
  { label: 'Assegno',   value: 'ASSEGNO' },
  { label: 'Altro',     value: 'ALTRO' },
]

// ─── Modal Crea Tutor ─────────────────────────
const modalCreaAperto = ref(false)
const salvando = ref(false)
const nuovoTutor = reactive({
  firstName:         '',
  lastName:          '',
  email:             '',
  password:          '',
  phone:             '',
  modalitaPagamento: 'ORE',
  importoForfait:    '',
})

async function creaTutor() {
  if (!nuovoTutor.firstName || !nuovoTutor.lastName || !nuovoTutor.email || !nuovoTutor.password) {
    toast.add({ title: 'Campi obbligatori mancanti', color: 'error' })
    return
  }
  salvando.value = true
  try {
    await $fetch('/api/tutors', {
      method: 'POST',
      body: {
        ...nuovoTutor,
        phone:          nuovoTutor.phone || null,
        importoForfait: nuovoTutor.importoForfait || null,
      },
    })
    toast.add({ title: 'Tutor creato con successo', color: 'success' })
    modalCreaAperto.value = false
    Object.assign(nuovoTutor, {
      firstName: '', lastName: '', email: '', password: '',
      phone: '', modalitaPagamento: 'ORE', importoForfait: '',
    })
    refresh()
  } catch (err: any) {
    const msg = err.data?.statusMessage ?? 'Errore nella creazione'
    const errors = err.data?.data?.errors
    let desc = ''
    if (errors) {
      desc = Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(' | ')
    }
    toast.add({ title: msg, description: desc, color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Modal Liquida ────────────────────────────
const modalLiquidaAperto  = ref(false)
const tutorSelezionato    = ref<any>(null)

const now = new Date()
const datiLiquida = reactive({
  mese:    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  importo: '',
  metodo:  'BONIFICO',
  proBono: false,
  note:    '',
})

function apriLiquida(tutor: any) {
  tutorSelezionato.value = tutor
  datiLiquida.importo = String(tutor.compensoResiduo > 0 ? tutor.compensoResiduo : tutor.compensoCalcolato)
  modalLiquidaAperto.value = true
}

async function liquidaTutor() {
  if (!tutorSelezionato.value) return
  salvando.value = true
  try {
    const [anno, mese] = datiLiquida.mese.split('-').map(Number)
    const meseISO = new Date(anno!, mese! - 1, 1).toISOString()

    await $fetch(`/api/tutors/${tutorSelezionato.value.id}/pay`, {
      method: 'POST',
      body: {
        mese:    meseISO,
        importo: datiLiquida.proBono ? '0' : datiLiquida.importo,
        metodo:  datiLiquida.metodo,
        proBono: datiLiquida.proBono,
        note:    datiLiquida.note || undefined,
      },
    })
    toast.add({ title: 'Liquidazione registrata', color: 'success' })
    modalLiquidaAperto.value = false
    refresh()
  } catch (err: any) {
    toast.add({ title: err.data?.statusMessage ?? 'Errore', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Azioni dropdown ─────────────────────────
function azioniTutor(tutor: any) {
  return [
    [{
      label: 'Vedi dettaglio',
      icon: 'i-heroicons-arrow-right',
      to: `/tutor/${tutor.id}`,
    }],
    [{
      label: 'Liquida mese',
      icon: 'i-heroicons-banknotes',
      onSelect: () => apriLiquida(tutor),
    }],
    [{
      label: tutor.active ? 'Disattiva' : 'Attiva',
      icon: tutor.active ? 'i-heroicons-pause-circle' : 'i-heroicons-play-circle',
      onSelect: () => toggleAttivo(tutor),
    }],
  ]
}

async function toggleAttivo(tutor: any) {
  try {
    if (tutor.active) {
      await $fetch(`/api/tutors/${tutor.id}`, { method: 'DELETE' })
      toast.add({ title: 'Tutor disattivato', color: 'info' })
    } else {
      await $fetch(`/api/tutors/${tutor.id}`, { method: 'PUT', body: { active: true } })
      toast.add({ title: 'Tutor riattivato', color: 'success' })
    }
    refresh()
  } catch (err: any) {
    toast.add({ title: err.data?.statusMessage ?? 'Errore aggiornamento stato', color: 'error' })
  }
}
</script>

