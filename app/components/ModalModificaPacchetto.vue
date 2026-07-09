<template>
  <UModal v-model:open="isOpen" title="Modifica Avanzata Pacchetto">
    <template #body>
      <div v-if="pacchetto" class="space-y-6">
        <!-- Contesto di sola lettura -->
        <UAlert color="info" variant="subtle" :title="pacchetto.nome" :description="`Studente: ${pacchetto.studentFirstName} ${pacchetto.studentLastName}`" />
        
        <div class="grid grid-cols-2 gap-4">
          <!-- Quantità Acquistata -->
          <UFormField :label="pacchetto.tipo === 'MENSILE' ? 'Giorni Acquistati' : 'Ore Acquistate'" required>
            <UInputNumber v-if="pacchetto.tipo === 'MENSILE'" v-model="form.nuoviGiorniAcquistati" :min="1" class="w-full" />
            <UInputNumber v-else v-model="form.nuoveOreAcquistate" :min="1" :step="0.5" class="w-full" />
          </UFormField>

          <!-- Nuova Data Scadenza -->
          <UFormField label="Data di Scadenza">
            <UInput type="date" v-model="form.nuovaDataScadenza" class="w-full" />
          </UFormField>
        </div>

        <USeparator />

        <!-- Sezione Prezzo e Integrazione -->
        <div class="space-y-4">
          <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div>
              <div class="text-sm text-slate-500">Già Pagato</div>
              <div class="font-semibold text-slate-900">€ {{ parseFloat(pacchetto.importoPagato).toFixed(2) }}</div>
            </div>
            <div class="text-right">
              <div class="text-sm text-slate-500">Prezzo Totale Precedente</div>
              <div class="font-semibold text-slate-900">€ {{ parseFloat(pacchetto.prezzoTotale).toFixed(2) }}</div>
            </div>
          </div>

          <UFormField label="Nuovo Prezzo Totale (€)" :error="prezzoError" required>
            <UInputNumber v-model="form.nuovoPrezzoTotale" :min="0" :step="10" class="w-full" />
            <template #help>
              Attenzione: non puoi inserire un totale inferiore a quanto lo studente ha già pagato.
            </template>
          </UFormField>

          <!-- Pagamento Immediato (se il nuovo prezzo supera il pagato) -->
          <div v-if="nuovoImportoDaPagare > 0" class="border border-primary-100 rounded-lg p-4 bg-primary-50 space-y-4">
            <h4 class="font-medium text-primary-800 text-sm">Registra Pagamento Immediato (Opzionale)</h4>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Importo da pagare ora">
                <UInputNumber v-model="form.pagamentoIntegrazione.importo" :min="0" :max="nuovoImportoDaPagare" class="w-full" />
              </UFormField>
              <UFormField label="Data Pagamento" v-if="form.pagamentoIntegrazione.importo > 0">
                <UInput type="date" v-model="form.pagamentoIntegrazione.dataPagamento" class="w-full" />
              </UFormField>
            </div>
            
            <div v-if="form.pagamentoIntegrazione.importo > 0" class="grid grid-cols-2 gap-4">
              <UFormField label="Metodo">
                <USelect
                  v-model="form.pagamentoIntegrazione.metodoPagamento"
                  :items="['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO']"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="" class="mt-6">
                <UCheckbox v-model="form.pagamentoIntegrazione.richiedeFattura" label="Richiede Fattura" />
              </UFormField>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" @click="isOpen = false">Annulla</UButton>
        <UButton :loading="isSaving" :disabled="!canSave" @click="salvaModifiche">Salva Modifiche</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'

const props = defineProps<{ pacchetto: any | null }>()
const emit = defineEmits<{ refresh: [] }>()
const isOpen = defineModel<boolean>('open', { default: false })

const toast = useToast()
const isSaving = ref(false)

const form = reactive({
  nuoveOreAcquistate: 0,
  nuoviGiorniAcquistati: 0,
  nuovoPrezzoTotale: 0,
  nuovaDataScadenza: '',
  pagamentoIntegrazione: {
    importo: 0,
    metodoPagamento: 'CONTANTI',
    dataPagamento: new Date().toISOString().slice(0, 10),
    richiedeFattura: false
  }
})

// Inizializza il form quando si apre o cambia il pacchetto
watch(() => [isOpen.value, props.pacchetto], ([open, pkg]) => {
  if (open && pkg) {
    form.nuoveOreAcquistate = parseFloat(pkg.oreAcquistate) || 0
    form.nuoviGiorniAcquistati = pkg.giorniAcquistati || 0
    form.nuovoPrezzoTotale = parseFloat(pkg.prezzoTotale) || 0
    if (pkg.dataScadenza) {
      const d = new Date(pkg.dataScadenza)
      form.nuovaDataScadenza = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    } else {
      form.nuovaDataScadenza = ''
    }
    
    form.pagamentoIntegrazione = {
      importo: 0,
      metodoPagamento: 'CONTANTI',
      dataPagamento: new Date().toISOString().slice(0, 10),
      richiedeFattura: false
    }
  }
})

// Se cambiano ore/giorni, suggeriamo un nuovo prezzoTotale basato sulla "tariffa" originaria
watch(() => form.nuoveOreAcquistate, (newOre, oldOre) => {
  if (!props.pacchetto || props.pacchetto.tipo === 'MENSILE') return
  const baseOre = parseFloat(props.pacchetto.oreAcquistate) || 0
  const basePrezzo = parseFloat(props.pacchetto.prezzoTotale) || 0
  
  // La tariffa usata in precedenza è il prezzo diviso le ore. Se il pacchetto era A_CONSUMO usa tariffaOraria se esiste.
  const tariffa = parseFloat(props.pacchetto.tariffaOraria) || (baseOre > 0 ? (basePrezzo / baseOre) : 0)

  if (tariffa > 0 && newOre !== oldOre) {
    const diff = newOre - baseOre
    form.nuovoPrezzoTotale = Math.max(0, basePrezzo + (diff * tariffa))
  }
})

watch(() => form.nuoviGiorniAcquistati, (newGiorni, oldGiorni) => {
  if (!props.pacchetto || props.pacchetto.tipo !== 'MENSILE') return
  const baseGiorni = props.pacchetto.giorniAcquistati || 0
  const basePrezzo = parseFloat(props.pacchetto.prezzoTotale) || 0
  
  const tariffaGiornaliera = baseGiorni > 0 ? (basePrezzo / baseGiorni) : 0

  if (tariffaGiornaliera > 0 && newGiorni !== oldGiorni) {
    const diff = newGiorni - baseGiorni
    form.nuovoPrezzoTotale = Math.max(0, basePrezzo + (diff * tariffaGiornaliera))
  }
})

// Calcolo importo da pagare "extra" (se il nuovo prezzo supera quanto già pagato in totale)
const nuovoImportoDaPagare = computed(() => {
  if (!props.pacchetto) return 0
  const giaPagato = parseFloat(props.pacchetto.importoPagato) || 0
  return Math.max(0, form.nuovoPrezzoTotale - giaPagato)
})

// Validazione Prezzo
const prezzoError = computed(() => {
  if (!props.pacchetto) return undefined
  const giaPagato = parseFloat(props.pacchetto.importoPagato) || 0
  if (form.nuovoPrezzoTotale < giaPagato) {
    return 'Il prezzo totale non può scendere sotto l\'importo già pagato.'
  }
  return undefined
})

const canSave = computed(() => {
  return !prezzoError.value
})

async function salvaModifiche() {
  if (!canSave.value || !props.pacchetto) return
  isSaving.value = true

  try {
    const payload: any = {
      nuovoPrezzoTotale: form.nuovoPrezzoTotale,
    }

    if (props.pacchetto.tipo === 'MENSILE') {
      payload.nuoviGiorniAcquistati = form.nuoviGiorniAcquistati
    } else {
      payload.nuoveOreAcquistate = form.nuoveOreAcquistate
    }

    if (form.nuovaDataScadenza) {
      payload.nuovaDataScadenza = form.nuovaDataScadenza
    }

    if (form.pagamentoIntegrazione.importo > 0) {
      payload.pagamentoIntegrazione = {
        importo: form.pagamentoIntegrazione.importo,
        metodoPagamento: form.pagamentoIntegrazione.metodoPagamento,
        dataPagamento: new Date(form.pagamentoIntegrazione.dataPagamento),
        richiedeFattura: form.pagamentoIntegrazione.richiedeFattura
      }
    }

    await $fetch(`/api/packages/${props.pacchetto.id}/upgrade`, {
      method: 'POST',
      body: payload
    })

    toast.add({ title: 'Pacchetto aggiornato', color: 'success' })
    isOpen.value = false
    emit('refresh')
  } catch (err: any) {
    console.error(err)
    toast.add({ 
      title: 'Errore Server', 
      description: err?.data?.data?.originalError || err?.data?.statusMessage || 'Errore durante la modifica', 
      color: 'error' 
    })
  } finally {
    isSaving.value = false
  }
}
</script>
