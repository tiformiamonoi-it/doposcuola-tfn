<template>
  <UModal v-model:open="isOpen" title="Libretto Ricariche">
    <template #body>
      <div class="space-y-4">
        <div v-if="caricamentoLibretto" class="py-4 text-center">
          <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin mx-auto text-slate-400" />
        </div>
        <div v-else-if="storicoRicariche.length === 0" class="py-4 text-center text-slate-500 text-sm">
          Nessuna ricarica trovata per questo pacchetto.
        </div>
        <div v-else class="space-y-2">
          <div v-for="r in storicoRicariche" :key="r.id" class="flex justify-between items-center p-2 bg-slate-50 border border-slate-100 rounded text-sm">
            <div>
              <div class="font-medium">Ricarica di € {{ parseFloat(r.importo).toFixed(2) }}</div>
              <div class="text-xs text-slate-500">{{ formatData(r.data) }} · {{ parseFloat(r.ore) }} ore aggiunte</div>
            </div>
            <div class="text-xs text-slate-400 text-right">
              <span v-if="r.paymentId" class="text-green-600 block">Pagata</span>
              <span v-else class="text-orange-500 block">Da pagare</span>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <UButton @click="isOpen = false">Chiudi</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatData } from '~/utils/format'

const props = defineProps<{ pacchetto: any | null }>()
const isOpen = defineModel<boolean>('open', { default: false })

const toast = useToast()
const caricamentoLibretto = ref(false)
const storicoRicariche = ref<any[]>([])



watch(isOpen, async (val) => {
  if (val && props.pacchetto) {
    caricamentoLibretto.value = true
    storicoRicariche.value = []
    try {
      const res: any = await $fetch(`/api/packages/${props.pacchetto.id}/recharges`)
      storicoRicariche.value = res.data ?? []
    } catch (err) {
      toast.add({ title: 'Errore', description: 'Impossibile caricare il libretto', color: 'error' })
    } finally {
      caricamentoLibretto.value = false
    }
  }
})
</script>
