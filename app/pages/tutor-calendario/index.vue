<template>
  <div>
    <PortaleTestata :campanella="false">
      <template #titolo>
        <div class="flex flex-col gap-1.5">
          <h1 class="font-heading font-bold text-[27px] leading-tight">Il mio calendario</h1>
          <p class="text-sm leading-5 text-pf-su-blu">Le tue lezioni. Registra quelle di oggi entro le 20:00.</p>
        </div>
      </template>
      <!-- Il mese: indietro, avanti e "Torna a oggi" -->
      <div class="flex items-center justify-between gap-2 p-1 bg-pf-blu-tasto rounded-[14px]">
        <button type="button" aria-label="Mese precedente" class="size-11 rounded-[11px] flex items-center justify-center hover:bg-pf-blu-scuro" @click="previousMonth">
          <UIcon name="i-heroicons-chevron-left" class="size-5" aria-hidden="true" />
        </button>
        <span class="flex flex-col items-center">
          <span class="font-semibold text-[15px] capitalize" aria-live="polite">{{ nomeMeseAnno }}</span>
          <button type="button" class="min-h-8 px-2 text-xs font-semibold text-pf-su-blu underline underline-offset-2 hover:text-white" @click="goToToday">Torna a oggi</button>
        </span>
        <button type="button" aria-label="Mese successivo" class="size-11 rounded-[11px] flex items-center justify-center hover:bg-pf-blu-scuro" @click="nextMonth">
          <UIcon name="i-heroicons-chevron-right" class="size-5" aria-hidden="true" />
        </button>
      </div>
    </PortaleTestata>

    <!-- Loading -->
    <div v-if="pending" class="mx-5 mt-5 flex flex-col gap-3" aria-busy="true">
      <USkeleton v-for="i in 3" :key="i" class="h-20 w-full rounded-[22px]" />
    </div>

    <!-- Lista giorni: oggi in cima ed espanso -->
    <div v-else-if="giorniVisibili.length > 0" class="mx-5 mt-5 flex flex-col gap-3">
      <section
        v-for="giorno in giorniVisibili"
        :key="giorno.dateStr"
        :aria-label="`${giorno.giornoNomeLungo} ${giorno.giornoNumero}${isToday(giorno.dateStr) ? ', oggi' : ''}`"
        class="bg-white rounded-[22px] overflow-hidden pf-ombra"
        :class="isToday(giorno.dateStr) ? 'ring-2 ring-pf-blu' : ''"
      >
        <button
          type="button"
          class="w-full min-h-[72px] p-3.5 flex items-center gap-3.5 text-left hover:bg-pf-fondo transition-colors"
          :aria-expanded="isDayExpanded(giorno.dateStr)"
          :aria-controls="`giorno-${giorno.dateStr}`"
          @click="toggleDay(giorno.dateStr)"
        >
          <span
            class="size-14 shrink-0 rounded-2xl flex flex-col items-center justify-center"
            :class="isToday(giorno.dateStr) ? 'bg-pf-blu text-white' : 'bg-pf-celeste text-pf-blu-scuro'"
          >
            <span class="text-xl font-bold leading-none">{{ giorno.giornoNumero }}</span>
            <span class="text-[10px] font-semibold uppercase tracking-wider mt-1">{{ giorno.giornoNomeCorto }}</span>
          </span>
          <span class="flex-1 min-w-0 flex flex-col gap-1">
            <span class="flex items-center gap-2">
              <span class="font-semibold text-base capitalize">{{ giorno.giornoNomeLungo }}</span>
              <span v-if="isToday(giorno.dateStr)" class="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-pf-giallo text-pf-giallo-testo">Oggi</span>
            </span>
            <span class="text-[13px] text-pf-grigio-scuro">
              <strong class="text-pf-testo">{{ giorno.numeroLezioni }}</strong> lezioni · <strong class="text-pf-testo">{{ giorno.numeroStudenti }}</strong> studenti
            </span>
          </span>
          <UIcon :name="isDayExpanded(giorno.dateStr) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="size-5 shrink-0 text-pf-grigio" aria-hidden="true" />
        </button>

        <div v-if="isDayExpanded(giorno.dateStr)" :id="`giorno-${giorno.dateStr}`" class="border-t border-pf-bordo">
          <div v-if="giorno.numeroLezioni === 0" class="p-6 text-center flex flex-col items-center gap-3">
            <img src="/portale/calendario.webp" alt="" class="size-14 object-contain" />
            <p class="font-semibold text-[15px]">
              {{ isToday(giorno.dateStr) ? 'Nessuna lezione ancora registrata per oggi' : 'Nessuna lezione in questo giorno' }}
            </p>
            <PortaleBottone v-if="isToday(giorno.dateStr) && entroOrario" @click="openLezioneRapida(giorno.dateStr)">
              <UIcon name="i-heroicons-plus" class="size-5" aria-hidden="true" />
              Registra una lezione
            </PortaleBottone>
            <p v-else-if="isToday(giorno.dateStr)" class="text-sm text-pf-crema-testo bg-pf-crema rounded-xl px-3 py-2">
              Sono passate le 20:00: non puoi più registrare lezioni per oggi.
            </p>
          </div>

          <div v-else>
            <div class="px-4 py-3 flex items-center justify-between gap-3">
              <h3 class="text-sm font-semibold">Griglia oraria</h3>
              <PortaleBottone v-if="isToday(giorno.dateStr) && entroOrario" variante="chiaro" piccolo @click="openLezioneRapida(giorno.dateStr)">
                <UIcon name="i-heroicons-plus" class="size-4" aria-hidden="true" />
                Aggiungi lezione
              </PortaleBottone>
            </div>

            <!-- Le fasce in colonna: la tabella scorre di lato, la pagina no -->
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse min-w-[400px]">
                <thead>
                  <tr class="bg-pf-celeste">
                    <th v-for="slot in getActiveSlotsForDay(giorno)" :key="slot.id" scope="col" class="py-3 px-2 text-xs font-bold text-pf-blu-scuro text-center min-w-[150px]">
                      {{ slot.label }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      v-for="slot in getActiveSlotsForDay(giorno)"
                      :key="slot.id"
                      class="p-1.5 border-l border-pf-bordo first:border-l-0 align-top"
                    >
                      <!-- Oggi entro le 20:00 la fascia è un bottone: apre la finestra per gestirla -->
                      <button
                        v-if="isToday(giorno.dateStr) && entroOrario"
                        type="button"
                        class="w-full min-h-[52px] p-2 rounded-xl flex flex-wrap gap-1.5 items-start content-start transition-colors"
                        :class="getStudentsInSlot(giorno, slot.id).length > 0 ? 'bg-pf-fondo hover:bg-pf-celeste' : 'border border-dashed border-pf-grigio/50 justify-center items-center text-pf-blu hover:bg-pf-celeste'"
                        :aria-label="getStudentsInSlot(giorno, slot.id).length > 0
                          ? `Gestisci la fascia ${slot.label}: ${nomiInSlot(giorno, slot.id)}`
                          : `Fascia ${slot.label} vuota: aggiungi un alunno`"
                        @click="openGestisciSlot(giorno.dateStr, slot)"
                      >
                        <span v-for="stu in getStudentsInSlot(giorno, slot.id)" :key="stu.id" :class="CHIP">{{ nomeBreve(stu) }}</span>
                        <UIcon v-if="getStudentsInSlot(giorno, slot.id).length === 0" name="i-heroicons-plus" class="size-5" aria-hidden="true" />
                      </button>
                      <div v-else class="min-h-[52px] p-2 flex flex-wrap gap-1.5 items-start content-start">
                        <span v-for="stu in getStudentsInSlot(giorno, slot.id)" :key="stu.id" :class="CHIP">{{ nomeBreve(stu) }}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="isToday(giorno.dateStr) && entroOrario" class="px-4 py-3 text-[13px] leading-[18px] text-pf-grigio">
              Tocca una fascia per aggiungere o togliere alunni. Scorri di lato per le altre fasce.
            </p>
          </div>
        </div>
      </section>
    </div>

    <div v-else class="mx-5 mt-5 bg-white rounded-3xl p-6 text-center flex flex-col items-center gap-2 pf-ombra">
      <img src="/portale/calendario.webp" alt="" class="size-16 object-contain" />
      <p class="font-semibold">Nessuna lezione trovata</p>
      <p class="text-sm text-pf-grigio">In questo mese non ci sono lezioni registrate.</p>
    </div>

    <!-- Disponibilità e stampa -->
    <nav aria-label="Altro" class="mx-5 mt-5 bg-white rounded-[22px] pf-ombra divide-y divide-pf-fondo overflow-hidden">
      <NuxtLink to="/area-tutor/disponibilita" class="min-h-14 px-4 flex items-center gap-3 text-[15px] font-medium text-pf-testo hover:bg-pf-fondo">
        <span class="flex-1">La mia disponibilità</span>
        <UIcon name="i-heroicons-chevron-right" class="size-4 text-pf-grigio" aria-hidden="true" />
      </NuxtLink>
      <!-- Nell'app niente "Stampa": il WebView di Android ignora window.print(), il tasto non farebbe nulla -->
      <NuxtLink v-if="!inApp" to="/stampe/tutor-lezioni" class="min-h-14 px-4 flex items-center gap-3 text-[15px] font-medium text-pf-testo hover:bg-pf-fondo">
        <span class="flex-1">Stampa le mie lezioni</span>
        <UIcon name="i-heroicons-printer" class="size-4 text-pf-grigio" aria-hidden="true" />
      </NuxtLink>
    </nav>

    <!-- Modali (le finestre di sempre, non cambiano) -->
    <ModalLezioneRapida
      v-if="modaleRapidaData"
      v-model:open="modaleRapidaAperto"
      :date="modaleRapidaData"
      :locked-tutor-id="user?.id"
      :locked-tutor-name="`${user?.firstName} ${user?.lastName}`"
      :students-pool="poolOggi"
      @refresh="refreshData"
    />

    <ModalGestisciSlot
      v-if="modaleGestisciProps"
      v-model:open="modaleGestisciAperto"
      v-bind="modaleGestisciProps"
      :students-pool="poolOggi"
      @refresh="refreshData"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isSameDay, getDaysInMonth, setDate } from 'date-fns'
import { it } from 'date-fns/locale'
import ModalLezioneRapida from '~/components/calendario/ModalLezioneRapida.vue'
import ModalGestisciSlot from '~/components/calendario/ModalGestisciSlot.vue'

// La veste è quella dell'area tutor (D3): logica, finestre e orari restano quelli di sempre
definePageMeta({ layout: 'tutor', middleware: ['tutor-only'] })
useHead({ title: 'Il mio Calendario — tiformiamonoi' })

const { user } = useUserSession()
const inApp = useInApp()

// ==========================================
// Finestra oraria (solo per la UI — la verità è sempre lato server)
// ==========================================
const entroOrario = ref(true)
function aggiornaEntroOrario() {
  const oraRome = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(new Date())
  entroOrario.value = parseInt(oraRome, 10) < 20
}
aggiornaEntroOrario()
// Solo nel browser, e si ferma uscendo dalla pagina (con il menu in basso si cambia pagina spesso)
let timerOrario: ReturnType<typeof setInterval> | undefined
onMounted(() => { timerOrario = setInterval(aggiornaEntroOrario, 60_000) })
onBeforeUnmount(() => clearInterval(timerOrario))

// ==========================================
// STATE
// ==========================================
const currentDate = ref(new Date())
const expandedDays = ref<Set<string>>(new Set([format(new Date(), 'yyyy-MM-dd')]))

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
    label: `${s.oraInizio.substring(0,5)}-${s.oraFine.substring(0,5)}`,
    sempreVisibile: s.sempreVisibile
  }))
})

const { data: lezioniRes, pending, refresh } = useFetch('/api/lessons', {
  lazy: true,
  // tutorId: al TUTOR il server lo impone già; il SUPER_TUTOR (nell'app, D2) altrimenti
  // vedrebbe le lezioni di tutti nel "suo" calendario.
  query: computed(() => ({ dataInizio: dateInizio.value, dataFine: dateFine.value, limit: 500, tutorId: user.value?.id })),
  watch: [currentDate],
})

const { data: poolOggi, refresh: refreshPool } = useFetch<{ studentId: string; nome: string; materia: string; classe: string | null }[]>('/api/tutors/today-pool', {
  lazy: true,
  default: () => [],
})

function refreshData() {
  refresh()
  refreshPool()
}

// ==========================================
// COMPUTED MESE
// ==========================================
const nomeMeseAnno = computed(() => format(currentDate.value, 'MMMM yyyy', { locale: it }))

const giorniDelMese = computed(() => {
  const days = []
  const numDays = getDaysInMonth(currentDate.value)
  for (let i = 1; i <= numDays; i++) {
    days.push(format(setDate(currentDate.value, i), 'yyyy-MM-dd'))
  }
  return days
})

const giorniConDati = computed(() => {
  const lezioni = lezioniRes.value?.data || []

  return giorniDelMese.value.map(dateStr => {
    const lezioniGiorno = lezioni.filter((l: any) => l.data.startsWith(dateStr))
    const studentiUnici = new Set<string>()
    lezioniGiorno.forEach((l: any) => l.lessonStudents?.forEach((ls: any) => studentiUnici.add(ls.studentId)))

    const dateObj = new Date(dateStr)
    return {
      dateStr,
      giornoNumero: format(dateObj, 'd'),
      giornoNomeCorto: format(dateObj, 'EEE', { locale: it }),
      giornoNomeLungo: format(dateObj, 'EEEE', { locale: it }),
      numeroLezioni: lezioniGiorno.length,
      numeroStudenti: studentiUnici.size,
      lezioniBase: lezioniGiorno,
    }
  })
})

// Oggi in cima, poi dal giorno più vicino al più lontano (D3)
const giorniVisibili = computed(() => {
  return giorniConDati.value
    .filter(g => isToday(g.dateStr) || g.lezioniBase.length > 0)
    .sort((a, b) => (isToday(a.dateStr) ? -1 : isToday(b.dateStr) ? 1 : b.dateStr.localeCompare(a.dateStr)))
})

// ==========================================
// NAVIGATION
// ==========================================
function previousMonth() { currentDate.value = subMonths(currentDate.value, 1) }
function nextMonth() { currentDate.value = addMonths(currentDate.value, 1) }
function goToToday() { currentDate.value = new Date() }
function isToday(dateStr: string) { return isSameDay(new Date(dateStr), new Date()) }

function toggleDay(dateStr: string) {
  const newSet = new Set(expandedDays.value)
  if (newSet.has(dateStr)) newSet.delete(dateStr)
  else newSet.add(dateStr)
  expandedDays.value = newSet
}
function isDayExpanded(dateStr: string) { return expandedDays.value.has(dateStr) }

// ==========================================
// GRIGLIA
// ==========================================
// Slot standard sempre; gli altri solo se quel giorno hanno lezioni (utils/slotCalendario)
function getActiveSlotsForDay(giorno: any) {
  return slotVisibiliNelGiorno(timeSlots.value, giorno.lezioniBase)
}

function getStudentsInSlot(giorno: any, slotId: string) {
  const lessons = giorno.lezioniBase.filter((l: any) => l.timeSlotId === slotId)
  const studentsMap = new Map()
  lessons.forEach((l: any) => {
    l.lessonStudents?.forEach((ls: any) => {
      if (!studentsMap.has(ls.studentId)) {
        studentsMap.set(ls.studentId, { id: ls.studentId, firstName: ls.student?.firstName, lastName: ls.student?.lastName })
      }
    })
  })
  return Array.from(studentsMap.values())
}

// ==========================================
// MODALI
// ==========================================
const modaleRapidaAperto = ref(false)
const modaleRapidaData = ref<string | null>(null)
function openLezioneRapida(dateStr: string) {
  modaleRapidaData.value = dateStr
  modaleRapidaAperto.value = true
}

const modaleGestisciAperto = ref(false)
const modaleGestisciProps = ref<any>(null)
function openGestisciSlot(dateStr: string, slot: any) {
  if (!user.value) return
  const giorno = giorniConDati.value.find(g => g.dateStr === dateStr)
  const existingLessonsInSlot = giorno?.lezioniBase.filter((l: any) => l.timeSlotId === slot.id) || []

  if (existingLessonsInSlot.length === 0) {
    openLezioneRapida(dateStr)
    return
  }

  modaleGestisciProps.value = {
    date: dateStr,
    tutorId: user.value.id,
    tutorName: `${user.value.firstName} ${user.value.lastName}`,
    timeSlotId: slot.id,
    slotStart: slot.start.substring(0,5),
    slotEnd: slot.end.substring(0,5),
    existingLessonsInSlot,
  }
  modaleGestisciAperto.value = true
}

// Nome e iniziale del cognome, come sempre nella griglia
const CHIP = 'text-xs font-semibold rounded-lg px-2.5 py-1 bg-white ring-1 ring-pf-bordo text-pf-testo whitespace-nowrap'
function nomeBreve(stu: { firstName?: string, lastName?: string }) {
  return `${stu.firstName || '?'} ${stu.lastName ? stu.lastName.charAt(0) + '.' : ''}`.trim()
}
function nomiInSlot(giorno: any, slotId: string) {
  return getStudentsInSlot(giorno, slotId).map(nomeBreve).join(', ')
}

// Il modulo "Nuova nota" ora sta nella pagina Note (/area-tutor/note, linguetta Scrivi)
</script>
