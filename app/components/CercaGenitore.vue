<template>
  <div class="space-y-3">
    <UFormField :label="etichetta" :help="aiuto">
      <UInput
        v-model="testo"
        type="search"
        icon="i-heroicons-magnifying-glass"
        autocomplete="off"
        :autofocus="autofocus"
        :loading="caricando"
        placeholder="Es. Rossi, 333 1234567, maria@…"
        class="w-full"
        :aria-describedby="idAnnuncio"
        @keydown.down.prevent="vaiAlRisultato(0)"
      />
    </UFormField>

    <!-- Per i lettori di schermo: quanti risultati ci sono, senza dover cercare la lista -->
    <p :id="idAnnuncio" class="sr-only" aria-live="polite">{{ annuncio }}</p>

    <p v-if="testoPulito.length > 0 && testoPulito.length < 2" class="text-xs text-slate-500">
      Scrivi almeno 2 lettere.
    </p>
    <UAlert v-else-if="errore" color="error" variant="subtle" icon="i-heroicons-exclamation-triangle" :description="errore" />
    <p v-else-if="cercato && !caricando && persone.length === 0" class="text-sm text-slate-500">
      Nessun genitore trovato con “{{ testoPulito }}”. Prova con il cognome, il telefono o il nome del fratello.
    </p>

    <!-- Un bottone vero per ogni risultato: si raggiunge con Tab, si sceglie con
         Invio, e le frecce su/giù passano da uno all'altro. -->
    <ul v-if="persone.length > 0" ref="lista" class="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden" aria-label="Genitori trovati">
      <li v-for="(p, i) in persone" :key="p.chiave">
        <button
          type="button"
          class="w-full text-left px-3 py-2.5 bg-white hover:bg-slate-50 focus-visible:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:-outline-offset-2"
          @click="emit('scegli', p)"
          @keydown.down.prevent="vaiAlRisultato(i + 1)"
          @keydown.up.prevent="i === 0 ? tornaAllaCasella() : vaiAlRisultato(i - 1)"
        >
          <span class="block text-sm text-slate-700">
            <strong class="text-slate-900">{{ p.nome || p.email || 'Genitore senza nome' }}</strong><template v-if="p.figli.length > 0">, {{ parolaParentela(p.relazione) }} di <em>{{ descriviFigli(p) }}</em></template>
          </span>
          <span class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span v-if="p.telefono">{{ p.telefono }}</span>
            <span v-if="p.email" class="break-all">{{ p.email }}</span>
            <span v-if="p.account" class="inline-flex items-center gap-1 text-emerald-700">
              <UIcon name="i-heroicons-globe-alt" class="w-3.5 h-3.5" aria-hidden="true" />
              ha l'accesso al portale
            </span>
          </span>
        </button>
      </li>
    </ul>

    <p v-if="altri && persone.length > 0" class="text-xs text-slate-500">
      Mostro i primi {{ persone.length }}: scrivi qualcosa in più per restringere la ricerca.
    </p>
  </div>
</template>

<script setup lang="ts">
// LA CASELLA "CERCA UN GENITORE GIÀ REGISTRATO" (C5).
// Si scrive cognome, nome, telefono o email — del genitore o del fratello — e
// ogni risultato dice di chi si tratta ("Maria Bianchi, mamma di Luca Rossi").
// Il componente cerca e basta: la persona scelta la riceve chi lo usa (wizard
// Nuovo studente, scheda alunno), che decide dove copiarla.
import { parolaParentela } from '#shared/genitori'
import type { PersonaGenitore, RisultatoCercaGenitori } from '#shared/genitori'

withDefaults(defineProps<{
  etichetta?: string
  aiuto?: string
  /** Mette subito il cursore nella casella (quando la ricerca si apre con un clic) */
  autofocus?: boolean
}>(), {
  etichetta: 'Cerca il genitore',
  aiuto: 'Cognome, nome, telefono o email del genitore, oppure il nome del fratello o della sorella.',
  autofocus: false,
})

const emit = defineEmits<{ scegli: [persona: PersonaGenitore] }>()

const testo = ref('')
const testoPulito = computed(() => testo.value.trim())
const persone = ref<PersonaGenitore[]>([])
const altri = ref(false)
const caricando = ref(false)
const cercato = ref(false)
const errore = ref('')
const lista = ref<HTMLElement | null>(null)
const idAnnuncio = useId()

const annuncio = computed(() => {
  if (caricando.value) return 'Ricerca in corso…'
  if (!cercato.value) return ''
  const n = persone.value.length
  if (n === 0) return 'Nessun genitore trovato'
  return n === 1 ? '1 genitore trovato. Freccia giù per sceglierlo.' : `${n} genitori trovati. Freccia giù per sceglierne uno.`
})

// La ricerca parte 300 ms dopo l'ultimo tasto (come nelle altre liste): niente
// chiamata a ogni lettera. Il numero `richiesta` scarta le risposte arrivate in
// ritardo: se scrivo "ros" e poi "rossi", deve restare a schermo "rossi" anche
// quando la risposta di "ros" arriva per ultima.
let timer: ReturnType<typeof setTimeout> | null = null
let richiesta = 0

watch(testoPulito, (q) => {
  if (timer) clearTimeout(timer)
  if (q.length < 2) {
    richiesta++
    persone.value = []
    altri.value = false
    cercato.value = false
    caricando.value = false
    errore.value = ''
    return
  }
  caricando.value = true
  timer = setTimeout(() => cerca(q), 300)
})
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })

async function cerca(q: string) {
  const mia = ++richiesta
  try {
    const res = await $fetch<RisultatoCercaGenitori>('/api/admin/genitori/cerca', { query: { q } })
    if (mia !== richiesta) return
    persone.value = res.persone
    altri.value = res.altri
    errore.value = ''
  } catch (e: any) {
    if (mia !== richiesta) return
    persone.value = []
    altri.value = false
    errore.value = e?.data?.statusMessage ?? 'Ricerca non riuscita: riprova tra un attimo.'
  } finally {
    if (mia === richiesta) {
      caricando.value = false
      cercato.value = true
    }
  }
}

// "Luca Rossi (3ª Media)", "Luca Rossi (3ª Media) e Sara Rossi (ex alunno)"…
// Oltre tre figli la riga diventerebbe un paragrafo: si dice solo quanti altri.
function descriviFigli(p: PersonaGenitore): string {
  const nomi = p.figli.map((f) => {
    const tra = [f.classe, f.attivo ? null : 'ex alunno'].filter(Boolean).join(', ')
    return tra ? `${f.nome} (${tra})` : f.nome
  })
  if (nomi.length <= 1) return nomi[0] ?? ''
  if (nomi.length <= 3) return `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`
  return `${nomi.slice(0, 3).join(', ')} e altri ${nomi.length - 3}`
}

// Tastiera: dalla casella, freccia giù porta al primo risultato; fra i risultati
// su e giù scorrono, e dal primo freccia su torna alla casella.
function vaiAlRisultato(indice: number) {
  const bottoni = lista.value?.querySelectorAll<HTMLButtonElement>('button')
  bottoni?.[Math.min(indice, bottoni.length - 1)]?.focus()
}
function tornaAllaCasella() {
  lista.value?.parentElement?.querySelector<HTMLInputElement>('input')?.focus()
}
</script>
