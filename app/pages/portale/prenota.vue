<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="font-heading text-xl font-bold text-slate-900">
        {{ isEditMode ? 'Modifica la lezione' : 'Richiedi una lezione' }}
      </h2>
      <UButton v-if="isEditMode" size="xs" color="gray" variant="ghost" @click="resetForm">
        Nuova richiesta
      </UButton>
    </div>

    <!-- Stepper -->
    <div class="flex items-center gap-2">
      <template v-for="(label, idx) in steps" :key="idx">
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
          :class="step > idx + 1
            ? 'bg-success-500 text-white'
            : step === idx + 1
              ? (isEditMode ? 'bg-amber-500 text-white' : 'bg-tfn-500 text-white')
              : 'bg-slate-100 text-slate-400'"
        >
          <UIcon v-if="step > idx + 1" name="i-heroicons-check" class="w-4 h-4" />
          <span v-else>{{ idx + 1 }}</span>
        </div>
        <span class="text-xs text-slate-500 hidden sm:inline">{{ label }}</span>
        <div v-if="idx < steps.length - 1" class="w-6 h-px bg-slate-200" />
      </template>
    </div>

    <!-- Step 1: Data -->
    <UCard v-if="step === 1">
      <template #header>
        <span class="font-medium text-slate-800">Quando vorresti la lezione?</span>
      </template>

      <div v-if="students.length > 1" class="mb-4">
        <label class="block text-sm font-medium text-slate-700 mb-1">Per quale figlio?</label>
        <USelect
          v-model="form.studentId"
          :items="students.map((s: any) => ({ label: `${s.firstName} ${s.lastName}`, value: s.id }))"
          placeholder="Seleziona figlio..."
          @change="onStudentChange"
        />
      </div>

      <!-- Custom Calendar -->
      <div class="bg-white rounded-lg border border-slate-200 p-4 max-w-sm mx-auto">
        <div class="flex items-center justify-between mb-4">
          <UButton icon="i-heroicons-chevron-left" variant="ghost" size="sm" @click="prevMonth" />
          <span class="font-bold text-slate-800 capitalize">{{ currentMonthName }} {{ currentYear }}</span>
          <UButton icon="i-heroicons-chevron-right" variant="ghost" size="sm" @click="nextMonth" />
        </div>
        <div class="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 mb-2">
          <div>Lun</div><div>Mar</div><div>Mer</div><div>Gio</div><div>Ven</div><div>Sab</div><div class="text-red-400">Dom</div>
        </div>
        <div class="grid grid-cols-7 gap-1 text-center">
          <div v-for="blank in blankDays" :key="'blank-'+blank" class="p-2"></div>
          <button
            v-for="day in daysInMonth" :key="'day-'+day"
            @click="selectDate(day)"
            :disabled="isDayDisabled(day)"
            class="relative rounded-lg transition-all flex items-center justify-center w-9 h-9 mx-auto text-sm"
            :class="[
              form.dataDesiderata === getDateString(day) 
                ? (isEditMode ? 'bg-amber-500 text-white font-bold shadow-md' : 'bg-tfn-500 text-white font-bold shadow-md')
                : (isDayDisabled(day) ? 'opacity-30 cursor-not-allowed bg-slate-50 text-slate-400' : 'hover:bg-slate-100 text-slate-700 cursor-pointer font-medium'),
            ]"
          >
            {{ day }}
            <!-- Pallino lezione esistente -->
            <span v-if="hasExistingLesson(day) && form.dataDesiderata !== getDateString(day)" class="absolute bottom-1 w-1 h-1 rounded-full bg-amber-500"></span>
            <span v-if="isTodayString(getDateString(day)) && form.dataDesiderata !== getDateString(day)" class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          </button>
        </div>
      </div>

      <div class="mt-4 flex flex-col gap-2 text-xs text-slate-500 justify-center items-center">
        <div class="flex items-center gap-4">
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span> Oggi</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-500"></span> Lezione prenotata</span>
        </div>
        <p v-if="isEditMode" class="text-amber-600 font-medium bg-amber-50 px-3 py-1.5 rounded-md mt-2">
          Hai già una lezione per questa data. Procedendo potrai modificarla.
        </p>
        <p v-else>La segreteria assegnerà l'orario esatto.</p>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton
            :color="isEditMode ? 'amber' : 'primary'"
            :disabled="!form.dataDesiderata || !form.studentId"
            @click="step = 2"
          >
            Avanti
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- Step 2: Materie -->
    <UCard v-if="step === 2">
      <template #header>
        <span class="font-medium text-slate-800">Quali materie vuoi studiare?</span>
      </template>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button
          v-for="materia in MATERIE"
          :key="materia"
          class="px-3 py-2 text-sm rounded-lg border transition-colors text-left"
          :class="form.materie.includes(materia)
            ? (isEditMode ? 'border-amber-500 bg-amber-50 text-amber-700 font-medium' : 'border-tfn-500 bg-tfn-50 text-tfn-700 font-medium')
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'"
          @click="toggleMateria(materia)"
        >
          {{ materia }}
        </button>
      </div>

      <p v-if="form.materie.length === 0" class="text-xs text-red-500 mt-2">
        Seleziona almeno una materia
      </p>

      <template #footer>
        <div class="flex justify-between">
          <UButton variant="ghost" @click="step = 1">Indietro</UButton>
          <UButton :color="isEditMode ? 'amber' : 'primary'" :disabled="form.materie.length === 0" @click="step = 3">Avanti</UButton>
        </div>
      </template>
    </UCard>

    <!-- Step 3: Nota + Conferma -->
    <UCard v-if="step === 3">
      <template #header>
        <span class="font-medium text-slate-800">Aggiungi una nota (opzionale)</span>
      </template>

      <div class="space-y-4">
        <UTextarea
          v-model="form.noteOrario"
          placeholder="(Avvisaci se fai tardi o hai qualche necessità)"
          :rows="3"
          class="w-full"
        />

        <div class="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-slate-500">Azione</span>
            <span class="font-bold" :class="isEditMode ? 'text-amber-600' : 'text-tfn-600'">
              {{ isEditMode ? 'Modifica Lezione Esistente' : 'Nuova Prenotazione' }}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Studente</span>
            <span class="font-medium text-slate-800">{{ studentSelezionato }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Data richiesta</span>
            <span class="font-medium text-slate-800">{{ formatDateLong(form.dataDesiderata) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Materie</span>
            <span class="font-medium text-slate-800">{{ form.materie.join(', ') }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between">
          <UButton variant="ghost" @click="step = 2">Indietro</UButton>
          <UButton :color="isEditMode ? 'amber' : 'primary'" :loading="loading" @click="inviaPrenotazione">
            {{ isEditMode ? 'Salva Modifiche' : 'Conferma richiesta' }}
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- Step 4: Successo -->
    <UCard v-if="step === 4">
      <div class="text-center py-8 space-y-4">
        <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto" :class="isEditMode ? 'bg-amber-100' : 'bg-success-100'">
          <UIcon name="i-heroicons-check" class="w-8 h-8" :class="isEditMode ? 'text-amber-600' : 'text-success-600'" />
        </div>
        <div>
          <h3 class="font-heading text-lg font-bold text-slate-900">
            {{ isEditMode ? 'Modifica salvata!' : 'Richiesta inviata!' }}
          </h3>
          <p class="text-sm text-slate-500 mt-1">
            La segreteria elaborerà la tua richiesta al più presto.
          </p>
        </div>
        <UButton to="/portale" variant="ghost">Torna alla home</UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watchEffect, onMounted } from 'vue'

definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Prenota — Portale Famiglie' })

const { data: portalConfigs } = useLazyFetch('/api/portal/configs')
const MATERIE = computed(() => (portalConfigs.value as any)?.materie ?? [
  'Matematica', 'Fisica', 'Chimica', 'Italiano', 'Inglese',
  'Storia', 'Geografia', 'Latino', 'Greco', 'Scienze', 'Informatica',
])

const toast = useToast()
const step = ref(1)
const loading = ref(false)
const steps = ['Data', 'Materie', 'Conferma']

const { data: studentsData } = useLazyFetch('/api/portal/students')
const students = computed(() => (studentsData.value as any[]) ?? [])

const { data: closuresData } = useLazyFetch('/api/portal/closures')
const closures = computed(() => (closuresData.value as any[]) ?? [])

// Carichiamo le prenotazioni per sapere se ci sono doppioni
const { data: bookingsData } = useLazyFetch('/api/portal/bookings')
const bookings = computed(() => (bookingsData.value as any[]) ?? [])

const form = reactive({
  studentId: '',
  dataDesiderata: '',
  materie: [] as string[],
  noteOrario: '',
})

const isEditMode = ref(false)
const editBookingId = ref<string | null>(null)

watchEffect(() => {
  if (students.value.length >= 1 && !form.studentId) {
    form.studentId = students.value[0].id
  }
})

// --- CALENDAR LOGIC ---
const currentDate = ref(new Date())

const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())
const currentMonthName = computed(() => {
  return currentDate.value.toLocaleString('it-IT', { month: 'long' })
})

const daysInMonth = computed(() => {
  return new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
})

const blankDays = computed(() => {
  let firstDay = new Date(currentYear.value, currentMonth.value, 1).getDay()
  // Trasforma Domenica (0) in 7 per avere Lunedì come primo giorno
  return firstDay === 0 ? 6 : firstDay - 1
})

function prevMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value - 1, 1)
}

function nextMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value + 1, 1)
}

function getDateString(day: number) {
  const d = new Date(currentYear.value, currentMonth.value, day)
  // Fix offset per ottenere YYYY-MM-DD corretto
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

function isTodayString(dateStr: string) {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'
  })
  const parts = formatter.formatToParts(now)
  const p = (type: string) => parts.find(x => x.type === type)?.value
  const todayStr = `${p('year')}-${p('month')}-${p('day')}`
  return dateStr === todayStr
}

function getItalyNow() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  })
  const parts = formatter.formatToParts(now)
  const p = (type: string) => parts.find(x => x.type === type)?.value
  return {
    todayStr: `${p('year')}-${p('month')}-${p('day')}`,
    hour: parseInt(p('hour') || '0', 10),
    minute: parseInt(p('minute') || '0', 10),
  }
}

function isDayDisabled(day: number) {
  const dateStr = getDateString(day)
  const d = new Date(dateStr)
  
  // 1. Passato
  const itNow = getItalyNow()
  if (dateStr < itNow.todayStr) return true
  
  // 2. Domenica
  if (d.getDay() === 0) return true
  
  // 3. Chiusure
  if (closures.value.some((c: any) => c.date.split('T')[0] === dateStr)) return true

  // 4. Oggi se oltre orario limite (11:30)
  if (dateStr === itNow.todayStr) {
    if (itNow.hour > 11 || (itNow.hour === 11 && itNow.minute >= 30)) {
      return true
    }
  }

  return false
}

function hasExistingLesson(day: number) {
  if (!form.studentId) return false
  const dateStr = getDateString(day)
  return bookings.value.some((b: any) => {
    if (b.status === 'CANCELLED') return false
    if (b.studentId !== form.studentId) return false
    return b.requestedDate.split('T')[0] === dateStr
  })
}

function selectDate(day: number) {
  if (isDayDisabled(day)) return
  
  const dateStr = getDateString(day)
  form.dataDesiderata = dateStr

  // Check se entra in Edit Mode
  const existing = bookings.value.find((b: any) => 
    b.status !== 'CANCELLED' && 
    b.studentId === form.studentId && 
    b.requestedDate.split('T')[0] === dateStr
  )

  if (existing) {
    isEditMode.value = true
    editBookingId.value = existing.id
    form.materie = existing.subjects ? existing.subjects.map((s: any) => s.name) : []
    form.noteOrario = existing.notes || ''
  } else {
    isEditMode.value = false
    editBookingId.value = null
    form.materie = []
    form.noteOrario = ''
  }
}

function onStudentChange() {
  // Ricalcola se la data selezionata ha una lezione per il nuovo figlio
  if (form.dataDesiderata) {
    const day = parseInt(form.dataDesiderata.split('-')[2], 10)
    selectDate(day) // Rilancia la logica di selezione che imposterà l'edit mode corretto
  }
}

function resetForm() {
  form.dataDesiderata = ''
  form.materie = []
  form.noteOrario = ''
  isEditMode.value = false
  editBookingId.value = null
  step.value = 1
}

const studentSelezionato = computed(() => {
  const s = students.value.find((s: any) => s.id === form.studentId)
  return s ? `${s.firstName} ${s.lastName}` : ''
})

function toggleMateria(m: string) {
  const idx = form.materie.indexOf(m)
  if (idx === -1) form.materie.push(m)
  else form.materie.splice(idx, 1)
}

function formatDateLong(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

async function inviaPrenotazione() {
  loading.value = true
  try {
    if (isEditMode.value && editBookingId.value) {
      // Chiamata PUT per la modifica
      await $fetch(`/api/portal/bookings/${editBookingId.value}`, {
        method: 'PUT',
        body: {
          dataDesiderata: form.dataDesiderata + 'T12:00:00.000Z',
          materie:        form.materie,
          noteOrario:     form.noteOrario || undefined,
        },
      })
    } else {
      // Chiamata POST standard
      await $fetch('/api/portal/bookings', {
        method: 'POST',
        body: {
          studentId:      form.studentId,
          dataDesiderata: form.dataDesiderata + 'T12:00:00.000Z',
          materie:        form.materie,
          noteOrario:     form.noteOrario || undefined,
        },
      })
    }
    step.value = 4
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile completare l\'operazione. Riprova.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>
