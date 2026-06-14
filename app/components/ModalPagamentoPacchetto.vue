<template>
  <UModal v-model:open="isOpen" title="Registra Pagamento">
    <template #body>
      <div class="space-y-4">
        <UAlert v-if="pacchetto" color="info" variant="subtle"
          :title="pacchetto.nome"
          :description="`Residuo da pagare: € ${parseFloat(pacchetto.importoResiduo ?? '0').toFixed(2)}`"
        />

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Importo (€)" required>
            <UInputNumber v-model="pagamento.importo" :min="0.01" :step="10" class="w-full" />
          </UFormField>
          <UFormField label="Data" required>
            <UInput v-model="pagamento.data" type="date" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Tipo" required>
            <USelect
              v-model="pagamento.tipo"
              :items="[
                { label: 'Acconto', value: 'ACCONTO' },
                { label: 'Saldo', value: 'SALDO' },
                { label: 'Rata', value: 'RATA' },
                { label: 'Integrazione', value: 'INTEGRAZIONE' },
              ]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Metodo" required>
            <USelect
              v-model="pagamento.metodo"
              :items="[
                { label: 'Contanti', value: 'CONTANTI' },
                { label: 'Bonifico', value: 'BONIFICO' },
                { label: 'POS', value: 'POS' },
                { label: 'Assegno', value: 'ASSEGNO' },
              ]"
              class="w-full"
            />
          </UFormField>
        </div>

        <UCheckbox v-model="pagamento.fattura" label="Richiede fattura" />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" @click="isOpen = false">Annulla</UButton>
        <UButton :loading="salvandoPagamento" @click="salvaPagamento">Registra Pagamento</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

const props = defineProps<{ pacchetto: any | null }>()
const emit = defineEmits<{ refresh: [] }>()
const isOpen = defineModel<boolean>('open', { default: false })

const toast = useToast()
const salvandoPagamento = ref(false)

const pagamento = reactive({
  importo: 0,
  data:    new Date().toISOString().slice(0, 10),
  tipo:    'SALDO' as string,
  metodo:  'CONTANTI' as string,
  fattura: false,
})

watch(isOpen, (val) => {
  if (val && props.pacchetto) {
    pagamento.importo = parseFloat(props.pacchetto.importoResiduo) || 0
    pagamento.data    = new Date().toISOString().slice(0, 10)
    pagamento.tipo    = 'SALDO'
    pagamento.metodo  = 'CONTANTI'
    pagamento.fattura = false
  }
})

async function salvaPagamento() {
  if (!props.pacchetto) return
  salvandoPagamento.value = true
  try {
    await $fetch('/api/payments', {
      method: 'POST',
      body: {
        packageId:       props.pacchetto.id,
        importo:         pagamento.importo,
        tipoPagamento:   pagamento.tipo,
        metodoPagamento: pagamento.metodo,
        dataPagamento:   pagamento.data,
        richiedeFattura: pagamento.fattura,
      },
    })
    toast.add({ title: 'Pagamento registrato', color: 'success', icon: 'i-heroicons-check-circle' })
    isOpen.value = false
    emit('refresh')
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile registrare il pagamento', color: 'error' })
  } finally {
    salvandoPagamento.value = false
  }
}
</script>
