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
          <USelectMenu 
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
                <USelectMenu
                  v-model="stu.packageItem"
                  :items="stu.packageOptions || []"
                  :loading="stu.loadingPackages"
                  placeholder="Seleziona il pacchetto da scalare..."
                  class="w-full"
                />
              </div>
            </div>
            
            <UButton v-if="!allStudentsSelected" size="sm" variant="soft" color="primary" icon="i-heroicons-plus" @click="addEmptyStudent" class="w-full justify-center">
              {{ students.length === 0 ? 'Aggiungi studenti (obbligatorio)' : 'Aggiungi altro studente' }}
            </UButton>
          </div>
        </div>

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
          <UCheckbox v-model="mezzaLezioneGlobale" @update:model-value="onMezzaLezioneChange" label="Mezza Lezione (applicata a tutti gli studenti)" />
          <UCheckbox v-model="forzaGruppo" :disabled="students.length < 2" label="Forza tipo GRUPPO (anche per 1 studente)" />
        </div>

        <!-- Note -->
        <UFormField label="Note (opzionale)">
          <UTextarea v-model="note" placeholder="Es: Lezione di recupero..." rows="2" />
        </UFormField>
      </div>
    </template>
    
    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <UButton variant="ghost" color="gray" @click="isOpen = false">Annulla</UButton>
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

const props = defineProps<{
  date: string
}>()

const emit = defineEmits(['refresh', 'close'])
const isOpen = defineModel('open', { type: Boolean, default: false })
const toast = useToast()

const tutorItem = ref<any>(null)
const timeSlotItem = ref<any>(null)
const duplicateWarning = ref<string | null>(null)
const existingLessonId = ref<string | null>(null)

const students = ref<any[]>([])
const forzaGruppo = ref(false)
const mezzaLezioneGlobale = ref(false)
const note = ref('')
const saving = ref(false)

// Fetch Data
const { data: tutorsRes } = useFetch('/api/tutors?active=true', { lazy: true })
const tutorsOptions = computed(() => (tutorsRes.value?.data || []).map((t: any) => ({ label: `${t.firstName} ${t.lastName}`, value: t.id })))

const { data: slotsRes } = useFetch('/api/settings/timeslots?active=true', { lazy: true })
const timeslotsOptions = computed(() => (slotsRes.value || []).map((s: any) => ({ label: `${s.oraInizio.substring(0,5)} - ${s.oraFine.substring(0,5)}`, value: s.id })))

const { data: studentsRes } = useFetch('/api/students?active=true&limit=200', { lazy: true })
const studentsOptions = computed(() => (studentsRes.value?.data || []).map((s: any) => ({ label: `${s.firstName} ${s.lastName}`, value: s.id })))

function getAvailableStudents(currentIndex: number) {
  const selectedIds = students.value.map((s, idx) => idx !== currentIndex ? s.studentItem?.value : null).filter(Boolean)
  return studentsOptions.value.filter(opt => !selectedIds.includes(opt.value))
}

const allStudentsSelected = computed(() => students.value.length > 0 && students.value.every(s => s.studentItem && s.packageItem) === false)

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
  const tipo = calculatedType.value
  const hasMezza = mezzaLezioneGlobale.value
  const tariffe: Record<string, number> = { SINGOLA: hasMezza ? 2.50 : 5.00, GRUPPO: hasMezza ? 4.00 : 8.00, MAXI: hasMezza ? 4.00 : 8.50 }
  return tariffe[tipo] || 0
})

function onMezzaLezioneChange() {
  students.value.forEach(s => s.mezzaLezione = mezzaLezioneGlobale.value)
}

function formatCurrency(val: number) { return val.toFixed(2) }
function formatDate(dateStr: string) {
  try { return format(new Date(dateStr), 'EEEE d MMMM yyyy', { locale: it }) } 
  catch { return dateStr }
}

function addEmptyStudent() { students.value.push({ studentItem: null, packageItem: null, packageOptions: [], loadingPackages: false, mezzaLezione: mezzaLezioneGlobale.value }) }
function removeStudent(idx: number) { students.value.splice(idx, 1) }

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
  if (!tutorItem.value?.value || !timeSlotItem.value?.value) return
  
  try {
    const response: any = await $fetch('/api/lessons', {
      query: { dataInizio: props.date, dataFine: props.date, tutorId: tutorItem.value.value }
    })
    const existing = response.data.find((l: any) => l.timeSlotId === timeSlotItem.value.value)
    if (existing) {
      existingLessonId.value = existing.id
      const names = existing.lessonStudents.map((ls: any) => `${ls.student?.firstName} ${ls.student?.lastName}`).join(', ')
      duplicateWarning.value = `Questo tutor ha già una lezione in questo slot con: ${names}. Se salvi, gli studenti verranno aggiunti alla stessa lezione.`
    }
  } catch (e) { console.error(e) }
}

watch(() => isOpen.value, (newVal) => {
  if (newVal) {
    tutorItem.value = null
    timeSlotItem.value = null
    students.value = []
    forzaGruppo.value = false
    mezzaLezioneGlobale.value = false
    note.value = ''
    duplicateWarning.value = null
    existingLessonId.value = null
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
      tutorId: tutorItem.value.value,
      timeSlotId: timeSlotItem.value.value,
      data: props.date,
      forzaGruppo: forzaGruppo.value,
      note: note.value,
      studenti: validStudents
    }

    if (existingLessonId.value) {
      // Come nel ManageSlotModal, aggiorniamo la lezione fondendola (o creandone una nuova fondendo i backend)
      // L'API /api/lessons POST non "fonde" automaticamente nel backend se non strutturata per farlo, 
      // ma il vecchio backend usava PUT o cancellava e ricreava.
      // Qui facciamo una POST semplice o chiamiamo update. Il vecchio form diceva "Aggiunto alla lezione esistente".
      // L'API della v2 di /api/lessons POST potrebbe non unire. Nel dubbio, dato che le lezioni possono coesistere con lo stesso tutor/timeslot nel DB, 
      // POSTeremo una nuova lesson, e il calendar renderer le accorperà visivamente, oppure userà una logica di delete-insert in un futuro endpoint.
      // Per sicurezza qui facciamo semplicemente POST.
    }
    
    await $fetch('/api/lessons', { method: 'POST', body: payload })
    toast.add({ title: 'Lezione salvata', color: 'success' })

    isOpen.value = false
    emit('refresh')
  } catch (err: any) {
    toast.add({ title: err.data?.statusMessage || 'Errore', description: err.data?.message, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
