<template>
  <div class="space-y-6">
    <h2 class="font-heading text-xl font-bold text-slate-900">Richiedi una lezione</h2>

    <!-- Stepper -->
    <div class="flex items-center gap-2">
      <template v-for="(label, idx) in steps" :key="idx">
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
          :class="step > idx + 1
            ? 'bg-success-500 text-white'
            : step === idx + 1
              ? 'bg-tfn-500 text-white'
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
        />
      </div>

      <div class="space-y-3">
        <label class="block text-sm font-medium text-slate-700">Data desiderata</label>
        <UInput
          v-model="form.dataDesiderata"
          type="date"
          :min="minDate"
          class="w-full"
          @change="validaDataDesiderata"
        />
        <p class="text-xs text-slate-400">La segreteria assegnerà l'orario esatto.</p>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton
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
            ? 'border-tfn-500 bg-tfn-50 text-tfn-700 font-medium'
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
          <UButton :disabled="form.materie.length === 0" @click="step = 3">Avanti</UButton>
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
          placeholder="Es. preferisco dopo le 17, o il giovedì pomeriggio"
          :rows="3"
          class="w-full"
        />

        <div class="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
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
          <UButton color="primary" :loading="loading" @click="inviaPrenotazione">
            Conferma richiesta
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- Step 4: Successo -->
    <UCard v-if="step === 4">
      <div class="text-center py-8 space-y-4">
        <div class="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto">
          <UIcon name="i-heroicons-check" class="w-8 h-8 text-success-600" />
        </div>
        <div>
          <h3 class="font-heading text-lg font-bold text-slate-900">Richiesta inviata!</h3>
          <p class="text-sm text-slate-500 mt-1">
            La segreteria ti contatterà per confermare orario e tutor.
          </p>
        </div>
        <UButton to="/portale" variant="ghost">Torna alla home</UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Prenota — Portale Famiglie' })

const MATERIE = [
  'Matematica', 'Fisica', 'Chimica', 'Italiano', 'Inglese',
  'Storia', 'Geografia', 'Latino', 'Greco', 'Scienze', 'Informatica',
]

const toast = useToast()
const step = ref(1)
const loading = ref(false)
const steps = ['Data', 'Materie', 'Conferma']

const { data: studentsData } = useLazyFetch('/api/portal/students')
const students = computed(() => (studentsData.value as any[]) ?? [])

const form = reactive({
  studentId:      '' as string,
  dataDesiderata: '',
  materie:        [] as string[],
  noteOrario:     '',
})

watchEffect(() => {
  if (students.value.length >= 1 && !form.studentId) {
    form.studentId = students.value[0].id
  }
})

const { data: closuresData } = useLazyFetch('/api/portal/closures')
const closures = computed(() => (closuresData.value as any[]) ?? [])

const minDate = computed(() => {
  const now = new Date()
  // Se sono le 11:30 o più tardi, blocca la data di oggi e passa a domani
  if (now.getHours() > 11 || (now.getHours() === 11 && now.getMinutes() >= 30)) {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }
  return now.toISOString().split('T')[0]
})

function validaDataDesiderata() {
  if (!form.dataDesiderata) return
  
  const selectedDate = new Date(form.dataDesiderata)
  
  // 1. Controllo Domenica (0 = Domenica)
  if (selectedDate.getDay() === 0) {
    toast.add({ title: 'Impossibile prenotare di Domenica', color: 'error' })
    form.dataDesiderata = ''
    return
  }

  // 2. Controllo chiusure
  const isChiuso = closures.value.some((c: any) => c.date.split('T')[0] === form.dataDesiderata)
  if (isChiuso) {
    toast.add({ title: 'Il centro è chiuso in questa data', color: 'error' })
    form.dataDesiderata = ''
    return
  }

  // 3. Controllo limite 11:30 per giorno stesso (doppia sicurezza in caso di minDate aggirato)
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  if (form.dataDesiderata === todayStr) {
    if (now.getHours() > 11 || (now.getHours() === 11 && now.getMinutes() >= 30)) {
      toast.add({ title: 'Le lezioni per oggi si potevano prenotare solo entro le 11:30', color: 'error' })
      form.dataDesiderata = ''
      return
    }
  }
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
    await $fetch('/api/portal/bookings', {
      method: 'POST',
      body: {
        studentId:      form.studentId,
        dataDesiderata: form.dataDesiderata + 'T12:00:00.000Z',
        materie:        form.materie,
        noteOrario:     form.noteOrario || undefined,
      },
    })
    step.value = 4
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile inviare la richiesta. Riprova.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

