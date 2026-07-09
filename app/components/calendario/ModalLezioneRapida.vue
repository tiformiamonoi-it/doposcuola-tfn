<template>
  <UModal v-model:open="isOpen" title="⚡ Aggiungi Lezione Rapida">
    <template #body>
      <div class="space-y-6">
        <!-- Data -->
        <UFormField label="Data">
          <UInput :value="formatDate(date)" readonly class="w-full bg-slate-50 cursor-not-allowed text-slate-500" />
        </UFormField>

        <!-- Tutor -->
        <UFormField label="Tutor" required>
          <UInput v-if="lockedTutorId" :value="lockedTutorName" readonly class="w-full bg-slate-50 cursor-not-allowed text-slate-500" />
          <USelectMenu
            v-else
            v-model="tutorItem"
            :items="tutorsOptions"
            placeholder="Seleziona tutor..."
            searchable
            class="w-full"
            @update:model-value="checkDuplicate"
          />
        </UFormField>

        <!-- Slot Orario -->
        <UFormField label="Slot Orario" required>
          <USelectMenu 
            v-model="timeSlotItem" 
            :items="timeslotsOptions" 
            placeholder="Seleziona orario..."
            class="w-full"
            @update:model-value="checkDuplicate"
          />
        </UFormField>

        <!-- Avviso Duplicato -->
        <UAlert 
          v-if="duplicateWarning" 
          title="Attenzione" 
          :description="duplicateWarning" 
          color="warning" 
          variant="soft" 
          icon="i-heroicons-exclamation-triangle"
        />

        <!-- Studenti -->
        <div>
          <h3 class="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <UIcon name="i-heroicons-users" class="w-5 h-5 text-slate-500" />
            Studenti
          </h3>

          <div class="space-y-3">
            <!-- Lista studenti aggiunti -->
            <div v-for="(stu, idx) in students" :key="idx" class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 shadow-sm">
              <div class="flex-1 min-w-0">
                <span class="font-medium text-slate-800">{{ stu.studentItem.label }}</span>
                <span v-if="stu.loadingPackages" class="text-xs text-slate-400 ml-2">caricamento...</span>
              </div>
              <!-- Dropdown pacchetto solo se non auto-selezionato e ci sono più opzioni -->
              <USelectMenu
                v-if="!stu.loadingPackages && stu.packageOptions.length > 1 && !stu.packageItem"
                v-model="stu.packageItem"
                :items="stu.packageOptions"
                placeholder="Scegli pacchetto..."
                class="w-40"
              />
              <span v-else-if="stu.packageItem" class="text-xs text-emerald-600 font-medium truncate max-w-[8rem]">{{ stu.packageItem.label }}</span>
              <span v-else-if="!stu.loadingPackages" class="text-xs text-red-400">Nessun pacchetto</span>
              <UButton icon="i-heroicons-x-mark" size="xs" variant="ghost" color="neutral" @click="removeStudent(idx)" />
            </div>

            <!-- Bottone apri picker -->
            <UButton icon="i-heroicons-user-plus" variant="soft" color="primary" class="w-full justify-center" @click="pickerAperto = true">
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

        <!-- Anteprima -->
        <div v-if="students.filter(s => s.studentItem).length > 0" class="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap gap-4">
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

        <!-- Opzioni -->
        <div class="space-y-3 border-t border-slate-200 pt-4">
          <UCheckbox v-model="mezzaLezioneGlobale" label="Mezza Lezione (applicata a tutti gli studenti)" />
          <UCheckbox v-model="forzaGruppo" :disabled="students.length < 2" label="Forza tipo GRUPPO (anche per 1 studente)" />
        </div>

        <!-- Note -->
        <UFormField label="Note (opzionale)">
          <UTextarea v-model="note" placeholder="Es: Lezione di recupero..." :rows="2" />
        </UFormField>
      </div>
    </template>
    
    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <UButton variant="ghost" color="neutral" @click="isOpen = false">Annulla</UButton>
        <UButton color="primary" :loading="saving" :disabled="!canSave" @click="saveLesson">
          Salva Lezione
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import ModalSelezionaStudenti from '~/components/calendario/ModalSelezionaStudenti.vue'
import { TARIFFE_DEFAULT, TARIFFE_MEZZA } from '#shared/tariffe'

const props = defineProps<{
  date: string
  // Se presenti, blocca il tutor (area personale tutor) e usa un pool di studenti
  // ristretto invece della lista completa degli studenti attivi.
  lockedTutorId?: string
  lockedTutorName?: string
  studentsPool?: { studentId: string; nome: string }[]
}>()

const emit = defineEmits(['refresh', 'close'])
const isOpen = defineModel('open', { type: Boolean, default: false })
const toast = useToast()

const tutorItem = ref<any>(null)
const timeSlotItem = ref<any>(null)
const duplicateWarning = ref<string | null>(null)
const existingLessonId = ref<string | null>(null)
const existingLessonStudents = ref<any[]>([])

const students = ref<any[]>([])
const forzaGruppo = ref(false)
const mezzaLezioneGlobale = ref(false)
const note = ref('')
const saving = ref(false)
const pickerAperto = ref(false)

// Fetch Data (la lista tutor non serve, e non è accessibile, quando il tutor è bloccato)
const { data: tutorsRes } = useFetch('/api/tutors?active=true', { lazy: true, immediate: !props.lockedTutorId })
const tutorsOptions = computed(() => (tutorsRes.value?.data || []).map((t: any) => ({ label: `${t.firstName} ${t.lastName}`, value: t.id })))

const { data: slotsRes } = useFetch('/api/settings/timeslots?active=true', { lazy: true })
const timeslotsOptions = computed(() => (slotsRes.value || []).map((s: any) => ({ label: `${s.oraInizio.substring(0,5)} - ${s.oraFine.substring(0,5)}`, value: s.id })))

const canSave = computed(() => {
  return tutorItem.value?.value && timeSlotItem.value?.value && students.value.length > 0 && students.value.every(s => s.studentItem?.value && s.packageItem?.value)
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

function formatCurrency(val: number) { return val.toFixed(2) }
function formatDate(dateStr: string) {
  try { return format(new Date(dateStr), 'EEEE d MMMM yyyy', { locale: it }) } 
  catch { return dateStr }
}

function removeStudent(idx: number) { students.value.splice(idx, 1) }

async function onPickerConfirm(picked: Array<{ studentId: string; nome: string; oreResiduo: string | null; pkgTipo: string | null }>) {
  pickerAperto.value = false
  for (const p of picked) {
    if (students.value.some(s => s.studentItem?.value === p.studentId)) continue
    const stu = {
      studentItem: { label: p.nome, value: p.studentId },
      packageItem: null,
      packageOptions: [],
      loadingPackages: false,
    }
    students.value.push(stu)
    const idx = students.value.length - 1
    await onStudenteSelezionato(idx, { value: p.studentId })
  }
}

async function onStudenteSelezionato(idx: number, newVal: any) {
  const stu = students.value[idx]
  const targetId = newVal?.value
  if (!targetId) { stu.packageOptions = []; stu.packageItem = null; return }
  
  stu.loadingPackages = true
  try {
    const res: any = await $fetch(`/api/packages?studentId=${targetId}&stati=ATTIVO`)
    const pkgs = res.data || []
    pkgs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    
    stu.packageOptions = pkgs.map((p: any) => ({
      label: `${p.nome} - Rim: ${p.tipo === 'MENSILE' ? p.giorniResiduo + 'gg' : parseFloat(p.oreResiduo) + 'h'}`,
      value: p.id
    }))
    
    if (stu.packageOptions.length > 0) stu.packageItem = stu.packageOptions[0]
    else stu.packageItem = null
  } catch (err) { console.error(err) } 
  finally { stu.loadingPackages = false }
}

async function checkDuplicate() {
  duplicateWarning.value = null
  existingLessonId.value = null
  existingLessonStudents.value = []
  if (!tutorItem.value?.value || !timeSlotItem.value?.value) return

  try {
    const response: any = await $fetch('/api/lessons', {
      query: { dataInizio: props.date, dataFine: props.date, tutorId: tutorItem.value.value }
    })
    const existing = response.data.find((l: any) => l.timeSlotId === timeSlotItem.value.value)
    if (existing) {
      existingLessonId.value = existing.id
      existingLessonStudents.value = existing.lessonStudents || []
      const names = existing.lessonStudents.map((ls: any) => `${ls.student?.firstName} ${ls.student?.lastName}`).join(', ')
      duplicateWarning.value = `Questo tutor ha già una lezione in questo slot con: ${names}. Se salvi, gli studenti verranno aggiunti alla stessa lezione.`
    }
  } catch (e) { console.error(e) }
}

watch(() => isOpen.value, (newVal) => {
  if (newVal) {
    tutorItem.value = props.lockedTutorId ? { label: props.lockedTutorName, value: props.lockedTutorId } : null
    timeSlotItem.value = null
    students.value = []
    forzaGruppo.value = false
    mezzaLezioneGlobale.value = false
    note.value = ''
    duplicateWarning.value = null
    existingLessonId.value = null
    existingLessonStudents.value = []
  }
})

async function saveLesson() {
  saving.value = true
  try {
    const validStudents = students.value.map(s => ({
      studentId: s.studentItem.value,
      packageId: s.packageItem.value,
    }))

    if (existingLessonId.value) {
      // Fusione nella lezione esistente (come promesso dall'avviso): PUT con l'elenco
      // studenti combinato. Mezza lezione/forzaGruppo vengono inviati solo se spuntati,
      // per non sovrascrivere le impostazioni della lezione esistente.
      const giaPresenti = new Set(existingLessonStudents.value.map((ls: any) => ls.studentId))
      const studentiCombinati = [
        ...existingLessonStudents.value.map((ls: any) => ({ studentId: ls.studentId, packageId: ls.packageId })),
        ...validStudents.filter(v => !giaPresenti.has(v.studentId)),
      ]
      await $fetch(`/api/lessons/${existingLessonId.value}`, {
        method: 'PUT',
        body: {
          studenti: studentiCombinati,
          ...(mezzaLezioneGlobale.value ? { mezzaLezione: true } : {}),
          ...(forzaGruppo.value ? { forzaGruppo: true } : {}),
          ...(note.value ? { note: note.value } : {}),
        },
      })
      toast.add({ title: 'Studenti aggiunti alla lezione esistente', color: 'success' })
    } else {
      await $fetch('/api/lessons', {
        method: 'POST',
        body: {
          tutorId: tutorItem.value.value,
          timeSlotId: timeSlotItem.value.value,
          data: props.date,
          mezzaLezione: mezzaLezioneGlobale.value,
          forzaGruppo: forzaGruppo.value,
          note: note.value,
          studenti: validStudents,
        },
      })
      toast.add({ title: 'Lezione salvata', color: 'success' })
    }

    isOpen.value = false
    emit('refresh')
  } catch (err: any) {
    toast.add({ title: err.data?.statusMessage || 'Errore', description: err.data?.message, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
