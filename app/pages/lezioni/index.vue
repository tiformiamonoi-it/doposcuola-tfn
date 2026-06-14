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
    <div class="flex flex-wrap gap-3 items-end">
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
    <UCard :ui="{ body: 'p-0' }">
      <UTable
        :data="lezioni"
        :columns="colonne"
        :loading="pending"
      >
        <!-- Colonna Data -->
        <template #data-cell="{ row }">
          <span class="font-medium text-slate-800">{{ formatData(row.original.data) }}</span>
        </template>

        <!-- Colonna Tipo -->
        <template #tipo-cell="{ row }">
          <UBadge :color="coloreTipo(row.original.tipo)" variant="subtle" size="sm">
            {{ row.original.tipo }}
          </UBadge>
        </template>

        <!-- Colonna Studenti -->
        <template #studenti-cell="{ row }">
          <div class="text-sm text-slate-700">
            <span v-if="row.original.lessonStudents && row.original.lessonStudents.length > 0">
              {{ row.original.lessonStudents.length }} studente{{ row.original.lessonStudents.length > 1 ? 'i' : '' }}
            </span>
            <span v-else>—</span>
          </div>
        </template>

        <!-- Colonna Compenso tutor -->
        <template #compenso-cell="{ row }">
          <span class="text-slate-700">
            € {{ row.original.compensoTutor ? parseFloat(row.original.compensoTutor).toFixed(2) : '—' }}
          </span>
        </template>

        <!-- Colonna Note -->
        <template #note-cell="{ row }">
          <span class="text-slate-500 text-xs truncate max-w-[160px] block">{{ row.original.note ?? '—' }}</span>
        </template>

        <!-- Colonna Dettaglio -->
        <template #dettaglio-cell="{ row }">
          <UButton
            icon="i-heroicons-arrow-right"
            variant="ghost"
            size="xs"
            @click="apriDettaglio(row.original)"
          />
        </template>
      </UTable>

      <!-- Paginazione -->
      <div v-if="meta && meta.totalPages > 1" class="flex justify-center py-4 border-t border-slate-100">
        <UPagination
          v-model:page="pagina"
          :total="meta.total"
          :items-per-page="50"
          @update:page="caricaLezioni"
        />
      </div>

      <div v-if="!pending && lezioni.length === 0" class="py-12 text-center">
        <UIcon name="i-heroicons-calendar-days" class="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p class="text-slate-500 text-sm">Nessuna lezione nel periodo selezionato</p>
      </div>
    </UCard>

    <!-- ─── MODAL DETTAGLIO LEZIONE ─── -->
    <UModal v-model:open="modalDettaglioAperto" :title="lezioneSelezionata ? `Lezione del ${formatData(lezioneSelezionata.data)}` : ''">
      <template v-if="lezioneSelezionata" #body>
        <dl class="space-y-3 text-sm">
          <div class="flex gap-2">
            <dt class="w-32 text-slate-400">Tipo</dt>
            <dd><UBadge :color="coloreTipo(lezioneSelezionata.tipo)" variant="subtle">{{ lezioneSelezionata.tipo }}</UBadge></dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-32 text-slate-400">Compenso tutor</dt>
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
          <USeparator />
          <div v-if="lezioneSelezionata.lessonStudents?.length > 0">
            <p class="text-slate-400 mb-2">Studenti ({{ lezioneSelezionata.lessonStudents.length }})</p>
            <ul class="space-y-1">
              <li v-for="ls in lezioneSelezionata.lessonStudents" :key="ls.studentId" class="flex items-center gap-2">
                <UIcon name="i-heroicons-user-circle" class="w-4 h-4 text-slate-400" />
                <span class="text-slate-700 font-medium">{{ ls.student?.firstName }} {{ ls.student?.lastName }}</span>
                <span class="text-slate-400 text-xs ml-auto">{{ ls.oreScalate }} ore scalate</span>
              </li>
            </ul>
          </div>
        </dl>
      </template>
      <template #footer>
        <div class="flex justify-between w-full">
          <UButton 
            v-if="lezioneSelezionata"
            color="red" 
            variant="soft" 
            icon="i-heroicons-trash"
            @click="eliminaLezioneSelezionata"
          >
            Elimina
          </UButton>
          <UButton variant="ghost" @click="modalDettaglioAperto = false">Chiudi</UButton>
        </div>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['admin-or-super'] })

// ─── Filtri ───
const oggi = new Date()
const primoDelMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1).toISOString().slice(0, 10)
const ultDelMese   = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0).toISOString().slice(0, 10)

const filtroDataInizio = ref(primoDelMese)
const filtroDataFine   = ref(ultDelMese)
const filtroTipo       = ref('all')
const filtroTutor      = ref('all')
const filtroStudente   = ref('all')
const pagina           = ref(1)

// Fetch Tutors & Students for filters
const { data: tutorsRes } = useLazyFetch('/api/tutors', { query: { active: 'true' } })
const tutors = computed(() => tutorsRes.value?.data ?? [])

const { data: studentsRes } = useLazyFetch('/api/students', { query: { active: 'true', limit: 1000 } })
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
  { accessorKey: 'tipo',             header: 'Tipo' },
  { id: 'studenti', accessorKey: 'lessonStudents', header: 'Studenti' },
  { id: 'compenso', accessorKey: 'compensoTutor',  header: 'Compenso tutor' },
  { accessorKey: 'note',             header: 'Note' },
  { id: 'dettaglio', accessorKey: 'id',            header: '' },
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

const toast = useToast()
async function eliminaLezioneSelezionata() {
  if (!lezioneSelezionata.value) return
  if (!confirm('Sei sicuro di voler eliminare questa lezione? Le ore verranno rimborsate agli alunni.')) return

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

