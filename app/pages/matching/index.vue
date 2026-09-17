<template>
  <div class="space-y-4">
    <!-- Intestazione -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Matching Manuale</h1>
        <p class="text-slate-500 text-sm mt-1">
          Trascina un alunno nella casella del tutor, oppure clicca l'alunno e poi la casella.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <UButton color="neutral" variant="outline" icon="i-heroicons-arrow-path" :loading="loading" @click="loadData">
          Aggiorna
        </UButton>
        <!-- Il foglio di stampa è una pagina a sé, in una scheda nuova: A4 orizzontale, un foglio solo -->
        <UButton color="primary" icon="i-heroicons-printer" :to="`/stampe/matching-${dateParam}`" target="_blank">
          Stampa / Salva PDF
        </UButton>
      </div>
    </div>

    <!-- Navigazione tra i giorni -->
    <div class="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-2 py-1.5">
      <UButton icon="i-heroicons-chevron-left" color="neutral" variant="ghost" aria-label="Giorno precedente" @click="cambiaGiorno(-1)" />
      <div class="text-center">
        <div class="font-bold text-slate-900">{{ dataFormattata }}</div>
        <div class="text-xs text-slate-500">{{ tutors.length }} Tutor | {{ badges.length }} Prenotazioni</div>
      </div>
      <UButton icon="i-heroicons-chevron-right" color="neutral" variant="ghost" aria-label="Giorno successivo" @click="cambiaGiorno(1)" />
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin w-8 h-8 text-primary-500" />
    </div>

    <template v-else>
      <!--
        Tabellone e "Da assegnare" alti al massimo quanto lo schermo, uno accanto all'altro:
        l'alunno e la casella dove metterlo si vedono insieme, senza dover scorrere la
        pagina mentre si trascina. Sui telefoni "Da assegnare" sta sopra, compatto.
      -->
      <div class="flex flex-col lg:flex-row lg:items-start gap-4">
        <!-- DA ASSEGNARE -->
        <section
          aria-labelledby="titolo-da-assegnare"
          class="lg:order-last lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-20 flex flex-col bg-white border border-slate-200 rounded-xl lg:max-h-[max(20rem,calc(100dvh-14rem))]"
        >
          <div class="flex items-center justify-between px-3 py-2 border-b border-slate-200">
            <h2 id="titolo-da-assegnare" class="font-semibold text-slate-800">Da Assegnare</h2>
            <UBadge color="neutral">{{ tabellone.daAssegnare.length }}</UBadge>
          </div>

          <p v-if="tabellone.daAssegnare.length === 0" class="p-4 text-sm text-center text-slate-500">
            Tutti gli studenti sono stati assegnati o non ci sono prenotazioni.
          </p>

          <ul v-else class="p-2 flex flex-wrap lg:flex-col lg:flex-nowrap gap-1.5 max-h-48 lg:max-h-none min-h-0 overflow-y-auto">
            <li
              v-for="badge in tabellone.daAssegnare"
              :key="badge.subjectId"
              class="relative max-w-full lg:w-full rounded-lg border bg-white text-sm cursor-grab active:cursor-grabbing"
              :class="classiTarghetta(badge)"
              draggable="true"
              @dragstart="iniziaTrascinamento($event, badge)"
              @dragend="fineTrascinamento"
            >
              <button
                type="button"
                class="block w-full text-left pl-2 pr-8 py-1.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tfn-500"
                :aria-pressed="selezionato?.subjectId === badge.subjectId"
                :title="titoloTarghetta(badge)"
                @click="selezionaTarghetta(badge)"
              >
                <span class="font-medium text-slate-900">{{ badge.studentSurname }} {{ badge.studentName }}</span>
                <span class="text-slate-600"> · {{ badge.subject }}</span>
                <span v-if="badge.studentPhone" class="hidden lg:block text-xs text-slate-600">{{ badge.studentPhone }}</span>
                <span v-if="badge.notes" class="block mt-0.5 px-1 rounded text-xs text-amber-800 bg-amber-50 line-clamp-1 lg:line-clamp-2">{{ badge.notes }}</span>
                <!-- Assegnato a un tutor tolto dal giorno (o a una fascia cancellata): senza casella sparirebbe -->
                <span v-if="badge.isAssigned" class="block mt-0.5 text-xs text-red-700">Il suo posto non è più nel tabellone: rimettilo in una casella</span>
              </button>
              <button
                type="button"
                class="absolute top-1 right-1 size-6 flex items-center justify-center rounded-md text-slate-600 hover:text-red-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-red-600"
                :aria-label="`Elimina la prenotazione di ${badge.studentName} ${badge.studentSurname}`"
                title="Elimina prenotazione"
                @click="eliminaPrenotazioneManuale(badge)"
              >
                <UIcon name="i-heroicons-trash" class="size-4" />
              </button>
              <!-- Lezione speciale fuori data: supplemento €10 da approvare -->
              <div v-if="badge.supplemento" class="mx-2 mb-1.5 flex flex-wrap items-center justify-between gap-1.5 bg-amber-50 border border-amber-200 rounded p-1.5">
                <span class="text-xs font-medium" :class="badge.supplementoApplicato ? 'text-emerald-700' : 'text-amber-800'">
                  ⭐ Speciale fuori data: +€{{ badge.supplemento }}
                </span>
                <UBadge v-if="badge.supplementoApplicato" color="success" variant="subtle" size="xs">Applicato al pacchetto</UBadge>
                <UButton
                  v-else
                  size="xs"
                  color="warning"
                  variant="soft"
                  :loading="applicandoSupplemento === badge.bookingId"
                  @click="applicaSupplemento(badge)"
                >
                  OK → +€{{ SUPPLEMENTO_SPECIALE }} sul pacchetto
                </UButton>
              </div>
            </li>
          </ul>
        </section>

        <!-- IL TABELLONE: una riga per tutor, una colonna per fascia oraria -->
        <section aria-label="Tabellone" class="flex-1 min-w-0">
          <div v-if="slots.length === 0" class="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500">
            Non ci sono fasce orarie: si impostano in Impostazioni.
          </div>
          <div v-else-if="tutors.length === 0" class="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500">
            Nessun tutor ha dato la disponibilità per questo giorno. Puoi aggiungerne uno qui sotto.
          </div>

          <!--
            Scorre dentro il suo riquadro: così la riga delle fasce e la colonna dei tutor restano ferme.
            Gli z-index restano bassi (1-3) per passare SOTTO la barra fissa in alto del gestionale (z-30).
          -->
          <div v-else class="overflow-auto max-h-[70dvh] lg:max-h-[max(20rem,calc(100dvh-14rem))] bg-white border border-slate-200 rounded-xl">
            <table class="w-full border-separate border-spacing-0">
              <caption class="sr-only">
                Tabellone di {{ dataFormattata }}: una riga per tutor, una colonna per fascia oraria
              </caption>
              <thead>
                <tr>
                  <th scope="col" class="sticky top-0 left-0 z-3 bg-slate-50 border-b border-r border-slate-200 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Tutor
                  </th>
                  <th
                    v-for="slot in slots"
                    :key="slot.id"
                    scope="col"
                    class="sticky top-0 z-2 bg-slate-50 border-b border-r border-slate-200 px-2 py-1.5 text-center"
                  >
                    <div class="text-sm font-semibold text-slate-800 tabular-nums whitespace-nowrap">{{ slot.label }}</div>
                    <div class="text-xs font-normal text-slate-500">{{ quantiAlunni(contaColonna(slot.id)) }}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(tutor, riga) in tutors" :key="tutor.id">
                  <th scope="row" class="sticky left-0 z-1 bg-white border-b border-r border-slate-200 p-2 align-top text-left w-32 min-w-32 sm:w-44 sm:min-w-44">
                    <div class="flex items-start gap-1">
                      <div class="min-w-0 flex-1">
                        <div class="text-sm font-semibold leading-snug text-slate-900 break-words">{{ tutor.name }}</div>
                        <div class="text-xs font-normal text-slate-500">{{ quantiAlunni(contaRiga(tutor.id)) }}</div>
                        <div v-if="tutor.notes" class="text-xs font-normal italic text-slate-500 line-clamp-2" :title="tutor.notes">{{ tutor.notes }}</div>
                      </div>
                      <UButton
                        v-if="tutor.rimovibile"
                        icon="i-heroicons-x-mark"
                        size="xs" color="error" variant="ghost"
                        :aria-label="`Togli ${tutor.name} da questo giorno`"
                        title="Togli questo tutor dal giorno"
                        :loading="cambiandoDisponibilita === tutor.id"
                        @click="cambiaDisponibilitaTutor(tutor.id, false)"
                      />
                    </div>
                  </th>

                  <td
                    v-for="(slot, colonna) in slots"
                    :key="slot.id"
                    class="relative align-top min-w-36 border-b border-r border-slate-200 p-1 pb-5 transition-colors"
                    :class="classiCasella(tutor.id, slot.id)"
                    @dragover.prevent="sopra = chiaveCasella(tutor.id, slot.id)"
                    @dragleave="sopra = null"
                    @drop.prevent="assegnaQui(tutor, slot)"
                  >
                    <!--
                      La casella intera è un bottone, sotto le targhette: si clicca nello spazio libero.
                      Si raggiunge col Tab solo quando c'è un alunno scelto (altrimenti sarebbero
                      decine di fermate inutili); da una casella all'altra si va con le frecce.
                    -->
                    <button
                      type="button"
                      class="absolute inset-0 size-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-tfn-600"
                      :class="inMano ? 'cursor-pointer' : 'cursor-default'"
                      :tabindex="inMano ? 0 : -1"
                      :data-casella="`${riga}-${colonna}`"
                      :aria-label="etichettaCasella(tutor, slot)"
                      @click="assegnaQui(tutor, slot)"
                      @keydown="muoviFocus($event, riga, colonna)"
                    />
                    <div class="relative space-y-1 pointer-events-none">
                      <div
                        v-for="badge in alunniInCasella(tutor.id, slot.id)"
                        :key="badge.subjectId"
                        class="pointer-events-auto relative rounded-md border bg-white text-xs leading-tight shadow-xs cursor-grab active:cursor-grabbing"
                        :class="classiTarghetta(badge)"
                        draggable="true"
                        @dragstart="iniziaTrascinamento($event, badge)"
                        @dragend="fineTrascinamento"
                      >
                        <button
                          type="button"
                          class="block w-full text-left pl-1.5 pr-6 py-1 rounded-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tfn-500"
                          :aria-pressed="selezionato?.subjectId === badge.subjectId"
                          :title="titoloTarghetta(badge)"
                          @click="selezionaTarghetta(badge)"
                        >
                          <span class="font-semibold text-slate-900">{{ nomeBreve(badge) }}</span>
                          <span class="sr-only"> ({{ badge.studentName }} {{ badge.studentSurname }})</span>
                          <span class="text-slate-600"> · {{ badge.subject }}</span>
                          <span v-if="badge.supplemento" aria-hidden="true"> ⭐</span>
                          <UIcon v-if="badge.notes" name="i-heroicons-chat-bubble-left-ellipsis" class="ml-0.5 size-3.5 align-text-bottom text-slate-500" aria-hidden="true" />
                          <span v-if="doppioni.has(badge.subjectId)" class="flex items-center gap-0.5 mt-0.5 font-semibold text-red-700" aria-hidden="true">
                            <UIcon name="i-heroicons-exclamation-triangle" class="size-3.5" />Doppione
                          </span>
                          <span v-if="dettagliTarghetta(badge).length" class="sr-only">, {{ dettagliTarghetta(badge).join(', ') }}</span>
                        </button>
                        <button
                          type="button"
                          class="absolute top-0 right-0 size-6 flex items-center justify-center rounded-md text-slate-600 hover:text-red-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-red-600"
                          :aria-label="`Togli ${badge.studentName} ${badge.studentSurname} (${badge.subject}) da questa casella`"
                          title="Togli dalla casella"
                          @click="rimuoviAssegnazione(badge)"
                        >
                          <UIcon name="i-heroicons-x-mark" class="size-3.5" />
                        </button>
                        <!-- Il bottone di approvazione deve esserci anche DOPO l'assegnazione al tutor -->
                        <div v-if="badge.supplemento && !badge.supplementoApplicato" class="px-1.5 pb-1">
                          <UButton
                            size="xs"
                            color="warning"
                            variant="soft"
                            :aria-label="`Approva il supplemento di €${SUPPLEMENTO_SPECIALE} per ${badge.studentName} ${badge.studentSurname}: si aggiunge al pacchetto`"
                            :loading="applicandoSupplemento === badge.bookingId"
                            @click="applicaSupplemento(badge)"
                          >
                            OK → +€{{ SUPPLEMENTO_SPECIALE }}
                          </UButton>
                        </div>
                      </div>
                    </div>
                    <!-- Casella vietata: non solo rossa, anche col segnale di divieto -->
                    <UIcon
                      v-if="inMano && fasceVietate.has(slot.id)"
                      name="i-heroicons-no-symbol"
                      class="absolute bottom-0.5 right-0.5 size-4 text-red-700 pointer-events-none"
                      aria-hidden="true"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- Aggiunte al tabellone -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Aggiungi un tutor al giorno anche senza disponibilità spuntata -->
        <div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h2 class="font-medium text-sm text-slate-700">Aggiungi tutor a questo giorno</h2>
          <div class="flex flex-col sm:flex-row gap-3">
            <USelectMenu
              v-model="tutorDaAggiungere"
              searchable
              :items="tutorOptions"
              placeholder="Seleziona tutor..."
              label-key="label"
              value-key="value"
              class="flex-1"
            />
            <UButton
              icon="i-heroicons-plus"
              size="sm"
              :disabled="!tutorDaAggiungere"
              :loading="cambiandoDisponibilita === tutorDaAggiungere"
              @click="cambiaDisponibilitaTutor(tutorDaAggiungere, true)"
            >
              Aggiungi
            </UButton>
          </div>
          <p class="text-xs text-slate-500">
            Vale come se il tutor avesse dato lui la disponibilità: comparirà nel tabellone e potrà ricevere assegnazioni.
          </p>
        </div>

        <div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h2 class="font-medium text-sm text-slate-700">Aggiungi studente manuale</h2>
          <div class="flex flex-col sm:flex-row gap-3">
            <USelectMenu
              v-model="manualeStudentId"
              searchable
              :items="studentOptions"
              placeholder="Seleziona studente..."
              label-key="label"
              value-key="value"
              class="flex-1"
            />
            <USelectMenu
              v-model="manualeMateria"
              :items="MATERIE"
              placeholder="Seleziona materia..."
              class="flex-1"
            />
          </div>
          <UButton icon="i-heroicons-plus" size="sm" :disabled="!manualeStudentId || !manualeMateria" :loading="aggiungendoManuale" @click="aggiungiStudenteManuale">
            Aggiungi al matching
          </UButton>
        </div>
      </div>
    </template>

    <!--
      Alunno scelto col clic: resta visibile mentre si cerca la casella. Sugli schermi larghi
      sta a destra, sopra "Da assegnare", per non coprire le ultime righe del tabellone.
    -->
    <div
      v-if="selezionato"
      class="fixed z-40 bottom-20 left-1/2 -translate-x-1/2 w-[min(36rem,calc(100vw-2rem))] lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0 lg:w-80 flex items-center gap-3 rounded-xl bg-slate-900 text-white shadow-lg px-4 py-2.5"
    >
      <div class="min-w-0 flex-1 text-sm">
        <p><strong>{{ selezionato.studentSurname }} {{ selezionato.studentName }}</strong> · {{ selezionato.subject }}</p>
        <p v-if="selezionato.notes" class="text-xs text-slate-300 line-clamp-2">Nota: {{ selezionato.notes }}</p>
        <p class="text-xs text-slate-300">Clicca la casella dove metterlo (quelle rosse sono vietate). Esc per annullare.</p>
      </div>
      <UButton color="neutral" variant="outline" size="sm" @click="annullaSelezione">Annulla</UButton>
    </div>

    <!-- Quello che succede, detto a chi usa un lettore di schermo -->
    <p class="sr-only" role="status" aria-live="polite">{{ annuncio }}</p>
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
import { format, addDays, subDays, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import { SUPPLEMENTO_SPECIALE } from '#shared/tariffe'
import { MATERIE_DEFAULT } from '#shared/materie'
import { giornoCivileValido } from '#shared/giorno-civile'
import {
  stessoAlunno, nomeBreve, chiaveCasella, dividiTabellone, quantiAlunni,
  type TutorDelGiorno, type BadgePrenotazione, type SlotOrario, type MatchingDelGiorno,
} from '#shared/matching'

definePageMeta({ middleware: ['admin-or-super'] })
useHead({ title: 'Matching — tiformiamonoi' })

const toast = useToast()
const route = useRoute()

// Stato principale. Si può aprire su un giorno preciso (/matching?giorno=2026-09-16):
// è così che il foglio di stampa riporta al giorno che si stava guardando.
const giornoRichiesto = route.query.giorno
const currentDate = ref(
  typeof giornoRichiesto === 'string' && giornoCivileValido(giornoRichiesto) ? parseISO(giornoRichiesto) : new Date(),
)
const loading = ref(false)
const tutors = ref<TutorDelGiorno[]>([])
const badges = ref<BadgePrenotazione[]>([])
const slots = ref<SlotOrario[]>([])

const dataFormattata = computed(() => {
  return format(currentDate.value, 'EEEE d MMMM yyyy', { locale: it }).replace(/^\w/, c => c.toUpperCase())
})

const dateParam = computed(() => format(currentDate.value, 'yyyy-MM-dd'))

// Chi sta in quale casella e chi è ancora da assegnare (la stessa divisione del foglio di stampa)
const tabellone = computed(() => dividiTabellone({ tutors: tutors.value, badges: badges.value, slots: slots.value }))

function alunniInCasella(tutorId: string, fascia: string) {
  return tabellone.value.perCasella.get(chiaveCasella(tutorId, fascia)) ?? []
}
function contaRiga(tutorId: string) {
  return slots.value.reduce((n, s) => n + alunniInCasella(tutorId, s.id).length, 0)
}
function contaColonna(fascia: string) {
  return tutors.value.reduce((n, t) => n + alunniInCasella(t.id, fascia).length, 0)
}

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

// ─── Tutor forzati sul giorno (senza disponibilità spuntata) ───
const { data: tutorsRes } = useFetch<any>('/api/tutors?active=true', { lazy: true })
const tutorDaAggiungere = ref('')
const cambiandoDisponibilita = ref<string | null>(null)

const tutorOptions = computed(() =>
  (tutorsRes.value?.data || [])
    .filter((t: any) => !tutors.value.some(x => x.id === t.id))
    .map((t: any) => ({ label: `${t.lastName} ${t.firstName}`, value: t.id })))

async function cambiaDisponibilitaTutor(tutorId: string, presente: boolean) {
  cambiandoDisponibilita.value = tutorId
  try {
    await $fetch('/api/matching/tutor-availability', {
      method: 'POST',
      body: { tutorId, date: dateParam.value, presente },
    })
    tutorDaAggiungere.value = ''
    await loadData()
    toast.add({ title: presente ? 'Tutor aggiunto al giorno' : 'Tutor tolto dal giorno', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Operazione non riuscita', color: 'error' })
  } finally {
    cambiandoDisponibilita.value = null
  }
}

function cambiaGiorno(dir: number) {
  currentDate.value = dir > 0 ? addDays(currentDate.value, 1) : subDays(currentDate.value, 1)
}

watch(currentDate, () => {
  loadData()
})

async function loadData() {
  loading.value = true
  try {
    const res = await $fetch<MatchingDelGiorno>(`/api/matching/${dateParam.value}`)
    tutors.value = res.tutors
    badges.value = res.badges
    slots.value = res.slots
    // La targhetta scelta apparteneva ai dati di prima: non esiste più
    selezionato.value = null
  } catch (err) {
    toast.add({ title: 'Errore', description: 'Impossibile caricare i dati di matching', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ─── Supplemento lezione speciale fuori data: OK admin → +€10 sul pacchetto ───
const applicandoSupplemento = ref<string | null>(null)
async function applicaSupplemento(badge: BadgePrenotazione) {
  applicandoSupplemento.value = badge.bookingId
  try {
    // Il server risponde anche con la prenotazione aggiornata: qui serve solo il nome del pacchetto
    const res = await $fetch<{ packageId: string, packageNome: string }>(
      `/api/admin/bookings/${badge.bookingId}/supplemento`, { method: 'POST' },
    )
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

// ─── L'alunno "in mano": quello che si sta trascinando, o quello scelto col clic ───
// Il clic-poi-clic serve a chi usa la tastiera e ai tablet, dove il trascinamento
// del browser non funziona. Le due strade finiscono nella stessa assegnaQui().
const selezionato = ref<BadgePrenotazione | null>(null)
const trascinato = ref<BadgePrenotazione | null>(null)
const sopra = ref<string | null>(null) // la casella sotto il puntatore mentre si trascina
const inMano = computed(() => trascinato.value ?? selezionato.value)
const annuncio = ref('')

// Le fasce dove l'alunno in mano NON può andare perché c'è già (N4), con la targhetta che
// le occupa. La regola è quella del server (shared/matching.ts): il rosso a schermo e il
// "no" del server coincidono. Vietata vuol dire tutta la colonna, con qualunque tutor.
const fasceVietate = computed(() => {
  const vietate = new Map<string, BadgePrenotazione>()
  const x = inMano.value
  if (!x) return vietate
  for (const y of badges.value) {
    if (y.subjectId !== x.subjectId && y.isAssigned && y.assignedSlot && stessoAlunno(x, y)) vietate.set(y.assignedSlot, y)
  }
  return vietate
})

// Doppioni già presenti nei dati (nati prima di questa regola): si segnalano, non si cancella niente
const doppioni = computed(() => {
  const trovati = new Set<string>()
  const assegnati = badges.value.filter(b => b.isAssigned && b.assignedSlot)
  assegnati.forEach((a, i) => {
    for (const b of assegnati.slice(i + 1)) {
      if (a.assignedSlot === b.assignedSlot && stessoAlunno(a, b)) {
        trovati.add(a.subjectId)
        trovati.add(b.subjectId)
      }
    }
  })
  return trovati
})

function classiTarghetta(b: BadgePrenotazione) {
  if (selezionato.value?.subjectId === b.subjectId) return 'border-tfn-600 ring-2 ring-tfn-500 bg-tfn-50'
  if (doppioni.value.has(b.subjectId)) return 'border-red-600 ring-1 ring-red-600'
  return 'border-slate-200 hover:border-tfn-300'
}

function classiCasella(tutorId: string, fascia: string) {
  if (!inMano.value) return ''
  const sotto = sopra.value === chiaveCasella(tutorId, fascia)
  if (fasceVietate.value.has(fascia)) return sotto ? 'bg-red-100 ring-2 ring-inset ring-red-600' : 'bg-red-50 ring-1 ring-inset ring-red-300'
  return sotto ? 'bg-tfn-100 ring-2 ring-inset ring-tfn-500' : 'bg-tfn-50 hover:bg-tfn-100'
}

// Quello che nella targhetta stretta non si legge per intero: va nel suggerimento al
// passaggio del mouse e, per i lettori di schermo, in un testo nascosto.
function dettagliTarghetta(b: BadgePrenotazione) {
  return [
    b.supplemento ? `supplemento +€${b.supplemento} ${b.supplementoApplicato ? 'applicato' : 'da approvare'}` : '',
    doppioni.value.has(b.subjectId) ? 'doppione: stesso alunno alla stessa ora' : '',
    b.notes ? `nota: ${b.notes}` : '',
  ].filter(Boolean)
}
function titoloTarghetta(b: BadgePrenotazione) {
  return [`${b.studentName} ${b.studentSurname} — ${b.subject}`, ...dettagliTarghetta(b)].join('\n')
}

function etichettaCasella(tutor: TutorDelGiorno, slot: SlotOrario) {
  const testo = `${tutor.name}, ${slot.label}, ${quantiAlunni(alunniInCasella(tutor.id, slot.id).length)}`
  const x = inMano.value
  return x && fasceVietate.value.has(slot.id)
    ? `${testo}: vietata, ${x.studentName} ${x.studentSurname} è già in questa fascia`
    : testo
}

function selezionaTarghetta(badge: BadgePrenotazione) {
  if (selezionato.value?.subjectId === badge.subjectId) return annullaSelezione()
  selezionato.value = badge
  annuncio.value = `${badge.studentName} ${badge.studentSurname}, ${badge.subject}: scelto. Ora scegli la casella; Esc per annullare.`
}

function annullaSelezione() {
  if (!selezionato.value) return
  selezionato.value = null
  annuncio.value = 'Scelta annullata.'
}

function iniziaTrascinamento(event: DragEvent, badge: BadgePrenotazione) {
  trascinato.value = badge
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    // Hack per far funzionare drag & drop su alcuni browser
    event.dataTransfer.setData('text/plain', badge.subjectId)
  }
}

function fineTrascinamento() {
  trascinato.value = null
  sopra.value = null
}

async function assegnaQui(tutor: TutorDelGiorno, slot: SlotOrario) {
  sopra.value = null
  // Teniamo da parte QUESTA targhetta: la chiamata al server dura, e nel frattempo
  // quella in mano potrebbe già essere un'altra (o nessuna).
  const badge = inMano.value
  if (!badge) {
    annuncio.value = 'Prima scegli un alunno: clicca la sua targhetta.'
    return
  }
  if (badge.isAssigned && badge.assignedTutorId === tutor.id && badge.assignedSlot === slot.id) {
    if (selezionato.value?.subjectId === badge.subjectId) selezionato.value = null
    return
  }

  try {
    await $fetch('/api/matching/assign', {
      method: 'POST',
      body: { subjectId: badge.subjectId, tutorId: tutor.id, slot: slot.id },
    })

    // Lo stato locale cambia solo se il server ha detto sì
    const b = badges.value.find(x => x.subjectId === badge.subjectId)
    if (b) {
      b.assignedTutorId = tutor.id
      b.assignedSlot = slot.id
      b.isAssigned = true
    }
    if (selezionato.value?.subjectId === badge.subjectId) selezionato.value = null
    annuncio.value = `${badge.studentName} ${badge.studentSurname} assegnato a ${tutor.name}, ${slot.label}.`
  } catch (err: any) {
    // Il "no" del server (per esempio un doppione) si legge nel messaggio. La targhetta
    // resta dov'era, e resta scelta: si può provare subito un'altra casella.
    const motivo = err?.data?.statusMessage ?? 'Errore imprevisto'
    toast.add({ title: 'Assegnazione non riuscita', description: motivo, color: 'error' })
    annuncio.value = `Assegnazione non riuscita: ${motivo}`
  }
}

// Frecce fra le caselle: con venti tutor e otto fasce, il solo Tab sarebbe un calvario
const PASSI_FRECCE: Record<string, [number, number]> = {
  ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
}
function muoviFocus(event: KeyboardEvent, riga: number, colonna: number) {
  const passo = PASSI_FRECCE[event.key]
  if (!passo) return
  const vicina = document.querySelector<HTMLElement>(`[data-casella="${riga + passo[0]}-${colonna + passo[1]}"]`)
  if (!vicina) return
  event.preventDefault()
  vicina.focus()
}

function suTasto(event: KeyboardEvent) {
  if (event.key === 'Escape') annullaSelezione()
}

async function rimuoviAssegnazione(badge: BadgePrenotazione) {
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
    annuncio.value = `${badge.studentName} ${badge.studentSurname} tolto dalla casella: ora è fra quelli da assegnare.`
  } catch (err: any) {
    toast.add({ title: 'Errore rimozione', description: err?.data?.statusMessage, color: 'error' })
  }
}

const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmDescription = ref('')
const pendingDeleteBadge = ref<BadgePrenotazione | null>(null)

function eliminaPrenotazioneManuale(badge: BadgePrenotazione) {
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
  } catch (err: any) {
    // Il server spiega il perché (es. "Luca Rossi ha già Matematica in questo giorno")
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile aggiungere studente', color: 'error' })
  } finally {
    aggiungendoManuale.value = false
  }
}

onMounted(() => {
  loadData()
  window.addEventListener('keydown', suTasto)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', suTasto)
})
</script>
