<template>
  <div class="space-y-6 max-w-4xl mx-auto">
    <!-- Intestazione -->
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Area Personale Tutor</h1>
      <p class="text-slate-500">Gestisci le tue presenze e inserisci note didattiche.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      <!-- 1) CALENDARIO DISPONIBILITÀ -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-slate-800">Le tue disponibilità</h2>
            <div class="flex items-center gap-2">
              <UButton icon="i-heroicons-chevron-left" color="white" variant="ghost" size="sm" @click="cambiaMese(-1)" />
              <span class="text-sm font-medium w-24 text-center">{{ nomeMeseCorrente }}</span>
              <UButton icon="i-heroicons-chevron-right" color="white" variant="ghost" size="sm" @click="cambiaMese(1)" />
            </div>
          </div>
        </template>
        
        <!-- Legenda -->
        <div class="flex gap-4 text-xs mb-4 text-slate-500">
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-primary-100 border border-primary-300"></div> Disponibile</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-white border border-slate-200"></div> Non disponibile</div>
        </div>

        <!-- Griglia Giorni -->
        <div class="grid grid-cols-7 gap-1 text-center">
          <!-- Intestazioni -->
          <div v-for="g in ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']" :key="g" class="text-xs font-medium text-slate-400 py-1">
            {{ g }}
          </div>
          
          <!-- Celle Vuote Iniziali -->
          <div v-for="blank in blankDays" :key="'b'+blank" class="p-2"></div>
          
          <!-- Giorni del Mese -->
          <button
            v-for="day in giorniMese"
            :key="day.dateStr"
            @click="toggleDisponibilita(day.dateStr)"
            class="p-2 rounded-md border text-sm transition-colors relative flex items-center justify-center min-h-[40px]"
            :class="[
              isDisponibile(day.dateStr) ? 'bg-primary-50 border-primary-300 text-primary-700 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            ]"
            :disabled="salvandoGiorno === day.dateStr"
          >
            <UIcon v-if="salvandoGiorno === day.dateStr" name="i-heroicons-arrow-path" class="animate-spin w-4 h-4 text-slate-400" />
            <span v-else>{{ day.numero }}</span>
          </button>
        </div>
      </UCard>

      <!-- 2) INSERIMENTO NOTE -->
      <UCard>
        <template #header>
          <h2 class="font-semibold text-slate-800">Nuova Nota Studente</h2>
          <p class="text-xs text-slate-500 font-normal">Aggiungi un commento su un alunno.</p>
        </template>
        
        <UForm :state="notaState" class="space-y-4" @submit="salvaNota">
          <UFormField label="Studente" required>
            <USelectMenu
              v-model="notaState.studentId"
              :items="studentsOptions"
              searchable
              placeholder="Cerca studente..."
              value-key="value"
              label-key="label"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Visibilità" required>
            <URadioGroup
              v-model="notaState.visibilita"
              :items="[{ label: 'Interna (Solo Staff)', value: 'INTERNA' }, { label: 'Famiglia (Visibile ai genitori)', value: 'FAMIGLIA' }]"
            />
          </UFormField>

          <UFormField label="Contenuto della nota" required>
            <UTextarea v-model="notaState.contenuto" :rows="4" placeholder="Scrivi qui..." />
          </UFormField>

          <div class="flex justify-end pt-2">
            <UButton type="submit" icon="i-heroicons-paper-airplane" :loading="salvandoNota">Salva Nota</UButton>
          </div>
        </UForm>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { startOfMonth, endOfMonth, addMonths, format, getDay, getDaysInMonth, setDate } from 'date-fns'
import { it } from 'date-fns/locale'

definePageMeta({ middleware: ['staff-only'] })
useHead({ title: 'Area Tutor — Ti Formiamo Noi' })

const toast = useToast()

// ─── CALENDARIO DISPONIBILITÀ ───
const meseRiferimento = ref(startOfMonth(new Date()))

const nomeMeseCorrente = computed(() => format(meseRiferimento.value, 'MMMM yyyy', { locale: it }))

const blankDays = computed(() => {
  const dayOfWeek = getDay(meseRiferimento.value)
  // getDay() => 0 (Dom) - 6 (Sab). Vogliamo Lunedì = 0
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1
})

const giorniMese = computed(() => {
  const tot = getDaysInMonth(meseRiferimento.value)
  const arr = []
  for (let i = 1; i <= tot; i++) {
    const d = setDate(meseRiferimento.value, i)
    arr.push({
      numero: i,
      dateStr: format(d, 'yyyy-MM-dd')
    })
  }
  return arr
})

function cambiaMese(dir: number) {
  meseRiferimento.value = addMonths(meseRiferimento.value, dir)
}

// Fetch presenze del mese
const fromStr = computed(() => format(meseRiferimento.value, 'yyyy-MM-dd'))
const toStr = computed(() => format(endOfMonth(meseRiferimento.value), 'yyyy-MM-dd'))

const { data: availabilities, refresh: refreshAvail } = useLazyFetch('/api/tutors/availabilities/me', {
  query: computed(() => ({ from: fromStr.value, to: toStr.value })),
  watch: [meseRiferimento]
})

function isDisponibile(dateStr: string) {
  if (!availabilities.value) return false
  return availabilities.value.some((a: any) => format(new Date(a.date), 'yyyy-MM-dd') === dateStr)
}

const salvandoGiorno = ref<string | null>(null)

async function toggleDisponibilita(dateStr: string) {
  salvandoGiorno.value = dateStr
  try {
    await $fetch('/api/tutors/availabilities/toggle', {
      method: 'POST',
      body: { date: dateStr }
    })
    await refreshAvail()
  } catch (err) {
    toast.add({ title: 'Errore', description: 'Impossibile salvare la disponibilità', color: 'error' })
  } finally {
    salvandoGiorno.value = null
  }
}

// ─── NOTE STUDENTE ───
const salvandoNota = ref(false)
const notaState = reactive({
  studentId: '',
  visibilita: 'INTERNA' as 'INTERNA' | 'FAMIGLIA',
  contenuto: ''
})

const { data: studentsRes } = useLazyFetch('/api/students?active=true&limit=1000')
const studentsOptions = computed(() => {
  return (studentsRes.value?.data || []).map((s: any) => ({
    label: `${s.firstName} ${s.lastName}`,
    value: s.id
  }))
})

async function salvaNota() {
  if (!notaState.studentId || !notaState.contenuto) {
    toast.add({ title: 'Compila tutti i campi', color: 'warning' })
    return
  }
  salvandoNota.value = true
  try {
    await $fetch('/api/notes', {
      method: 'POST',
      body: notaState
    })
    toast.add({ title: 'Nota salvata con successo', color: 'success' })
    notaState.contenuto = ''
    notaState.studentId = ''
  } catch (err) {
    toast.add({ title: 'Errore salvataggio nota', color: 'error' })
  } finally {
    salvandoNota.value = false
  }
}
</script>

