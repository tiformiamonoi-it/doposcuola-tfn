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
        @click="apriModalCrea"
      >
        Nuovo Studente
      </UButton>
    </div>

    <!-- Filtri -->
    <div class="flex flex-wrap gap-3">
      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        placeholder="Cerca per nome, cognome o email..."
        class="w-72"
        @input="onSearch"
      />
      <USelect
        v-model="filtroAttivo"
        :items="[
          { label: 'Tutti', value: 'all' },
          { label: 'Attivi', value: 'true' },
          { label: 'Inattivi', value: 'false' },
        ]"
        class="w-36"
        @change="caricaStudenti"
      />
    </div>

    <!-- Tabella studenti -->
    <UCard :ui="{ body: 'p-0' }">
      <UTable
        :data="studenti"
        :columns="colonne"
        :loading="pending"
        @select="onRowSelect"
        class="cursor-pointer"
      >
        <!-- Colonna Nome completo -->
        <template #nome-cell="{ row }">
          <div class="font-medium text-slate-900">{{ row.original.lastName }} {{ row.original.firstName }}</div>
        </template>

        <!-- Colonna Classe -->
        <template #classe-cell="{ row }">
          <span class="text-slate-600">{{ row.original.classe ?? '—' }}</span>
        </template>

        <!-- Colonna Scuola -->
        <template #scuola-cell="{ row }">
          <span class="text-slate-600 truncate max-w-[160px] block">{{ row.original.scuola ?? '—' }}</span>
        </template>

        <!-- Colonna Genitore -->
        <template #genitore-cell="{ row }">
          <div v-if="row.original.parentName" class="text-sm">
            <div class="text-slate-700">{{ row.original.parentName }}</div>
            <div class="text-slate-400 text-xs">{{ row.original.parentEmail ?? '' }}</div>
          </div>
          <span v-else class="text-slate-400">—</span>
        </template>

        <!-- Colonna Stato -->
        <template #stato-cell="{ row }">
          <UBadge
            :color="row.original.active ? 'success' : 'neutral'"
            variant="subtle"
          >
            {{ row.original.active ? 'Attivo' : 'Inattivo' }}
          </UBadge>
        </template>

        <!-- Colonna Azioni -->
        <template #azioni-cell="{ row }">
          <UButton
            icon="i-heroicons-arrow-right"
            variant="ghost"
            size="xs"
            :to="`/studenti/${row.original.id}`"
            @click.stop
          />
        </template>
      </UTable>

      <!-- Paginazione -->
      <div v-if="meta && meta.totalPages > 1" class="flex justify-center py-4 border-t border-slate-100">
        <UPagination
          v-model:page="pagina"
          :total="meta.total"
          :items-per-page="20"
          @update:page="caricaStudenti"
        />
      </div>

      <!-- Stato vuoto -->
      <div v-if="!pending && studenti.length === 0" class="py-12 text-center">
        <UIcon name="i-heroicons-users" class="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p class="text-slate-500 text-sm">Nessuno studente trovato</p>
      </div>
    </UCard>

    <!-- ─── MODAL CREA STUDENTE ─── -->
    <UModal v-model:open="modalCreaAperto" title="Nuovo Studente" :ui="{ width: 'max-w-2xl' }">
      <template #body>
        <UForm ref="formCrea" :schema="CreateStudentSchema" :state="nuovoStudente" @submit="creaStudente" class="space-y-4">

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="firstName" label="Nome" required>
              <UInput v-model="nuovoStudente.firstName" placeholder="Mario" class="w-full" />
            </UFormField>
            <UFormField name="lastName" label="Cognome" required>
              <UInput v-model="nuovoStudente.lastName" placeholder="Rossi" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="classe" label="Classe">
              <USelectMenu
                v-model="nuovoStudente.classe"
                :items="CLASSI_LISTA"
                searchable
                placeholder="Seleziona classe..."
                class="w-full"
              />
            </UFormField>
            <UFormField name="scuola" label="Scuola">
              <template v-if="!altreScuolaCrea">
                <USelectMenu
                  v-model="nuovoStudente.scuola"
                  :items="SCUOLE_TRAPANI"
                  searchable
                  placeholder="Cerca scuola..."
                  class="w-full"
                />
                <button
                  type="button"
                  class="text-xs text-tfn-500 hover:underline mt-1 block"
                  @click="altreScuolaCrea = true"
                >
                  Non trovi la scuola? Inserisci manualmente
                </button>
              </template>
              <template v-else>
                <div class="flex gap-2">
                  <UInput v-model="nuovoStudente.scuola" placeholder="Nome scuola" class="flex-1" />
                  <UButton variant="ghost" size="xs" @click="altreScuolaCrea = false; nuovoStudente.scuola = ''">
                    ← Lista
                  </UButton>
                </div>
              </template>
            </UFormField>
          </div>

          <USeparator label="Dati Genitore" />

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="parentName" label="Nome Genitore">
              <UInput v-model="nuovoStudente.parentName" placeholder="Luigi Rossi" class="w-full" />
            </UFormField>
            <UFormField name="parentPhone" label="Telefono Genitore">
              <UInput
                v-model="nuovoStudente.parentPhone"
                placeholder="+39 333 1234567"
                class="w-full"
                @blur="nuovoStudente.parentPhone = normalizzaTelefono(nuovoStudente.parentPhone)"
              />
            </UFormField>
          </div>

          <UFormField name="parentEmail" label="Email genitore / alunno" required>
            <UInput v-model="nuovoStudente.parentEmail" type="email" placeholder="genitore@email.it" class="w-full" />
          </UFormField>

          <UFormField name="note" label="Note">
            <UTextarea v-model="nuovoStudente.note" placeholder="Eventuali note su questo studente..." :rows="3" class="w-full" />
          </UFormField>

        </UForm>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="modalCreaAperto = false">Annulla</UButton>
          <UButton :loading="salvando" @click="formCrea?.submit()">Salva Studente</UButton>
        </div>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
import { CreateStudentSchema } from '#shared/schemas/student.schema'
import { normalizzaTelefono } from '~/utils/phone'

definePageMeta({ middleware: ['staff-only'] })

const router = useRouter()
const toast = useToast()

// ─── Scuole e classi ───
const SCUOLE_TRAPANI = [
  // Trapani città - superiori
  'Liceo Scientifico "G. Galilei" - Trapani',
  'Liceo Classico "L. Ximenes" - Trapani',
  'Liceo delle Scienze Umane "G. B. Fardella" - Trapani',
  'Liceo Artistico di Trapani',
  'ITC "P. F. Calvino" - Trapani',
  'ITIS "G. Ferro" - Trapani',
  'IPSIA "L. Cassia" - Trapani',
  'Istituto Alberghiero di Trapani',
  // Trapani città - medie/elementari
  'I.C. "S. Borsellino-Ajello" - Trapani',
  'I.C. "G. Mazzini" - Trapani',
  'I.C. "E. De Amicis" - Trapani',
  'I.C. "G. Garibaldi" - Trapani',
  'I.C. "L. Da Vinci" - Trapani',
  'I.C. "G. Petrosino" - Petrosino (TP)',
  // Comuni limitrofi
  'Liceo "G. G. Adria" - Marsala',
  'ITIS "P. Gentili" - Marsala',
  'ITC "A. Lombardo" - Marsala',
  'I.C. di Erice',
  'I.C. di Paceco',
  'I.C. di Valderice',
]

const CLASSI_LISTA = [
  // Elementari
  '1ª Elementare', '2ª Elementare', '3ª Elementare', '4ª Elementare', '5ª Elementare',
  // Medie
  '1ª Media', '2ª Media', '3ª Media',
  // Superiori
  '1ª Superiore', '2ª Superiore', '3ª Superiore', '4ª Superiore', '5ª Superiore',
  // Altro
  'Università', 'Concorsi / Adulti',
]

// ─── Stato filtri ───
const search = ref('')
const filtroAttivo = ref('all')
const pagina = ref(1)
let searchTimer: ReturnType<typeof setTimeout> | null = null

// ─── Fetch studenti ───
const { data, pending, refresh } = await useFetch('/api/students', {
  query: computed(() => ({
    search:  search.value   || undefined,
    active:  filtroAttivo.value === 'all' ? undefined : filtroAttivo.value,
    page:    pagina.value,
    limit:   20,
    sortBy:  'lastName',
    sortDir: 'asc',
  })),
  watch: false,
})

const studenti = computed(() => data.value?.data ?? [])
const meta     = computed(() => data.value?.meta)

function caricaStudenti() {
  refresh()
}

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pagina.value = 1
    refresh()
  }, 350)
}

// ─── Click riga → naviga ───
// Nuxt UI v4: @select emette (event, row) — row è il TableRow di TanStack
function onRowSelect(_event: Event, row: any) {
  const id = row?.original?.id
  if (id) router.push(`/studenti/${id}`)
}

// ─── Colonne tabella ───
const colonne = [
  { id: 'nome',      accessorKey: 'lastName',    header: 'Studente' },
  { accessorKey: 'classe',                        header: 'Classe' },
  { accessorKey: 'scuola',                        header: 'Scuola' },
  { id: 'genitore',  accessorKey: 'parentName',   header: 'Genitore' },
  { id: 'stato',     accessorKey: 'active',       header: 'Stato' },
  { id: 'azioni',    accessorKey: 'id',           header: '' },
]

// ─── Modal crea ───
const modalCreaAperto  = ref(false)
const formCrea         = ref()
const salvando         = ref(false)
const altreScuolaCrea  = ref(false)

const nuovoStudente = reactive({
  firstName: '',
  lastName:  '',
  classe:    '',
  scuola:    '',
  parentName:  '',
  parentPhone: '',
  parentEmail: '',
  note:        '',
})

function apriModalCrea() {
  Object.assign(nuovoStudente, {
    firstName: '', lastName: '', classe: '', scuola: '',
    parentName: '', parentPhone: '', parentEmail: '', note: '',
  })
  altreScuolaCrea.value = false
  modalCreaAperto.value = true
}

async function creaStudente() {
  salvando.value = true
  try {
    await $fetch('/api/students', {
      method: 'POST',
      body: {
        ...nuovoStudente,
        classe:      nuovoStudente.classe      || undefined,
        scuola:      nuovoStudente.scuola      || undefined,
        parentName:  nuovoStudente.parentName  || undefined,
        parentPhone: nuovoStudente.parentPhone || undefined,
        parentEmail: nuovoStudente.parentEmail || undefined,
        note:        nuovoStudente.note        || undefined,
      },
    })
    toast.add({ title: 'Studente creato', color: 'success', icon: 'i-heroicons-check-circle' })
    modalCreaAperto.value = false
    refresh()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile creare lo studente', color: 'error', icon: 'i-heroicons-x-circle' })
  } finally {
    salvando.value = false
  }
}
</script>
