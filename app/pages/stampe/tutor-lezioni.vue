<template>
  <div class="min-h-screen bg-white p-6 max-w-3xl mx-auto">

    <!-- Controlli (solo a schermo, nascosti in stampa) -->
    <div class="no-print flex flex-wrap items-end gap-3 mb-6 bg-slate-50 rounded-xl border border-slate-200 p-4">
      <UButton icon="i-heroicons-arrow-left" variant="ghost" size="sm" @click="navigateTo('/tutor-calendario')">
        Torna al calendario
      </UButton>
      <UFormField label="Dal" size="sm">
        <UInput v-model="dataInizio" type="date" size="sm" />
      </UFormField>
      <UFormField label="Al" size="sm">
        <UInput v-model="dataFine" type="date" size="sm" />
      </UFormField>
      <UButton icon="i-heroicons-printer" size="sm" class="ml-auto" @click="stampa">
        Stampa / Salva PDF
      </UButton>
    </div>

    <!-- Intestazione foglio -->
    <div class="border-b-2 border-slate-800 pb-4 mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Ti Formiamo Noi</h1>
      <p class="text-sm text-slate-600">Programma lezioni tutor</p>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
      <div>
        <p class="text-slate-500">Tutor</p>
        <p class="font-bold text-slate-900 text-lg">{{ user?.firstName }} {{ user?.lastName }}</p>
      </div>
      <div class="text-right">
        <p class="text-slate-500">Periodo</p>
        <p class="font-medium text-slate-900">{{ formatData(dataInizio) }} → {{ formatData(dataFine) }}</p>
        <p class="text-slate-500 mt-1">Stampato il {{ formatData(oggi) }}</p>
      </div>
    </div>

    <!-- Tabella lezioni -->
    <p v-if="pending" class="text-sm text-slate-400">Caricamento…</p>
    <p v-else-if="lezioni.length === 0" class="text-sm text-slate-500">Nessuna lezione nel periodo selezionato.</p>
    <table v-else class="w-full text-sm border-collapse">
      <thead>
        <tr class="border-b-2 border-slate-300 text-left">
          <th class="py-2 pr-3 font-semibold text-slate-700">Data</th>
          <th class="py-2 pr-3 font-semibold text-slate-700">Orario</th>
          <th class="py-2 pr-3 font-semibold text-slate-700">Studenti</th>
          <th class="py-2 font-semibold text-slate-700">Durata</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="l in lezioni" :key="l.id" class="border-b border-slate-200">
          <td class="py-1.5 pr-3 text-slate-800">{{ formatData(l.data) }}</td>
          <td class="py-1.5 pr-3 text-slate-800">
            {{ l.timeSlot?.oraInizio?.substring(0, 5) }} – {{ l.timeSlot?.oraFine?.substring(0, 5) }}
          </td>
          <td class="py-1.5 pr-3 text-slate-800">
            {{ (l.lessonStudents ?? []).map((ls: any) => `${ls.student?.firstName ?? ''} ${ls.student?.lastName ?? ''}`.trim()).join(', ') || '—' }}
          </td>
          <td class="py-1.5 text-slate-800">{{ l.mezzaLezione ? 'Mezza lezione' : 'Lezione intera' }}</td>
        </tr>
      </tbody>
    </table>

    <p class="mt-6 text-sm font-medium text-slate-700">Totale: {{ lezioni.length }} lezioni</p>

    <p class="mt-10 text-xs text-slate-400">
      Documento generato dal gestionale Ti Formiamo Noi.
    </p>
  </div>
</template>

<script setup lang="ts">
import { oggiISO, formatData } from '~/utils/format'

definePageMeta({ layout: false, middleware: ['tutor-only'] })
useHead({ title: 'Stampa lezioni — Ti Formiamo Noi' })

const { user } = useUserSession()
const oggi = oggiISO()

function shiftISO(iso: string, giorni: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + giorni)
  return d.toISOString().slice(0, 10)
}
// Default: da oggi ai prossimi 7 giorni (le lezioni in programma)
const dataInizio = ref(oggi)
const dataFine = ref(shiftISO(oggi, 7))

// Stessa chiamata del calendario tutor: il server restituisce solo le lezioni del tutor loggato
const { data: lezioniRes, pending } = useLazyFetch<{ data: any[] }>('/api/lessons', {
  query: computed(() => ({
    dataInizio: dataInizio.value,
    dataFine: dataFine.value,
    limit: 500,
  })),
})
const lezioni = computed(() =>
  [...(lezioniRes.value?.data ?? [])].sort((a, b) =>
    String(a.data).localeCompare(String(b.data)) || String(a.timeSlot?.oraInizio ?? '').localeCompare(String(b.timeSlot?.oraInizio ?? ''))
  )
)

function stampa() {
  window.print()
}
</script>

<style scoped>
@media print {
  .no-print {
    display: none !important;
  }
}
</style>
