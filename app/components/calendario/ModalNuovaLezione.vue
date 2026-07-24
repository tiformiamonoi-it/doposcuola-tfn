<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'sm:max-w-[1200px]' }">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-xl font-bold text-slate-800 flex items-center gap-2">
          <UIcon name="i-heroicons-queue-list" class="w-6 h-6 text-primary-500" />
          Creazione Multipla Lezioni
        </h3>
        <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="isOpen = false" />
      </div>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- SEZIONE 1: DATA E TUTOR -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <UFormField label="Data" required>
            <UInput v-model="selectedDate" type="date" class="w-full" size="lg" />
          </UFormField>

          <UFormField label="Tutor" required>
            <USelectMenu 
              v-model="tutorItem" 
              :items="tutorsOptions" 
              placeholder="Seleziona tutor..."
              searchable
              class="w-full"
              size="lg"
            >
              <template #leading>
                <UIcon name="i-heroicons-user" class="w-5 h-5 text-slate-400" />
              </template>
            </USelectMenu>
          </UFormField>
        </div>

        <div v-if="!tutorItem" class="py-12 text-center text-slate-400">
          <UIcon name="i-heroicons-arrow-up-circle" class="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Seleziona un tutor per iniziare a compilare gli slot orari</p>
        </div>

        <template v-else>
          <!-- SEZIONE 2: GRIGLIA SLOT ORARI -->
          <div>
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <UIcon name="i-heroicons-clock" class="w-5 h-5 text-slate-500" />
                Slot Orari
              </h4>
              <USelectMenu
                v-if="availableExtraSlots.length > 0"
                v-model="selectedExtraSlot"
                :items="availableExtraSlots"
                @update:model-value="onExtraSlotChange"
                :popper="{ placement: 'bottom-end' }"
                class="w-48"
              >
                <UButton color="gray" variant="soft" icon="i-heroicons-plus" label="Aggiungi Slot Extra" class="w-full justify-between" />
              </USelectMenu>
              <span v-else class="text-xs text-slate-400 italic">Tutti gli slot orari sono già presenti</span>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <UCard v-for="(slot, slotIndex) in activeSlots" :key="slot.timeSlotId" class="flex flex-col h-full shadow-sm ring-1 ring-slate-200" :ui="{ body: { padding: 'p-4 flex-1 flex flex-col' }, header: { padding: 'px-4 py-3 bg-slate-50 border-b border-slate-100' } }">
                <template #header>
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-800">{{ slot.label }}</span>
                    <div class="flex items-center gap-1">
                      <UButton 
                        v-if="slotIndex < activeSlots.length - 1"
                        size="2xs" 
                        color="gray" 
                        variant="ghost" 
                        icon="i-heroicons-document-duplicate" 
                        title="Duplica nel prossimo slot"
                        @click="duplicateToNext(slotIndex)"
                      />
                      <UButton
                        size="2xs"
                        color="error"
                        variant="ghost"
                        icon="i-heroicons-trash"
                        @click="removeExtraSlot(slotIndex)"
                      />
                    </div>
                  </div>
                </template>

                <div class="flex-1 flex flex-col gap-3">
                  <!-- Lista Studenti in questo slot -->
                  <div v-for="(stu, stuIndex) in slot.studenti" :key="stuIndex"
                       class="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm">
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-slate-800 truncate">{{ stu.studentItem?.label }}</div>
                      <!-- Select Pacchetto se non auto-selezionato o multiplo -->
                      <USelectMenu
                        v-if="stu.packageOptions?.length > 1"
                        v-model="stu.packageItem"
                        :items="stu.packageOptions"
                        :loading="stu.loadingPackages"
                        placeholder="Pacchetto..."
                        size="xs"
                        class="w-full mt-1"
                      />
                      <span v-else-if="stu.packageItem" class="text-xs"
                            :class="isPackageWarning(stu.packageItem) ? 'text-amber-600 font-bold' : 'text-slate-400'">
                        {{ stu.packageItem.label }}
                      </span>
                      <span v-else-if="stu.loadingPackages" class="text-xs text-slate-400">Caricamento...</span>
                      <span v-else class="text-xs text-rose-500">Nessun pacchetto attivo</span>
                    </div>
                    <UButton icon="i-heroicons-x-mark" size="xs" color="neutral" variant="ghost" @click="removeStudent(slotIndex, stuIndex)" />
                  </div>

                  <!-- Bottone apri picker -->
                  <UButton size="sm" variant="soft" color="primary" icon="i-heroicons-user-plus"
                           class="w-full justify-center border border-dashed border-primary-300 bg-primary-50 hover:bg-primary-100"
                           @click="apriPickerPerSlot(slotIndex)">
                    {{ slot.studenti.length === 0 ? 'Aggiungi studenti' : '+ Aggiungi altri studenti' }}
                  </UButton>
                </div>

                <!-- Footer Slot (Impostazioni) -->
                <div class="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  <UCheckbox v-model="slot.mezzaLezione" size="sm" label="Mezza Lezione (per tutti)" />
                  <UCheckbox v-model="slot.forzaGruppo" :disabled="slot.studenti.length < 1" size="sm" label="Forza GRUPPO (paga come gruppo)" />
                </div>
              </UCard>
            </div>
          </div>

          <!-- SEZIONE 3: RIEPILOGO E NOTE -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Note -->
            <div class="lg:col-span-2">
              <UFormField label="Note Generali (opzionale)">
                <UTextarea v-model="note" placeholder="Es: Lezioni di recupero, argomenti trattati..." :rows="4" class="w-full" />
              </UFormField>
            </div>

            <!-- Dashboard Riepilogo -->
            <div class="bg-primary-600 rounded-xl p-5 text-white shadow-lg flex flex-col justify-between ring-1 ring-primary-700">
              <div>
                <h4 class="text-sm font-semibold text-primary-100 uppercase tracking-wider mb-4 border-b border-primary-500 pb-2">Riepilogo Totale</h4>
                <div class="space-y-3 text-sm">
                  <div class="flex justify-between items-center">
                    <span class="text-primary-100">Slot Compilati</span>
                    <span class="font-bold text-lg">{{ totalSlotsUsed }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-primary-100">Totale Studenti</span>
                    <span class="font-bold text-lg">{{ totalStudentsCount }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-primary-100">Ore Scalate stim.</span>
                    <span class="font-bold text-lg">{{ totalHoursDeducted }}h</span>
                  </div>
                </div>
              </div>
              <div class="mt-6 pt-4 border-t border-primary-500 flex justify-between items-end">
                <span class="text-primary-100">Compenso Tutor</span>
                <span class="text-2xl font-black text-white">€{{ formatCurrency(totalCompenso) }}</span>
              </div>
            </div>
          </div>

          <!-- Warnings Pacchetti -->
          <UAlert 
            v-if="warnings.length > 0"
            title="Attenzione ai pacchetti"
            :description="'I seguenti studenti stanno esaurendo le ore: ' + warnings.join(', ')"
            color="warning"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
          />
        </template>

        <!-- Picker studenti (condiviso, una sola istanza per tutti gli slot).
             Deve stare dentro #body: fuori dal body viene montato prima della
             modale madre e si apre sotto di essa (stesso pattern di ModalLezioneRapida). -->
        <ModalSelezionaStudenti
          v-model:open="pickerAperto"
          :already-selected-ids="pickerSlotIndex >= 0 ? activeSlots[pickerSlotIndex]?.studenti.map((s: any) => s.studentItem?.value).filter(Boolean) : []"
          :lesson-date="selectedDate"
          @confirm="onPickerConfirm"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <UButton variant="ghost" color="neutral" @click="isOpen = false">Annulla</UButton>
        <UButton color="primary" size="lg" :loading="saving" :disabled="!canSave" @click="saveAllLessons">
          <UIcon name="i-heroicons-check-circle" class="w-5 h-5 mr-1" />
          Salva Tutte le Lezioni
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { format } from 'date-fns'
import ModalSelezionaStudenti from '~/components/calendario/ModalSelezionaStudenti.vue'
import { TARIFFE_DEFAULT, TARIFFE_MEZZA } from '#shared/tariffe'

const emit = defineEmits(['refresh', 'close'])
const isOpen = defineModel('open', { type: Boolean, default: false })
const toast = useToast()

const selectedDate = ref(format(new Date(), 'yyyy-MM-dd'))
const tutorItem = ref<any>(null)
const note = ref('')
const saving = ref(false)

const activeSlots = ref<any[]>([])

// ==========================================
// FETCH DATA
// ==========================================
const { data: tutorsRes } = useFetch('/api/tutors?active=true', { lazy: true })
const tutorsOptions = computed(() => (tutorsRes.value?.data || []).map((t: any) => ({ label: `${t.firstName} ${t.lastName}`, value: t.id })))

const { data: slotsRes } = useFetch('/api/settings/timeslots?active=true', { lazy: true })
const allSlotsOptions = computed(() => (slotsRes.value || []).map((s: any) => ({ label: `${s.oraInizio.substring(0,5)} - ${s.oraFine.substring(0,5)}`, value: s.id, oraInizio: s.oraInizio.substring(0,5), oraFine: s.oraFine.substring(0,5) })))

const { data: studentsRes } = useFetch('/api/students?active=true&limit=500&light=true', { lazy: true })
const studentsOptions = computed(() => (studentsRes.value?.data || []).map((s: any) => ({ label: `${s.firstName} ${s.lastName}`, value: s.id })))

const { data: configsRes } = useFetch('/api/settings/configs', { lazy: true })
const tariffeConfig = computed(() => {
  try {
    return JSON.parse(configsRes.value?.tariffe_tutor ?? 'null') ?? TARIFFE_DEFAULT
  } catch { return TARIFFE_DEFAULT }
})

// ==========================================
// INIT SLOTS
// ==========================================
watch([() => isOpen.value, allSlotsOptions], ([open, options]) => {
  if (open && options.length > 0) {
    resetState()
    
    // Inizializza tutti gli slot attivi dal DB
    activeSlots.value = options.map((o: any) => createEmptySlot(o))
  }
}, { immediate: true })

function resetState() {
  selectedDate.value = format(new Date(), 'yyyy-MM-dd')
  tutorItem.value = null
  note.value = ''
  activeSlots.value = []
}

function createEmptySlot(slotOpt: any) {
  return {
    timeSlotId: slotOpt.value,
    label: slotOpt.label,
    oraInizio: slotOpt.oraInizio,
    oraFine: slotOpt.oraFine,
    studenti: [],
    mezzaLezione: false,
    forzaGruppo: false
  }
}

// ==========================================
// SLOT MANAGEMENT
// ==========================================
const availableExtraSlots = computed(() => {
  const usedIds = activeSlots.value.map(s => s.timeSlotId)
  return allSlotsOptions.value.filter(opt => !usedIds.includes(opt.value))
})

const selectedExtraSlot = ref<any>(null)
function onExtraSlotChange(val: any) {
  if (!val) return
  addExtraSlot(val)
  // Utilizziamo setTimeout per resettare il valore altrimenti USelectMenu potrebbe bloccarsi
  setTimeout(() => {
    selectedExtraSlot.value = null
  }, 50)
}

function addExtraSlot(slotOpt: any) {
  activeSlots.value.push(createEmptySlot(slotOpt))
  activeSlots.value.sort((a, b) => a.oraInizio.localeCompare(b.oraInizio))
}

function removeExtraSlot(idx: number) {
  activeSlots.value.splice(idx, 1)
}

function duplicateToNext(idx: number) {
  const current = activeSlots.value[idx]
  const next = activeSlots.value[idx + 1]
  if (!next) return
  
  next.studenti = current.studenti.map((stu: any) => ({
    studentItem: { ...stu.studentItem },
    packageItem: stu.packageItem ? { ...stu.packageItem } : null,
    packageOptions: [...(stu.packageOptions || [])],
    loadingPackages: false
  }))
  next.mezzaLezione = current.mezzaLezione
  next.forzaGruppo = current.forzaGruppo
  toast.add({ title: 'Studenti duplicati', description: `Copiati nello slot ${next.label}`, color: 'info' })
}

// ==========================================
// STUDENTS MANAGEMENT
// ==========================================
function getAvailableStudents(slotIdx: number, stuIdx: number) {
  const currentSlot = activeSlots.value[slotIdx]
  const selectedIds = currentSlot.studenti.map((s: any, idx: number) => idx !== stuIdx ? s.studentItem?.value : null).filter(Boolean)
  return studentsOptions.value.filter(opt => !selectedIds.includes(opt.value))
}

function removeStudent(slotIdx: number, stuIdx: number) {
  activeSlots.value[slotIdx].studenti.splice(stuIdx, 1)
}

// ─── Picker studenti ───
const pickerAperto = ref(false)
const pickerSlotIndex = ref(-1)

function apriPickerPerSlot(slotIdx: number) {
  pickerSlotIndex.value = slotIdx
  pickerAperto.value = true
}

async function onPickerConfirm(picked: Array<{ studentId: string; nome: string; pacchettiAttivi?: any[] }>) {
  pickerAperto.value = false
  const slotIdx = pickerSlotIndex.value
  if (slotIdx < 0 || !activeSlots.value[slotIdx]) return

  for (const p of picked) {
    const alreadyIn = activeSlots.value[slotIdx].studenti.some((s: any) => s.studentItem?.value === p.studentId)
    if (alreadyIn) continue

    const stu = { studentItem: { label: p.nome, value: p.studentId }, packageItem: null, packageOptions: [], loadingPackages: false }
    activeSlots.value[slotIdx].studenti.push(stu)
    const stuIdx = activeSlots.value[slotIdx].studenti.length - 1
    await onStudenteSelezionato(slotIdx, stuIdx, { value: p.studentId }, p.pacchettiAttivi)
  }
}

async function onStudenteSelezionato(slotIdx: number, stuIdx: number, newVal: any, prefetched?: any[]) {
  const stu = activeSlots.value[slotIdx].studenti[stuIdx]
  const targetId = newVal?.value
  if (!targetId) { stu.packageOptions = []; stu.packageItem = null; return }

  stu.loadingPackages = true
  try {
    // Pacchetti già forniti dal picker (admin) → nessuna chiamata; fetch solo di riserva.
    let pkgs: any[]
    if (prefetched !== undefined) {
      pkgs = prefetched
    } else {
      const res: any = await $fetch(`/api/packages?studentId=${targetId}&stati=ATTIVO`)
      pkgs = res.data || []
    }
    pkgs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    
    stu.packageOptions = pkgs.map((p: any) => ({
      label: `${p.nome} (${p.tipo === 'MENSILE' ? p.giorniResiduo + 'gg res.' : parseFloat(p.oreResiduo) + 'h res.'})`,
      value: p.id,
      residuo: p.tipo === 'MENSILE' ? p.giorniResiduo : parseFloat(p.oreResiduo),
      tipo: p.tipo
    }))
    
    if (stu.packageOptions.length > 0) stu.packageItem = stu.packageOptions[0]
    else stu.packageItem = null
  } catch (err) { console.error(err) } 
  finally { stu.loadingPackages = false }
}

function isPackageWarning(pkgItem: any) {
  if (!pkgItem) return false
  return pkgItem.residuo <= 0
}

// ==========================================
// SUMMARY CALCULATIONS
// ==========================================
const populatedSlots = computed(() => activeSlots.value.filter(s => s.studenti.filter((stu: any) => stu.studentItem && stu.packageItem).length > 0))

const totalSlotsUsed = computed(() => populatedSlots.value.length)

const totalStudentsCount = computed(() => {
  return populatedSlots.value.reduce((acc, slot) => acc + slot.studenti.filter((s: any) => s.studentItem && s.packageItem).length, 0)
})

const totalHoursDeducted = computed(() => totalStudentsCount.value)

const totalCompenso = computed(() => {
  let total = 0
  populatedSlots.value.forEach(slot => {
    const validStudents = slot.studenti.filter((s: any) => s.studentItem && s.packageItem).length
    if (validStudents === 0) return
    
    let tipo = 'SINGOLA'
    if (slot.forzaGruppo) tipo = 'GRUPPO'
    else if (validStudents === 1) tipo = 'SINGOLA'
    else if (validStudents <= 4) tipo = 'GRUPPO'   // MAXI solo da 5 studenti (come il server)
    else tipo = 'MAXI'
    
    // Mezza lezione: tariffe fisse da shared/tariffe.ts (mezza MAXI = €4,00, NON tariffa/2)
    // — stessa regola applicata dal server in calcCompenso.
    const isMezza = slot.mezzaLezione
    const base = tariffeConfig.value
    const tariffe: Record<string, number> = {
      SINGOLA: isMezza ? TARIFFE_MEZZA.SINGOLA : (base.SINGOLA ?? TARIFFE_DEFAULT.SINGOLA),
      GRUPPO:  isMezza ? TARIFFE_MEZZA.GRUPPO  : (base.GRUPPO  ?? TARIFFE_DEFAULT.GRUPPO),
      MAXI:    isMezza ? TARIFFE_MEZZA.MAXI    : (base.MAXI    ?? TARIFFE_DEFAULT.MAXI),
    }

    total += tariffe[tipo] || 0
  })
  return total
})

const warnings = computed(() => {
  const warns: string[] = []
  populatedSlots.value.forEach(slot => {
    slot.studenti.forEach((stu: any) => {
      if (stu.studentItem && isPackageWarning(stu.packageItem)) {
        warns.push(stu.studentItem.label)
      }
    })
  })
  return [...new Set(warns)]
})

const canSave = computed(() => {
  return selectedDate.value && tutorItem.value && totalSlotsUsed.value > 0
})

function formatCurrency(val: number) { return val.toFixed(2) }

// ==========================================
// SAVE LOGIC
// ==========================================
async function saveAllLessons() {
  saving.value = true
  let successCount = 0
  let errorCount = 0

  try {
    for (const slot of populatedSlots.value) {
      const validStudents = slot.studenti.filter((s: any) => s.studentItem && s.packageItem).map((s: any) => ({
        studentId: s.studentItem.value,
        packageId: s.packageItem.value,
        mezzaLezione: slot.mezzaLezione
      }))

      const payload = {
        tutorId: tutorItem.value.value,
        timeSlotId: slot.timeSlotId,
        data: selectedDate.value,
        forzaGruppo: slot.forzaGruppo,
        note: note.value,
        studenti: validStudents
      }

      try {
        await $fetch('/api/lessons', { method: 'POST', body: payload })
        successCount++
      } catch (err: any) {
        console.error(`Errore salvataggio slot ${slot.label}:`, err)
        errorCount++
        toast.add({ title: `Errore slot ${slot.oraInizio}`, description: err.data?.message || 'Errore imprevisto', color: 'error' })
      }
    }

    if (successCount > 0) {
      toast.add({ title: 'Salvataggio completato', description: `${successCount} lezioni create con successo.`, color: 'success' })
      if (errorCount === 0) {
        isOpen.value = false
        emit('refresh')
      } else {
        emit('refresh')
      }
    }
  } catch (err) {
    console.error('Fatal error during bulk save:', err)
  } finally {
    saving.value = false
  }
}
</script>
