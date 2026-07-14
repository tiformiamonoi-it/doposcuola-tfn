<template>
  <div class="grid grid-cols-1 lg:grid-cols-10 gap-6">

    <!-- ═══ Colonna sinistra (70%) — Calendario ═══ -->
    <div class="lg:col-span-7 space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-slate-900">Il mio Calendario</h2>
          <p class="text-sm text-slate-500 mt-0.5">Le tue lezioni — registra quelle di oggi entro le 20:00</p>
        </div>
        <div class="flex gap-2">
          <UButton to="/area-tutor" icon="i-heroicons-check-circle" variant="soft" size="sm">Disponibilità</UButton>
          <UButton to="/area-tutor/cronologia" icon="i-heroicons-document-text" variant="soft" size="sm">Cronologia Note</UButton>
          <UButton to="/stampe/tutor-lezioni" icon="i-heroicons-printer" variant="soft" size="sm">Stampa</UButton>
        </div>

        <div class="flex items-center bg-white rounded-xl ring-1 ring-slate-200 shadow-sm p-1">
          <UButton color="gray" variant="ghost" icon="i-heroicons-chevron-left" @click="previousMonth" />
          <div class="flex flex-col items-center min-w-[140px] px-2">
            <span class="text-sm font-semibold text-slate-800 capitalize">{{ nomeMeseAnno }}</span>
            <UButton size="2xs" variant="link" color="primary" @click="goToToday" :padded="false" class="mt-0.5">Torna a Oggi</UButton>
          </div>
          <UButton color="gray" variant="ghost" icon="i-heroicons-chevron-right" @click="nextMonth" />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="pending" class="py-12 flex justify-center bg-white rounded-2xl border border-slate-200">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-slate-300 animate-spin" />
      </div>

      <!-- Lista giorni -->
      <div v-else-if="giorniVisibili.length > 0" class="space-y-5">
        <div
          v-for="giorno in giorniVisibili"
          :key="giorno.dateStr"
          class="bg-white rounded-2xl ring-1 ring-slate-200 shadow-md overflow-hidden transition-all duration-200 border-l-4"
          :class="isToday(giorno.dateStr) ? 'ring-2 ring-primary-500 shadow-lg border-l-primary-500' : 'border-l-transparent'"
        >
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer transition-colors gap-4"
            :class="isToday(giorno.dateStr) ? 'bg-primary-50/40' : 'hover:bg-slate-50'"
            @click="toggleDay(giorno.dateStr)"
          >
            <div class="flex items-center gap-4">
              <div
                class="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ring-1"
                :class="isToday(giorno.dateStr) ? 'bg-primary-100 text-primary-700 ring-primary-300' : 'bg-sky-50 text-sky-700 ring-sky-200'"
              >
                <span class="text-xl font-bold leading-none">{{ giorno.giornoNumero }}</span>
                <span class="text-[10px] font-semibold uppercase tracking-wider mt-1">{{ giorno.giornoNomeCorto }}</span>
              </div>
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
            <UButton color="gray" variant="ghost" :icon="isDayExpanded(giorno.dateStr) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="pointer-events-none" />
          </div>

          <div v-if="isDayExpanded(giorno.dateStr)" class="border-t border-slate-100">
            <div v-if="giorno.numeroLezioni === 0" class="p-10 text-center flex flex-col items-center bg-slate-50/30">
              <div class="w-14 h-14 rounded-2xl bg-primary-50 text-primary-500 flex items-center justify-center mb-3">
                <UIcon name="i-heroicons-sparkles" class="w-7 h-7" />
              </div>
              <h4 class="text-base font-semibold text-slate-700">
                {{ isToday(giorno.dateStr) ? 'Nessuna lezione ancora registrata per oggi' : 'Nessuna lezione in questo giorno' }}
              </h4>
              <UButton
                v-if="isToday(giorno.dateStr) && entroOrario"
                color="primary" icon="i-heroicons-plus" class="mt-5"
                @click="openLezioneRapida(giorno.dateStr)"
              >
                Registra una lezione
              </UButton>
              <p v-else-if="isToday(giorno.dateStr)" class="text-sm text-amber-600 mt-3">
                Sono passate le 20:00: non puoi più registrare lezioni per oggi.
              </p>
            </div>

            <div v-else class="bg-slate-50/30">
              <div class="p-4 flex items-center justify-between border-b border-slate-100 bg-white">
                <h4 class="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 text-slate-400" />
                  Griglia Oraria
                </h4>
                <UButton v-if="isToday(giorno.dateStr) && entroOrario" size="xs" color="gray" variant="soft" icon="i-heroicons-plus" @click="openLezioneRapida(giorno.dateStr)">
                  Aggiungi lezione
                </UButton>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse min-w-[400px]">
                  <thead>
                    <tr class="bg-sky-50">
                      <th v-for="slot in getActiveSlotsForDay(giorno)" :key="slot.id" class="py-3.5 px-2 text-xs font-bold text-sky-700 text-center border-b-2 border-sky-200 min-w-[150px] uppercase tracking-wider">
                        {{ slot.label }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white">
                    <tr>
                      <td
                        v-for="slot in getActiveSlotsForDay(giorno)"
                        :key="slot.id"
                        class="p-0 border-l-2 border-slate-200 relative align-top"
                        :class="[
                          getStudentsInSlot(giorno, slot.id).length > 0 ? 'bg-sky-50/60' : '',
                          isToday(giorno.dateStr) && entroOrario ? 'cursor-pointer hover:bg-sky-100/60 transition-colors group' : ''
                        ]"
                        @click="isToday(giorno.dateStr) && entroOrario ? openGestisciSlot(giorno.dateStr, slot) : null"
                      >
                        <div v-if="getStudentsInSlot(giorno, slot.id).length > 0" class="min-h-[52px] p-2.5 flex flex-wrap gap-2 items-start content-start">
                          <div
                            v-for="stu in getStudentsInSlot(giorno, slot.id)"
                            :key="stu.id"
                            class="text-xs font-semibold rounded-lg px-2.5 py-1 shadow-sm ring-1 ring-slate-300 bg-white text-slate-700 inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <span>{{ stu.firstName || '?' }} {{ stu.lastName ? stu.lastName.charAt(0) + '.' : '' }}</span>
                          </div>
                        </div>
                        <div v-else class="min-h-[52px] flex items-center justify-center text-slate-200 group-hover:text-primary-400 transition-colors">
                          <UIcon v-if="isToday(giorno.dateStr) && entroOrario" name="i-heroicons-plus" class="w-5 h-5 opacity-0 group-hover:opacity-100" />
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

      <div v-else class="py-16 text-center bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm flex flex-col items-center">
        <UIcon name="i-heroicons-calendar" class="w-16 h-16 text-slate-300 mb-4" />
        <h3 class="text-lg font-bold text-slate-700">Nessuna lezione trovata</h3>
        <p class="text-slate-500 mt-1 max-w-sm">In questo mese non ci sono lezioni registrate.</p>
      </div>
    </div>

    <!-- ═══ Colonna destra (30%) — Nota Studente, sticky ═══ -->
    <div class="lg:col-span-3">
      <div class="sticky top-6">
        <UCard>
          <template #header>
            <h2 class="font-semibold text-slate-800">Nuova Nota Studente</h2>
            <p class="text-xs text-slate-500 font-normal">Aggiungi un commento su un alunno.</p>
          </template>

          <UForm :state="notaState" class="space-y-4" @submit="salvaNota">
            <UFormField label="Studente" required>
              <USelectMenu
                v-model="notaState.studentId"
                :items="studentsOptionsNota"
                searchable
                placeholder="Cerca studente..."
                value-key="value"
                label-key="label"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Visibilità" required>
              <URadioGroup
                v-model="notaState.visibilita"
                :items="[{ label: 'Interna (Solo Staff)', value: 'INTERNA' }, { label: 'Famiglia (Visibile ai genitori)', value: 'FAMIGLIA' }]"
              />
            </UFormField>

            <UFormField label="Contenuto della nota" required>
              <UTextarea v-model="notaState.contenuto" :rows="4" placeholder="Scrivi qui..." />
            </UFormField>

            <div class="flex justify-end pt-2">
              <UButton type="submit" icon="i-heroicons-paper-airplane" :loading="salvandoNota">Salva Nota</UButton>
            </div>
          </UForm>
        </UCard>
      </div>
    </div>

    <!-- Modali -->
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

definePageMeta({ middleware: ['tutor-only'] })
useHead({ title: 'Il mio Calendario — Ti Formiamo Noi' })

const { user } = useUserSession()
const toast = useToast()

// ==========================================
// Finestra oraria (solo per la UI — la verità è sempre lato server)
// ==========================================
const entroOrario = ref(true)
function aggiornaEntroOrario() {
  const oraRome = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(new Date())
  entroOrario.value = parseInt(oraRome, 10) < 20
}
aggiornaEntroOrario()
setInterval(aggiornaEntroOrario, 60_000)

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
    label: `${s.oraInizio.substring(0,5)}-${s.oraFine.substring(0,5)}`
  }))
})

const standardSlotStarts = computed(() => timeSlots.value.map((s: any) => s.start))

const { data: lezioniRes, pending, refresh } = useFetch('/api/lessons', {
  lazy: true,
  query: computed(() => ({ dataInizio: dateInizio.value, dataFine: dateFine.value, limit: 500 })),
  watch: [currentDate],
})

const { data: poolOggi, refresh: refreshPool } = useFetch<{ studentId: string; nome: string; materia: string }[]>('/api/tutors/today-pool', {
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

const giorniVisibili = computed(() => {
  return giorniConDati.value.filter(g => isToday(g.dateStr) || g.lezioniBase.length > 0)
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
function getActiveSlotsForDay(giorno: any) {
  if (giorno.lezioniBase.length === 0) {
    return timeSlots.value.filter((s: any) => standardSlotStarts.value.includes(s.start))
  }
  const usedIds = new Set(giorno.lezioniBase.map((l: any) => l.timeSlotId))
  return timeSlots.value.filter((s: any) => standardSlotStarts.value.includes(s.start) || usedIds.has(s.id))
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

// ==========================================
// NOTA STUDENTE (spostata da Area Tutor)
// ==========================================
const salvandoNota = ref(false)
const notaState = reactive({
  studentId: '',
  visibilita: 'INTERNA' as 'INTERNA' | 'FAMIGLIA',
  contenuto: ''
})

const { data: studentsRes } = useLazyFetch('/api/students?active=true&limit=1000&light=true')
const studentsOptionsNota = computed(() => {
  return (studentsRes.value?.data || []).map((s: any) => ({
    label: `${s.firstName} ${s.lastName}`,
    value: s.id
  }))
})

async function salvaNota() {
  if (!notaState.studentId || !notaState.contenuto) {
    toast.add({ title: 'Compila tutti i campi', color: 'warning' })
    return
  }
  salvandoNota.value = true
  try {
    const creata: any = await $fetch('/api/notes', { method: 'POST', body: notaState })
    const inAttesa = creata?.visibilita === 'FAMIGLIA' && !creata?.approvataAt
    toast.add({
      title: 'Nota salvata con successo',
      description: inAttesa ? 'Sarà visibile alla famiglia dopo l\'approvazione della segreteria.' : undefined,
      color: 'success'
    })
    notaState.contenuto = ''
    notaState.studentId = ''
  } catch (err) {
    toast.add({ title: 'Errore salvataggio nota', color: 'error' })
  } finally {
    salvandoNota.value = false
  }
}
</script>
