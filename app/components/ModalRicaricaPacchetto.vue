<template>
  <UModal v-model:open="isOpen" title="Nuova Ricarica">
    <template #body>
      <div class="space-y-4">
        <UAlert v-if="pacchetto" color="info" variant="subtle"
          :title="pacchetto.nome"
          :description="`Tariffa oraria: € ${parseFloat(pacchetto.tariffaOraria ?? '0').toFixed(2)} / h`"
        />
        <UFormField label="Importo ricarica (€)" required>
          <UInputNumber v-model="ricarica.importo" :min="10" :step="10" :step-snapping="false" class="w-full" />
        </UFormField>
        <div class="text-xs text-slate-500">
          Ore che verranno aggiunte: <strong>{{ oreAggiunteStimate }}</strong>
        </div>
        
        <USeparator label="Pagamento (opzionale)" />
        
        <UFormField label="Pagato subito (€)">
          <UInputNumber v-model="ricarica.pagatoSubito" :min="0" :step="10" :step-snapping="false" :max="ricarica.importo" class="w-full" />
        </UFormField>
        
        <div v-if="ricarica.pagatoSubito > 0" class="grid grid-cols-2 gap-4">
          <UFormField label="Metodo pagamento" required>
            <USelect
              v-model="ricarica.metodoPagamento"
              :items="[
                { label: 'Contanti', value: 'CONTANTI' },
                { label: 'Bonifico', value: 'BONIFICO' },
                { label: 'POS', value: 'POS' },
                { label: 'Assegno', value: 'ASSEGNO' },
              ]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="">
            <div class="flex items-center gap-2 mt-6">
              <UCheckbox v-model="ricarica.richiedeFattura" label="Richiede fattura" />
            </div>
          </UFormField>
        </div>
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

const props = defineProps<{ pacchetto: any | null }>()
const emit = defineEmits<{ refresh: [] }>()
const isOpen = defineModel<boolean>('open', { default: false })

const toast = useToast()
const salvandoRicarica = ref(false)

const ricarica = reactive({
  importo: 50,
  pagatoSubito: 0,
  metodoPagamento: 'CONTANTI',
  richiedeFattura: false,
})

watch(isOpen, (val) => {
  if (val) {
    ricarica.importo = 50
    ricarica.pagatoSubito = 0
    ricarica.metodoPagamento = 'CONTANTI'
    ricarica.richiedeFattura = false
  }
})

const oreAggiunteStimate = computed(() => {
  if (!props.pacchetto) return 0
  const tariffa = parseFloat(props.pacchetto.tariffaOraria) || 1
  return (ricarica.importo / tariffa).toFixed(1)
})

async function salvaRicarica() {
  if (!props.pacchetto) return
  salvandoRicarica.value = true
  try {
    const body: any = {
      importo: ricarica.importo,
      ore: Number(oreAggiunteStimate.value),
    }
    if (ricarica.pagatoSubito > 0) {
      body.pagamentoIniziale = {
        importo: ricarica.pagatoSubito,
        metodoPagamento: ricarica.metodoPagamento,
        richiedeFattura: ricarica.richiedeFattura,
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
