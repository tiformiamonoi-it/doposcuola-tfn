<template>
  <div class="flex flex-col flex-1" :class="passo < 4 ? 'pb-40' : ''">
    <!-- ═══ PASSI 1–3: testata con "Passo N di 3" e la barra di avanzamento ═══ -->
    <PortaleTestata v-if="passo < 4" :campanella="false" :indietro="passo === 1 ? '/portale/lezioni' : true" @indietro="() => { passo-- }">
      <template #destra>
        <span class="text-sm font-semibold text-pf-su-blu">Passo {{ passo }} di 3</span>
      </template>
      <template #titolo>
        <div class="flex items-center justify-between gap-3">
          <div class="flex flex-col gap-1 min-w-0">
            <h1 class="font-heading font-bold text-[25px] leading-tight">{{ TITOLI[passo - 1] }}</h1>
            <p class="text-[15px] first-letter:uppercase">{{ sottotitolo }}</p>
          </div>
          <img :src="IMMAGINI[passo - 1]" alt="" class="size-[70px] shrink-0 object-contain" />
        </div>
      </template>
      <div role="progressbar" aria-label="Avanzamento" aria-valuemin="1" aria-valuemax="3" :aria-valuenow="passo" :aria-valuetext="`Passo ${passo} di 3`" class="flex gap-1.5">
        <span v-for="n in 3" :key="n" class="flex-1 h-1.5 rounded-full" :class="n <= passo ? 'bg-pf-giallo' : 'bg-white/35'" />
      </div>
    </PortaleTestata>

    <!-- ═══ PASSO 1: per chi e quando ═══ -->
    <template v-if="passo === 1">
      <section v-if="studenti.length > 1" aria-labelledby="t-chi" class="mx-5 mt-6 flex flex-col gap-3">
        <h2 id="t-chi" class="text-[15px] font-bold text-pf-grigio uppercase tracking-wide">Per chi</h2>
        <div class="grid grid-cols-2 gap-2.5">
          <button
            v-for="(s, i) in studenti"
            :key="s.id"
            type="button"
            :aria-pressed="form.studentId === s.id"
            :disabled="!prenotabile(s)"
            class="relative min-h-[84px] rounded-[20px] flex items-center gap-2.5 px-3.5 text-left transition-colors disabled:cursor-not-allowed"
            :class="form.studentId === s.id ? 'border-2 border-pf-blu bg-white' : prenotabile(s) ? 'border border-pf-bordo bg-white hover:border-pf-blu' : 'border border-pf-bordo bg-pf-fondo text-pf-grigio'"
            @click="scegliStudente(s.id)"
          >
            <PortaleAvatar :nome="s.firstName" :indice="i" />
            <span class="flex flex-col gap-0.5 min-w-0">
              <span class="font-semibold text-[15px] truncate">{{ s.firstName }}</span>
              <span class="text-xs font-semibold" :class="!prenotabile(s) ? 'text-pf-grigio' : statoPacchettoPortale(s.packages?.[0]).tono === 'verde' ? 'text-pf-verde' : 'text-pf-rosso'">
                {{ prenotabile(s) ? `Pacchetto ${statoPacchettoPortale(s.packages?.[0]).etichetta.toLowerCase()}` : 'Prenotazione non attiva' }}
              </span>
            </span>
            <span v-if="form.studentId === s.id" class="absolute top-2 right-2 size-5 rounded-full bg-pf-blu text-white flex items-center justify-center" aria-hidden="true">
              <UIcon name="i-heroicons-check" class="size-3" />
            </span>
          </button>
        </div>
      </section>

      <section aria-labelledby="t-quando" class="mx-5 mt-6 flex flex-col gap-3">
        <h2 id="t-quando" class="text-[15px] font-bold text-pf-grigio uppercase tracking-wide">Quando</h2>
        <div class="bg-white rounded-3xl p-4 pf-ombra">
          <PortaleCalendario :model-value="form.dataDesiderata" v-model:mese="mese" :segni="segni" :spento="giornoSpento" @update:model-value="scegliGiorno" />
        </div>
        <div v-if="materieSpecialiDelGiorno.length" class="px-3.5 py-3 rounded-[18px] bg-pf-crema flex items-center gap-3">
          <img src="/portale/stella.webp" alt="" class="size-10 shrink-0 object-contain" />
          <p class="text-sm leading-5 text-pf-giallo-testo">
            <span class="first-letter:uppercase inline-block">{{ giornoInParole(form.dataDesiderata, { weekday: 'long', day: 'numeric' }) }}</span>
            c'è <strong>{{ materieSpecialiDelGiorno.join(', ') }}</strong>: in questo giorno è senza supplemento.
          </p>
        </div>
        <p v-if="isEditMode" class="px-3.5 py-3 rounded-[18px] bg-pf-celeste text-sm text-pf-blu-scuro">
          In questo giorno c'è già una lezione: andando avanti la modifichi.
        </p>
      </section>
    </template>

    <!-- ═══ PASSO 2: le materie ═══ -->
    <div v-else-if="passo === 2" class="px-5 pt-6 flex flex-col gap-5">
      <div v-if="materieSpecialiDelGiorno.length" class="px-3.5 py-3 rounded-[18px] bg-pf-crema flex items-center gap-3">
        <img src="/portale/stella.webp" alt="" class="size-10 shrink-0 object-contain" />
        <p class="text-sm leading-5 text-pf-giallo-testo">
          In questo giorno c'è <strong>{{ materieSpecialiDelGiorno.join(', ') }}</strong>: senza supplemento.
          <template v-if="MATERIE_SPECIALI.length > materieSpecialiDelGiorno.length">Le altre materie speciali costano €{{ SUPPLEMENTO_SPECIALE }} in più.</template>
        </p>
      </div>

      <label class="min-h-[52px] px-4 rounded-2xl bg-white border border-pf-bordo flex items-center gap-2.5 text-pf-grigio focus-within:border-pf-blu">
        <UIcon name="i-heroicons-magnifying-glass" class="size-5" aria-hidden="true" />
        <span class="sr-only">Cerca una materia</span>
        <input v-model="cerca" type="search" placeholder="Cerca una materia" class="flex-1 bg-transparent text-base text-pf-testo outline-none! py-3" />
      </label>

      <section aria-labelledby="t-materie" class="flex flex-col gap-2.5">
        <h2 id="t-materie" class="text-[15px] font-bold text-pf-grigio uppercase tracking-wide">Tocca le materie</h2>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="m in materieMostrate"
            :key="m"
            type="button"
            :aria-pressed="form.materie.includes(m)"
            class="min-h-[52px] px-3.5 py-2.5 rounded-[18px] border text-left flex flex-col justify-center gap-0.5 text-[15px] transition-colors"
            :class="form.materie.includes(m)
              ? 'border-pf-blu bg-pf-blu text-white font-semibold shadow-[0_6px_14px_rgb(0_107_172/0.25)]'
              : materieSpecialiDelGiorno.includes(m) ? 'border-pf-giallo/50 bg-pf-crema text-pf-testo font-medium' : 'border-pf-bordo bg-white text-pf-testo font-medium hover:border-pf-blu'"
            @click="toggleMateria(m)"
          >
            <span>{{ m }}</span>
            <!-- La riga piccola dice cosa comporta scegliere questa materia PROPRIO in questa data -->
            <span v-if="materieSpecialiDelGiorno.includes(m)" class="text-xs font-semibold" :class="form.materie.includes(m) ? 'text-pf-su-blu' : 'text-pf-crema-testo'">in programma in questo giorno</span>
            <span v-else-if="MATERIE_SPECIALI.includes(m)" class="text-xs font-semibold" :class="form.materie.includes(m) ? 'text-pf-su-blu' : 'text-pf-grigio'">
              + €{{ SUPPLEMENTO_SPECIALE }}<template v-if="prossimaGiornataDi(m)"> · gratis {{ prossimaGiornataDi(m) }}</template>
            </span>
          </button>
        </div>
        <p v-if="materieMostrate.length === 0" class="text-sm text-pf-grigio text-center">Nessuna materia con questo nome.</p>
        <p v-else-if="giaPrenotate.length" class="text-[13px] text-pf-grigio text-center">Le materie già prenotate da {{ nomeStudente }} compaiono per prime.</p>
      </section>

      <p v-if="specialeFuoriData" class="px-3.5 py-3 rounded-[18px] bg-pf-crema text-sm text-pf-giallo-testo">
        <strong>{{ specialiFuoriData.join(', ') }}</strong> in questo giorno {{ specialiFuoriData.length > 1 ? 'sono fuori' : 'è fuori' }}
        dalla giornata dedicata: è previsto un <strong>supplemento di €{{ SUPPLEMENTO_SPECIALE }}</strong> per la giornata, che verrà aggiunto al pacchetto.
      </p>
    </div>

    <!-- ═══ PASSO 3: controlla e prenota ═══ -->
    <div v-else-if="passo === 3" class="px-5 pt-6 flex flex-col gap-5">
      <section aria-labelledby="t-riep" class="flex flex-col gap-2.5">
        <h2 id="t-riep" class="text-[15px] font-bold text-pf-grigio uppercase tracking-wide">Riepilogo</h2>
        <dl class="bg-white rounded-[22px] px-4 py-1 pf-ombra divide-y divide-pf-fondo">
          <div class="flex items-center gap-3 py-3">
            <dt class="w-24 shrink-0 text-sm text-pf-grigio">Per</dt>
            <dd class="flex-1 text-[15px] font-semibold">{{ nomeStudente }}</dd>
            <button v-if="studenti.length > 1" type="button" class="min-h-11 px-1 text-sm font-semibold text-pf-blu" @click="() => { passo = 1 }">Cambia<span class="sr-only"> ragazzo</span></button>
          </div>
          <div class="flex items-center gap-3 py-3">
            <dt class="w-24 shrink-0 text-sm text-pf-grigio">Quando</dt>
            <dd class="flex-1 text-[15px] font-semibold">{{ giornoInParole(form.dataDesiderata) }}</dd>
            <button type="button" class="min-h-11 px-1 text-sm font-semibold text-pf-blu" @click="() => { passo = 1 }">Cambia<span class="sr-only"> giorno</span></button>
          </div>
          <div class="flex items-center gap-3 py-3">
            <dt class="w-24 shrink-0 text-sm text-pf-grigio">Materie</dt>
            <dd class="flex-1 text-[15px] font-semibold">{{ form.materie.join(', ') }}</dd>
            <button type="button" class="min-h-11 px-1 text-sm font-semibold text-pf-blu" @click="() => { passo = 2 }">Cambia<span class="sr-only"> materie</span></button>
          </div>
          <div class="flex items-center gap-3 py-3">
            <dt class="w-24 shrink-0 text-sm text-pf-grigio">Supplemento</dt>
            <dd class="flex-1 text-[15px] font-semibold" :class="specialeFuoriData ? 'text-pf-crema-testo' : 'text-pf-verde'">
              {{ specialeFuoriData ? `+ €${formatImporto(SUPPLEMENTO_SPECIALE)}` : 'Nessuno' }}
            </dd>
          </div>
        </dl>
      </section>

      <div class="flex flex-col gap-2.5">
        <label for="nota-prenota" class="text-[15px] font-bold text-pf-grigio uppercase tracking-wide">
          Nota per la segreteria <span class="normal-case font-medium">(facoltativa)</span>
        </label>
        <textarea
          id="nota-prenota"
          v-model="form.noteOrario"
          rows="3"
          placeholder="Es. arriva dopo le 16:30"
          class="w-full px-3.5 py-3 rounded-2xl border border-pf-bordo bg-white text-base text-pf-testo resize-none"
        />
      </div>

      <p class="px-3.5 py-3 rounded-2xl bg-pf-celeste flex gap-2.5 items-start text-sm leading-5 text-pf-blu-scuro">
        <UIcon name="i-heroicons-information-circle" class="size-5 shrink-0" aria-hidden="true" />
        La lezione è confermata appena la prenoti. Potrai modificarla entro le 11:30 e annullarla entro le 12:30 del giorno stesso.
      </p>
    </div>

    <!-- ═══ PASSO 4: lezione prenotata (schermata 6) ═══ -->
    <template v-else>
      <header class="pf-testata-sfondo text-white rounded-b-[40px] min-h-[300px] flex flex-col items-center justify-end gap-2 pb-7 px-5">
        <img src="/portale/calendario.webp" alt="" class="size-[150px] object-contain" />
        <h1 class="font-heading font-bold text-[26px]" tabindex="-1" ref="titoloFatto">{{ isEditMode ? 'Lezione modificata!' : 'Lezione prenotata!' }}</h1>
      </header>
      <div class="px-5 pt-6 flex flex-col gap-4">
        <p class="text-[15px] leading-[22px] text-pf-grigio-scuro text-center">
          È tutto confermato: ti aspettiamo {{ giornoInParole(form.dataDesiderata) }}.
          Il giorno prima la trovi anche tra le notifiche.
        </p>
        <dl class="bg-white rounded-[22px] px-4 py-1.5 pf-ombra divide-y divide-pf-fondo">
          <div class="flex justify-between gap-3 py-3"><dt class="text-sm text-pf-grigio">Per</dt><dd class="text-sm font-semibold">{{ nomeStudente }}</dd></div>
          <div class="flex justify-between gap-3 py-3"><dt class="text-sm text-pf-grigio">Quando</dt><dd class="text-sm font-semibold">{{ giornoInParole(form.dataDesiderata) }}</dd></div>
          <div class="flex justify-between gap-3 py-3"><dt class="text-sm text-pf-grigio">Materie</dt><dd class="text-sm font-semibold text-right">{{ form.materie.join(', ') }}</dd></div>
          <div class="flex justify-between gap-3 py-3 items-center"><dt class="text-sm text-pf-grigio">Stato</dt><dd><PortaleStato tono="verde">Confermata</PortaleStato></dd></div>
        </dl>
        <div class="flex flex-col gap-2.5 pt-4">
          <PortaleBottone variante="blu" blocco to="/portale/lezioni">Vai alle mie lezioni</PortaleBottone>
          <PortaleBottone variante="chiaro" blocco to="/portale">Torna alla Home</PortaleBottone>
        </div>
      </div>
    </template>

    <!-- ═══ Il fondo fisso con il riepilogo e il bottone giallo (passi 1–3) ═══ -->
    <footer v-if="passo < 4" class="fixed bottom-0 inset-x-0 z-40">
      <div class="mx-auto max-w-[640px] bg-white rounded-t-[28px] px-5 pt-4 flex flex-col gap-3 shadow-[0_-8px_24px_rgb(15_27_45/0.08)]" style="padding-bottom: max(20px, env(safe-area-inset-bottom))">
        <p class="text-[15px] font-semibold text-center first-letter:uppercase" aria-live="polite">{{ riepilogoFondo }}</p>
        <PortaleBottone v-if="passo < 3" grande blocco :disabled="!passoCompleto" @click="() => { passo++ }">
          Avanti <UIcon name="i-heroicons-chevron-right" class="size-5" aria-hidden="true" />
        </PortaleBottone>
        <PortaleBottone v-else grande blocco :loading="loading" @click="inviaPrenotazione">
          {{ isEditMode ? 'Salva le modifiche' : 'Prenota la lezione' }}
        </PortaleBottone>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { SUPPLEMENTO_SPECIALE } from '#shared/tariffe'
import { MATERIE_DEFAULT } from '#shared/materie'
import { isDomenica } from '#shared/giorno-civile'
import { formatImporto } from '~/utils/format'

// PRENOTA IN 3 PASSI + "Lezione prenotata!" (schermate 3–6). La lezione nasce già
// confermata: niente "richiesta inviata", niente "la segreteria assegnerà l'orario".
// Da Lezioni → Modifica si arriva qui con ?studente=…&data=…: il giorno con la lezione
// già prenotata apre la modifica (stessa regola di sempre: una lezione per giorno).
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
  senzaMenu: true,
})
useHead({ title: 'Prenota — Portale Famiglie' })

const TITOLI = ['Prenota una lezione', 'Quali materie?', 'Controlla e prenota']
const IMMAGINI = ['/portale/calendario.webp', '/portale/libri.webp', '/portale/zaino.webp']

type Studente = { id: string; firstName: string; lastName: string; abilitatoPrenotazioneOnline: boolean; packages?: { stati: string[] }[] }
type Prenotazione = { id: string; studentId: string | null; requestedDate: string; status: string; notes: string | null; subjects: { name: string }[] }

const route = useRoute()
const toast = useToast()
const { user } = useUserSession()
const isStudente = computed(() => user.value?.role === 'STUDENTE')

const { data: portalConfigs } = useLazyFetch<{ materie?: string[]; materie_speciali?: string[]; giornate_speciali?: Record<string, string[]> }>('/api/portal/configs')
const MATERIE = computed<string[]>(() => portalConfigs.value?.materie ?? [...MATERIE_DEFAULT])
// Materie speciali: giornate dedicate + supplemento fuori data. Nelle giornate prefissate
// se ne possono prenotare più di una (senza supplemento); fuori data UNA sola.
const MATERIE_SPECIALI = computed<string[]>(() => portalConfigs.value?.materie_speciali ?? [])
const GIORNATE_SPECIALI = computed<Record<string, string[]>>(() => portalConfigs.value?.giornate_speciali ?? {})

const { data: studentsData } = await useFetch<Studente[]>('/api/portal/students')
const studenti = computed(() => studentsData.value ?? [])
const { data: closuresData } = useLazyFetch<{ date: string }[]>('/api/portal/closures')
const { data: bookingsData } = await useFetch<Prenotazione[]>('/api/portal/bookings')
const prenotazioni = computed(() => (bookingsData.value ?? []).filter((b) => b.status !== 'CANCELLED'))

const passo = ref(1)
const loading = ref(false)
const cerca = ref('')
const oggi = adessoItalia().giorno
const mese = ref(oggi.slice(0, 7))

const form = reactive({ studentId: '', dataDesiderata: '', materie: [] as string[], noteOrario: '' })
const isEditMode = ref(false)
const editBookingId = ref<string | null>(null)

// Il genitore prenota per i figli abilitati alla prenotazione online; lo STUDENTE sempre
// (il permesso è l'account stesso, come controlla bookings.post.ts).
const prenotabile = (s: Studente) => isStudente.value || s.abilitatoPrenotazioneOnline
const nomeStudente = computed(() => studenti.value.find((s) => s.id === form.studentId)?.firstName ?? '')

// ─── Calendario ───
function giornoSpento(g: string) {
  if (g < oggi) return true
  if (isDomenica(g)) return true
  if ((closuresData.value ?? []).some((c) => c.date === g)) return true
  // Oggi solo entro le 11:30
  return g === oggi && !lezioneModificabile(g)
}
const esistente = (g: string) => prenotazioni.value.find((b) => b.studentId === form.studentId && giornoPrenotazione(b) === g)
const segni = (g: string) => ({ lezione: !!esistente(g), speciale: (GIORNATE_SPECIALI.value[g]?.length ?? 0) > 0 })

function scegliGiorno(g: string) {
  if (giornoSpento(g)) return
  form.dataDesiderata = g
  const gia = esistente(g)
  isEditMode.value = !!gia
  editBookingId.value = gia?.id ?? null
  form.materie = gia ? gia.subjects.map((s) => s.name) : []
  form.noteOrario = gia?.notes ?? ''
}

function scegliStudente(id: string) {
  form.studentId = id
  // Il giorno già scelto può avere (o non avere) una lezione per l'altro figlio
  if (form.dataDesiderata) scegliGiorno(form.dataDesiderata)
}

// Primo ragazzo prenotabile, oppure quello e il giorno arrivati da "Modifica"
const daQuery = String(route.query.studente ?? '')
const primo = studenti.value.find((s) => s.id === daQuery && prenotabile(s)) ?? studenti.value.find(prenotabile)
if (primo) form.studentId = primo.id
const dataQuery = String(route.query.data ?? '')
if (/^\d{4}-\d{2}-\d{2}$/.test(dataQuery) && !giornoSpento(dataQuery)) {
  mese.value = dataQuery.slice(0, 7)
  scegliGiorno(dataQuery)
}

// ─── Materie ───
const materieSpecialiDelGiorno = computed<string[]>(() => GIORNATE_SPECIALI.value[form.dataDesiderata] ?? [])
// Le materie già prenotate da questo ragazzo, dalla più frequente: sono quelle che si cercano
const giaPrenotate = computed(() => {
  const conta = new Map<string, number>()
  for (const b of prenotazioni.value) {
    if (b.studentId !== form.studentId) continue
    for (const s of b.subjects) conta.set(s.name, (conta.get(s.name) ?? 0) + 1)
  }
  return [...conta.entries()].sort((a, b) => b[1] - a[1]).map(([nome]) => nome)
})
// In cima le speciali del giorno, poi quelle già prenotate, poi le altre
const materieOrdinate = computed(() => {
  const peso = (m: string) => materieSpecialiDelGiorno.value.includes(m) ? -1000 : giaPrenotate.value.includes(m) ? giaPrenotate.value.indexOf(m) - 500 : 0
  return [...MATERIE.value].sort((a, b) => peso(a) - peso(b))
})
const materieMostrate = computed(() => {
  const q = cerca.value.trim().toLowerCase()
  return q ? materieOrdinate.value.filter((m) => m.toLowerCase().includes(q)) : materieOrdinate.value
})

// Per una materia speciale scelta nel giorno sbagliato: QUANDO sarebbe senza supplemento
function prossimaGiornataDi(materia: string): string | null {
  const giorno = Object.keys(GIORNATE_SPECIALI.value)
    .filter((d) => d > form.dataDesiderata && (GIORNATE_SPECIALI.value[d] ?? []).includes(materia))
    .sort()[0]
  return giorno ? giornoInParole(giorno, { weekday: 'short', day: 'numeric', month: 'numeric' }) : null
}

const specialiScelte = computed(() => form.materie.filter((m) => MATERIE_SPECIALI.value.includes(m)))
const specialiFuoriData = computed(() => specialiScelte.value.filter((m) => !materieSpecialiDelGiorno.value.includes(m)))
const specialeFuoriData = computed(() => specialiFuoriData.value.length > 0)

function toggleMateria(m: string) {
  const i = form.materie.indexOf(m)
  if (i !== -1) { form.materie.splice(i, 1); return }
  const fuoriData = MATERIE_SPECIALI.value.includes(m) && !materieSpecialiDelGiorno.value.includes(m)
  if (fuoriData && specialiFuoriData.value.length >= 1) {
    toast.add({
      title: 'Una sola materia speciale fuori data',
      description: `Fuori dalle sue giornate puoi prenotare una sola materia speciale (hai già ${specialiFuoriData.value.join(', ')}).`,
      color: 'warning',
    })
    return
  }
  form.materie.push(m)
}

// ─── Testi della testata e del fondo ───
const sottotitolo = computed(() => {
  if (passo.value === 1) return 'Per chi e quando'
  if (passo.value === 2) return [nomeStudente.value, form.dataDesiderata && giornoInParole(form.dataDesiderata)].filter(Boolean).join(' · ')
  return 'Ultimo passo'
})
const riepilogoFondo = computed(() => {
  if (passo.value === 2) return form.materie.length ? `${form.materie.length} ${form.materie.length === 1 ? 'materia' : 'materie'}: ${form.materie.join(', ')}` : 'Scegli almeno una materia'
  if (!form.dataDesiderata) return 'Scegli un giorno'
  return [nomeStudente.value, giornoInParole(form.dataDesiderata)].filter(Boolean).join(' · ')
})
const passoCompleto = computed(() => passo.value === 1 ? !!(form.studentId && form.dataDesiderata) : form.materie.length > 0)

// ─── Prenota (o salva la modifica) ───
const titoloFatto = ref<HTMLElement | null>(null)
async function inviaPrenotazione() {
  loading.value = true
  try {
    const body = { dataDesiderata: `${form.dataDesiderata}T12:00:00.000Z`, materie: form.materie, noteOrario: form.noteOrario || undefined }
    if (isEditMode.value && editBookingId.value) {
      await $fetch(`/api/portal/bookings/${editBookingId.value}`, { method: 'PUT', body })
    } else {
      await $fetch('/api/portal/bookings', { method: 'POST', body: { ...body, studentId: form.studentId } })
    }
    passo.value = 4
    window.scrollTo({ top: 0 })
    // Il lettore di schermo annuncia subito l'esito
    await nextTick()
    titoloFatto.value?.focus()
  } catch (e: any) {
    toast.add({ title: 'Non è stato possibile prenotare', description: e?.data?.statusMessage ?? 'Riprova fra poco.', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>
