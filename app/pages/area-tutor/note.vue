<template>
  <div>
    <PortaleTestata titolo="Note" indietro="/area-tutor" :campanella="false">
      <!-- Tre linguette: bottoni veri, quella scelta è "premuta" (come la scelta della card) -->
      <div role="group" aria-label="Sezioni delle note" class="p-1 bg-pf-blu-tasto rounded-[14px] grid grid-cols-3 gap-1">
        <button
          v-for="l in LINGUETTE"
          :key="l.id"
          type="button"
          :aria-pressed="sezione === l.id"
          class="min-h-11 rounded-[11px] text-sm px-2 transition-colors"
          :class="sezione === l.id ? 'bg-white text-pf-blu font-semibold' : 'text-white font-medium hover:bg-pf-blu-scuro'"
          @click="scegli(l.id)"
        >
          {{ l.etichetta }}
        </button>
      </div>
    </PortaleTestata>

    <!-- ═══ SCRIVI: il modulo che prima stava nel calendario ═══ -->
    <form v-if="sezione === 'scrivi'" class="mx-5 mt-5 flex flex-col gap-5" @submit.prevent="salvaNota">
      <div class="flex flex-col gap-1.5">
        <label for="nota-alunno" class="text-sm font-semibold">Alunno</label>
        <USelectMenu
          id="nota-alunno"
          aria-label="Alunno"
          v-model="notaState.studentId"
          :items="opzioniAlunni"
          value-key="value"
          :loading="caricandoAlunni"
          placeholder="Cerca per nome..."
          size="xl"
          class="w-full"
        />
      </div>

      <fieldset class="flex flex-col gap-2.5">
        <legend class="text-sm font-semibold mb-1.5">Chi la può leggere?</legend>
        <label
          v-for="v in VISIBILITA"
          :key="v.valore"
          class="flex gap-3 items-start px-4 py-3.5 rounded-[18px] bg-white cursor-pointer"
          :class="notaState.visibilita === v.valore ? 'border-2 border-pf-blu' : 'border border-pf-grigio/50 m-px'"
        >
          <input v-model="notaState.visibilita" type="radio" name="visibilita" :value="v.valore" class="mt-1 size-5 accent-pf-blu" />
          <span class="flex flex-col gap-0.5">
            <span class="font-semibold text-[15px]">{{ v.titolo }}</span>
            <span class="text-[13px] leading-[18px] text-pf-grigio">{{ v.spiegazione }}</span>
          </span>
        </label>
      </fieldset>

      <div class="flex flex-col gap-1.5">
        <label for="nota-testo" class="text-sm font-semibold">La nota</label>
        <textarea
          id="nota-testo"
          v-model="notaState.contenuto"
          rows="5"
          placeholder="Scrivi qui..."
          class="px-4 py-3 rounded-2xl bg-white border border-pf-bordo text-[15px] leading-[22px] focus:border-pf-blu"
        />
      </div>

      <PortaleBottone type="submit" :loading="salvandoNota" blocco grande>Salva la nota</PortaleBottone>
    </form>

    <!-- ═══ LE MIE: le note che ho scritto (prima "Cronologia") ═══ -->
    <section v-else-if="sezione === 'mie'" aria-label="Le note che hai scritto" class="mx-5 mt-5">
      <div v-if="pendingMie" class="flex flex-col gap-3">
        <USkeleton v-for="i in 3" :key="i" class="h-24 w-full rounded-[20px]" />
      </div>
      <p v-else-if="!mie?.length" class="bg-white rounded-3xl p-6 text-center text-sm text-pf-grigio-scuro pf-ombra">Non hai scritto alcuna nota.</p>
      <ul v-else class="flex flex-col gap-3">
        <li v-for="n in mie" :key="n.id" class="bg-white rounded-[20px] p-4 flex flex-col gap-2 pf-ombra">
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="font-semibold text-[15px]">{{ n.student?.firstName }} {{ n.student?.lastName ? n.student.lastName.charAt(0) + '.' : '' }}</span>
              <time :datetime="n.createdAt" class="text-xs text-pf-grigio">{{ formatDataOra(n.createdAt) }}</time>
            </div>
            <PortaleStato :tono="statoNota(n).tono">{{ statoNota(n).etichetta }}</PortaleStato>
          </div>
          <p class="text-sm leading-5 text-pf-grigio-scuro whitespace-pre-wrap">{{ n.contenuto }}</p>
        </li>
      </ul>
    </section>

    <!-- ═══ SUGLI ALUNNI: cosa hanno scritto colleghi e segreteria (solo lettura) ═══ -->
    <section v-else aria-label="Note sugli alunni" class="mx-5 mt-5 flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label for="note-alunno" class="text-sm font-semibold">Di quale alunno?</label>
        <USelectMenu
          id="note-alunno"
          aria-label="Di quale alunno?"
          v-model="alunnoId"
          :items="opzioniAlunni"
          value-key="value"
          :loading="caricandoAlunni"
          placeholder="Cerca per nome..."
          size="xl"
          class="w-full"
        />
        <span class="text-[13px] text-pf-grigio">Utile quando sostituisci un collega: leggi cosa hanno notato gli altri.</span>
      </div>

      <p v-if="!alunnoId" class="py-6 text-center text-sm text-pf-grigio">Scegli un alunno qui sopra per vedere le sue note.</p>
      <div v-else-if="status === 'pending'" class="flex flex-col gap-3" aria-busy="true">
        <USkeleton v-for="i in 3" :key="i" class="h-24 w-full rounded-[20px]" />
      </div>
      <p v-else-if="status === 'error'" class="py-6 text-center text-sm text-pf-grigio-scuro">Non è stato possibile caricare le note. Riprova tra poco.</p>
      <p v-else-if="!noteAlunno?.length" class="bg-white rounded-3xl p-6 text-center text-sm text-pf-grigio-scuro pf-ombra">Nessuna nota su questo alunno.</p>
      <ul v-else class="flex flex-col gap-3">
        <li v-for="n in noteAlunno" :key="n.id" class="bg-white rounded-[20px] p-4 flex flex-col gap-2 pf-ombra">
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="font-semibold text-[15px]">{{ n.author ? `${n.author.firstName} ${n.author.lastName}`.trim() : '—' }}</span>
              <span class="text-xs text-pf-grigio">
                <time :datetime="n.createdAt">{{ formatDataOra(n.createdAt) }}</time>
                <template v-if="n.lesson"> · lezione del {{ formatData(n.lesson.data) }}</template>
              </span>
            </div>
            <PortaleStato :tono="n.visibilita === 'FAMIGLIA' ? 'verde' : 'grigio'">{{ n.visibilita === 'FAMIGLIA' ? 'Inviata alla famiglia' : 'Interna' }}</PortaleStato>
          </div>
          <p class="text-sm leading-5 text-pf-grigio-scuro whitespace-pre-wrap">{{ n.contenuto }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { TonoStato } from '~/utils/portale'

// LE NOTE (bozza Note): Scrivi (il modulo che stava in /tutor-calendario), Le mie (prima
// /area-tutor/cronologia, che ora rimanda qui) e Sugli alunni. La linguetta sta
// nell'indirizzo (?tab=mie, ?tab=alunni), così la Home ci porta dritta.
definePageMeta({ layout: 'tutor', middleware: ['tutor-only'] })
useHead({ title: 'Note — Area Tutor' })

const toast = useToast()
const route = useRoute()

type Sezione = 'scrivi' | 'mie' | 'alunni'
const LINGUETTE: { id: Sezione, etichetta: string }[] = [
  { id: 'scrivi', etichetta: 'Scrivi' },
  { id: 'mie', etichetta: 'Le mie' },
  { id: 'alunni', etichetta: 'Sugli alunni' },
]
const sezione = computed<Sezione>(() => (['mie', 'alunni'].includes(String(route.query.tab)) ? route.query.tab as Sezione : 'scrivi'))
const scegli = (id: Sezione) => navigateTo({ query: id === 'scrivi' ? {} : { tab: id } }, { replace: true })

// ─── Gli alunni per le due tendine ───
// Tutti gli alunni attivi, non solo i suoi: un tutor può sostituire un collega e deve
// poter leggere cosa è stato notato. Versione "leggera" dell'elenco: i recapiti dei
// genitori il server li toglie già ai tutor.
interface Alunno { id: string, firstName: string, lastName: string }
const { data: alunniRes, status: statoAlunni } = useLazyFetch<{ data: Alunno[] }>('/api/students', {
  query: { active: 'true', limit: 1000, light: 'true' },
})
const caricandoAlunni = computed(() => statoAlunni.value === 'pending')
const opzioniAlunni = computed(() => (alunniRes.value?.data ?? [])
  .map(s => ({ label: `${s.firstName} ${s.lastName}`.trim(), value: s.id })))

// ─── SCRIVI ───
const VISIBILITA = [
  { valore: 'INTERNA', titolo: 'Solo segreteria e tutor', spiegazione: 'Resta dentro il centro: la famiglia non la vede.' },
  { valore: 'FAMIGLIA', titolo: 'Anche la famiglia', spiegazione: 'Prima la legge la segreteria, poi arriva nel portale dei genitori.' },
] as const

const salvandoNota = ref(false)
const notaState = reactive({
  studentId: '',
  visibilita: 'INTERNA' as 'INTERNA' | 'FAMIGLIA',
  contenuto: '',
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
      color: 'success',
    })
    notaState.contenuto = ''
    notaState.studentId = ''
    refreshMie()
  } catch {
    toast.add({ title: 'Errore salvataggio nota', color: 'error' })
  } finally {
    salvandoNota.value = false
  }
}

// ─── LE MIE ───
type MiaNota = {
  id: string
  contenuto: string
  visibilita: 'INTERNA' | 'FAMIGLIA'
  approvataAt: string | null
  createdAt: string
  student: { firstName: string, lastName: string } | null
}
const { data: mie, pending: pendingMie, refresh: refreshMie } = useLazyFetch<MiaNota[]>('/api/notes/me')

function statoNota(n: MiaNota): { etichetta: string, tono: TonoStato } {
  if (n.visibilita === 'INTERNA') return { etichetta: 'Interna', tono: 'grigio' }
  return n.approvataAt ? { etichetta: 'Inviata alla famiglia', tono: 'verde' } : { etichetta: 'Da approvare', tono: 'crema' }
}

// ─── SUGLI ALUNNI ───
// Quello che il server manda al tutor: solo note interne e note per la famiglia
// già approvate (il filtro è sul server, non qui).
interface NotaAlunno {
  id: string
  contenuto: string
  visibilita: 'INTERNA' | 'FAMIGLIA'
  createdAt: string
  author: { firstName: string, lastName: string } | null
  lesson: { data: string } | null
}
const alunnoId = ref<string>()
// Le note partono solo quando si sceglie un alunno: cambiando alunno cambia l'indirizzo
const { data: noteAlunno, status } = useLazyFetch<NotaAlunno[]>(() => `/api/students/${alunnoId.value}/notes`, {
  immediate: false,
})

// formatData() e formatDataOra() arrivano da ~/utils/format (auto-importate)
</script>
