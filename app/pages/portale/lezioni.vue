<template>
  <div>
    <PortaleTestata titolo="Lezioni" sovrapposta>
      <!-- Il bottone giallo grande delle bozze: l'azione principale della pagina -->
      <NuxtLink
        v-if="puoPrenotare"
        to="/portale/prenota"
        class="min-h-[68px] rounded-[22px] bg-pf-giallo text-pf-giallo-testo flex items-center gap-3 pl-2.5 pr-4 font-bold text-lg shadow-[0_12px_26px_rgb(0_30_60/0.28)] hover:brightness-95"
      >
        <img src="/portale/calendario.webp" alt="" class="size-[50px] object-contain" />
        <span class="flex-1">Prenota una lezione</span>
        <span class="size-9 rounded-full bg-white flex items-center justify-center" aria-hidden="true">
          <UIcon name="i-heroicons-plus" class="size-5" />
        </span>
      </NuxtLink>

      <!-- Filtro per figlio: bottoni veri con aria-pressed (cambiano l'elenco, non sono schede) -->
      <div v-if="studenti.length > 1" role="group" aria-label="Mostra le lezioni di" class="flex flex-wrap gap-2">
        <button
          v-for="f in filtri"
          :key="f.id"
          type="button"
          :aria-pressed="filtro === f.id"
          class="min-h-11 px-4 rounded-full text-sm transition-colors"
          :class="filtro === f.id ? 'bg-white text-pf-blu font-semibold' : 'bg-pf-blu-tasto text-white font-medium hover:bg-pf-blu-scuro'"
          @click="() => { filtro = f.id }"
        >
          {{ f.nome }}
        </button>
      </div>
    </PortaleTestata>

    <!-- Il calendario del mese -->
    <section aria-label="Calendario delle lezioni" class="relative -mt-[52px] mx-5 bg-white rounded-3xl p-4 pf-ombra-alta">
      <PortaleCalendario v-model="giornoScelto" v-model:mese="mese" :segni="segni" con-svolte />
    </section>

    <!-- Il giorno scelto -->
    <section aria-labelledby="t-giorno" class="mx-5 mt-6 flex flex-col gap-3">
      <h2 id="t-giorno" class="font-heading font-bold text-lg first-letter:uppercase" aria-live="polite">{{ giornoInParole(giornoScelto) }}</h2>
      <USkeleton v-if="pending" class="h-40 w-full rounded-[22px]" />
      <template v-else-if="delGiorno.length">
        <PortaleSchedaLezione
          v-for="b in delGiorno"
          :key="b.id"
          :lezione="b"
          :nome="nomeDi(b)"
          :indice="indiceDi(b.studentId)"
          @annulla="chiediAnnullamento(b)"
        />
      </template>
      <div v-else class="bg-white rounded-[22px] p-4 text-sm text-pf-grigio-scuro pf-ombra flex flex-col gap-3">
        <p>Nessuna lezione in questo giorno.</p>
        <NuxtLink v-if="puoPrenotare && giornoScelto >= oggi" :to="`/portale/prenota?data=${giornoScelto}`" class="self-start py-2 font-semibold text-pf-blu hover:text-pf-blu-scuro">
          Prenota per questo giorno
        </NuxtLink>
      </div>
    </section>

    <!-- Le prossime lezioni: toccandone una si apre il suo giorno qui sopra -->
    <section v-if="prossime.length" aria-labelledby="t-prossime" class="mx-5 mt-6 flex flex-col gap-2.5">
      <h2 id="t-prossime" class="font-heading font-bold text-lg">Prossime lezioni</h2>
      <button
        v-for="b in prossime"
        :key="b.id"
        type="button"
        class="bg-white rounded-[20px] p-3 flex items-center gap-3 text-left text-pf-testo pf-ombra hover:bg-pf-fondo transition-colors"
        @click="apriGiorno(giornoPrenotazione(b))"
      >
        <span class="shrink-0 w-[52px] h-14 rounded-[14px] flex flex-col items-center justify-center" :class="speciale(b) ? 'bg-pf-crema text-pf-crema-testo' : 'bg-pf-celeste text-pf-blu-scuro'">
          <span class="text-[11px] font-semibold uppercase">{{ giornoInParole(giornoPrenotazione(b), { weekday: 'short' }) }}</span>
          <span class="font-heading text-xl font-bold leading-[22px]">{{ Number(giornoPrenotazione(b).slice(8)) }}</span>
        </span>
        <span class="flex-1 min-w-0 flex flex-col gap-0.5">
          <span class="font-semibold text-[15px] truncate">{{ nomeDi(b) }} · {{ b.subjects.map((s) => s.name).join(', ') }}</span>
          <span v-if="speciale(b)" class="text-xs font-semibold text-pf-crema-testo">Materia speciale, senza supplemento</span>
          <span v-else class="text-xs text-pf-grigio">{{ giornoInParole(giornoPrenotazione(b), { day: 'numeric', month: 'long' }) }}</span>
        </span>
        <PortaleStato tono="verde">Confermata</PortaleStato>
      </button>
    </section>

    <!-- Annulla una lezione (schermata 18): un foglio dal basso, con due scelte chiare -->
    <UDrawer v-model:open="annullaAperto" :title="titoloAnnulla" :description="descrizioneAnnulla" :ui="{ title: 'font-heading text-xl font-bold text-pf-testo', description: 'text-sm text-pf-grigio' }">
      <template #body>
        <div class="pf flex flex-col gap-4 pb-4">
          <div class="flex items-center gap-3.5">
            <img src="/portale/calendario.webp" alt="" class="size-16 shrink-0 object-contain" />
            <p class="text-sm leading-5 text-pf-grigio-scuro p-3 rounded-2xl bg-pf-fondo">
              Puoi annullare fino alle 12:30 del giorno della lezione. Se cambi idea, potrai prenotarla di nuovo.
            </p>
          </div>
          <PortaleBottone variante="scuro" blocco :loading="annullando" @click="annulla">Sì, annulla la lezione</PortaleBottone>
          <PortaleBottone variante="chiaro" blocco @click="() => { annullaAperto = false }">No, la tengo</PortaleBottone>
        </div>
      </template>
    </UDrawer>
  </div>
</template>

<script setup lang="ts">
// LE LEZIONI (schermata 2): calendario del mese, il giorno scelto con Modifica e Annulla,
// le prossime lezioni. Prima stavano in fondo alla Home; ora la Home mostra solo la prossima.
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Lezioni — Portale Famiglie' })

type Studente = { id: string; firstName: string; abilitatoPrenotazioneOnline: boolean }
type Prenotazione = { id: string; studentId: string | null; studentName: string; requestedDate: string; createdAt: string; status: string; notes: string | null; subjects: { name: string }[] }

const toast = useToast()
const { user } = useUserSession()
const isStudente = computed(() => user.value?.role === 'STUDENTE')
const oggi = adessoItalia().giorno

const { data: studentsData } = await useFetch<Studente[]>('/api/portal/students')
const studenti = computed(() => studentsData.value ?? [])
// Lo STUDENTE prenota sempre (il permesso è l'account stesso); il genitore se almeno un figlio è abilitato
const puoPrenotare = computed(() => isStudente.value || studenti.value.some((s) => s.abilitatoPrenotazioneOnline))

const { data: bookingsData, pending, refresh } = useLazyFetch<Prenotazione[]>('/api/portal/bookings')
const { data: portalConfigs } = useLazyFetch<{ giornate_speciali?: Record<string, string[]> }>('/api/portal/configs')
const giornateSpeciali = computed(() => portalConfigs.value?.giornate_speciali ?? {})

const filtro = ref('TUTTI')
const filtri = computed(() => [{ id: 'TUTTI', nome: 'Tutti' }, ...studenti.value.map((s) => ({ id: s.id, nome: s.firstName }))])
const lezioni = computed(() => (bookingsData.value ?? []).filter((b) => filtro.value === 'TUTTI' || b.studentId === filtro.value))

const indiceDi = (id: string | null) => Math.max(0, studenti.value.findIndex((s) => s.id === id))
const nomeDi = (b: Prenotazione) => studenti.value.find((s) => s.id === b.studentId)?.firstName ?? b.studentName

// Il giorno aperto all'inizio: la prossima lezione, altrimenti oggi
const giornoScelto = ref(oggi)
const mese = ref(oggi.slice(0, 7))
const primaProssima = (bookingsData.value ?? [])
  .filter((b) => b.status !== 'CANCELLED' && giornoPrenotazione(b) >= oggi)
  .map(giornoPrenotazione).sort()[0]
if (primaProssima) apriGiorno(primaProssima)
watch(bookingsData, (lista) => {
  const prima = (lista ?? []).filter((b) => b.status !== 'CANCELLED' && giornoPrenotazione(b) >= oggi).map(giornoPrenotazione).sort()[0]
  if (prima && giornoScelto.value === oggi) apriGiorno(prima)
}, { once: true })

function apriGiorno(g: string) {
  giornoScelto.value = g
  mese.value = g.slice(0, 7)
}

const attive = computed(() => lezioni.value.filter((b) => b.status !== 'CANCELLED'))
function segni(g: string) {
  const qui = attive.value.filter((b) => giornoPrenotazione(b) === g)
  return {
    lezione: g >= oggi && qui.length > 0,
    svolta: g < oggi && qui.length > 0,
    speciale: (giornateSpeciali.value[g]?.length ?? 0) > 0,
  }
}

const delGiorno = computed(() => lezioni.value.filter((b) => giornoPrenotazione(b) === giornoScelto.value))
const prossime = computed(() => attive.value
  .filter((b) => giornoPrenotazione(b) >= oggi && giornoPrenotazione(b) !== giornoScelto.value)
  .sort((a, b) => a.requestedDate.localeCompare(b.requestedDate))
  .slice(0, 8))
// Una materia speciale prenotata proprio nella sua giornata: senza supplemento
const speciale = (b: Prenotazione) => b.subjects.some((s) => (giornateSpeciali.value[giornoPrenotazione(b)] ?? []).includes(s.name))

// ─── Annulla ───
const annullaAperto = ref(false)
const annullando = ref(false)
const daAnnullare = ref<Prenotazione | null>(null)
const titoloAnnulla = computed(() => daAnnullare.value
  ? `Annullare la lezione di ${giornoInParole(giornoPrenotazione(daAnnullare.value), { weekday: 'long', day: 'numeric' })}?`
  : '')
const descrizioneAnnulla = computed(() => daAnnullare.value
  ? `${nomeDi(daAnnullare.value)} · ${daAnnullare.value.subjects.map((s) => s.name).join(', ')}`
  : '')

function chiediAnnullamento(b: Prenotazione) {
  daAnnullare.value = b
  annullaAperto.value = true
}

async function annulla() {
  if (!daAnnullare.value) return
  annullando.value = true
  try {
    await $fetch(`/api/portal/bookings/${daAnnullare.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Lezione annullata', color: 'success' })
    annullaAperto.value = false
    await refresh()
  } catch (err: any) {
    toast.add({ title: 'Non è stato possibile annullare', description: err?.data?.statusMessage ?? 'Riprova fra poco.', color: 'error' })
  } finally {
    annullando.value = false
  }
}
</script>
