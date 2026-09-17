<template>
  <div class="min-h-screen overflow-x-auto bg-slate-100 px-4 py-6 print:min-h-0 print:overflow-visible print:bg-white print:p-0">

    <!-- Controlli (solo a schermo, nascosti in stampa) -->
    <div class="print:hidden mx-auto mb-4 max-w-[296mm] space-y-3">
      <div class="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-slate-200 p-3">
        <UButton icon="i-heroicons-arrow-left" variant="ghost" size="sm" :to="`/matching?giorno=${giorno}`">
          Torna al Matching
        </UButton>
        <UButton icon="i-heroicons-printer" size="sm" class="ml-auto" :disabled="!dati" @click="stampa">
          Stampa / Salva PDF
        </UButton>
      </div>

      <UAlert
        v-if="errore"
        color="error"
        variant="subtle"
        icon="i-heroicons-exclamation-triangle"
        title="Tabellone non disponibile"
        :description="errore"
      />
      <UAlert
        v-else-if="pagine > 1"
        color="warning"
        variant="subtle"
        icon="i-heroicons-document-duplicate"
        :title="`Il tabellone di questo giorno occupa ${pagine === 2 ? 'due' : pagine} pagine`"
        description="Su un foglio solo il testo diventerebbe troppo piccolo per leggerlo. Si stampa su più fogli, e la riga con le fasce orarie si ripete in cima a ogni foglio."
      />
    </div>

    <p v-if="pending" class="print:hidden text-center text-sm text-slate-500">Caricamento…</p>

    <!-- Il foglio: a schermo si vede come sulla carta, margini compresi -->
    <div v-else-if="dati" class="mx-auto w-fit bg-white p-[8mm] shadow-sm ring-1 ring-slate-200 print:p-0 print:shadow-none print:ring-0">
      <!-- La dimensione del testo la decide adattaAlFoglio(): tutto dentro è in "em" e si rimpicciolisce insieme -->
      <div ref="foglio" class="w-[280mm] leading-snug text-slate-900 [print-color-adjust:exact]" :style="{ fontSize: `${corpo}pt` }">
        <header class="flex items-center gap-[1em] border-b-2 border-tfn-500 pb-[0.5em]">
          <img src="/logo.svg" alt="tiformiamonoi" class="h-[3.2em] w-auto">
          <div class="min-w-0 flex-1">
            <h1 class="font-heading text-[1.6em] font-bold leading-tight text-tfn-700">Tabellone abbinamenti</h1>
            <p class="text-[1.15em] font-semibold text-slate-800">{{ giornoEsteso }}</p>
          </div>
          <p class="text-right text-[0.95em] text-slate-700">
            {{ tutorInStampa.length }} tutor<br>{{ dati.badges.length }} prenotazioni
          </p>
        </header>

        <p v-if="dati.slots.length === 0" class="mt-[1em]">Non ci sono fasce orarie impostate.</p>
        <p v-else-if="tutorInStampa.length === 0" class="mt-[1em]">Nessun alunno assegnato ai tutor in questo giorno.</p>

        <!-- La stessa griglia dello schermo: righe i tutor, colonne le fasce orarie -->
        <table v-else class="mt-[0.6em] w-full table-fixed border-collapse">
          <thead>
            <tr>
              <th scope="col" class="w-[14%] border border-slate-500 bg-slate-100 px-[0.4em] py-[0.25em] text-left">Tutor</th>
              <th
                v-for="slot in dati.slots"
                :key="slot.id"
                scope="col"
                class="border border-slate-500 bg-slate-100 px-[0.3em] py-[0.25em] text-center tabular-nums"
              >
                {{ slot.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tutor in tutorInStampa" :key="tutor.id" class="break-inside-avoid">
              <th scope="row" class="border border-slate-500 px-[0.4em] py-[0.25em] text-left align-top font-semibold break-words">
                {{ tutor.name }}
              </th>
              <td
                v-for="slot in dati.slots"
                :key="slot.id"
                class="h-[2em] border border-slate-500 px-[0.35em] py-[0.2em] align-top"
              >
                <div v-for="b in tabellone.perCasella.get(chiaveCasella(tutor.id, slot.id)) ?? []" :key="b.subjectId" class="break-words">
                  <span class="font-semibold">{{ nomeBreve(b) }}</span>
                  <span class="text-slate-700"> · {{ b.subject }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <section v-if="tabellone.daAssegnare.length" class="mt-[0.6em] break-inside-avoid border border-slate-500 px-[0.5em] py-[0.35em]">
          <h2 class="font-semibold">Non ancora assegnati ({{ tabellone.daAssegnare.length }})</h2>
          <p class="text-slate-800">
            <template v-for="(b, i) in tabellone.daAssegnare" :key="b.subjectId">
              <span class="whitespace-nowrap">{{ b.studentSurname }} {{ b.studentName }} ({{ b.subject }})</span>
              <template v-if="i < tabellone.daAssegnare.length - 1"> · </template>
            </template>
          </p>
        </section>

        <footer class="mt-[0.5em] flex justify-between text-[0.8em] text-slate-600">
          <span>tiformiamonoi · Tabellone abbinamenti</span>
          <span v-if="stampatoIl">Stampato il {{ stampatoIl }}</span>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { giornoCivileValido } from '#shared/giorno-civile'
import { dividiTabellone, chiaveCasella, nomeBreve, type MatchingDelGiorno } from '#shared/matching'

definePageMeta({ layout: false, middleware: ['admin-or-super'] })

// Il foglio orizzontale vale SOLO per questa pagina. Messo con useHead sparisce quando
// si esce; un <style> normale resterebbe attivo nella scheda e girerebbe in orizzontale
// anche le stampe aperte dopo (libretto, lezioni).
const MARGINE_MM = 8
const route = useRoute()
const giorno = String(route.params.data ?? '')
useHead({
  // Il titolo diventa anche il nome proposto per il PDF
  title: `Tabellone ${giorno} — tiformiamonoi`,
  style: [{ textContent: `@page { size: A4 landscape; margin: ${MARGINE_MM}mm; }` }],
})
const giornoValido = giornoCivileValido(giorno)

// Gli stessi dati della pagina Matching
const { data: dati, pending, error } = useLazyFetch<MatchingDelGiorno>(`/api/matching/${giorno}`, { immediate: giornoValido })

const tabellone = computed(() => dividiTabellone(dati.value ?? { tutors: [], badges: [], slots: [] }))

// Sulla carta vanno solo i tutor con almeno un alunno in una fascia (richiesta del
// titolare): una riga vuota non serve a chi legge il foglio in sala e ruba spazio,
// cioè rimpicciolisce il testo di tutte le altre. A schermo, nel Matching, restano
// tutti: lì le righe vuote servono per assegnare.
const tutorInStampa = computed(() => (dati.value?.tutors ?? []).filter(t =>
  (dati.value?.slots ?? []).some(s => (tabellone.value.perCasella.get(chiaveCasella(t.id, s.id))?.length ?? 0) > 0)))

// "Martedì 16 settembre 2026"
const giornoEsteso = computed(() => giornoValido
  ? format(parseISO(giorno), 'EEEE d MMMM yyyy', { locale: it }).replace(/^\w/, c => c.toUpperCase())
  : '')

const errore = computed(() => {
  if (!giornoValido) return 'Il giorno indicato nell\'indirizzo non esiste.'
  if (!error.value) return null
  return (error.value as any)?.data?.statusMessage ?? 'Impossibile caricare il tabellone.'
})

// ─── Tutto su un foglio ───
// Si prova il testo dal più comodo al più piccolo ancora leggibile, misurando ogni volta
// l'altezza del foglio contro l'altezza utile di un A4 orizzontale (210 mm meno i due
// margini, in pixel CSS a 96 per pollice), con un 3% di riserva per le piccole differenze
// fra anteprima a schermo e stampa. Il foglio è largo quanto la carta, quindi il testo più
// piccolo va anche meno a capo: la misura a schermo è quella che uscirà.
const ALTEZZA_UTILE_PX = (210 - 2 * MARGINE_MM) / 25.4 * 96 * 0.97
const CORPI_PT = [11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5, 7]
// Oltre venti tutor un foglio unico sarebbe illeggibile: non si scende sotto questo corpo
// e si va su due fogli (il thead della tabella si ripete da solo sul secondo).
const MAX_TUTOR_UN_FOGLIO = 20
const CORPO_PIU_FOGLI = 9

const foglio = ref<HTMLElement | null>(null)
const corpo = ref(CORPI_PT[0]!)
const pagine = ref(1)

async function adattaAlFoglio() {
  if (!dati.value) return
  // Si misura col carattere vero, non con quello di riserva mostrato mentre si scarica
  await document.fonts?.ready
  const minimo = tutorInStampa.value.length > MAX_TUTOR_UN_FOGLIO ? CORPO_PIU_FOGLI : 7
  for (const pt of CORPI_PT.filter(pt => pt >= minimo)) {
    corpo.value = pt
    await nextTick()
    if (!foglio.value) return
    if (foglio.value.scrollHeight <= ALTEZZA_UTILE_PX) {
      pagine.value = 1
      return
    }
  }
  corpo.value = CORPO_PIU_FOGLI
  await nextTick()
  pagine.value = Math.max(2, Math.ceil((foglio.value?.scrollHeight ?? 0) / ALTEZZA_UTILE_PX))
}

watch(dati, () => adattaAlFoglio(), { flush: 'post' })

// Data e ora di stampa: si scrivono nel browser (il server ha un altro fuso orario) e si
// rinfrescano appena prima di stampare, anche se il foglio è rimasto aperto a lungo.
const stampatoIl = ref('')
function aggiornaOra() {
  stampatoIl.value = format(new Date(), "dd/MM/yyyy 'alle' HH:mm")
}

onMounted(() => {
  aggiornaOra()
  window.addEventListener('beforeprint', aggiornaOra)
  adattaAlFoglio()
})
onBeforeUnmount(() => window.removeEventListener('beforeprint', aggiornaOra))

async function stampa() {
  aggiornaOra()
  await nextTick() // l'ora nuova deve essere già sul foglio quando il browser lo fotografa
  window.print()
}
</script>
