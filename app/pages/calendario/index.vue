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
          <UButton color="neutral" variant="ghost" icon="i-heroicons-chevron-left" @click="previousMonth" />
          <div class="flex flex-col items-center min-w-[140px] px-2">
            <span class="text-sm font-semibold text-slate-800 capitalize">{{ nomeMeseAnno }}</span>
            <UButton size="xs" variant="link" color="primary" @click="goToToday" :padded="false" class="mt-0.5">Torna a Oggi</UButton>
          </div>
          <UButton color="neutral" variant="ghost" icon="i-heroicons-chevron-right" @click="nextMonth" />
        </div>
        <UButton color="neutral" variant="outline" icon="i-heroicons-bolt" @click="openLezioneRapida(format(currentDate, 'yyyy-MM-dd'))">
          Lezione rapida
        </UButton>
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
      <UButton color="neutral" variant="soft" :icon="allExpanded ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'" @click="toggleAllDays" class="w-full sm:w-auto justify-center">
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
              color="neutral"
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
              <UButton color="neutral" variant="soft" icon="i-heroicons-queue-list" @click="openNuovaLezione">Creazione multipla</UButton>
            </div>
          </div>

          <!-- Caso: griglia oraria normale -->
          <div v-else class="bg-slate-50/30">
            <div class="p-4 flex items-center justify-between border-b border-slate-100 bg-white">
              <h4 class="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 text-slate-400" />
                Griglia Oraria
              </h4>
              <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-plus" @click="openLezioneRapida(giorno.dateStr)">
                Aggiungi Tutor in questo giorno
              </UButton>
            </div>

            <div class="overflow-x-auto pb-4 px-4 pt-4">
              <div class="flex gap-3 items-start" style="min-width: max-content;">

                <!-- Card per ogni tutor -->
                <div v-for="tutorData in giorno.tutorsRecap" :key="tutorData.tutor.id"
                     class="flex-none w-72 bg-slate-50/70 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">

                  <!-- Header card tutor -->
                  <div class="flex items-center gap-2.5 px-3 py-3 border-b border-slate-200 bg-white">
                    <div class="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {{ tutorData.tutor.firstName.charAt(0) }}{{ tutorData.tutor.lastName.charAt(0) }}
                    </div>
                    <div class="min-w-0">
                      <div class="text-sm font-semibold text-slate-800 truncate">{{ tutorData.tutor.firstName }} {{ tutorData.tutor.lastName }}</div>
                      <div class="text-xs text-slate-400">{{ getActiveSlotsForDay(giorno).length }} slot</div>
                    </div>
                  </div>

                  <!-- Bande slot -->
                  <div class="flex flex-col gap-2 p-2.5">
                    <div v-for="slot in getActiveSlotsForDay(giorno)" :key="slot.id"
                         class="border rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-sm"
                         :class="getStudentsInSlot(giorno, tutorData.tutor.id, slot.id).length > 0
                           ? coloreBandaSlot(tipoLezioneSlot(giorno, tutorData.tutor.id, slot.id))
                           : 'border-slate-200 bg-white hover:border-primary-300'"
                         @click="openGestisciSlot(giorno.dateStr, tutorData.tutor.id, tutorData.tutor.firstName + ' ' + tutorData.tutor.lastName, slot)">

                      <!-- Header banda -->
                      <div class="flex items-center justify-between px-2.5 py-1.5 bg-white/60">
                        <span class="text-xs font-bold text-slate-600 font-mono">{{ slot.label }}</span>
                        <span v-if="getStudentsInSlot(giorno, tutorData.tutor.id, slot.id).length > 0"
                              class="text-[10px] font-bold uppercase tracking-wider"
                              :class="labelColoreTipo(tipoLezioneSlot(giorno, tutorData.tutor.id, slot.id))">
                          {{ tipoLezioneSlot(giorno, tutorData.tutor.id, slot.id) }}
                        </span>
                      </div>

                      <!-- Corpo banda: studenti o "+aggiungi" -->
                      <div v-if="getStudentsInSlot(giorno, tutorData.tutor.id, slot.id).length > 0"
                           class="flex flex-col gap-1 px-2.5 pb-2.5">
                        <span v-for="stu in getStudentsInSlot(giorno, tutorData.tutor.id, slot.id)" :key="stu.id"
                              class="text-xs font-medium text-slate-700 bg-white/80 border border-white rounded-lg px-2 py-1 truncate flex items-center gap-1">
                          {{ stu.firstName || '?' }} {{ stu.lastName || '' }}
                          <span v-if="stu.mezzaLezione" class="text-amber-500 font-bold ml-auto">½</span>
                        </span>
                      </div>
                      <div v-else class="px-2.5 pb-2">
                        <div class="w-full py-1.5 border border-dashed border-slate-200 rounded-lg text-center text-xs font-semibold text-slate-300 hover:border-primary-300 hover:text-primary-400 transition-colors">
                          + aggiungi
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Card "+ Tutor" (apre nuova lezione) -->
                <button class="flex-none w-32 min-h-40 self-stretch border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-primary-400 hover:text-primary-500 hover:bg-primary-50 transition-all text-xs font-semibold"
                        @click="openLezioneRapida(giorno.dateStr)">
                  <UIcon name="i-heroicons-plus" class="w-5 h-5" />
                  Tutor
                </button>

              </div>
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
import { ref, computed, onMounted } from 'vue'
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

// Deep-link: /calendario?data=YYYY-MM-DD apre il mese giusto e il giorno
const route = useRoute()
onMounted(() => {
  const dataParam = route.query.data as string | undefined
  if (dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
    // Costruisco la data in orario LOCALE (non UTC) per evitare che il giorno slitti
    const [y, m, gg] = dataParam.split('-').map(Number) as [number, number, number]
    const d = new Date(y, m - 1, gg)
    if (!isNaN(d.getTime())) {
      currentDate.value = d
      expandedDays.value = new Set([dataParam])
    }
  }
})

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

const standardSlotStarts = computed(() => timeSlots.value.map((s: any) => s.start))

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
    return timeSlots.value.filter(s => standardSlotStarts.value.includes(s.start))
  }
  const usedIds = new Set(giorno.lezioniBase.map((l: any) => l.timeSlotId))
  return timeSlots.value.filter(s => standardSlotStarts.value.includes(s.start) || usedIds.has(s.id))
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

function tipoLezioneSlot(giorno: any, tutorId: string, slotId: string): string {
  const stus = getStudentsInSlot(giorno, tutorId, slotId)
  if (stus.length === 0) return ''
  for (const lesson of giorno.lezioniBase || []) {
    if (lesson.tutorId === tutorId && lesson.timeSlotId === slotId) {
      if (lesson.tipo) return lesson.tipo
    }
  }
  if (stus.length === 1) return 'SINGOLA'
  if (stus.length <= 3) return 'GRUPPO'
  return 'MAXI'
}

function coloreBandaSlot(tipo: string): string {
  if (tipo === 'GRUPPO') return 'border border-l-4 border-primary-200 border-l-primary-400 bg-primary-50/60 hover:border-l-primary-500'
  if (tipo === 'MAXI')   return 'border border-l-4 border-amber-200 border-l-amber-400 bg-amber-50/60 hover:border-l-amber-500'
  // SINGOLA
  return 'border border-l-4 border-slate-200 border-l-slate-400 bg-slate-50/80 hover:border-l-slate-500'
}

function labelColoreTipo(tipo: string): string {
  if (tipo === 'GRUPPO') return 'text-primary-500'
  if (tipo === 'MAXI')   return 'text-amber-500'
  return 'text-slate-400'
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
