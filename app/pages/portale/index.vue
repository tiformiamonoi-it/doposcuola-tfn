<template>
  <div class="space-y-8">
    <!-- ═══ HEADER BANNED PREMIUM ═══ -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-tfn-600 p-6 sm:p-8 text-white shadow-lg">
      <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-xl" />
      <div class="absolute -left-10 -top-10 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
      
      <div class="relative z-10 space-y-2">
        <h1 class="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">
          Ciao, {{ user?.firstName }}! 👋
        </h1>
        <p class="text-indigo-100 text-sm sm:text-base max-w-md">
          Qui puoi monitorare le ore dei ragazzi e gestire in autonomia le lezioni prenotate.
        </p>
      </div>
    </div>

    <!-- ═══ SEZIONE STUDENTI / PACCHETTI ═══ -->
    <div class="space-y-4">
      <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
        <UIcon name="i-heroicons-academic-cap" class="w-5 h-5 text-tfn-500" />
        Stato Pacchetti Studenti
      </h2>

      <div v-if="pendingStudents" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <USkeleton v-for="i in 2" :key="i" class="h-28 w-full rounded-xl" />
      </div>

      <div v-else-if="students.length === 0" class="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-500">
        Nessuno studente collegato a questo account. Contatta la segreteria.
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UCard
          v-for="student in students"
          :key="student.id"
          class="hover:shadow-md transition-shadow duration-300 border border-slate-100 rounded-xl"
        >
          <div class="flex items-start justify-between">
            <div class="space-y-1">
              <h3 class="font-bold text-slate-800">{{ student.firstName }} {{ student.lastName }}</h3>
              <p class="text-xs text-slate-500">{{ student.classe || 'Nessuna classe' }} — {{ student.scuola || 'Nessuna scuola' }}</p>
            </div>
            <UBadge
              :color="student.abilitatoPrenotazioneOnline ? 'success' : 'neutral'"
              variant="subtle"
              size="xs"
            >
              {{ student.abilitatoPrenotazioneOnline ? 'Prenotazione Attiva' : 'Solo Consultazione' }}
            </UBadge>
          </div>

          <!-- Stato pacchetto attivo -->
          <div class="mt-4 pt-3 border-t border-slate-50">
            <div v-if="student.packages && student.packages.length > 0">
              <div v-for="pkg in student.packages" :key="pkg.id" class="space-y-2">
                <div class="flex justify-between items-center text-xs font-semibold text-slate-600">
                  <span>{{ pkg.nome }}</span>
                  <span class="text-tfn-600">
                    <template v-if="pkg.tipo === 'ORE'">
                      {{ parseFloat(pkg.oreResiduo) }} ore residue
                    </template>
                    <template v-else-if="pkg.tipo === 'MENSILE'">
                      {{ pkg.giorniResiduo }} giorni residui
                    </template>
                    <template v-else-if="pkg.tipo === 'A_CONSUMO'">
                      {{ parseFloat(pkg.oreResiduo) }} ore libretto
                    </template>
                  </span>
                </div>
                <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    class="bg-tfn-500 h-full rounded-full transition-all duration-500" 
                    :style="{ width: getProgressPercentage(pkg) + '%' }"
                  />
                </div>
              </div>
            </div>
            <div v-else class="text-xs text-amber-500 font-medium flex items-center gap-1">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
              Nessun pacchetto attivo trovato. Contatta il centro per ricaricare.
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- ═══ SEZIONE LEZIONI PRENOTATE ═══ -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <UIcon name="i-heroicons-calendar" class="w-5 h-5 text-tfn-500" />
          Le tue Lezioni Prenotate
        </h2>
        <UButton
          v-if="prenotazioneAbilitata"
          to="/portale/prenota"
          size="sm"
          color="primary"
          icon="i-heroicons-plus"
        >
          Prenota lezione
        </UButton>
      </div>

      <div v-if="pendingBookings" class="space-y-3">
        <USkeleton v-for="i in 2" :key="i" class="h-32 w-full rounded-xl" />
      </div>

      <div v-else-if="bookings.length === 0" class="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500 space-y-3">
        <UIcon name="i-heroicons-calendar-days" class="w-8 h-8 mx-auto text-slate-400" />
        <p class="text-sm font-medium">Non hai lezioni prenotate nel sistema.</p>
        <p class="text-xs text-slate-400 max-w-xs mx-auto">Le lezioni che prenoti appariranno qui pronte per essere svolte.</p>
        <UButton v-if="prenotazioneAbilitata" to="/portale/prenota" size="xs" color="indigo" variant="outline">Prenota Ora</UButton>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="b in bookings"
          :key="b.id"
          class="bg-white border rounded-xl p-4 shadow-sm hover:border-indigo-200 transition-colors duration-200 relative"
          :class="b.status === 'CANCELLED' ? 'opacity-60 bg-slate-50/50' : 'border-slate-100'"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="space-y-1">
              <!-- Giorno e Studente -->
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-extrabold text-slate-800 text-sm sm:text-base">
                  {{ formatDateLong(b.requestedDate) }}
                </span>
                <UBadge
                  :color="getStatusColor(b.status)"
                  variant="subtle"
                  size="xs"
                >
                  {{ getStatusLabel(b.status) }}
                </UBadge>
              </div>
              <p class="text-xs text-slate-500 font-medium">Studente: <span class="text-slate-700">{{ b.studentName }} {{ b.studentSurname }}</span></p>

              <!-- Materie -->
              <div class="flex flex-wrap gap-1 mt-1.5">
                <span 
                  v-for="s in b.subjects" 
                  :key="s.name"
                  class="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded"
                >
                  {{ s.name }}
                </span>
              </div>

              <!-- Note orario della famiglia -->
              <p v-if="b.notes" class="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded inline-block mt-1 font-medium italic">
                Nota: "{{ b.notes }}"
              </p>

            </div>

            <!-- Pulsanti di azione per il genitore -->
            <div v-if="b.status !== 'CANCELLED'" class="flex items-center gap-2 sm:self-center shrink-0">
              <UButton
                v-if="canModify(b.requestedDate)"
                size="xs"
                color="indigo"
                variant="soft"
                icon="i-heroicons-pencil"
                @click="apriModifica(b)"
              >
                Modifica
              </UButton>
              <UButton
                v-if="canCancel(b.requestedDate)"
                size="xs"
                color="error"
                variant="outline"
                icon="i-heroicons-trash"
                :loading="cancellandoId === b.id"
                @click="annullaLezione(b.id)"
              >
                Annulla
              </UButton>

              <!-- Indicazione di blocco orario -->
              <span 
                v-if="!canModify(b.requestedDate) && !canCancel(b.requestedDate) && isOggi(b.requestedDate)" 
                class="text-[11px] text-slate-400 bg-slate-100 px-2 py-1 rounded flex items-center gap-1"
                title="Modifiche chiuse dopo le 11:30 e cancellazioni chiuse dopo le 12:30 per oggi."
              >
                <UIcon name="i-heroicons-lock-closed" class="w-3.5 h-3.5" />
                Orario limite superato
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ MODAL DI MODIFICA PRENOTAZIONE ═══ -->
    <UModal v-model:open="modalModificaAperto" title="Modifica Prenotazione">
      <template #body>
        <div class="space-y-4 p-4">
          <p class="text-xs text-slate-500">
            Modifica la data, le materie o le note per questa lezione.
            <span class="text-amber-600 block mt-1 font-semibold">⚠️ Nota: Se la lezione era già stata abbinata a un tutor, la modifica azzererà il matching per consentire alla segreteria di riassegnarla correttamente.</span>
          </p>

          <!-- Data -->
          <UFormField label="Nuova data desiderata" required>
            <UInput
              v-model="modificaForm.dataDesiderata"
              type="date"
              :min="minDate"
              class="w-full"
              @change="validaDataModifica"
            />
          </UFormField>

          <!-- Materie -->
          <UFormField label="Materia / Materie" required>              <div class="grid grid-cols-2 gap-2 mt-1">
              <button
                v-for="materia in MATERIE"
                :key="materia"
                type="button"
                class="px-2.5 py-1.5 text-xs rounded-lg border text-left transition-colors font-medium"
                :class="modificaForm.materie.includes(materia)
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'"
                @click="toggleMateriaModifica(materia)"
              >
                {{ materia }}
              </button>
            </div>
            <p v-if="modificaForm.materie.length === 0" class="text-xs text-red-500 mt-1">Seleziona almeno una materia</p>
          </UFormField>

          <!-- Note -->
          <UFormField label="Nota per l'orario (opzionale)">
            <UTextarea
              v-model="modificaForm.noteOrario"
              placeholder="Es. preferisco dopo le 16:30"
              :rows="2"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 px-4 pb-4">
          <UButton variant="ghost" size="sm" @click="modalModificaAperto = false">Annulla</UButton>
          <UButton 
            color="primary" 
            size="sm"
            :loading="salvandoModifica" 
            :disabled="modificaForm.materie.length === 0 || !modificaForm.dataDesiderata"
            @click="salvaModifica"
          >
            Salva Modifiche
          </UButton>
        </div>
      </template>
    </UModal>
  </div>

  <ConfirmDialog
    v-model:open="confirmOpen"
    :title="confirmTitle"
    :description="confirmDescription"
    confirm-label="Annulla"
    confirm-color="error"
    @confirm="eseguiAnnullamento"
  />
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import ConfirmDialog from '~/components/ConfirmDialog.vue'

definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Home — Portale Famiglie' })

const toast = useToast()
const { user } = useUserSession()

const { data: portalConfigs } = useLazyFetch('/api/portal/configs')
const MATERIE = computed(() => (portalConfigs.value as any)?.materie ?? [
  'Matematica', 'Fisica', 'Chimica', 'Italiano', 'Inglese',
  'Storia', 'Geografia', 'Latino', 'Greco', 'Scienze', 'Informatica',
])

// ─── CARICAMENTO DATI ───
const { data: studentsData, pending: pendingStudents } = await useFetch('/api/portal/students')
const students = computed(() => (studentsData.value as any[]) ?? [])

const prenotazioneAbilitata = computed(() =>
  students.value.some((s: any) => s.abilitatoPrenotazioneOnline)
)

const { data: bookingsData, pending: pendingBookings, refresh: refreshBookings } = await useFetch('/api/portal/bookings')
const bookings = computed(() => (bookingsData.value as any[]) ?? [])

const { data: closuresData } = useLazyFetch('/api/portal/closures')
const closures = computed(() => (closuresData.value as any[]) ?? [])

// ─── UTILS GRAFICI ───
function getProgressPercentage(pkg: any) {
  if (pkg.tipo === 'MENSILE') {
    // Calcoliamo basandoci sui giorni inseriti
    const acq = pkg.giorniAcquistati ?? 1
    const res = pkg.giorniResiduo ?? 0
    return Math.min(100, Math.max(0, (res / acq) * 100))
  }
  const acq = parseFloat(pkg.oreAcquistate || '1')
  const res = parseFloat(pkg.oreResiduo || '0')
  return Math.min(100, Math.max(0, (res / acq) * 100))
}

function getStatusColor(status: string) {
  switch (status) {
    case 'CONFIRMED': return 'success'
    case 'CANCELLED': return 'neutral'
    case 'PENDING': return 'warning'
    case 'COMPLETED': return 'info'
    default: return 'neutral'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'CONFIRMED': return 'Confermata'
    case 'CANCELLED': return 'Annullata'
    case 'PENDING': return 'In attesa'
    case 'COMPLETED': return 'Completata'
    default: return status
  }
}

function formatDateLong(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).replace(/^\w/, c => c.toUpperCase())
}


// ─── VERIFICA LIMITI TEMPORALI ───
function isOggi(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  return d.toISOString().split('T')[0] === today.toISOString().split('T')[0]
}

function canModify(dateStr: string) {
  const reqDate = new Date(dateStr)
  const now = new Date()
  
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  })
  const parts = formatter.formatToParts(now)
  const p = (type: string) => parts.find(x => x.type === type)?.value
  const todayStr = `${p('year')}-${p('month')}-${p('day')}`
  const italyHour = parseInt(p('hour') || '0', 10)
  const italyMinute = parseInt(p('minute') || '0', 10)

  const reqStr = reqDate.toISOString().split('T')[0]
  
  if (reqStr === todayStr) {
    // Oggi: entro le 11:30
    return italyHour < 11 || (italyHour === 11 && italyMinute < 30)
  }
  return reqDate.getTime() > now.getTime()
}

function canCancel(dateStr: string) {
  const reqDate = new Date(dateStr)
  const now = new Date()
  
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  })
  const parts = formatter.formatToParts(now)
  const p = (type: string) => parts.find(x => x.type === type)?.value
  const todayStr = `${p('year')}-${p('month')}-${p('day')}`
  const italyHour = parseInt(p('hour') || '0', 10)
  const italyMinute = parseInt(p('minute') || '0', 10)

  const reqStr = reqDate.toISOString().split('T')[0]
  
  if (reqStr === todayStr) {
    // Oggi: entro le 12:30
    return italyHour < 12 || (italyHour === 12 && italyMinute < 30)
  }
  return reqDate.getTime() > now.getTime()
}

// ─── ANNULLAMENTO PRENOTAZIONE ───
const cancellandoId = ref<string | null>(null)
const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmDescription = ref('')
const pendingCancelId = ref<string | null>(null)

function annullaLezione(id: string) {
  pendingCancelId.value = id
  confirmTitle.value = 'Annullare questa prenotazione?'
  confirmDescription.value = 'La lezione verrà cancellata e non potrà essere recuperata.'
  confirmOpen.value = true
}

async function eseguiAnnullamento() {
  confirmOpen.value = false
  if (!pendingCancelId.value) return
  cancellandoId.value = pendingCancelId.value
  try {
    await $fetch(`/api/portal/bookings/${pendingCancelId.value}`, { method: 'DELETE' })
    toast.add({ title: 'Lezione annullata con successo', color: 'success' })
    await refreshBookings()
  } catch (err: any) {
    toast.add({
      title: 'Errore',
      description: err.data?.statusMessage ?? 'Impossibile annullare la lezione',
      color: 'error'
    })
  } finally {
    cancellandoId.value = null
    pendingCancelId.value = null
  }
}

// ─── MODIFICA PRENOTAZIONE (MODAL & VALIDAZIONE) ───
const modalModificaAperto = ref(false)
const salvandoModifica = ref(false)
const modificaForm = reactive({
  id: '',
  dataDesiderata: '',
  materie: [] as string[],
  noteOrario: ''
})

const minDate = computed(() => {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  })
  const parts = formatter.formatToParts(now)
  const p = (type: string) => parts.find(x => x.type === type)?.value
  const italyHour = parseInt(p('hour') || '0', 10)
  const italyMinute = parseInt(p('minute') || '0', 10)

  // Se dopo le 11:30, la prima data utile è domani
  if (italyHour > 11 || (italyHour === 11 && italyMinute >= 30)) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }
  return new Date().toISOString().split('T')[0]
})

function apriModifica(booking: any) {
  modificaForm.id = booking.id
  modificaForm.dataDesiderata = booking.requestedDate.split('T')[0]
  modificaForm.materie = booking.subjects ? booking.subjects.map((s: any) => s.name) : []
  modificaForm.noteOrario = booking.notes || ''
  modalModificaAperto.value = true
}

function toggleMateriaModifica(materia: string) {
  const idx = modificaForm.materie.indexOf(materia)
  if (idx === -1) modificaForm.materie.push(materia)
  else modificaForm.materie.splice(idx, 1)
}

function validaDataModifica() {
  if (!modificaForm.dataDesiderata) return
  
  const selectedDate = new Date(modificaForm.dataDesiderata)
  
  // 1. Controllo Domenica
  if (selectedDate.getDay() === 0) {
    toast.add({ title: 'Impossibile prenotare o spostare di Domenica', color: 'error' })
    modificaForm.dataDesiderata = ''
    return
  }

  // 2. Controllo Chiusure
  const isChiuso = closures.value.some((c: any) => c.date.split('T')[0] === modificaForm.dataDesiderata)
  if (isChiuso) {
    toast.add({ title: 'Il centro è chiuso in questa data', color: 'error' })
    modificaForm.dataDesiderata = ''
    return
  }

  // 3. Controllo limite 11:30 per oggi stesso
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  })
  const parts = formatter.formatToParts(now)
  const p = (type: string) => parts.find(x => x.type === type)?.value
  const todayStr = `${p('year')}-${p('month')}-${p('day')}`
  const italyHour = parseInt(p('hour') || '0', 10)
  const italyMinute = parseInt(p('minute') || '0', 10)

  if (modificaForm.dataDesiderata === todayStr) {
    if (italyHour > 11 || (italyHour === 11 && italyMinute >= 30)) {
      toast.add({ title: 'Le lezioni per oggi si potevano modificare o prenotare solo entro le 11:30', color: 'error' })
      modificaForm.dataDesiderata = ''
    }
  }
}

async function salvaModifica() {
  if (!modificaForm.dataDesiderata || modificaForm.materie.length === 0) return
  
  salvandoModifica.value = true
  try {
    await $fetch(`/api/portal/bookings/${modificaForm.id}`, {
      method: 'PUT',
      body: {
        dataDesiderata: modificaForm.dataDesiderata + 'T12:00:00.000Z',
        materie:        modificaForm.materie,
        noteOrario:     modificaForm.noteOrario || undefined
      }
    })
    
    toast.add({ title: 'Prenotazione modificata con successo', color: 'success' })
    modalModificaAperto.value = false
    await refreshBookings()
  } catch (err: any) {
    toast.add({
      title: 'Errore',
      description: err.data?.statusMessage ?? 'Impossibile salvare le modifiche',
      color: 'error'
    })
  } finally {
    salvandoModifica.value = false
  }
}
</script>
