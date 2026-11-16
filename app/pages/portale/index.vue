<template>
  <div>
    <!-- ═══ TESTATA: data e saluto che cambia con l'ora italiana ═══ -->
    <PortaleTestata sovrapposta>
      <div class="flex flex-col gap-1">
        <p class="text-sm text-pf-su-blu first-letter:uppercase">{{ oggiInParole }}</p>
        <h1 class="font-heading text-[28px] leading-9 font-medium">
          {{ saluto }}<template v-if="user?.firstName">, <span class="font-bold">{{ user.firstName }}</span></template>
        </h1>
      </div>
    </PortaleTestata>

    <!-- ═══════════════ HOME DELL'ALUNNO (schermata 15) ═══════════════ -->
    <template v-if="isStudente">
      <NuxtLink
        to="/portale/lezioni"
        class="relative -mt-11 mx-5 bg-white rounded-3xl p-4 flex items-center gap-3.5 pf-ombra-alta hover:bg-pf-fondo transition-colors"
      >
        <img src="/portale/calendario.webp" alt="" class="size-[60px] shrink-0 object-contain" />
        <span class="flex-1 min-w-0 flex flex-col gap-0.5">
          <span class="text-xs font-bold text-pf-blu uppercase tracking-wide">La tua prossima lezione</span>
          <template v-if="prossimaDi(studenteSolo?.id)">
            <span class="font-heading font-bold text-lg first-letter:uppercase">{{ giornoInParole(giornoPrenotazione(prossimaDi(studenteSolo?.id)!)) }}</span>
            <span class="text-[13px] text-pf-grigio">{{ materieDi(prossimaDi(studenteSolo?.id)!) }} · confermata</span>
          </template>
          <template v-else>
            <span class="font-heading font-bold text-lg">Nessuna in programma</span>
            <span class="text-[13px] text-pf-grigio">Tocca qui per prenotarne una</span>
          </template>
        </span>
      </NuxtLink>

      <nav aria-label="Azioni rapide" class="mx-5 mt-6 grid grid-cols-3 gap-2.5">
        <NuxtLink v-for="a in azioniAlunno" :key="a.to" :to="a.to" class="flex flex-col items-center gap-2 text-pf-testo rounded-2xl group">
          <span class="size-[84px] rounded-3xl bg-white shadow-[0_6px_16px_rgb(15_27_45/0.07)] flex items-center justify-center group-hover:bg-pf-celeste transition-colors">
            <img :src="a.img" alt="" class="size-[58px] object-contain" />
          </span>
          <span class="text-[13px] font-semibold text-center">{{ a.etichetta }}</span>
        </NuxtLink>
      </nav>

      <!-- La card in breve: attiva o no, fino a quando. Mai il motivo (privacy economica) -->
      <section v-if="cardAlunno" aria-labelledby="t-tua-card" class="relative mx-5 mt-6 rounded-3xl bg-pf-notte text-white p-[18px] flex flex-col gap-3.5 overflow-hidden">
        <span aria-hidden="true" class="absolute -right-[50px] -top-[60px] size-[180px] rounded-full border-[26px] border-pf-notte-anello" />
        <div class="relative flex items-center justify-between">
          <h2 id="t-tua-card" class="font-heading font-bold text-[17px]">La tua card</h2>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-white" :class="cardAlunno.attiva ? 'text-pf-verde' : 'text-pf-rosso'">
            {{ cardAlunno.attiva ? 'Attiva' : 'Sospesa' }}
          </span>
        </div>
        <p class="relative text-sm leading-5 text-pf-su-blu">
          <template v-if="!cardAlunno.attiva">{{ testoCardSospesa(null, false) }}</template>
          <template v-else-if="cardAlunno.validaFino">Sconti nei negozi convenzionati fino al {{ giornoInParole(cardAlunno.validaFino, { day: 'numeric', month: 'long', year: 'numeric' }) }}.</template>
          <template v-else>Sconti nei negozi convenzionati.</template>
        </p>
        <PortaleBottone to="/portale/card" class="relative self-start">Mostra la card</PortaleBottone>
      </section>
    </template>

    <!-- ═══════════════ HOME DELLA FAMIGLIA (schermata 1) ═══════════════ -->
    <template v-else>
      <section aria-label="I tuoi ragazzi" class="relative -mt-11">
        <div v-if="studenti.length === 0" class="mx-5 bg-white rounded-3xl p-5 pf-ombra-alta text-sm text-pf-grigio-scuro">
          Nessun ragazzo collegato a questo account. Scrivi alla segreteria.
        </div>
        <!-- Più figli: scorrono di lato, come nelle bozze. La pagina non scorre mai di lato -->
        <div v-else class="flex gap-3 px-5 pb-2 overflow-x-auto snap-x snap-mandatory scrollbar-nascosta">
          <PortaleSchedaAlunno
            v-for="(s, i) in studenti"
            :key="s.id"
            :alunno="s"
            :indice="i"
            class="shrink-0 snap-start"
            :class="studenti.length > 1 ? 'w-[296px]' : 'w-full'"
          >
            <div class="grid grid-cols-2 gap-2">
              <NuxtLink to="/portale/lezioni" class="flex flex-col gap-0.5 rounded-lg hover:bg-pf-fondo">
                <span class="text-xs text-pf-grigio">Prossima lezione</span>
                <span class="text-sm font-semibold">
                  {{ prossimaDi(s.id) ? giornoInParole(giornoPrenotazione(prossimaDi(s.id)!), { weekday: 'short', day: 'numeric', month: 'short' }) : 'Nessuna' }}
                </span>
              </NuxtLink>
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-xs text-pf-grigio">Pacchetto</span>
                <span class="text-sm font-semibold truncate">{{ s.packages?.[0]?.nome ?? 'Nessuno attivo' }}</span>
              </div>
            </div>
          </PortaleSchedaAlunno>
        </div>
      </section>

      <section aria-labelledby="t-azioni" class="mx-5 mt-7 flex flex-col gap-3">
        <h2 id="t-azioni" class="font-heading font-bold text-lg">Azioni rapide</h2>
        <div class="grid gap-2.5" :class="azioniGenitore.length === 4 ? 'grid-cols-4' : 'grid-cols-3'">
          <NuxtLink v-for="a in azioniGenitore" :key="a.to" :to="a.to" class="flex flex-col items-center gap-2 text-pf-testo rounded-2xl group">
            <span class="size-[72px] rounded-[22px] bg-white shadow-[0_6px_16px_rgb(15_27_45/0.07)] flex items-center justify-center group-hover:bg-pf-celeste transition-colors">
              <img :src="a.img" alt="" class="size-[52px] object-contain" />
            </span>
            <span class="text-xs font-semibold text-center leading-[15px]">{{ a.etichetta }}</span>
          </NuxtLink>
        </div>
      </section>

      <!-- Le card che chiedono attenzione: sospese, disattivate o nei 15 giorni di margine.
           Come le notifiche: una card mai accesa (senza data) non è una novità da segnalare. -->
      <section
        v-for="c in cardDaSegnalare"
        :key="c.id"
        :aria-label="`Avviso sulla card di ${c.firstName}`"
        class="mx-5 mt-6 p-4 rounded-[22px] bg-pf-crema flex gap-3.5 items-center"
      >
        <img src="/portale/tessera.webp" alt="" class="size-14 shrink-0 object-contain" />
        <div class="flex-1 flex flex-col gap-1">
          <p class="font-semibold text-[15px] text-pf-giallo-testo">
            <template v-if="c.motivo === 'DISATTIVATA'">La card di {{ c.firstName }} è disattivata</template>
            <template v-else-if="!c.attiva">La card di {{ c.firstName }} è sospesa</template>
            <template v-else>La card di {{ c.firstName }} resta attiva fino al {{ giornoNumeri(c.validaFino) }}</template>
          </p>
          <p class="text-[13px] leading-[18px] text-pf-crema-testo">
            {{ c.attiva ? testoCardInScadenza(c.motivo, true) : testoCardSospesa(c.motivo, true) }}
          </p>
          <PortaleBottone variante="blu" piccolo :to="`/portale/card?alunno=${c.id}`" class="self-start mt-2">Vai alla card</PortaleBottone>
        </div>
      </section>

      <!-- Invito ai consensi facoltativi: solo finché foto/video o promozioni non hanno MAI
           avuto risposta, e si può chiudere. Non è un blocco: un consenso facoltativo che
           assilla la famiglia finché non dice di sì non è più libero. -->
      <section v-if="mostraInvitoConsensi" aria-labelledby="t-consensi" class="mx-5 mt-6 p-4 rounded-[22px] bg-pf-celeste flex gap-3 items-start">
        <UIcon name="i-heroicons-shield-check" class="size-6 shrink-0 text-pf-blu-scuro" aria-hidden="true" />
        <div class="flex-1 flex flex-col gap-1">
          <h2 id="t-consensi" class="font-semibold text-[15px] text-pf-blu-scuro">Due scelte facoltative da fare</h2>
          <p class="text-[13px] leading-[18px] text-pf-blu-scuro">
            Nel tuo profilo puoi dirci se possiamo usare foto e video dei ragazzi e se vuoi ricevere le nostre novità. Puoi cambiare idea quando vuoi.
          </p>
          <NuxtLink to="/portale/profilo" class="self-start mt-1 py-2 text-sm font-semibold text-pf-blu underline-offset-2 hover:underline">Vai al profilo</NuxtLink>
        </div>
        <button type="button" aria-label="Chiudi l'invito" class="size-11 -m-2 shrink-0 rounded-full flex items-center justify-center text-pf-blu-scuro hover:bg-white/60" @click="chiudiInvitoConsensi">
          <UIcon name="i-heroicons-x-mark" class="size-5" aria-hidden="true" />
        </button>
      </section>

      <!-- «Torna da noi quest'anno?»: compare solo se la segreteria l'ha acceso in Rientri -->
      <div class="mx-5 mt-6 empty:hidden"><DomandaRientro /></div>

      <!-- Dalla segreteria: le ultime note e comunicazioni (le note entrano qui e nelle
           Notifiche, non c'è più una voce a parte nel menu). Mai il nome del tutor. -->
      <section v-if="ultimeDallaSegreteria.length" aria-labelledby="t-avvisi" class="mx-5 mt-7 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <img src="/portale/megafono.webp" alt="" class="size-[30px] object-contain" loading="lazy" />
            <h2 id="t-avvisi" class="font-heading font-bold text-lg">Dalla segreteria</h2>
          </div>
          <NuxtLink to="/portale/notifiche" class="py-2 text-sm font-semibold text-pf-blu hover:text-pf-blu-scuro">Tutte</NuxtLink>
        </div>
        <NuxtLink
          v-for="v in ultimeDallaSegreteria"
          :key="v.id"
          :to="v.link ?? '/portale/notifiche'"
          class="bg-white rounded-[22px] p-4 flex flex-col gap-1.5 text-pf-testo pf-ombra hover:bg-pf-fondo transition-colors"
        >
          <span class="flex items-center gap-2">
            <PortaleStato v-if="v.nuova" tono="rosso">Nuova</PortaleStato>
            <span class="text-xs text-pf-grigio">{{ quando(v.data) }}</span>
          </span>
          <span class="font-semibold text-base">{{ v.titolo }}</span>
          <span class="text-sm leading-5 text-pf-grigio-scuro line-clamp-3 whitespace-pre-line">{{ v.testo }}</span>
        </NuxtLink>
      </section>
    </template>

    <!-- ═══ MATERIE SPECIALI DEL MESE (genitore e alunno) ═══ -->
    <section v-if="giornateSpecialiMese.length" aria-labelledby="t-speciali" class="mx-5 mt-7 bg-white rounded-[22px] p-4 flex flex-col gap-3 pf-ombra">
      <div class="flex items-center gap-3">
        <img src="/portale/stella.webp" alt="" class="size-11 object-contain" loading="lazy" />
        <div>
          <h2 id="t-speciali" class="font-semibold text-base">Materie speciali di {{ nomeMeseCorrente }}</h2>
          <p class="text-xs text-pf-grigio">In questi giorni senza supplemento</p>
        </div>
      </div>
      <ul class="flex flex-col gap-2">
        <li v-for="g in giornateSpecialiMese" :key="g.materia" class="flex justify-between items-center gap-3 px-3 py-2.5 bg-pf-fondo rounded-xl">
          <span class="text-sm font-semibold">{{ g.materia }}</span>
          <span class="text-[13px] text-pf-grigio-scuro text-right">{{ g.giorni }}</span>
        </li>
      </ul>
      <p class="text-xs text-pf-grigio">Negli altri giorni è previsto un supplemento di €{{ SUPPLEMENTO_SPECIALE }}.</p>
    </section>

    <!-- ═══ ULTIME CONVENZIONI (genitore) ═══ -->
    <section v-if="!isStudente && ultimeConvenzioni.length" aria-labelledby="t-conv" class="mt-7 flex flex-col gap-3">
      <div class="flex items-center justify-between px-5">
        <div class="flex items-center gap-2">
          <img src="/portale/regalo.webp" alt="" class="size-[30px] object-contain" loading="lazy" />
          <h2 id="t-conv" class="font-heading font-bold text-lg">Ultime convenzioni</h2>
        </div>
        <NuxtLink to="/portale/sconti" class="py-2 text-sm font-semibold text-pf-blu hover:text-pf-blu-scuro">Vedi tutte</NuxtLink>
      </div>
      <div class="flex gap-3 px-5 pb-2 overflow-x-auto snap-x scrollbar-nascosta">
        <NuxtLink
          v-for="c in ultimeConvenzioni"
          :key="c.id"
          :to="`/portale/sconti/${c.id}`"
          class="shrink-0 snap-start w-[200px] bg-white rounded-[22px] overflow-hidden text-pf-testo flex flex-col pf-ombra hover:bg-pf-fondo transition-colors"
        >
          <span class="relative h-[110px] bg-pf-bordo flex items-center justify-center">
            <img v-if="c.foto" :src="c.foto" alt="" loading="lazy" class="size-full object-cover" />
            <UIcon v-else name="i-heroicons-building-storefront" class="size-9 text-pf-grigio" aria-hidden="true" />
            <span v-if="c.sconto" class="absolute top-2.5 left-2.5 text-[13px] font-bold px-2.5 py-1 rounded-full bg-pf-giallo text-pf-giallo-testo">{{ c.sconto }}</span>
          </span>
          <span class="p-3 flex flex-col gap-0.5">
            <span class="font-semibold text-[15px] line-clamp-2">{{ c.nome }}</span>
            <span v-if="c.categoria || c.citta" class="text-xs text-pf-grigio">{{ [c.categoria, c.citta].filter(Boolean).join(' · ') }}</span>
          </span>
        </NuxtLink>
      </div>
    </section>

    <div class="mx-5 mt-6"><InstallBanner /></div>
  </div>
</template>

<script setup lang="ts">
import { SUPPLEMENTO_SPECIALE } from '#shared/tariffe'
import type { Convenzione } from '#shared/convenzioni'
import type { MotivoCard } from '#shared/card-studente'

definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Home — Portale Famiglie' })

const { user } = useUserSession()
const isStudente = computed(() => user.value?.role === 'STUDENTE')

// ─── Saluto e data, in ora italiana ───
const ora = adessoItalia()
const saluto = salutoDellOra(ora.minuti)
const oggiInParole = giornoInParole(ora.giorno)

// ─── Dati: tutti dalle API del portale che già esistono ───
type Studente = { id: string; firstName: string; lastName: string; classe: string | null; scuola: string | null; abilitatoPrenotazioneOnline: boolean; packages: { id: string; nome: string; stati: string[] }[] }
type Prenotazione = { id: string; studentId: string | null; requestedDate: string; status: string; subjects: { name: string }[] }
type Card = { id: string; firstName: string; attiva: boolean; validaFino: string | null; inMargine: boolean; motivo?: MotivoCard | null }
type Voce = { id: string; titolo: string; testo: string; data: string; nuova: boolean; link?: string }

const { data: studentsData } = await useFetch<Studente[]>('/api/portal/students')
const studenti = computed(() => studentsData.value ?? [])
const studenteSolo = computed(() => studenti.value[0])

const { data: bookingsData } = useLazyFetch<Prenotazione[]>('/api/portal/bookings')
const { data: cardData } = useLazyFetch<Card[]>('/api/portal/card')
const { data: portalConfigs } = useLazyFetch<{ giornate_speciali?: Record<string, string[]> }>('/api/portal/configs')
// Le note e le comunicazioni arrivano dalle notifiche: la stessa lettura del layout (stessa chiave)
const { data: notificheData } = useLazyFetch<{ voci: Voce[] }>('/api/portal/notifiche', { server: false, key: 'portale-notifiche-menu' })
const { data: scontiData } = useLazyFetch<Convenzione[]>('/api/portal/sconti', { server: false, immediate: !isStudente.value })

// La prossima lezione di un ragazzo: da oggi in poi, non annullata
function prossimaDi(studentId?: string) {
  if (!studentId) return undefined
  const oggi = ora.giorno
  return (bookingsData.value ?? [])
    .filter((b) => b.studentId === studentId && b.status !== 'CANCELLED' && giornoPrenotazione(b) >= oggi)
    .sort((a, b) => a.requestedDate.localeCompare(b.requestedDate))[0]
}
const materieDi = (b: Prenotazione) => b.subjects.map((s) => s.name).join(', ')

const prenotazioneAbilitata = computed(() => studenti.value.some((s) => s.abilitatoPrenotazioneOnline))

const azioniAlunno = [
  { to: '/portale/prenota', etichetta: 'Prenota lezione', img: '/portale/calendario.webp' },
  { to: '/portale/card', etichetta: 'La mia card', img: '/portale/tessera.webp' },
  { to: '/portale/sconti', etichetta: 'Convenzioni', img: '/portale/regalo.webp' },
]
const azioniGenitore = computed(() => [
  ...(prenotazioneAbilitata.value ? [{ to: '/portale/prenota', etichetta: 'Prenota lezione', img: '/portale/calendario.webp' }] : []),
  { to: '/portale/pagamenti', etichetta: 'Paga il mensile', img: '/portale/portafoglio.webp' },
  { to: '/portale/card', etichetta: 'Card studente', img: '/portale/tessera.webp' },
  { to: '/portale/sconti', etichetta: 'Convenzioni', img: '/portale/regalo.webp' },
])

const cardAlunno = computed(() => cardData.value?.[0])
const cardDaSegnalare = computed(() => (cardData.value ?? []).filter((c) =>
  c.motivo === 'DISATTIVATA' || (!c.attiva && !!c.validaFino) || (c.attiva && c.inMargine && !!c.validaFino)))

const ultimeDallaSegreteria = computed(() => (notificheData.value?.voci ?? [])
  .filter((v) => v.id.startsWith('nota:') || v.id.startsWith('comunicazione:'))
  .slice(0, 2))
const quando = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long' })

// Le ultime arrivate per prime: il server le ordina dalla più vecchia
const ultimeConvenzioni = computed(() => [...(scontiData.value ?? [])].reverse().slice(0, 4))

// ─── Invito ai consensi facoltativi (solo genitori) ───
// Chi lo chiude non lo rivede più su quel dispositivo: la scelta resta nel Profilo.
const invitoChiuso = ref(false)
const { data: consensiFamiglia } = useLazyFetch<{
  figli: { immagini: { valore: boolean | null } }[]
  marketing: { valore: boolean | null }
}>('/api/portal/consensi', { server: false, immediate: !isStudente.value })

onMounted(() => {
  try {
    invitoChiuso.value = localStorage.getItem('invito-consensi-chiuso') === '1'
  } catch {
    // Navigazione privata o cookie bloccati: pazienza, l'invito resta visibile
  }
})

const mostraInvitoConsensi = computed(() => {
  if (isStudente.value || invitoChiuso.value) return false
  const dati = consensiFamiglia.value
  if (!dati) return false
  return dati.marketing?.valore === null || (dati.figli ?? []).some((f) => f.immagini?.valore === null)
})

function chiudiInvitoConsensi() {
  invitoChiuso.value = true
  try {
    localStorage.setItem('invito-consensi-chiuso', '1')
  } catch {
    // se non si può ricordare, l'invito ricomparirà al prossimo accesso
  }
}

// ─── Materie speciali del mese corrente, raggruppate per materia ───
const nomeMeseCorrente = giornoInParole(ora.giorno, { month: 'long' })
const giornateSpecialiMese = computed(() => {
  const giornate = portalConfigs.value?.giornate_speciali ?? {}
  const mese = ora.giorno.slice(0, 7)
  const perMateria = new Map<string, string[]>()
  for (const [data, materie] of Object.entries(giornate).sort(([a], [b]) => a.localeCompare(b))) {
    if (!data.startsWith(mese)) continue
    // Un giorno può avere più materie speciali
    for (const materia of (Array.isArray(materie) ? materie : [materie])) {
      if (!perMateria.has(materia)) perMateria.set(materia, [])
      perMateria.get(materia)!.push(data)
    }
  }
  return [...perMateria.entries()].map(([materia, date]) => ({
    materia,
    giorni: date.map((d) => giornoInParole(d, { weekday: 'short', day: 'numeric' })).join(' · '),
  }))
})
</script>
