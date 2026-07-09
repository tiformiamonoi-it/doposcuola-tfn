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
              <div v-for="(stu, index) in students" :key="index" class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 shadow-sm">
                <div class="flex-1 min-w-0">
                  <span class="font-medium text-slate-800">{{ stu.studentItem?.label }}</span>
                  <span v-if="stu.loadingPackages" class="text-xs text-slate-400 ml-2">caricamento...</span>
                </div>

                <!-- Studente già esistente: pacchetto in sola lettura -->
                <div v-if="stu.esistente" class="flex items-center gap-1 text-xs text-slate-500">
                  <UIcon name="i-heroicons-cube" class="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span class="truncate max-w-[8rem]">{{ stu.packageItem?.label || 'Pacchetto' }}</span>
                </div>
                <!-- Studente nuovo: dropdown pacchetto se più opzioni, altrimenti mostra nome -->
                <template v-else>
                  <USelectMenu
                    v-if="!stu.loadingPackages && stu.packageOptions.length > 1 && !stu.packageItem"
                    v-model="stu.packageItem"
                    :items="stu.packageOptions"
                    placeholder="Scegli pacchetto..."
                    class="w-40"
                  />
                  <span v-else-if="stu.packageItem" class="text-xs text-emerald-600 font-medium truncate max-w-[8rem]">{{ stu.packageItem.label }}</span>
                  <span v-else-if="!stu.loadingPackages" class="text-xs text-red-400">Nessun pacchetto</span>
                </template>

                <UButton icon="i-heroicons-x-mark" size="xs" variant="ghost" color="neutral" @click="removeStudent(index)" />
              </div>

              <!-- Bottone apri picker -->
              <UButton size="sm" variant="soft" color="primary" icon="i-heroicons-user-plus" class="w-full justify-center" @click="pickerAperto = true">
                {{ students.length === 0 ? 'Aggiungi studenti (obbligatorio)' : '+ Aggiungi altri studenti' }}
              </UButton>
            </div>
          </div>

          <!-- Picker studenti -->
          <ModalSelezionaStudenti
            v-model:open="pickerAperto"
            :already-selected-ids="students.map(s => s.studentItem?.value).filter(Boolean)"
            :students-pool="props.studentsPool"
            @confirm="onPickerConfirm"
          />

          <!-- Opzioni -->
          <div class="space-y-3 border-t border-slate-200 pt-4">
            <UCheckbox v-model="mezzaLezioneGlobale" label="Mezza Lezione (applicata a tutti gli studenti)" />
            <UCheckbox v-model="forzaGruppo" :disabled="students.length < 2" label="Forza tipo GRUPPO (anche per 1 studente)" />
          </div>

          <!-- Note -->
          <UFormField label="Note (opzionale)">
            <UTextarea v-model="note" placeholder="Aggiungi note sulla lezione..." :rows="2" />
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

  <ConfirmDialog
    v-model:open="confirmAperto"
    :title="confirmConfig.title"
    :description="confirmConfig.description"
    :confirm-label="confirmConfig.confirmLabel"
    :confirm-color="confirmConfig.confirmColor"
    :loading="confirmLoading"
    @confirm="eseguiEliminazione"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, reactive } from 'vue'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import ModalSelezionaStudenti from '~/components/calendario/ModalSelezionaStudenti.vue'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import { TARIFFE_DEFAULT, TARIFFE_MEZZA } from '#shared/tariffe'

const props = defineProps<{
  date: string
  tutorId: string
  tutorName: string
  timeSlotId: string
  slotStart: string
  slotEnd: string
  existingLessonsInSlot: any[] // Le lezioni che appartengono già a questo slot
  // Se presente (area personale tutor), usa un pool di studenti ristretto invece
  // della lista completa degli studenti attivi.
  studentsPool?: { studentId: string; nome: string }[]
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
const pickerAperto = ref(false)

const confirmAperto = ref(false)
const confirmLoading = ref(false)
const confirmConfig = reactive({
  title: 'Conferma eliminazione',
  description: '',
  confirmLabel: 'Elimina',
  confirmColor: 'error' as 'primary' | 'error' | 'warning',
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
  const tipo = calculatedType.value as keyof typeof TARIFFE_DEFAULT
  if (!tipo) return 0
  // Anteprima con tariffe di default condivise; il valore autoritativo lo calcola il server
  return (mezzaLezioneGlobale.value ? TARIFFE_MEZZA[tipo] : TARIFFE_DEFAULT[tipo]) || 0
})

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

function removeStudent(idx: number) {
  students.value.splice(idx, 1)
}

async function onPickerConfirm(picked: Array<{ studentId: string; nome: string; oreResiduo: string | null; pkgTipo: string | null }>) {
  pickerAperto.value = false
  for (const p of picked) {
    if (students.value.some(s => s.studentItem?.value === p.studentId)) continue
    const stu = {
      studentItem: { label: p.nome, value: p.studentId },
      packageItem: null,
      packageOptions: [],
      loadingPackages: false,
      mezzaLezione: mezzaLezioneGlobale.value,
      esistente: false,
    }
    students.value.push(stu)
    const idx = students.value.length - 1
    await onStudenteSelezionato(idx, { value: p.studentId })
  }
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
      // Il flag mezzaLezione vive sulla LEZIONE (non sulle righe studente):
      // leggerlo da lì evita che riaprire e salvare converta una mezza in lezione piena
      if (lesson.mezzaLezione) mezzaLezioneGlobale.value = true

      lesson.lessonStudents?.forEach((ls: any) => {
        // Mocking the loaded items for USelectMenu
        const nomePacchetto = ls.package?.nome || 'Pacchetto'
        students.value.push({
          id: ls.studentId, // original DB id, used for tracking deletions
          lessonId: lesson.id,
          esistente: true, // studente già nello slot → pacchetto in sola lettura
          studentItem: { label: `${ls.student?.firstName} ${ls.student?.lastName}`, value: ls.studentId },
          packageItem: { label: nomePacchetto, value: ls.packageId },
          packageOptions: [{ label: nomePacchetto, value: ls.packageId }],
          loadingPackages: false
        })
      })
    })
  } else {
    // Slot vuoto — l'utente aprirà il picker per aggiungere studenti
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
    }))

    const postPayload = {
      tutorId:     props.tutorId,
      timeSlotId:  props.timeSlotId,
      data:        props.date,
      forzaGruppo: forzaGruppo.value,
      mezzaLezione: mezzaLezioneGlobale.value,
      note:        note.value,
      studenti:    validStudents,
    }
    const putPayload = {
      forzaGruppo:  forzaGruppo.value,
      mezzaLezione: mezzaLezioneGlobale.value,
      note:         note.value,
      studenti:     validStudents,
    }

    if (existingLesson.value && props.existingLessonsInSlot.length > 0) {
      if (props.existingLessonsInSlot.length > 1) {
        // Slot doppio (caso raro): prima PUT atomica sulla prima lezione,
        // poi DELETE delle lezioni extra. Se il PUT fallisce non si perde nulla.
        await $fetch(`/api/lessons/${existingLesson.value.id}`, { method: 'PUT', body: putPayload })
        for (const l of props.existingLessonsInSlot.slice(1)) {
          await $fetch(`/api/lessons/${l.id}`, { method: 'DELETE' })
        }
      } else {
        await $fetch(`/api/lessons/${existingLesson.value.id}`, { method: 'PUT', body: putPayload })
      }
      toast.add({ title: 'Lezione aggiornata', color: 'success' })
    } else {
      await $fetch('/api/lessons', { method: 'POST', body: postPayload })
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

function chiediEliminazione() {
  confirmConfig.title = 'Conferma eliminazione'
  confirmConfig.description = 'Sei sicuro di voler eliminare tutte le lezioni di questo slot? Verranno ripristinate le ore.'
  confirmConfig.confirmLabel = 'Elimina'
  confirmConfig.confirmColor = 'error'
  confirmAperto.value = true
}

async function eseguiEliminazione() {
  confirmLoading.value = true
  try {
    for (const l of props.existingLessonsInSlot) {
      await $fetch(`/api/lessons/${l.id}`, { method: 'DELETE' })
    }
    toast.add({ title: 'Lezione eliminata', color: 'success' })
    confirmAperto.value = false
    isOpen.value = false
    emit('refresh')
  } catch (err) {
    console.error(err)
    toast.add({ title: 'Errore', color: 'error' })
  } finally {
    confirmLoading.value = false
  }
}

async function deleteLesson() {
  chiediEliminazione()
}
</script>
