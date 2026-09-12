<script setup lang="ts">
/**
 * La spunta del bollo da 2 € (F1).
 *
 * Compare da sola quando il pagamento che si sta registrando supera i 77,47 € ed è
 * segnato "richiede fattura": in quel caso la marca da bollo è dovuta per legge,
 * quindi la spunta nasce già attiva. Chi registra può sempre toglierla.
 *
 * Vive in un componente suo perché il pagamento si registra da quattro punti diversi
 * (scheda del pacchetto, nuovo pacchetto, ricarica, wizard nuovo alunno) e la regola
 * deve essere identica in tutti e quattro: una sola volta scritta, una sola da correggere.
 */
import { IMPORTO_BOLLO_LABEL, SOGLIA_BOLLO_LABEL, serveBollo } from '#shared/bollo'

const props = defineProps<{
  /** Importo del pagamento che si sta registrando. */
  importo: number | string | null | undefined
  /** È spuntato "richiede fattura"? */
  richiedeFattura: boolean
}>()

// true = il bollo va registrato. Chi usa il componente lo manda al server.
const attivo = defineModel<boolean>({ default: true })

const serve = computed(() => serveBollo(Number(props.importo ?? 0), props.richiedeFattura))

// Quando le condizioni si avverano (si alza l'importo, si spunta la fattura) la
// casella torna attiva: il bollo è la regola, non un di più da ricordarsi ogni volta.
watch(serve, (ora) => { if (ora) attivo.value = true })
</script>

<template>
  <div v-if="serve" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
    <UCheckbox v-model="attivo" label="Aggiungi il bollo da 2 €" />
    <p class="text-xs text-amber-800 mt-1.5 leading-relaxed">
      Sopra € {{ SOGLIA_BOLLO_LABEL }} la fattura richiede la marca da bollo da
      € {{ IMPORTO_BOLLO_LABEL }}, che paga il cliente.
      Sono € {{ IMPORTO_BOLLO_LABEL }} <strong>a parte</strong>: non sono compresi nel prezzo
      del pacchetto e in contabilità restano una riga separata.
    </p>
  </div>
</template>
