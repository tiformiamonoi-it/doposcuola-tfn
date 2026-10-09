<template>
  <div class="space-y-6 max-w-3xl mx-auto">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Note sugli alunni</h1>
      <p class="text-slate-500">Scegli un alunno per leggere cosa hanno scritto i colleghi e la segreteria.</p>
    </div>

    <UFormField label="Alunno">
      <USelectMenu
        v-model="alunnoId"
        :items="opzioniAlunni"
        value-key="value"
        :loading="caricandoAlunni"
        placeholder="Cerca per nome..."
        aria-label="Alunno"
        size="lg"
        class="w-full"
      />
    </UFormField>

    <div v-if="!alunnoId" class="py-10 text-center text-slate-400">
      <UIcon name="i-heroicons-magnifying-glass" class="w-8 h-8 mx-auto mb-2" />
      <p>Scegli un alunno qui sopra per vedere le sue note.</p>
    </div>

    <div v-else-if="status === 'pending'" class="space-y-4" aria-busy="true">
      <USkeleton v-for="i in 3" :key="i" class="h-24 w-full" />
    </div>

    <div v-else-if="status === 'error'" class="py-10 text-center text-slate-500">
      <p>Non è stato possibile caricare le note. Riprova tra poco.</p>
    </div>

    <div v-else-if="!note?.length" class="py-10 text-center text-slate-400">
      <UIcon name="i-heroicons-document-text" class="w-8 h-8 mx-auto mb-2" />
      <p>Nessuna nota su questo alunno.</p>
    </div>

    <!-- Solo lettura: qui niente "modifica" né "elimina". Le note si scrivono dalle lezioni. -->
    <ul v-else class="space-y-3">
      <li v-for="n in note" :key="n.id">
        <UCard :ui="{ body: 'p-4' }">
          <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div>
              <div class="text-sm font-medium text-slate-800">
                {{ n.author ? `${n.author.firstName} ${n.author.lastName}`.trim() : '—' }}
              </div>
              <div class="text-xs text-slate-500">
                <time :datetime="n.createdAt">{{ formatDataOra(n.createdAt) }}</time>
                <span v-if="n.lesson"> · lezione del {{ formatData(n.lesson.data) }}</span>
              </div>
            </div>
            <UBadge :color="n.visibilita === 'FAMIGLIA' ? 'success' : 'warning'" variant="subtle" size="sm">
              {{ n.visibilita === 'FAMIGLIA' ? 'Inviata alla famiglia' : 'Interna' }}
            </UBadge>
          </div>
          <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ n.contenuto }}</p>
        </UCard>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['tutor-only'] })
useHead({ title: 'Note sugli alunni — Area Tutor' })

interface Alunno { id: string, firstName: string, lastName: string }

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

// Tutti gli alunni attivi, non solo i suoi (decisione D1): un tutor può sostituire
// un collega e deve poter leggere cosa è stato notato. Versione "leggera"
// dell'elenco, la stessa delle tendine del calendario: niente pacchetti, e i
// recapiti dei genitori il server li toglie già ai tutor.
const { data: alunniRes, status: statoAlunni } = useLazyFetch<{ data: Alunno[] }>('/api/students', {
  query: { active: 'true', limit: 1000, light: 'true' },
})
const caricandoAlunni = computed(() => statoAlunni.value === 'pending')
const opzioniAlunni = computed(() => (alunniRes.value?.data ?? [])
  .map(s => ({ label: `${s.firstName} ${s.lastName}`.trim(), value: s.id })))

const alunnoId = ref<string>()

// Le note partono solo quando si sceglie un alunno: cambiando alunno cambia
// l'indirizzo, e Nuxt le ricarica da solo.
const { data: note, status } = useLazyFetch<NotaAlunno[]>(() => `/api/students/${alunnoId.value}/notes`, {
  immediate: false,
})

// formatData() e formatDataOra() arrivano da ~/utils/format (auto-importate)
</script>
