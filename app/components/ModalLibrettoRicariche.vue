<template>
  <UModal v-model:open="isOpen" title="Libretto orario" :ui="{ content: 'max-w-2xl' }">
    <template #body>
      <div class="space-y-4">

        <!-- Caricamento -->
        <div v-if="caricamento" class="py-6 text-center">
          <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin mx-auto text-slate-400" aria-hidden="true" />
          <p class="sr-only">Caricamento dell'estratto conto in corso</p>
        </div>

        <!-- Errore (es. il pacchetto non è un libretto) -->
        <UAlert
          v-else-if="errore"
          color="error"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          title="Estratto conto non disponibile"
          :description="errore"
        />

        <template v-else-if="estratto">
          <!-- Il saldo, grande e subito visibile: è la domanda per cui si apre questa finestra -->
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs uppercase tracking-wide text-slate-500">Ore che restano</p>
                <p class="text-3xl font-bold leading-tight" :class="estratto.saldoPacchetto > 0 ? 'text-emerald-600' : 'text-rose-600'">
                  {{ formatOre(estratto.saldoPacchetto) }} <span class="text-base font-medium text-slate-500">ore</span>
                </p>
              </div>
              <div class="text-right text-xs text-slate-500 leading-relaxed">
                <p class="font-medium text-slate-700 truncate">{{ estratto.pacchetto.studente || '—' }}</p>
                <p class="truncate">{{ estratto.pacchetto.nome }}</p>
                <p v-if="estratto.pacchetto.tariffaOraria">€ {{ estratto.pacchetto.tariffaOraria.toFixed(2) }}/h</p>
              </div>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div class="rounded-lg bg-white border border-slate-200 px-3 py-2">
                <span class="block text-slate-500">Ricaricate in tutto</span>
                <span class="font-semibold text-emerald-700">+{{ formatOre(estratto.totaleRicaricate) }} ore</span>
              </div>
              <div class="rounded-lg bg-white border border-slate-200 px-3 py-2">
                <span class="block text-slate-500">Consumate in tutto</span>
                <span class="font-semibold text-rose-700">−{{ formatOre(estratto.totaleConsumate) }} ore</span>
              </div>
            </div>
          </div>

          <!-- Il conto non torna: meglio dirlo che mostrare un elenco che mente -->
          <UAlert
            v-if="estratto.avviso"
            color="warning"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            title="Il conto non torna"
            :description="estratto.avviso"
          />

          <!-- L'estratto conto vero e proprio -->
          <div v-if="estratto.voci.length === 0" class="py-6 text-center text-sm text-slate-500">
            Questo libretto non ha ancora nessun movimento: né ricariche né lezioni.
          </div>
          <ul v-else class="space-y-1.5" aria-label="Movimenti del libretto, dal più recente">
            <li
              v-for="v in vociDalPiuRecente"
              :key="v.id"
              class="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-2.5 text-sm"
            >
              <!-- Ore del movimento: il segno è la cosa che si legge per prima -->
              <span
                class="shrink-0 w-16 text-right font-mono font-semibold tabular-nums"
                :class="v.ore >= 0 ? 'text-emerald-600' : 'text-rose-600'"
              >
                {{ v.ore >= 0 ? '+' : '−' }}{{ formatOre(Math.abs(v.ore)) }}
              </span>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-baseline gap-x-2">
                  <span class="font-medium text-slate-800">{{ v.descrizione }}</span>
                  <span v-if="v.importo !== null" class="text-slate-600">€ {{ formatImporto(v.importo) }}</span>
                  <UBadge v-if="v.tipo === 'RICARICA' && v.pagata === false" color="warning" variant="subtle" size="sm">
                    Da pagare
                  </UBadge>
                </div>
                <p class="text-xs text-slate-500 truncate">
                  {{ formatData(v.data) }}<template v-if="v.dettaglio"> · {{ v.dettaglio }}</template>
                </p>
              </div>

              <span class="shrink-0 text-right text-xs text-slate-500 leading-tight">
                <span class="block">saldo</span>
                <span class="font-semibold tabular-nums text-slate-700">{{ formatOre(v.saldo) }}</span>
              </span>
            </li>
          </ul>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton variant="ghost" class="justify-center" @click="chiudi">Chiudi</UButton>
        <UButton
          v-if="estratto"
          icon="i-heroicons-printer"
          variant="soft"
          class="justify-center"
          :to="`/stampe/libretto-${estratto.pacchetto.id}`"
          target="_blank"
        >
          Stampa
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatData, formatImporto } from '~/utils/format'

const props = defineProps<{ pacchetto: any | null }>()
const isOpen = defineModel<boolean>('open', { default: false })

const caricamento = ref(false)
const errore = ref<string | null>(null)
const estratto = ref<any>(null)

// Dal PIÙ RECENTE al più vecchio.
// Il saldo di ogni riga resta quello progressivo calcolato dal server (dalla prima
// ricarica in avanti): qui si gira solo l'ordine di lettura. La finestra si apre in
// segreteria per rispondere a "quante ore restano?" e "cos'è successo per ultimo?" —
// ed è giusto trovarsele in cima, senza scorrere due anni di lezioni. Il foglio da
// stampare per la famiglia fa l'opposto (dal più vecchio), perché lì si legge la
// storia dall'inizio come un estratto conto della banca.
const vociDalPiuRecente = computed(() => [...(estratto.value?.voci ?? [])].reverse())

function chiudi() {
  isOpen.value = false
}

// "9,5" all'italiana; le mezze ore esistono (mezza lezione), gli spezzoni no
function formatOre(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}

watch(isOpen, async (val) => {
  if (!val || !props.pacchetto) return

  caricamento.value = true
  errore.value = null
  estratto.value = null
  try {
    const res: any = await $fetch(`/api/packages/${props.pacchetto.id}/estratto-conto`)
    estratto.value = res.data
  } catch (err: any) {
    // L'errore si mostra dentro la finestra, non come notifica che sparisce: chi ha
    // aperto il libretto sta guardando qui, e il messaggio spiega cosa fare.
    errore.value = err?.data?.statusMessage ?? 'Impossibile caricare il libretto. Riprova fra poco.'
  } finally {
    caricamento.value = false
  }
})
</script>
