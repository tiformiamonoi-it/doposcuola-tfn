<template>
  <UModal v-model:open="isOpen" title="Nuova Ricarica">
    <template #body>
      <div class="space-y-4">
        <UAlert v-if="pacchetto" color="info" variant="subtle"
          :title="pacchetto.nome"
          description="Il libretto si ricarica a ore: scrivi quante ne aggiungi e il prezzo si calcola da solo."
        />
        <!-- SI COMPRANO ORE, NON EURO (decisione Q27 del 14/09/2026).
             Prima si scriveva l'importo e le ore venivano dedotte: 50 € a 12 €/h
             facevano 4,2 ore, e quel «0,2» non lo poteva usare nessuno, perché ogni
             lezione scala un'ora intera. Restava scritto come residuo e non spariva
             mai. Scrivendo le ore, il problema non può proprio nascere. -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Ore da ricaricare" required>
            <UInputNumber v-model="ricarica.ore" :min="1" :step="1" class="w-full" />
          </UFormField>
          <UFormField label="Tariffa oraria (€/h)" required>
            <UInputNumber v-model="ricarica.tariffaOraria" :min="1" :step="1" :step-snapping="false" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Importo della ricarica (€)" :hint="importoToccato ? 'corretto a mano' : 'calcolato: ore × tariffa'">
          <UInputNumber v-model="ricarica.importo" :min="0" :step="10" :step-snapping="false" class="w-full"
            @update:model-value="importoToccato = true" />
        </UFormField>
        <div v-if="importoToccato && ricarica.importo !== importoCalcolato" class="text-xs text-slate-500">
          Con {{ ricarica.ore }} ore a € {{ ricarica.tariffaOraria.toFixed(2) }}/h verrebbero
          <strong>€ {{ importoCalcolato.toFixed(2) }}</strong>.
          <button type="button" class="text-tfn-600 hover:underline" @click="ripristinaImporto">Ricalcola</button>
        </div>
        
        <USeparator label="Pagamento (opzionale)" />
        
        <UFormField label="Pagato subito (€)">
          <UInputNumber v-model="ricarica.pagatoSubito" :min="0" :step="10" :step-snapping="false" :max="ricarica.importo" class="w-full" />
        </UFormField>
        
        <div v-if="ricarica.pagatoSubito > 0" class="grid grid-cols-2 gap-4">
          <UFormField label="Metodo pagamento" required>
            <USelect
              v-model="ricarica.metodoPagamento"
              :items="METODI_PAGAMENTO_ITEMS"
              class="w-full"
            />
          </UFormField>
          <UFormField label="">
            <div class="flex items-center gap-2 mt-6">
              <UCheckbox v-model="ricarica.richiedeFattura" label="Richiede fattura" />
            </div>
          </UFormField>
        </div>

        <!-- Bollo (F1): compare da solo sopra 77,47 € con fattura, già spuntato -->
        <SpuntaBollo
          v-if="ricarica.pagatoSubito > 0"
          v-model="ricarica.aggiungiBollo"
          :importo="ricarica.pagatoSubito"
          :richiede-fattura="ricarica.richiedeFattura"
        />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" @click="isOpen = false">Annulla</UButton>
        <UButton :loading="salvandoRicarica" @click="salvaRicarica">Conferma Ricarica</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { METODI_PAGAMENTO_ITEMS } from '~/utils/contabilita'
import { TARIFFA_ORARIA_DEFAULT } from '#shared/tariffe'

const props = defineProps<{ pacchetto: any | null }>()
const emit = defineEmits<{ refresh: [] }>()
const isOpen = defineModel<boolean>('open', { default: false })

const toast = useToast()
const salvandoRicarica = ref(false)

const ricarica = reactive({
  // Le ore sono il campo principale: è quello che la famiglia compra davvero
  ore: 10,
  tariffaOraria: TARIFFA_ORARIA_DEFAULT,
  importo: 10 * TARIFFA_ORARIA_DEFAULT,
  pagatoSubito: 0,
  metodoPagamento: 'CONTANTI',
  richiedeFattura: false,
  // Bollo da 2 € (F1): vale solo sopra i 77,47 € con fattura, e in quel caso è dovuto
  aggiungiBollo: true,
})

// Ogni apertura riparte pulita: 10 ore alla tariffa del pacchetto (o quella
// predefinita, se quel libretto non ne ha una sua).
watch(isOpen, (val) => {
  if (!val) return
  ricarica.ore = 10
  ricarica.tariffaOraria = parseFloat(props.pacchetto?.tariffaOraria ?? '') || TARIFFA_ORARIA_DEFAULT
  ricarica.importo = ricarica.ore * ricarica.tariffaOraria
  importoToccato.value = false
  ricarica.pagatoSubito = 0
  ricarica.metodoPagamento = 'CONTANTI'
  ricarica.richiedeFattura = false
  ricarica.aggiungiBollo = true
})

// Il prezzo lo calcola il gestionale, ma resta correggibile: capita di fare uno
// sconto o di arrotondare. Da quando lo si tocca a mano, smette di seguire le ore —
// altrimenti la cifra scritta dalla segreteria sparirebbe al primo ritocco.
const importoToccato = ref(false)
const importoCalcolato = computed(() => Number((ricarica.ore * ricarica.tariffaOraria).toFixed(2)))

watch(importoCalcolato, (nuovo) => {
  if (!importoToccato.value) ricarica.importo = nuovo
})

function ripristinaImporto() {
  ricarica.importo = importoCalcolato.value
  importoToccato.value = false
}

async function salvaRicarica() {
  if (!props.pacchetto) return
  salvandoRicarica.value = true
  try {
    const body: any = {
      importo: ricarica.importo,
      ore: ricarica.ore,
      // La tariffa usata resta scritta sulla riga del libretto: fra un anno si deve
      // poter capire a che prezzo erano state comprate quelle ore.
      tariffaOraria: ricarica.tariffaOraria,
    }
    if (ricarica.pagatoSubito > 0) {
      body.pagamentoIniziale = {
        importo: ricarica.pagatoSubito,
        metodoPagamento: ricarica.metodoPagamento,
        richiedeFattura: ricarica.richiedeFattura,
        aggiungiBollo:   ricarica.aggiungiBollo,
      }
    }
    await $fetch(`/api/packages/${props.pacchetto.id}/recharge`, {
      method: 'POST',
      body,
    })
    toast.add({ title: 'Ricarica effettuata', color: 'success', icon: 'i-heroicons-check-circle' })
    isOpen.value = false
    emit('refresh')
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile ricaricare', color: 'error' })
  } finally {
    salvandoRicarica.value = false
  }
}
</script>
