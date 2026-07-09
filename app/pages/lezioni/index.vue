<template>
  <div class="space-y-6">

    <!-- Intestazione -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">Lezioni</h2>
        <p class="text-sm text-slate-500 mt-0.5">{{ meta?.total ?? 0 }} lezioni nel periodo selezionato</p>
      </div>
    </div>

    <!-- Filtri -->
    <div class="flex flex-wrap gap-3 items-end bg-white p-4 rounded-2xl ring-1 ring-slate-200 shadow-sm">
      <UFormField label="Dal">
        <UInput v-model="filtroDataInizio" type="date" class="w-40" @change="caricaLezioni" />
      </UFormField>
      <UFormField label="Al">
        <UInput v-model="filtroDataFine" type="date" class="w-40" @change="caricaLezioni" />
      </UFormField>
      <USelect
        v-model="filtroTipo"
        :items="[
          { label: 'Tutti i tipi', value: 'all' },
          { label: 'Singola (1 studente)', value: 'SINGOLA' },
          { label: 'Gruppo (2–4)', value: 'GRUPPO' },
          { label: 'Maxi (5+)', value: 'MAXI' },
        ]"
        class="w-52"
        @change="caricaLezioni"
      />
      <USelect
        v-model="filtroTutor"
        :items="[{ label: 'Tutti i tutor', value: 'all' }, ...tutors.map(t => ({ label: `${t.lastName} ${t.firstName}`, value: t.id }))]"
        class="w-52"
        @change="caricaLezioni"
      />
      <USelect
        v-model="filtroStudente"
        :items="[{ label: 'Tutti gli alunni', value: 'all' }, ...students.map(s => ({ label: `${s.lastName} ${s.firstName}`, value: s.id }))]"
        class="w-52"
        @change="caricaLezioni"
      />
    </div>

    <!-- Tabella lezioni -->
    <div class="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
      <UTable
        :data="lezioni"
        :columns="colonne"
        :loading="pending"
        class="w-full"
      >
        <!-- Colonna Data e Ora -->
        <template #data-cell="{ row }">
          <div class="flex flex-col">
            <span class="font-medium text-slate-800">{{ formatData(row.original.data) }}</span>
            <span class="text-xs text-slate-500" v-if="row.original.timeSlot">
              <UIcon name="i-heroicons-clock" class="w-3 h-3 inline-block mr-0.5 align-text-bottom" />
              {{ row.original.timeSlot.oraInizio.substring(0,5) }} - {{ row.original.timeSlot.oraFine.substring(0,5) }}
            </span>
          </div>
        </template>

        <!-- Colonna Tutor -->
        <template #tutor-cell="{ row }">
          <div class="flex items-center gap-2">
            <UAvatar :alt="row.original.tutor?.firstName" size="xs" class="bg-primary-100 text-primary-600 font-bold" />
            <span class="font-medium text-slate-800">{{ row.original.tutor?.firstName }} {{ row.original.tutor?.lastName }}</span>
          </div>
        </template>

        <!-- Colonna Tipo -->
        <template #tipo-cell="{ row }">
          <div class="flex items-center gap-1.5">
            <UBadge :color="coloreTipo(row.original.tipo)" variant="subtle" size="sm" class="font-medium uppercase tracking-wide text-xs">
              {{ row.original.tipo }}
            </UBadge>
            <UIcon v-if="row.original.confermata" name="i-heroicons-check-badge" class="w-4 h-4 text-emerald-500" title="Visione confermata" />
          </div>
        </template>

        <!-- Colonna Studenti -->
        <template #studenti-cell="{ row }">
          <div class="text-sm text-slate-700 font-medium">
            <span v-if="row.original.lessonStudents && row.original.lessonStudents.length > 0" class="flex items-center gap-1.5">
              <UIcon name="i-heroicons-users" class="w-4 h-4 text-slate-400" />
              {{ row.original.lessonStudents.length }}
            </span>
            <span v-else class="text-slate-400">—</span>
          </div>
        </template>

        <!-- Colonna Compenso tutor -->
        <template #compenso-cell="{ row }">
          <span class="font-bold text-emerald-600">
            € {{ row.original.compensoTutor ? parseFloat(row.original.compensoTutor).toFixed(2) : '—' }}
          </span>
        </template>

        <!-- Colonna Note -->
        <template #note-cell="{ row }">
          <span class="text-slate-500 text-xs truncate max-w-[160px] block" :title="row.original.note">{{ row.original.note ?? '—' }}</span>
        </template>

        <!-- Colonna Azioni -->
        <template #azioni-cell="{ row }">
          <div class="flex justify-end">
            <UDropdownMenu
              :items="[
                [
                  { label: 'Dettagli', icon: 'i-heroicons-document-magnifying-glass', onSelect: () => apriDettaglio(row.original) },
                  { label: 'Vai al Calendario', icon: 'i-heroicons-calendar-days', onSelect: () => vaiAlCalendario(row.original) },
                ]
              ]"
            >
              <UButton icon="i-heroicons-ellipsis-horizontal" color="neutral" variant="ghost" size="sm" />
            </UDropdownMenu>
          </div>
        </template>
      </UTable>

      <!-- Paginazione -->
      <div v-if="meta && meta.totalPages > 1" class="flex justify-center py-4 border-t border-slate-100 bg-slate-50">
        <UPagination
          v-model:page="pagina"
          :total="meta.total"
          :items-per-page="50"
          @update:page="caricaLezioni"
        />
      </div>

      <div v-if="!pending && lezioni.length === 0" class="py-16 text-center">
        <UIcon name="i-heroicons-calendar-days" class="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 class="text-lg font-bold text-slate-700">Nessuna lezione</h3>
        <p class="text-slate-500 text-sm mt-1">Non ci sono lezioni nel periodo o coi filtri selezionati.</p>
      </div>
    </div>

    <!-- ─── MODAL DETTAGLIO LEZIONE ─── -->
    <UModal v-model:open="modalDettaglioAperto" :title="lezioneSelezionata ? `Lezione del ${formatData(lezioneSelezionata.data)}` : ''">
      <template v-if="lezioneSelezionata" #body>
        <dl class="space-y-3 text-sm">
          <div class="flex gap-2">
            <dt class="w-32 text-slate-400">Tutor</dt>
            <dd class="font-medium text-slate-800">{{ lezioneSelezionata.tutor?.firstName }} {{ lezioneSelezionata.tutor?.lastName }}</dd>
          </div>
          <div v-if="lezioneSelezionata.timeSlot" class="flex gap-2">
            <dt class="w-32 text-slate-400">Orario</dt>
            <dd>{{ lezioneSelezionata.timeSlot.oraInizio.substring(0,5) }} - {{ lezioneSelezionata.timeSlot.oraFine.substring(0,5) }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-32 text-slate-400">Tipo</dt>
            <dd><UBadge :color="coloreTipo(lezioneSelezionata.tipo)" variant="subtle">{{ lezioneSelezionata.tipo }}</UBadge></dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-32 text-slate-400">Compenso</dt>
            <dd class="font-medium">€ {{ lezioneSelezionata.compensoTutor ? parseFloat(lezioneSelezionata.compensoTutor).toFixed(2) : '—' }}</dd>
          </div>
          <div v-if="lezioneSelezionata.mezzaLezione" class="flex gap-2">
            <dt class="w-32 text-slate-400">Durata</dt>
            <dd><UBadge color="warning" variant="subtle" size="xs">½ lezione</UBadge></dd>
          </div>
          <div v-if="lezioneSelezionata.note" class="flex gap-2">
            <dt class="w-32 text-slate-400">Note</dt>
            <dd class="text-slate-700">{{ lezioneSelezionata.note }}</dd>
          </div>
          <div class="flex gap-2 items-center">
            <dt class="w-32 text-slate-400">Visione</dt>
            <dd>
              <UBadge v-if="lezioneSelezionata.confermata" color="success" variant="subtle" size="sm" class="flex items-center gap-1">
                <UIcon name="i-heroicons-check-badge" class="w-3.5 h-3.5" />
                Confermata da {{ lezioneSelezionata.confermataDaUser?.firstName }} {{ lezioneSelezionata.confermataDaUser?.lastName }}
              </UBadge>
              <UBadge v-else color="warning" variant="subtle" size="sm">Da confermare</UBadge>
            </dd>
          </div>
          <USeparator />
          <div v-if="lezioneSelezionata.lessonStudents?.length > 0">
            <p class="text-slate-400 mb-2">Studenti ({{ lezioneSelezionata.lessonStudents.length }})</p>
            <ul class="space-y-1">
              <li v-for="ls in lezioneSelezionata.lessonStudents" :key="ls.studentId" class="flex items-center gap-2">
                <UIcon name="i-heroicons-user-circle" class="w-4 h-4 text-primary-500" />
                <span class="text-slate-700 font-medium">{{ ls.student?.firstName }} {{ ls.student?.lastName }}</span>
                <span class="text-slate-400 text-xs ml-auto">{{ ls.oreScalate }}h scalate</span>
              </li>
            </ul>
          </div>
        </dl>
      </template>
      <template #footer>
        <div class="flex justify-between w-full">
          <div class="flex gap-2">
            <UButton 
              v-if="lezioneSelezionata && !lezioneSelezionata.confermata"
              color="success" 
              variant="soft" 
              icon="i-heroicons-check-badge"
              :loading="confermando"
              @click="confermaVisione"
            >
              Conferma visione
            </UButton>
            <UButton 
              v-if="lezioneSelezionata"
              color="red" 
              variant="soft" 
              icon="i-heroicons-trash"
              @click="eliminaLezioneSelezionata"
            >
              Elimina
            </UButton>
          </div>
          <UButton variant="ghost" @click="modalDettaglioAperto = false">Chiudi</UButton>
        </div>
      </template>
    </UModal>

  </div>

  <ConfirmDialog
    v-model:open="confirmOpen"
    :title="confirmTitle"
    :description="confirmDescription"
    confirm-label="Elimina"
    confirm-color="error"
    @confirm="eseguiEliminazione"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ConfirmDialog from '~/components/ConfirmDialog.vue'

definePageMeta({ middleware: ['admin-or-super'] })

// ─── Filtri ───
// Costruisco le stringhe 'YYYY-MM-DD' dai componenti LOCALI (non con toISOString, che usa
// UTC e farebbe slittare il 1° del mese al giorno prima per chi è in fuso orario italiano).
const oggi = new Date()
const aaaammgg = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const primoDelMese = aaaammgg(new Date(oggi.getFullYear(), oggi.getMonth(), 1))
const ultDelMese   = aaaammgg(new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0))

const filtroDataInizio = ref(primoDelMese)
const filtroDataFine   = ref(ultDelMese)
const filtroTipo       = ref('all')
const filtroTutor      = ref('all')
const filtroStudente   = ref('all')
const pagina           = ref(1)

// Fetch Tutors & Students for filters
const { data: tutorsRes } = useLazyFetch('/api/tutors', { query: { active: 'true' } })
const tutors = computed(() => tutorsRes.value?.data ?? [])

const { data: studentsRes } = useLazyFetch('/api/students', { query: { active: 'true', limit: 1000, light: 'true' } })
const students = computed(() => studentsRes.value?.data ?? [])

// ─── Fetch lezioni ───
const { data, pending, refresh } = useLazyFetch('/api/lessons', {
  query: computed(() => ({
    dataInizio: filtroDataInizio.value || undefined,
    dataFine:   filtroDataFine.value   || undefined,
    tipo:       filtroTipo.value === 'all' ? undefined : filtroTipo.value,
    tutorId:    filtroTutor.value === 'all' ? undefined : filtroTutor.value,
    studentId:  filtroStudente.value === 'all' ? undefined : filtroStudente.value,
    page:       pagina.value,
    limit:      50,
  })),
  watch: false,
})

const lezioni = computed(() => data.value?.data ?? [])
const meta    = computed(() => data.value?.meta)

function caricaLezioni() { pagina.value = 1; refresh() }

// ─── Colonne ───
const colonne = [
  { accessorKey: 'data',             header: 'Data' },
  { accessorKey: 'tutor',            header: 'Tutor' },
  { accessorKey: 'tipo',             header: 'Tipo' },
  { id: 'studenti', accessorKey: 'lessonStudents', header: 'Studenti' },
  { id: 'compenso', accessorKey: 'compensoTutor',  header: 'Compenso' },
  { accessorKey: 'note',             header: 'Note' },
  { id: 'azioni',    header: '' },
]

function formatData(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function coloreTipo(tipo: string) {
  if (tipo === 'SINGOLA') return 'info'
  if (tipo === 'GRUPPO')  return 'warning'
  if (tipo === 'MAXI')    return 'error'
  return 'neutral'
}

// ─── Modal dettaglio ───
const modalDettaglioAperto = ref(false)
const lezioneSelezionata   = ref<any>(null)

function apriDettaglio(row: any) {
  lezioneSelezionata.value = row
  modalDettaglioAperto.value = true
}

function vaiAlCalendario(lezione: any) {
  const data = lezione.data?.slice(0, 10) // prende YYYY-MM-DD
  navigateTo(`/calendario?data=${data}`)
}

const toast = useToast()
const confermando = ref(false)

const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmDescription = ref('')

function eliminaLezioneSelezionata() {
  if (!lezioneSelezionata.value) return
  confirmTitle.value = 'Eliminare questa lezione?'
  confirmDescription.value = 'Le ore verranno rimborsate agli alunni.'
  confirmOpen.value = true
}

async function confermaVisione() {
  if (!lezioneSelezionata.value) return
  confermando.value = true
  try {
    await $fetch(`/api/lessons/${lezioneSelezionata.value.id}/confirm`, { method: 'POST' })
    toast.add({ title: 'Visione confermata', color: 'success' })
    lezioneSelezionata.value.confermata = true
    caricaLezioni()
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage || 'Impossibile confermare la visione',
      color: 'error'
    })
  } finally {
    confermando.value = false
  }
}

async function eseguiEliminazione() {
  confirmOpen.value = false
  try {
    await $fetch(`/api/lessons/${lezioneSelezionata.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Lezione eliminata con successo', color: 'success' })
    modalDettaglioAperto.value = false
    caricaLezioni()
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage || 'Impossibile eliminare la lezione',
      color: 'error'
    })
  }
}
</script>
