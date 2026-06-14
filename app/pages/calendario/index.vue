<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">Calendario Lezioni</h2>
        <p class="text-sm text-slate-500 mt-0.5">Visualizza e inserisci le lezioni settimanali</p>
      </div>
      <div class="flex items-center gap-3">
        <UButton color="white" variant="solid" icon="i-heroicons-chevron-left" @click="cambiaSettimana(-1)" />
        <span class="font-medium text-slate-700 min-w-[200px] text-center">
          {{ formatDataRange(inizioSettimana, fineSettimana) }}
        </span>
        <UButton color="white" variant="solid" icon="i-heroicons-chevron-right" @click="cambiaSettimana(1)" />
        <UButton color="primary" icon="i-heroicons-plus" @click="apriNuovaLezione">Nuova Lezione</UButton>
      </div>
    </div>

    <!-- Griglia Settimanale -->
    <UCard :ui="{ body: { padding: 'p-0 sm:p-0' } }">
      <div class="grid grid-cols-1 lg:grid-cols-7 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div v-for="giorno in giorniSettimana" :key="giorno.dateStr" class="flex flex-col h-full bg-slate-50/50">
          <!-- Intestazione Giorno -->
          <div class="p-3 text-center border-b border-slate-200" :class="{ 'bg-primary-50': isOggi(giorno.date) }">
            <div class="text-xs font-semibold text-slate-500 uppercase">{{ giorno.nome }}</div>
            <div class="text-lg font-bold text-slate-800" :class="{ 'text-primary-600': isOggi(giorno.date) }">{{ giorno.numero }}</div>
          </div>
          
          <!-- Lezioni del Giorno -->
          <div class="p-2 flex-1 space-y-2 min-h-[300px]">
            <div v-if="pending" class="space-y-2">
              <USkeleton v-for="i in 2" :key="i" class="h-20 w-full" />
            </div>
            <template v-else>
              <div v-for="lez in getLezioniByDate(giorno.dateStr)" :key="lez.id" 
                   class="bg-white border border-slate-200 rounded-md p-2 shadow-sm text-sm hover:border-primary-300 transition-colors cursor-pointer"
                   @click="apriDettaglio(lez)">
                <div class="flex justify-between items-start mb-1">
                  <span class="font-bold text-slate-700">{{ lez.timeSlot?.oraInizio }} - {{ lez.timeSlot?.oraFine }}</span>
                  <UBadge size="xs" :color="lez.tipo === 'SINGOLA' ? 'info' : 'warning'">{{ lez.tipo }}</UBadge>
                </div>
                <div class="text-slate-600 text-xs font-medium truncate mb-1">
                  <UIcon name="i-heroicons-user" class="inline w-3 h-3 align-text-bottom mr-1"/>
                  {{ lez.tutor?.firstName }} {{ lez.tutor?.lastName }}
                </div>
                <div class="text-slate-500 text-xs mt-1">
                  {{ lez.lessonStudents?.length || 0 }} student{{ lez.lessonStudents?.length === 1 ? 'e' : 'i' }}
                </div>
              </div>
              
              <div v-if="getLezioniByDate(giorno.dateStr).length === 0" class="h-full flex items-center justify-center">
                <span class="text-xs text-slate-400">Nessuna lezione</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </UCard>

    <!-- MODAL INSERIMENTO LEZIONE -->
    <UModal v-model:open="modalNuovaAperto" title="Nuova Lezione">
      <template #body>
        <form @submit.prevent="creaLezione" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Data" required>
              <UInput v-model="nuovaLezione.data" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Slot Orario" required>
              <USelectMenu 
                v-model="nuovaLezione.timeSlotItem" 
                :items="timeslotsOptions" 
                placeholder="Seleziona orario..."
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField label="Tutor" required>
            <USelectMenu 
              v-model="nuovaLezione.tutorItem" 
              :items="tutorsOptions" 
              placeholder="Cerca tutor..."
              searchable
              class="w-full"
            />
          </UFormField>

          <UFormField label="Studenti" required>
            <div class="border border-slate-200 rounded-md p-3 space-y-3 bg-slate-50">
              <div v-for="(stu, index) in nuovaLezione.studenti" :key="index" class="flex flex-col gap-2 p-2 bg-white rounded border border-slate-100 shadow-sm relative">
                <UButton icon="i-heroicons-x-mark" size="2xs" color="gray" variant="ghost" class="absolute top-1 right-1" @click="rimuoviStudente(index)" />
                <USelectMenu
                  v-model="stu.studentItem"
                  :items="getAvailableStudents(index)"
                  placeholder="Cerca studente..."
                  searchable
                  class="w-full pr-6"
                  @update:model-value="(val) => onStudenteSelezionato(index, val)"
                />
                <USelectMenu
                  v-if="stu.studentItem"
                  v-model="stu.packageItem"
                  :items="stu.packageOptions || []"
                  :loading="stu.loadingPackages"
                  placeholder="Da quale pacchetto?"
                  class="w-full"
                />
                </div>
              <UButton size="sm" variant="soft" icon="i-heroicons-plus" @click="aggiungiStudente">Aggiungi studente</UButton>
            </div>
          </UFormField>

          <UFormField label="Opzioni aggiuntive">
            <div class="space-y-2">
              <UCheckbox v-model="nuovaLezione.mezzaLezione" label="Mezza Lezione (per tutti gli studenti)" />
              <UCheckbox v-model="nuovaLezione.forzaGruppo" :disabled="nuovaLezione.studenti.length > 1" label="Forza tariffa GRUPPO (anche per 1 studente)" />
            </div>
          </UFormField>

          <UFormField label="Note">
            <UTextarea v-model="nuovaLezione.note" placeholder="Opzionale..." />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="modalNuovaAperto = false">Annulla</UButton>
          <UButton :loading="salvando" @click="creaLezione">Salva Lezione</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { startOfWeek, endOfWeek, addDays, addWeeks, format, isSameDay } from 'date-fns'
import { it } from 'date-fns/locale'

definePageMeta({ middleware: ['admin-or-super'] })

const toast = useToast()

// ─── GESTIONE DATE ───
const dataRiferimento = ref(new Date())
const inizioSettimana = computed(() => startOfWeek(dataRiferimento.value, { weekStartsOn: 1 }))
const fineSettimana = computed(() => endOfWeek(dataRiferimento.value, { weekStartsOn: 1 }))

const giorniSettimana = computed(() => {
  const days = []
  let curr = inizioSettimana.value
  for (let i = 0; i < 7; i++) {
    days.push({
      date: curr,
      dateStr: format(curr, 'yyyy-MM-dd'),
      nome: format(curr, 'EEEE', { locale: it }),
      numero: format(curr, 'd')
    })
    curr = addDays(curr, 1)
  }
  return days
})

function cambiaSettimana(dir: number) {
  dataRiferimento.value = addWeeks(dataRiferimento.value, dir)
}

function formatDataRange(start: Date, end: Date) {
  const s = format(start, 'd MMM', { locale: it })
  const e = format(end, 'd MMM yyyy', { locale: it })
  return `${s} - ${e}`
}

function isOggi(d: Date) {
  return isSameDay(d, new Date())
}

// ─── FETCH LEZIONI ───
const { data: lezioniData, pending, refresh } = useFetch('/api/lessons', {
  lazy: true,
  query: computed(() => ({
    dataInizio: format(inizioSettimana.value, 'yyyy-MM-dd'),
    dataFine: format(fineSettimana.value, 'yyyy-MM-dd')
  })),
  watch: [inizioSettimana, fineSettimana]
})

const lezioni = computed(() => lezioniData.value?.data ?? [])

function getLezioniByDate(dateStr: string) {
  return lezioni.value.filter((l: any) => l.data.startsWith(dateStr)).sort((a: any, b: any) => {
    return (a.timeSlot?.oraInizio || '').localeCompare(b.timeSlot?.oraInizio || '')
  })
}

// ─── CREAZIONE LEZIONE ───
const modalNuovaAperto = ref(false)
const salvando = ref(false)

const nuovaLezione = reactive({
  data: format(new Date(), 'yyyy-MM-dd'),
  tutorItem: null as any,
  timeSlotItem: null as any,
  mezzaLezione: false,
  studenti: [{ studentItem: null as any, packageItem: null as any, packageOptions: [], loadingPackages: false }],
  forzaGruppo: false,
  note: ''
})

function apriNuovaLezione() {
  nuovaLezione.data = format(new Date(), 'yyyy-MM-dd')
  nuovaLezione.tutorItem = null
  nuovaLezione.timeSlotItem = null
  nuovaLezione.mezzaLezione = false
  nuovaLezione.studenti = [{ studentItem: null, packageItem: null, packageOptions: [], loadingPackages: false }]
  nuovaLezione.forzaGruppo = false
  nuovaLezione.note = ''
  modalNuovaAperto.value = true
}

function aggiungiStudente() {
  nuovaLezione.studenti.push({ studentItem: null, packageItem: null, packageOptions: [], loadingPackages: false })
}

function rimuoviStudente(idx: number) {
  nuovaLezione.studenti.splice(idx, 1)
}

// Fetch base data
const { data: slotsRes } = useFetch('/api/settings/timeslots', { lazy: true })
const timeslotsOptions = computed(() => {
  const slots = slotsRes.value ?? []
  return slots.filter((s: any) => s.active).map((s: any) => ({
    label: `${s.oraInizio} - ${s.oraFine}`,
    value: s.id
  }))
})

const { data: tutorsRes } = useFetch('/api/tutors?active=true', { lazy: true })
const tutorsOptions = computed(() => {
  const tutors = tutorsRes.value?.data ?? []
  return tutors.map((t: any) => ({
    label: `${t.firstName} ${t.lastName}`,
    value: t.id
  }))
})

const { data: studentsRes } = useFetch('/api/students?active=true&limit=100', { lazy: true })
const studentsOptions = computed(() => {
  const students = studentsRes.value?.data ?? []
  return students.map((s: any) => ({
    label: `${s.firstName} ${s.lastName}`,
    value: s.id
  }))
})

function getAvailableStudents(currentIndex: number) {
  const selectedIds = nuovaLezione.studenti
    .map((s, idx) => idx !== currentIndex ? s.studentItem?.value : null)
    .filter(Boolean)
  
  return studentsOptions.value.filter(opt => !selectedIds.includes(opt.value))
}

async function onStudenteSelezionato(idx: number, newVal?: any) {
  const stu = nuovaLezione.studenti[idx]
  const targetObject = newVal || stu.studentItem
  const targetStudentId = targetObject?.value
  
  if (!targetStudentId) {
    stu.packageOptions = []
    stu.packageItem = null
    return
  }
  
  stu.loadingPackages = true
  try {
    const res = await $fetch(`/api/packages?studentId=${targetStudentId}&stati=ATTIVO`)
    
    const pkgs = res.data ?? []
    
    // Ordina dal meno recente al più recente
    pkgs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    
    stu.packageOptions = pkgs.map((p: any) => {
      const option = {
        label: `${p.nome || 'Pacchetto'} (${p.tipo === 'MENSILE' ? (p.giorniAcquistati + 'gg') : (parseFloat(p.oreAcquistate) + 'h')}) - Rim: ${p.tipo === 'MENSILE' ? p.giorniResiduo : parseFloat(p.oreResiduo)}`,
        value: p.id
      }
      return option
    })
    
    if (stu.packageOptions.length > 0) {
      stu.packageItem = stu.packageOptions[0]
    } else {
      stu.packageItem = null
    }
  } catch (err) {
    console.error('Errore fetching pacchetti:', err)
  } finally {
    stu.loadingPackages = false
  }
}

async function creaLezione() {
  const tutorIdStr = nuovaLezione.tutorItem?.value
  const timeSlotIdStr = nuovaLezione.timeSlotItem?.value

  if (!tutorIdStr || !timeSlotIdStr || !nuovaLezione.data) {
    toast.add({ title: 'Compila tutti i campi obbligatori', color: 'warning' })
    return
  }
  
  // Check per evitare di inserire lo stesso alunno più volte
  const studentIds = nuovaLezione.studenti.map(s => s.studentItem?.value).filter(Boolean)
  const uniqueStudentIds = new Set(studentIds)
  if (studentIds.length !== uniqueStudentIds.size) {
    toast.add({ title: 'Hai inserito lo stesso studente più volte', color: 'warning' })
    return
  }
  
  const validStudents = nuovaLezione.studenti
    .map(s => ({
      studentId: s.studentItem?.value,
      packageId: s.packageItem?.value
    }))
    .filter(s => s.studentId && s.packageId)

  if (validStudents.length === 0) {
    toast.add({ title: 'Aggiungi almeno uno studente con un pacchetto valido', color: 'warning' })
    return
  }

  salvando.value = true
  try {
    const payload = {
      ...nuovaLezione,
      tutorId: tutorIdStr,
      timeSlotId: timeSlotIdStr,
      studenti: validStudents
    }
    
    // Rimuoviamo i campi "*Item" e altri non necessari che potrebbero confondere Zod
    delete (payload as any).tutorItem
    delete (payload as any).timeSlotItem
    delete (payload as any).studentiItems
    
    await $fetch('/api/lessons', { method: 'POST', body: payload })
    toast.add({ title: 'Lezione creata', color: 'success' })
    modalNuovaAperto.value = false
    refresh()
  } catch (err: any) {
    const msg = err.data?.statusMessage ?? 'Errore creazione'
    toast.add({ title: msg, color: 'error' })
    console.error('Errore validazione o salvataggio:', err.data?.data?.errors || err)
  } finally {
    salvando.value = false
  }
}

function apriDettaglio(lez: any) {
  // TODO: modal dettaglio lezione, per ora blando
  toast.add({ title: `Lezione di ${lez.tutor?.firstName}`, description: 'Funzione di dettaglio in arrivo.' })
}
</script>
