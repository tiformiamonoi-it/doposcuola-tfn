<template>
  <div class="min-h-screen bg-white p-6 max-w-3xl mx-auto">

    <!-- Controlli (solo a schermo, nascosti in stampa) -->
    <div class="no-print flex flex-wrap items-center gap-3 mb-6 bg-slate-50 rounded-xl border border-slate-200 p-4">
      <UButton icon="i-heroicons-arrow-left" variant="ghost" size="sm" @click="tornaIndietro">
        Torna indietro
      </UButton>
      <UButton icon="i-heroicons-printer" size="sm" class="ml-auto" @click="stampa">
        Stampa / Salva PDF
      </UButton>
    </div>

    <p v-if="pending" class="text-sm text-slate-400">Caricamento…</p>

    <UAlert
      v-else-if="errore"
      class="no-print"
      color="error"
      variant="subtle"
      icon="i-heroicons-exclamation-triangle"
      title="Estratto conto non disponibile"
      :description="errore"
    />

    <template v-else-if="estratto">
      <!-- Intestazione foglio -->
      <div class="border-b-2 border-slate-800 pb-4 mb-6">
        <h1 class="text-2xl font-bold text-slate-900">tiformiamonoi</h1>
        <p class="text-sm text-slate-600">Libretto orario — estratto conto delle ore</p>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p class="text-slate-500">Alunno</p>
          <p class="font-bold text-slate-900 text-lg">{{ estratto.pacchetto.studente || '—' }}</p>
          <p class="text-slate-600">{{ estratto.pacchetto.nome }}</p>
          <p v-if="estratto.pacchetto.tariffaOraria" class="text-slate-600">
            Tariffa € {{ estratto.pacchetto.tariffaOraria.toFixed(2) }} all'ora
          </p>
        </div>
        <div class="text-right">
          <p class="text-slate-500">Periodo</p>
          <p class="font-medium text-slate-900">
            {{ formatData(estratto.periodo.dal) }} → {{ formatData(estratto.periodo.al) }}
          </p>
          <p class="text-slate-600 mt-1">
            Apertura {{ formatData(estratto.pacchetto.dataInizio) }}<template v-if="estratto.pacchetto.dataScadenza">
              · valido fino al {{ formatData(estratto.pacchetto.dataScadenza) }}</template>
          </p>
          <p class="text-slate-500 mt-1">Stampato il {{ formatData(oggi) }}</p>
        </div>
      </div>

      <!-- Il conto non torna: l'avviso si stampa insieme al resto, non si nasconde -->
      <div v-if="estratto.avviso" class="mb-6 border-2 border-amber-400 bg-amber-50 rounded-lg p-3 text-sm text-amber-900">
        <strong>Il conto non torna.</strong> {{ estratto.avviso }}
      </div>

      <!-- L'elenco, dal più vecchio al più recente: si legge come un estratto conto -->
      <p v-if="estratto.voci.length === 0" class="text-sm text-slate-500">
        Questo libretto non ha ancora nessun movimento.
      </p>
      <table v-else class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b-2 border-slate-300 text-left">
            <th class="py-2 pr-3 font-semibold text-slate-700 text-right">Ore</th>
            <th class="py-2 pr-3 font-semibold text-slate-700">Data</th>
            <th class="py-2 pr-3 font-semibold text-slate-700">Movimento</th>
            <th class="py-2 font-semibold text-slate-700 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in estratto.voci" :key="v.id" class="border-b border-slate-200">
            <td class="py-1.5 pr-3 text-right font-semibold tabular-nums" :class="v.ore >= 0 ? 'text-emerald-700' : 'text-rose-700'">
              {{ v.ore >= 0 ? '+' : '−' }}{{ formatOre(Math.abs(v.ore)) }}
            </td>
            <td class="py-1.5 pr-3 text-slate-800 whitespace-nowrap">{{ formatData(v.data) }}</td>
            <td class="py-1.5 pr-3 text-slate-800">
              {{ v.descrizione }}<template v-if="v.importo !== null"> — € {{ formatImporto(v.importo) }}</template>
              <span v-if="v.dettaglio" class="text-slate-500"> ({{ v.dettaglio }})</span>
            </td>
            <td class="py-1.5 text-right font-medium text-slate-900 tabular-nums">{{ formatOre(v.saldo) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Il saldo finale, il numero per cui la famiglia tiene il foglio -->
      <div class="mt-6 flex items-end justify-between border-t-2 border-slate-800 pt-3">
        <div class="text-sm text-slate-600">
          <p>Ore ricaricate in tutto: <strong>{{ formatOre(estratto.totaleRicaricate) }}</strong></p>
          <p>Ore consumate in tutto: <strong>{{ formatOre(estratto.totaleConsumate) }}</strong></p>
        </div>
        <div class="text-right">
          <p class="text-xs uppercase tracking-wide text-slate-500">Ore che restano</p>
          <p class="text-3xl font-bold text-slate-900">{{ formatOre(estratto.saldoPacchetto) }}</p>
        </div>
      </div>

      <p class="mt-10 text-xs text-slate-400">
        Documento generato dal gestionale tiformiamonoi — non ha valore fiscale.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { oggiISO, formatData, formatImporto } from '~/utils/format'

definePageMeta({ layout: false, middleware: ['admin-or-super'] })
useHead({ title: 'Stampa libretto orario — tiformiamonoi' })

const route = useRoute()
const id = route.params.id as string
const oggi = oggiISO()

const { data: risposta, pending, error } = useLazyFetch<{ data: any }>(`/api/packages/${id}/estratto-conto`)
const estratto = computed(() => risposta.value?.data ?? null)

// Il messaggio del server ("questo non è un libretto", "pacchetto non trovato") è già
// scritto per la segreteria: si mostra così com'è invece di un generico "errore".
const errore = computed(() => {
  if (!error.value) return null
  return (error.value as any)?.data?.statusMessage ?? 'Impossibile caricare il libretto.'
})

// "9,5" all'italiana
function formatOre(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}

// Il foglio si apre in una scheda nuova dalla finestra del libretto: se non c'è una
// pagina precedente si torna all'elenco dei pacchetti invece di restare bloccati.
function tornaIndietro() {
  if (window.history.length > 1) window.history.back()
  else navigateTo('/pacchetti')
}

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
