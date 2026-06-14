<template>
  <UModal v-model:open="isOpen" :title="`Gestisci Slot • ${tutorName}`">
    <template #body>
      <div class="space-y-6">
        <div class="flex flex-col gap-1">
          <div class="text-sm text-slate-500 font-medium">{{ formatDate(date) }}</div>
          <div class="text-lg font-bold text-slate-800">{{ slotStart }} - {{ slotEnd }}</div>
        </div>

        <div v-if="loading" class="py-8 flex justify-center">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
        </div>
        
        <div v-else class="space-y-6">
          <!-- Info Lezione Esistente -->
          <div v-if="existingLesson" class="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap gap-4">
            <div class="flex items-center gap-2">
              <span class="text-slate-500 text-sm">Tipo:</span>
              <UBadge size="sm" :color="calculatedType === 'SINGOLA' ? 'info' : (calculatedType === 'GRUPPO' ? 'success' : 'warning')">
                {{ calculatedType }}
              </UBadge>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-slate-500 text-sm">Compenso tutor:</span>
              <span class="font-bold text-slate-800">€{{ formatCurrency(calculatedCompenso) }}</span>
            </div>
          </div>

          <!-- Sezione Studenti -->
          <div>
            <h3 class="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <UIcon name="i-heroicons-users" class="w-5 h-5 text-slate-500" />
              Studenti nello slot ({{ students.length }})
            </h3>
            
            <div class="space-y-3">
              <div v-for="(stu, index) in students" :key="index" class="bg-white border border-slate-200 rounded-lg p-3 relative flex flex-col gap-2 shadow-sm">
                <UButton icon="i-heroicons-trash" size="xs" color="error" variant="ghost" class="absolute top-2 right-2" @click="removeStudent(index)" />
                
                <div class="pr-8">
                  <USelectMenu
                    v-model="stu.studentItem"
                    :items="getAvailableStudents(index)"
                    placeholder="Cerca studente..."
                    searchable
                    class="w-full"
                    @update:model-value="(val) => onStudenteSelezionato(index, val)"
                  />
                </div>
                
                <div v-if="stu.studentItem" class="pr-8">
                  <!-- Studente già nello slot: pacchetto in sola lettura, mostra il nome corretto -->
                  <div
                    v-if="stu.esistente"
                    class="w-full px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-600 flex items-center gap-2"
                  >
                    <UIcon name="i-heroicons-cube" class="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span class="truncate">{{ stu.packageItem?.label || 'Pacchetto' }}</span>
                  </div>
                  <!-- Studente nuovo: pacchetto selezionabile -->
                  <USelectMenu
                    v-else
                    v-model="stu.packageItem"
                    :items="stu.packageOptions || []"
                    :loading="stu.loadingPackages"
                    placeholder="Seleziona il pacchetto da scalare..."
                    class="w-full"
                  />
                </div>
              </div>
              
              <UButton v-if="!allStudentsSelected" size="sm" variant="soft" color="primary" icon="i-heroicons-plus" @click="addEmptyStudent" class="w-full justify-center">
                Aggiungi Studente
              </UButton>
            </div>
          </div>

          <!-- Opzioni -->
          <div class="space-y-3 border-t border-slate-200 pt-4">
            <UCheckbox v-model="mezzaLezioneGlobale" @update:model-value="onMezzaLezioneChange" label="Mezza Lezione (applicata a tutti gli studenti)" />
            <UCheckbox v-model="forzaGruppo" :disabled="students.length < 2" label="Forza tipo GRUPPO (anche per 1 studente)" />
          </div>

          <!-- Note -->
          <UFormField label="Note (opzionale)">
            <UTextarea v-model="note" placeholder="Aggiungi note sulla lezione..." rows="2" />
          </UFormField>
        </div>
      </div>
    </template>
    
    <template #footer>
      <div class="flex justify-between w-full">
        <UButton v-if="existingLesson" color="error" variant="soft" icon="i-heroicons-trash" :loading="saving" @click="deleteLesson">
          Elimina
        </UButton>
        <div v-else></div>
        
        <div class="flex gap-3">
          <UButton variant="ghost" color="gray" @click="isOpen = false">Annulla</UButton>
          <UButton color="primary" :loading="saving" :disabled="!canSave" @click="saveLesson">
            {{ existingLesson ? 'Aggiorna Lezione' : 'Crea Lezione' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const props = defineProps<{
  date: string
  tutorId: string
  tutorName: string
  timeSlotId: string
  slotStart: string
  slotEnd: string
  existingLessonsInSlot: any[] // Le lezioni che appartengono già a questo slot
}>()

const emit = defineEmits(['refresh', 'close'])

const isOpen = defineModel('open', { type: Boolean, default: false })
const toast = useToast()

const loading = ref(false)
const saving = ref(false)
const existingLesson = ref<any>(null)

// Studenti nella lezione (un mix di esistenti e nuovi)
const students = ref<any[]>([])
const forzaGruppo = ref(false)
const mezzaLezioneGlobale = ref(false)
const note = ref('')

// Opzioni globali
const { data: studentsRes } = useFetch('/api/students?active=true&limit=200', { lazy: true })
const studentsOptions = computed(() => {
  return (studentsRes.value?.data || []).map((s: any) => ({
    label: `${s.firstName} ${s.lastName}`,
    value: s.id
  }))
})

function getAvailableStudents(currentIndex: number) {
  const selectedIds = students.value
    .map((s, idx) => idx !== currentIndex ? s.studentItem?.value : null)
    .filter(Boolean)
  return studentsOptions.value.filter(opt => !selectedIds.includes(opt.value))
}

const allStudentsSelected = computed(() => {
  return students.value.length > 0 && students.value.every(s => s.studentItem && s.packageItem) === false
})

const canSave = computed(() => {
  if (students.value.length === 0) return false
  return students.value.every(s => s.studentItem?.value && s.packageItem?.value)
})

// Calcoli
const calculatedType = computed(() => {
  const num = students.value.filter(s => s.studentItem).length
  if (num === 0) return ''
  if (forzaGruppo.value) return 'GRUPPO'
  if (num === 1) return 'SINGOLA'
  if (num <= 3) return 'GRUPPO'
  return 'MAXI'
})

const calculatedCompenso = computed(() => {
  const tipo = calculatedType.value
  const hasMezza = mezzaLezioneGlobale.value
  const tariffe: Record<string, number> = {
    SINGOLA: hasMezza ? 2.50 : 5.00,
    GRUPPO: hasMezza ? 4.00 : 8.00,
    MAXI: hasMezza ? 4.00 : 8.50,
  }
  return tariffe[tipo] || 0
})

function onMezzaLezioneChange() {
  students.value.forEach(s => s.mezzaLezione = mezzaLezioneGlobale.value)
}

function formatCurrency(val: number) {
  return val.toFixed(2)
}

function formatDate(dateStr: string) {
  try {
    return format(new Date(dateStr), 'EEEE d MMMM yyyy', { locale: it })
  } catch {
    return dateStr
  }
}

function addEmptyStudent() {
  students.value.push({ studentItem: null, packageItem: null, packageOptions: [], loadingPackages: false, mezzaLezione: mezzaLezioneGlobale.value })
}

function removeStudent(idx: number) {
  students.value.splice(idx, 1)
}

async function onStudenteSelezionato(idx: number, newVal: any) {
  const stu = students.value[idx]
  const targetId = newVal?.value
  if (!targetId) {
    stu.packageOptions = []
    stu.packageItem = null
    return
  }
  
  stu.loadingPackages = true
  try {
    const res: any = await $fetch(`/api/packages?studentId=${targetId}&stati=ATTIVO`)
    const pkgs = res.data || []
    pkgs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    
    stu.packageOptions = pkgs.map((p: any) => ({
      label: `${p.nome} - Rim: ${p.tipo === 'MENSILE' ? p.giorniResiduo + 'gg' : parseFloat(p.oreResiduo) + 'h'}`,
      value: p.id
    }))
    
    if (stu.packageOptions.length > 0) {
      stu.packageItem = stu.packageOptions[0]
    } else {
      stu.packageItem = null
    }
  } catch (err) {
    console.error(err)
  } finally {
    stu.loadingPackages = false
  }
}

function initModal() {
  students.value = []
  existingLesson.value = null
  forzaGruppo.value = false
  mezzaLezioneGlobale.value = false
  note.value = ''

  if (props.existingLessonsInSlot && props.existingLessonsInSlot.length > 0) {
    // Esistono già lezioni in questo slot (es: una lezione per ciascun alunno se creati separatamente, 
    // oppure una lezione singola con più alunni). Raggruppiamo i dati.
    existingLesson.value = props.existingLessonsInSlot[0]
    forzaGruppo.value = existingLesson.value.forzaGruppo || false
    note.value = existingLesson.value.note || ''
    
    // Raccogliamo tutti gli studenti da tutte le lezioni nello slot
    props.existingLessonsInSlot.forEach(lesson => {
      lesson.lessonStudents?.forEach((ls: any) => {
        // Mocking the loaded items for USelectMenu
        const nomePacchetto = ls.package?.nome || 'Pacchetto'
        students.value.push({
          id: ls.studentId, // original DB id, used for tracking deletions
          lessonId: lesson.id,
          esistente: true, // studente già nello slot → pacchetto in sola lettura
          mezzaLezione: ls.mezzaLezione,
          studentItem: { label: `${ls.student?.firstName} ${ls.student?.lastName}`, value: ls.studentId },
          packageItem: { label: nomePacchetto, value: ls.packageId },
          packageOptions: [{ label: nomePacchetto, value: ls.packageId }],
          loadingPackages: false
        })
        if (ls.mezzaLezione) mezzaLezioneGlobale.value = true
      })
    })
  } else {
    // Slot vuoto, aggiungi una riga vuota
    addEmptyStudent()
  }
}

watch(() => isOpen.value, (newVal) => {
  if (newVal) {
    initModal()
  }
})

async function saveLesson() {
  saving.value = true
  try {
    const validStudents = students.value.map(s => ({
      studentId: s.studentItem.value,
      packageId: s.packageItem.value,
      mezzaLezione: s.mezzaLezione || mezzaLezioneGlobale.value
    }))

    const payload = {
      tutorId: props.tutorId,
      timeSlotId: props.timeSlotId,
      data: props.date,
      forzaGruppo: forzaGruppo.value,
      note: note.value,
      studenti: validStudents
    }

    if (existingLesson.value && props.existingLessonsInSlot.length > 0) {
      // Per semplicità, se stiamo aggiornando, è più sicuro eliminare le lezioni precedenti nello slot e ricreare,
      // MA l'API PUT /api/lessons/:id supporta l'update degli studenti (cancellando i non presenti e aggiungendo i nuovi).
      // Se c'erano più "lessons" per lo stesso slot, le cancelliamo e ne creiamo una sola unificata.
      if (props.existingLessonsInSlot.length > 1) {
        for (const l of props.existingLessonsInSlot) {
          await $fetch(`/api/lessons/${l.id}`, { method: 'DELETE' })
        }
        await $fetch('/api/lessons', { method: 'POST', body: payload })
      } else {
        await $fetch(`/api/lessons/${existingLesson.value.id}`, { method: 'PUT', body: payload })
      }
      toast.add({ title: 'Lezione aggiornata', color: 'success' })
    } else {
      await $fetch('/api/lessons', { method: 'POST', body: payload })
      toast.add({ title: 'Lezione creata', color: 'success' })
    }

    isOpen.value = false
    emit('refresh')
  } catch (err: any) {
    console.error(err)
    toast.add({ title: err.data?.statusMessage || 'Errore', description: err.data?.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function deleteLesson() {
  if (!confirm('Sei sicuro di voler eliminare tutte le lezioni di questo slot? Verranno ripristinate le ore.')) return
  saving.value = true
  try {
    for (const l of props.existingLessonsInSlot) {
      await $fetch(`/api/lessons/${l.id}`, { method: 'DELETE' })
    }
    toast.add({ title: 'Lezione eliminata', color: 'success' })
    isOpen.value = false
    emit('refresh')
  } catch (err) {
    console.error(err)
    toast.add({ title: 'Errore', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
