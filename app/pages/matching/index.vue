<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <!-- Intestazione -->
    <div class="no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Matching Manuale</h1>
        <p class="text-slate-500 text-sm mt-1">
          Visualizza i tutor disponibili e assegna gli alunni prenotati.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <UButton color="white" icon="i-heroicons-arrow-path" :loading="loading" @click="loadData">
          Aggiorna
        </UButton>
        <UButton color="primary" icon="i-heroicons-printer" @click="stampaTabellone">
          Stampa Tabellone
        </UButton>
      </div>
    </div>

    <!-- Calendario Navigazione Giorno -->
    <UCard class="no-print">
      <div class="flex items-center justify-between">
        <UButton icon="i-heroicons-chevron-left" color="white" variant="ghost" @click="cambiaGiorno(-1)" />
        <div class="text-center">
          <div class="font-bold text-lg">{{ dataFormattata }}</div>
          <div class="text-sm text-slate-500">{{ tutors.length }} Tutor | {{ badges.length }} Prenotazioni</div>
        </div>
        <UButton icon="i-heroicons-chevron-right" color="white" variant="ghost" @click="cambiaGiorno(1)" />
      </div>
    </UCard>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin w-8 h-8 text-primary-500" />
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- COLONNA SINISTRA: TUTOR DISPONIBILI -->
      <div class="lg:col-span-2 space-y-4">
        <h2 class="font-semibold text-lg text-slate-800">Tutor Disponibili</h2>
        
        <div v-if="tutors.length === 0" class="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500">
          Nessun tutor ha dato la disponibilità per oggi.
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            v-for="tutor in tutors" 
            :key="tutor.id"
            class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col print-card"
          >
            <!-- Header Tutor -->
            <div class="bg-slate-50 border-b border-slate-200 px-4 py-3">
              <div class="font-semibold text-slate-800 flex items-center gap-2">
                <UIcon name="i-heroicons-user" class="w-4 h-4 text-tfn-500" />
                {{ tutor.name }}
              </div>
              <div v-if="tutor.notes" class="text-xs text-slate-500 italic mt-1">{{ tutor.notes }}</div>
            </div>
            
            <!-- Slot Orari (Zone di Drop) -->
            <div class="p-4 grid grid-cols-1 gap-3">
              <div 
                v-for="slot in slots" 
                :key="slot.id"
                class="border-2 rounded-lg p-2 min-h-[80px] transition-colors"
                :class="isDragOver === tutor.id + slot.id ? 'border-primary-400 bg-primary-50' : 'border-dashed border-slate-200 bg-slate-50'"
                @dragover.prevent="isDragOver = tutor.id + slot.id"
                @dragleave.prevent="isDragOver = null"
                @drop.prevent="handleDrop($event, tutor.id, slot.id)"
              >
                <div class="text-xs font-medium text-slate-500 mb-2">{{ slot.label }}</div>
                
                <div class="space-y-2">
                  <div 
                    v-for="badge in getAssignedBadges(tutor.id, slot.id)" 
                    :key="badge.subjectId"
                    class="bg-white border border-primary-200 rounded p-2 text-sm shadow-sm relative group cursor-grab active:cursor-grabbing"
                    draggable="true"
                    @dragstart="handleDragStart($event, badge)"
                  >
                    <div class="font-medium text-slate-800">{{ badge.studentSurname }} {{ badge.studentName }}</div>
                    <div class="text-xs text-primary-600">{{ badge.subject }}</div>
                    <div v-if="badge.supplemento" class="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap" :class="badge.supplementoApplicato ? 'text-emerald-600' : 'text-amber-600'">
                      <span>⭐ +€{{ badge.supplemento }} {{ badge.supplementoApplicato ? 'applicato' : 'da approvare' }}</span>
                      <!-- Il bottone di approvazione deve esserci anche DOPO l'assegnazione al tutor -->
                      <UButton
                        v-if="!badge.supplementoApplicato"
                        size="xs"
                        color="warning"
                        variant="soft"
                        class="no-print"
                        :loading="applicandoSupplemento === badge.bookingId"
                        @click.stop="applicaSupplemento(badge)"
                      >
                        OK → +€{{ SUPPLEMENTO_SPECIALE }} sul pacchetto
                      </UButton>
                    </div>
                    <button
                      class="no-print absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 rounded p-1"
                      @click="rimuoviAssegnazione(badge)"
                    >
                      <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- COLONNA DESTRA: PRENOTAZIONI -->
      <div class="no-print space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-lg text-slate-800">Da Assegnare</h2>
          <UBadge color="gray">{{ unassignedBadges.length }}</UBadge>
        </div>

        <div v-if="unassignedBadges.length === 0" class="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500">
          Tutti gli studenti sono stati assegnati o non ci sono prenotazioni.
        </div>

        <div class="space-y-3 max-h-[800px] overflow-y-auto pr-2">
          <div 
            v-for="badge in unassignedBadges" 
            :key="badge.subjectId"
            class="bg-white border border-slate-200 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary-300 transition-colors relative group"
            draggable="true"
            @dragstart="handleDragStart($event, badge)"
          >
            <div class="font-medium text-slate-800 flex justify-between items-start">
              <span>{{ badge.studentSurname }} {{ badge.studentName }}</span>
              <button 
                class="no-print opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 rounded p-1 transition-opacity"
                @click.stop="eliminaPrenotazioneManuale(badge)"
                title="Elimina"
              >
                <UIcon name="i-heroicons-trash" class="w-4 h-4" />
              </button>
            </div>
            <div class="flex items-center justify-between mt-1">
              <span class="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded">{{ badge.subject }}</span>
              <span class="text-xs text-slate-400">{{ badge.studentPhone }}</span>
            </div>
            <div v-if="badge.notes" class="text-xs text-amber-600 mt-2 bg-amber-50 p-1 rounded">{{ badge.notes }}</div>
            <!-- Lezione speciale fuori data: supplemento €10 da approvare -->
            <div v-if="badge.supplemento" class="mt-2 flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded p-1.5">
              <span class="text-xs font-medium" :class="badge.supplementoApplicato ? 'text-emerald-700' : 'text-amber-700'">
                ⭐ Speciale fuori data: +€{{ badge.supplemento }}
              </span>
              <UBadge v-if="badge.supplementoApplicato" color="success" variant="subtle" size="xs">Applicato al pacchetto</UBadge>
              <UButton
                v-else
                size="xs"
                color="warning"
                variant="soft"
                :loading="applicandoSupplemento === badge.bookingId"
                @click.stop="applicaSupplemento(badge)"
              >
                OK → +€{{ SUPPLEMENTO_SPECIALE }} sul pacchetto
              </UButton>
            </div>
          </div>
        </div>

        <div class="mt-8 border-t border-slate-200 pt-4 space-y-3">
          <h3 class="font-medium text-sm text-slate-500">Aggiungi studente manuale</h3>
          <USelectMenu
            v-model="manualeStudentId"
            searchable
            :items="studentOptions"
            placeholder="Seleziona studente..."
            label-key="label"
            value-key="value"
            class="w-full"
          />
          <USelectMenu
            v-model="manualeMateria"
            :items="MATERIE"
            placeholder="Seleziona materia..."
            class="w-full"
          />
          <UButton icon="i-heroicons-plus" size="sm" :disabled="!manualeStudentId || !manualeMateria" :loading="aggiungendoManuale" @click="aggiungiStudenteManuale">
            Aggiungi al matching
          </UButton>
        </div>
      </div>
    </div>
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
import { format, addDays, subDays } from 'date-fns'
import { it } from 'date-fns/locale'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import { SUPPLEMENTO_SPECIALE } from '#shared/tariffe'
import { MATERIE_DEFAULT } from '#shared/materie'

definePageMeta({ middleware: ['admin-or-super'] })
useHead({ title: 'Matching — Ti Formiamo Noi' })

const toast = useToast()

// Stato principale
const currentDate = ref(new Date())
const loading = ref(false)
const tutors = ref<any[]>([])
const badges = ref<any[]>([])
const slots = ref<any[]>([])
const isDragOver = ref<string | null>(null)
let draggedBadge: any = null

const dataFormattata = computed(() => {
  return format(currentDate.value, 'EEEE d MMMM yyyy', { locale: it }).replace(/^\w/, c => c.toUpperCase())
})

const dateParam = computed(() => format(currentDate.value, 'yyyy-MM-dd'))

const unassignedBadges = computed(() => badges.value.filter(b => !b.isAssigned))

// Tutti gli studenti attivi (per l'aggiunta manuale)
const { data: studentsRes } = useFetch('/api/students?active=true&limit=1000&light=true', { lazy: true })
const studentOptions = computed(() => {
  return (studentsRes.value?.data || []).map((s: any) => ({
    label: `${s.lastName} ${s.firstName}`,
    value: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    phone: s.studentPhone || s.parentPhone || ''
  }))
})

// Materie da Impostazioni → Materie & Tariffe (fallback se non configurate)
const { data: configsRes } = useLazyFetch<Record<string, string>>('/api/settings/configs')
const MATERIE = computed<string[]>(() => {
  try {
    const lista = JSON.parse(configsRes.value?.materie ?? '[]')
    if (Array.isArray(lista) && lista.length > 0) return lista
  } catch {}
  return MATERIE_DEFAULT
})

const manualeStudentId = ref('')
const manualeMateria = ref('')
const aggiungendoManuale = ref(false)

function cambiaGiorno(dir: number) {
  currentDate.value = dir > 0 ? addDays(currentDate.value, 1) : subDays(currentDate.value, 1)
}

watch(currentDate, () => {
  loadData()
})

async function loadData() {
  loading.value = true
  try {
    const res = await $fetch(`/api/matching/${dateParam.value}`)
    tutors.value = res.tutors
    badges.value = res.badges
    slots.value = res.slots
  } catch (err) {
    toast.add({ title: 'Errore', description: 'Impossibile caricare i dati di matching', color: 'error' })
  } finally {
    loading.value = false
  }
}

function getAssignedBadges(tutorId: string, slotId: string) {
  return badges.value.filter(b => b.assignedTutorId === tutorId && b.assignedSlot === slotId)
}

// ─── Supplemento lezione speciale fuori data: OK admin → +€10 sul pacchetto ───
const applicandoSupplemento = ref<string | null>(null)
async function applicaSupplemento(badge: any) {
  applicandoSupplemento.value = badge.bookingId
  try {
    const res: any = await $fetch(`/api/admin/bookings/${badge.bookingId}/supplemento`, { method: 'POST' })
    badges.value.forEach(b => { if (b.bookingId === badge.bookingId) b.supplementoApplicato = true })
    toast.add({
      title: 'Supplemento applicato',
      description: `+€${badge.supplemento} aggiunti al pacchetto "${res.packageNome}": risulterà da pagare.`,
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
  } catch (err: any) {
    toast.add({ title: 'Impossibile applicare il supplemento', description: err?.data?.statusMessage ?? 'Errore imprevisto', color: 'error' })
  } finally {
    applicandoSupplemento.value = null
  }
}

function handleDragStart(event: any, badge: any) {
  draggedBadge = badge
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    // Hack per far funzionare drag & drop su alcuni browser
    event.dataTransfer.setData('text/plain', badge.subjectId)
  }
}

async function handleDrop(event: any, tutorId: string, slotId: string) {
  isDragOver.value = null
  if (!draggedBadge) return

  try {
    await $fetch('/api/matching/assign', {
      method: 'POST',
      body: {
        subjectId: draggedBadge.subjectId,
        tutorId,
        slot: slotId
      }
    })
    
    // Aggiorna stato locale
    const badge = badges.value.find(b => b.subjectId === draggedBadge.subjectId)
    if (badge) {
      badge.assignedTutorId = tutorId
      badge.assignedSlot = slotId
      badge.isAssigned = true
    }
  } catch (err) {
    toast.add({ title: 'Errore assegnazione', color: 'error' })
  }
  
  draggedBadge = null
}

async function rimuoviAssegnazione(badge: any) {
  try {
    await $fetch('/api/matching/assign', {
      method: 'POST',
      body: {
        subjectId: badge.subjectId,
        tutorId: null,
        slot: null
      }
    })
    
    // Aggiorna stato locale
    const b = badges.value.find(x => x.subjectId === badge.subjectId)
    if (b) {
      b.assignedTutorId = null
      b.assignedSlot = null
      b.isAssigned = false
    }
  } catch (err) {
    toast.add({ title: 'Errore rimozione', color: 'error' })
  }
}

const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmDescription = ref('')
const pendingDeleteBadge = ref<any>(null)

function eliminaPrenotazioneManuale(badge: any) {
  pendingDeleteBadge.value = badge
  confirmTitle.value = `Eliminare la prenotazione per ${badge.studentName} ${badge.studentSurname}?`
  confirmDescription.value = 'La prenotazione verrà rimossa definitivamente.'
  confirmOpen.value = true
}

async function eseguiEliminazione() {
  confirmOpen.value = false
  if (!pendingDeleteBadge.value) return
  try {
    await $fetch(`/api/admin/bookings/${pendingDeleteBadge.value.bookingId}`, {
      method: 'DELETE'
    })
    toast.add({ title: 'Prenotazione eliminata', color: 'success' })
    await loadData()
  } catch (err) {
    toast.add({ title: 'Errore', description: 'Impossibile eliminare la prenotazione', color: 'error' })
  } finally {
    pendingDeleteBadge.value = null
  }
}

async function aggiungiStudenteManuale() {
  if (!manualeStudentId.value || !manualeMateria.value) return

  const student = studentOptions.value.find(s => s.value === manualeStudentId.value)
  if (!student) return

  aggiungendoManuale.value = true
  try {
    await $fetch('/api/admin/bookings', {
      method: 'POST',
      body: {
        studentId: student.value,
        studentName: student.firstName,
        studentSurname: student.lastName,
        studentPhone: student.phone,
        requestedDate: dateParam.value + 'T12:00:00.000Z',
        status: 'PENDING',
        subjects: [manualeMateria.value]
      }
    })

    toast.add({ title: 'Studente aggiunto al matching', color: 'success' })
    manualeStudentId.value = ''
    manualeMateria.value = ''
    await loadData()
  } catch (err) {
    toast.add({ title: 'Errore', description: 'Impossibile aggiungere studente', color: 'error' })
  } finally {
    aggiungendoManuale.value = false
  }
}

onMounted(() => {
  loadData()
})

function stampaTabellone() {
  window.print()
}
</script>

<style>
@media print {
  @page { size: A4 portrait; margin: 1cm; }
  body { background-color: white !important; }
  aside, header { display: none !important; }
  main { margin: 0 !important; padding: 0 !important; }
  .no-print { display: none !important; }
  
  .print-card {
    border: 1px solid #e2e8f0 !important;
    box-shadow: none !important;
    break-inside: avoid;
    margin-bottom: 15px;
  }
}
</style>
