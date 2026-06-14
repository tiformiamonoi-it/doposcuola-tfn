<template>
  <div class="space-y-6">
    <!-- Intestazione pagina -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">Calendario Lezioni</h2>
        <p class="text-sm text-slate-500 mt-0.5">Gestisci le lezioni e gli slot orari dei tutor</p>
      </div>
      
      <!-- Navigazione Mese e Azioni -->
      <div class="flex flex-col sm:flex-row items-center gap-4">
        <div class="flex items-center bg-white rounded-xl ring-1 ring-slate-200 shadow-sm p-1">
          <UButton color="gray" variant="ghost" icon="i-heroicons-chevron-left" @click="previousMonth" />
          <div class="flex flex-col items-center min-w-[140px] px-2">
            <span class="text-sm font-semibold text-slate-800 capitalize">{{ nomeMeseAnno }}</span>
            <UButton size="2xs" variant="link" color="primary" @click="goToToday" :padded="false" class="mt-0.5">Torna a Oggi</UButton>
          </div>
          <UButton color="gray" variant="ghost" icon="i-heroicons-chevron-right" @click="nextMonth" />
        </div>
        <UButton color="primary" icon="i-heroicons-plus" @click="openNuovaLezione" class="w-full sm:w-auto justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-500/30">
          Nuova Lezione
        </UButton>
      </div>
    </div>

    <!-- Filtri e Azioni globali -->
    <div class="flex flex-col sm:flex-row gap-3 items-center">
      <USelectMenu
        v-model="filtroTutor"
        :items="tutorsOptions"
        placeholder="Filtra per tutor"
        icon="i-heroicons-funnel"
        searchable
        clearable
        class="w-full sm:w-64"
      />
      <UButton color="gray" variant="soft" :icon="allExpanded ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'" @click="toggleAllDays" class="w-full sm:w-auto justify-center">
        {{ allExpanded ? 'Comprimi Tutti' : 'Espandi Tutti' }}
      </UButton>
    </div>

    <!-- Loading State -->
    <div v-if="pending" class="py-12 flex justify-center bg-white rounded-2xl border border-slate-200">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-slate-300 animate-spin" />
    </div>

    <!-- Lista Giorni Mensile -->
    <div v-else-if="giorniVisibili.length > 0" class="space-y-5">
      <div
        v-for="giorno in giorniVisibili"
        :key="giorno.dateStr"
        class="bg-white rounded-2xl ring-1 ring-slate-200 shadow-md overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 border-l-4"
        :class="isToday(giorno.dateStr) ? 'ring-2 ring-primary-500 shadow-lg border-l-primary-500' : 'border-l-transparent'"
      >
        <!-- Header Giorno (Cliccabile) -->
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer transition-colors gap-4"
          :class="isToday(giorno.dateStr) ? 'bg-primary-50/40' : 'hover:bg-slate-50'"
          @click="toggleDay(giorno.dateStr)"
        >
          <div class="flex items-center gap-4">
            <!-- Riquadro Data -->
            <div
              class="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ring-1"
              :class="isToday(giorno.dateStr) ? 'bg-primary-100 text-primary-700 ring-primary-300' : 'bg-sky-50 text-sky-700 ring-sky-200'"
            >
              <span class="text-xl font-bold leading-none">{{ giorno.giornoNumero }}</span>
              <span class="text-[10px] font-semibold uppercase tracking-wider mt-1">{{ giorno.giornoNomeCorto }}</span>
            </div>
            
            <!-- Info Riassuntive -->
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-base font-semibold text-slate-900 capitalize">{{ giorno.giornoNomeLungo }}</p>
                <UBadge v-if="isToday(giorno.dateStr)" color="primary" variant="subtle" size="xs" class="uppercase tracking-wide">Oggi</UBadge>
              </div>
              <div class="flex items-center gap-3 text-xs text-slate-500 mt-1">
                <span class="flex items-center gap-1"><UIcon name="i-heroicons-academic-cap" class="w-3.5 h-3.5" /> <strong class="text-slate-700">{{ giorno.numeroLezioni }}</strong> lezioni</span>
                <span class="flex items-center gap-1"><UIcon name="i-heroicons-users" class="w-3.5 h-3.5" /> <strong class="text-slate-700">{{ giorno.numeroStudenti }}</strong> studenti</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <!-- Ricavo stimato della giornata -->
            <div v-if="giorno.numeroLezioni > 0" class="text-right">
              <p class="text-[10px] uppercase tracking-wider text-slate-400 leading-none">Ricavo stim.</p>
              <p class="text-base font-bold leading-tight mt-0.5" :class="giorno.ricavo >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                € {{ giorno.ricavo.toFixed(2) }}
              </p>
            </div>
            <UButton
              color="gray"
              variant="ghost"
              :icon="isDayExpanded(giorno.dateStr) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
              class="pointer-events-none"
            />
          </div>
        </div>

        <!-- Corpo Giorno Espanso -->
        <div v-if="isDayExpanded(giorno.dateStr)" class="border-t border-slate-100">

          <!-- Caso: giornata di chiusura o domenica (senza lezioni) -->
          <div v-if="(giorno.isChiusura || giorno.isDomenica) && giorno.numeroLezioni === 0" class="p-10 text-center flex flex-col items-center">
            <div class="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-3">
              <UIcon name="i-heroicons-sun" class="w-7 h-7" />
            </div>
            <h4 class="text-base font-semibold text-slate-700">
              {{ giorno.isChiusura ? 'Giornata di chiusura' : 'Oggi è domenica' }}
            </h4>
            <p class="text-sm text-slate-400 mt-1">Il centro è chiuso, nessuna lezione prevista.</p>
          </div>

          <!-- Caso: giorno senza lezioni (es. oggi ancora vuoto) -->
          <div v-else-if="giorno.numeroLezioni === 0" class="p-10 text-center flex flex-col items-center bg-slate-50/30">
            <div class="w-14 h-14 rounded-2xl bg-primary-50 text-primary-500 flex items-center justify-center mb-3">
              <UIcon name="i-heroicons-sparkles" class="w-7 h-7" />
            </div>
            <h4 class="text-base font-semibold text-slate-700">
              {{ isToday(giorno.dateStr) ? 'Buona giornata! Ancora nessuna lezione per oggi' : 'Nessuna lezione in questo giorno' }}
            </h4>
            <p class="text-sm text-slate-400 mt-1 max-w-sm">Aggiungi un tutor con i suoi studenti per iniziare a riempire la griglia.</p>
            <div class="flex flex-wrap items-center justify-center gap-2 mt-5">
              <UButton color="primary" icon="i-heroicons-plus" @click="openLezioneRapida(giorno.dateStr)">Aggiungi lezione</UButton>
              <UButton color="gray" variant="soft" icon="i-heroicons-queue-list" @click="openNuovaLezione">Creazione multipla</UButton>
            </div>
          </div>

          <!-- Caso: griglia oraria normale -->
          <div v-else class="bg-slate-50/30">
            <div class="p-4 flex items-center justify-between border-b border-slate-100 bg-white">
              <h4 class="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 text-slate-400" />
                Griglia Oraria
              </h4>
              <UButton size="xs" color="gray" variant="soft" icon="i-heroicons-plus" @click="openLezioneRapida(giorno.dateStr)">
                Aggiungi Tutor in questo giorno
              </UButton>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr class="bg-sky-50">
                    <th class="py-3.5 px-5 text-xs font-bold text-sky-700 border-r-2 border-slate-300 border-b-2 border-sky-200 w-48 uppercase tracking-wider sticky left-0 z-20 bg-sky-50">Tutor</th>
                    <th v-for="slot in getActiveSlotsForDay(giorno)" :key="slot.id" class="py-3.5 px-2 text-xs font-bold text-sky-700 text-center border-l-2 border-b-2 border-sky-200 min-w-[150px] uppercase tracking-wider">
                      {{ slot.label }}
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white">
                  <tr v-for="tutorData in giorno.tutorsRecap" :key="tutorData.tutor.id" class="border-t-2 border-slate-200 first:border-t-0 hover:bg-slate-50/60 transition-colors">
                    <!-- Colonna tutor: neutra, in grassetto, fissa allo scorrimento -->
                    <td class="py-3 px-5 text-sm font-semibold text-slate-800 border-r-2 border-slate-300 sticky left-0 z-10 bg-white">
                      <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-slate-100 text-slate-600">
                          {{ tutorData.tutor.firstName.charAt(0) }}{{ tutorData.tutor.lastName.charAt(0) }}
                        </div>
                        <span class="truncate">{{ tutorData.tutor.firstName }} {{ tutorData.tutor.lastName.charAt(0) }}.</span>
                      </div>
                    </td>

                    <td
                      v-for="slot in getActiveSlotsForDay(giorno)"
                      :key="slot.id"
                      class="p-0 border-l-2 border-slate-200 relative cursor-pointer hover:bg-sky-100/60 transition-colors group align-top"
                      :class="getStudentsInSlot(giorno, tutorData.tutor.id, slot.id).length > 0 ? 'bg-sky-50/60' : ''"
                      @click="openGestisciSlot(giorno.dateStr, tutorData.tutor.id, tutorData.tutor.firstName + ' ' + tutorData.tutor.lastName, slot)"
                    >
                      <!-- Cella piena: targhette studenti neutre, in fila (vanno a capo da sole) -->
                      <div v-if="getStudentsInSlot(giorno, tutorData.tutor.id, slot.id).length > 0" class="min-h-[52px] p-2.5 flex flex-wrap gap-2 items-start content-start">
                        <div
                          v-for="stu in getStudentsInSlot(giorno, tutorData.tutor.id, slot.id)"
                          :key="stu.id"
                          class="text-xs font-semibold rounded-lg px-2.5 py-1 shadow-sm ring-1 ring-slate-300 bg-white text-slate-700 inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <span>{{ stu.firstName || '?' }} {{ stu.lastName ? stu.lastName.charAt(0) + '.' : '' }}</span>
                          <span v-if="stu.mezzaLezione" class="font-bold text-amber-600" title="Mezza Lezione">½</span>
                        </div>
                      </div>
                      <!-- Cella vuota -->
                      <div v-else class="min-h-[52px] flex items-center justify-center text-slate-200 group-hover:text-primary-400 transition-colors">
                        <UIcon name="i-heroicons-plus" class="w-5 h-5 opacity-0 group-hover:opacity-100" />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="py-16 text-center bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm flex flex-col items-center">
      <UIcon name="i-heroicons-calendar" class="w-16 h-16 text-slate-300 mb-4" />
      <h3 class="text-lg font-bold text-slate-700">Nessuna lezione trovata</h3>
      <p class="text-slate-500 mt-1 max-w-sm">In questo mese non sono presenti lezioni programmate, oppure sono state filtrate.</p>
      <UButton color="primary" variant="soft" icon="i-heroicons-plus" class="mt-6" @click="openNuovaLezione">
        Crea la prima lezione
      </UButton>
    </div>

    <!-- Modali -->
    <ModalNuovaLezione v-model:open="modaleNuovaAperto" @refresh="refreshData" />
    
    <ModalLezioneRapida 
      v-if="modaleRapidaData"
      v-model:open="modaleRapidaAperto" 
      :date="modaleRapidaData" 
      @refresh="refreshData" 
    />
    
    <ModalGestisciSlot
      v-if="modaleGestisciProps"
      v-model:open="modaleGestisciAperto"
      v-bind="modaleGestisciProps"
      @refresh="refreshData"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isSameDay, getDaysInMonth, setDate } from 'date-fns'
import { it } from 'date-fns/locale'
import { corsiaTutor } from '~/utils/coloriTutor'
import { coloreGiorno } from '~/utils/coloreGiorno'
import ModalNuovaLezione from '~/components/calendario/ModalNuovaLezione.vue'
import ModalLezioneRapida from '~/components/calendario/ModalLezioneRapida.vue'
import ModalGestisciSlot from '~/components/calendario/ModalGestisciSlot.vue'

definePageMeta({ middleware: ['admin-or-super'] })

// ==========================================
// STATE
// ==========================================
const currentDate = ref(new Date())

// Oggi parte già espanso (atterraggio diretto sulla griglia di oggi).
const expandedDays = ref<Set<string>>(new Set([format(new Date(), 'yyyy-MM-dd')]))
const allExpanded = ref(false)
const filtroTutor = ref<any>(null)

// ==========================================
// DATA FETCHING
// ==========================================
const dateInizio = computed(() => format(startOfMonth(currentDate.value), 'yyyy-MM-dd'))
const dateFine = computed(() => format(endOfMonth(currentDate.value), 'yyyy-MM-dd'))

const { data: timeslotsRes } = useFetch('/api/settings/timeslots', { lazy: true })
const timeSlots = computed(() => {
  return (timeslotsRes.value || []).map((s: any) => ({
    id: s.id,
    start: s.oraInizio,
    end: s.oraFine,
    label: `${s.oraInizio.substring(0,5)}-${s.oraFine.substring(0,5)}`
  }))
})

const { data: closuresRes } = useFetch('/api/settings/closures', { lazy: true })
const dateChiusure = computed(() => {
  return (closuresRes.value || []).map((c: any) => c.data)
})

const STANDARD_SLOTS = ['15:30', '16:30', '17:30']

const { data: tutorsRes } = useFetch('/api/tutors?active=true', { lazy: true })
const tutorsOptions = computed(() => {
  return (tutorsRes.value?.data || []).map((t: any) => ({
    label: `${t.firstName} ${t.lastName}`,
    value: t.id
  }))
})

const { data: lezioniRes, pending, refresh } = useFetch('/api/lessons', {
  lazy: true,
  query: computed(() => {
    const q: any = { dataInizio: dateInizio.value, dataFine: dateFine.value, limit: 500 }
    if (filtroTutor.value?.value) q.tutorId = filtroTutor.value.value
    return q
  }),
  watch: [currentDate, filtroTutor]
})

function refreshData() {
  refresh()
}

// ==========================================
// COMPUTED MESE
// ==========================================
const nomeMeseAnno = computed(() => format(currentDate.value, 'MMMM yyyy', { locale: it }))

const giorniDelMese = computed(() => {
  const days = []
  const numDays = getDaysInMonth(currentDate.value)
  for (let i = 1; i <= numDays; i++) {
    const d = setDate(currentDate.value, i)
    days.push(format(d, 'yyyy-MM-dd'))
  }
  return days
})

const giorniWithTutorRecap = computed(() => {
  const lezioni = lezioniRes.value?.data || []

  return giorniDelMese.value.map(dateStr => {
    // Filtra lezioni per questo giorno
    const lezioniGiorno = lezioni.filter((l: any) => l.data.startsWith(dateStr))
    
    // Raggruppa per tutor
    const tutorsMap = new Map()
    lezioniGiorno.forEach((lezione: any) => {
      const tId = lezione.tutorId
      if (!tutorsMap.has(tId)) {
        tutorsMap.set(tId, {
          tutor: { ...lezione.tutor, id: tId },
          lezioni: [],
          studentiUnici: new Set()
        })
      }
      
      const tData = tutorsMap.get(tId)
      tData.lezioni.push(lezione)
      lezione.lessonStudents?.forEach((ls: any) => tData.studentiUnici.add(ls.studentId))
    })

    const tutorsRecap = Array.from(tutorsMap.values()).map(tData => ({
      tutor: tData.tutor,
      numeroLezioni: tData.lezioni.length,
      numeroStudenti: tData.studentiUnici.size,
      lezioni: tData.lezioni,
      colore: corsiaTutor(tData.tutor.id)
    }))

    // Calcolo totali giorno + RICAVO STIMATO (ipotetico)
    // ricavo = Σ lezioni [ Σ alunni (prezzo÷ore × ore scalate) − compenso tutor ]
    let totalLez = 0
    let studentiUniciGiorno = new Set()
    let ricavoGiorno = 0
    lezioniGiorno.forEach((l: any) => {
      totalLez++
      let incasso = 0
      l.lessonStudents?.forEach((ls: any) => {
        studentiUniciGiorno.add(ls.studentId)
        const prezzo = parseFloat(ls.package?.prezzoTotale ?? '0')
        const ore = parseFloat(ls.package?.oreAcquistate ?? '0')
        const costoOrario = ore > 0 ? prezzo / ore : 0
        const oreScalate = parseFloat(ls.oreScalate ?? '1')
        incasso += costoOrario * oreScalate
      })
      ricavoGiorno += incasso - parseFloat(l.compensoTutor ?? '0')
    })

    const dateObj = new Date(dateStr)
    return {
      dateStr,
      giornoNumero: format(dateObj, 'd'),
      giornoNomeCorto: format(dateObj, 'EEE', { locale: it }),
      giornoNomeLungo: format(dateObj, 'EEEE', { locale: it }),
      numeroLezioni: totalLez,
      numeroStudenti: studentiUniciGiorno.size,
      ricavo: Number(ricavoGiorno.toFixed(2)),
      tutorsRecap,
      lezioniBase: lezioniGiorno,
      isDomenica: dateObj.getDay() === 0,
      isChiusura: dateChiusure.value.includes(dateStr),
      tema: coloreGiorno(dateStr)
    }
  })
})

const giorniVisibili = computed(() => {
  return giorniWithTutorRecap.value.filter(g => {
    // Oggi è SEMPRE visibile, anche se vuoto / domenica / chiusura.
    if (isToday(g.dateStr)) return true
    if (g.isDomenica) return false
    if (g.isChiusura) return false
    if (g.lezioniBase.length === 0) return false
    return true
  })
})

// ==========================================
// NAVIGATION
// ==========================================
function previousMonth() { currentDate.value = subMonths(currentDate.value, 1) }
function nextMonth() { currentDate.value = addMonths(currentDate.value, 1) }
function goToToday() { currentDate.value = new Date() }
function isToday(dateStr: string) { return isSameDay(new Date(dateStr), new Date()) }

// ==========================================
// ESPANSIONE GIORNI
// ==========================================
function toggleDay(dateStr: string) {
  const newSet = new Set(expandedDays.value)
  if (newSet.has(dateStr)) newSet.delete(dateStr)
  else newSet.add(dateStr)
  expandedDays.value = newSet
}

function isDayExpanded(dateStr: string) {
  // Per default, apri oggi. Oppure se esplicitamente nel set.
  if (expandedDays.value.has(dateStr)) return true
  // if (isToday(dateStr) && !allExpanded.value) return true // Opzionale auto-expand oggi
  return false
}

function toggleAllDays() {
  if (allExpanded.value) {
    expandedDays.value = new Set()
  } else {
    expandedDays.value = new Set(giorniDelMese.value)
  }
  allExpanded.value = !allExpanded.value
}

// ==========================================
// LOGICA GRIGLIA
// ==========================================
function getActiveSlotsForDay(giorno: any) {
  if (giorno.lezioniBase.length === 0) {
    return timeSlots.value.filter(s => STANDARD_SLOTS.includes(s.start))
  }
  const usedIds = new Set(giorno.lezioniBase.map((l: any) => l.timeSlotId))
  return timeSlots.value.filter(s => STANDARD_SLOTS.includes(s.start) || usedIds.has(s.id))
}

function getStudentsInSlot(giorno: any, tutorId: string, slotId: string) {
  const lessons = giorno.lezioniBase.filter((l: any) => l.tutorId === tutorId && l.timeSlotId === slotId)
  const studentsMap = new Map()
  
  lessons.forEach((l: any) => {
    l.lessonStudents?.forEach((ls: any) => {
      if (!studentsMap.has(ls.studentId)) {
        studentsMap.set(ls.studentId, {
          id: ls.studentId,
          firstName: ls.student?.firstName,
          lastName: ls.student?.lastName,
          mezzaLezione: ls.mezzaLezione
        })
      }
    })
  })
  
  return Array.from(studentsMap.values())
}

// ==========================================
// MODALI
// ==========================================
const modaleNuovaAperto = ref(false)
function openNuovaLezione() {
  modaleNuovaAperto.value = true
}

const modaleRapidaAperto = ref(false)
const modaleRapidaData = ref<string | null>(null)
function openLezioneRapida(dateStr: string) {
  modaleRapidaData.value = dateStr
  modaleRapidaAperto.value = true
}

const modaleGestisciAperto = ref(false)
const modaleGestisciProps = ref<any>(null)
function openGestisciSlot(dateStr: string, tutorId: string | null, tutorName: string | null, slot: any) {
  if (!tutorId) {
    // Se clicco su una cella vuota della riga "placeholder" apro il modale rapida
    openLezioneRapida(dateStr)
    return
  }
  
  const giorno = giorniWithTutorRecap.value.find(g => g.dateStr === dateStr)
  const existingLessonsInSlot = giorno?.lezioniBase.filter((l: any) => l.tutorId === tutorId && l.timeSlotId === slot.id) || []

  modaleGestisciProps.value = {
    date: dateStr,
    tutorId,
    tutorName,
    timeSlotId: slot.id,
    slotStart: slot.start.substring(0,5),
    slotEnd: slot.end.substring(0,5),
    existingLessonsInSlot
  }
  modaleGestisciAperto.value = true
}
</script>
