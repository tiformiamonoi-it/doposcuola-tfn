<template>
  <UModal v-model:open="isOpen" title="Registra Pagamento">
    <template #body>
      <div class="space-y-4">
        <UAlert v-if="pacchetto" :color="giaSaldato ? 'success' : 'info'" variant="subtle"
          :title="`${pacchetto.studentLastName ?? ''} ${pacchetto.studentFirstName ?? ''} — ${pacchetto.nome}`"
          :description="giaSaldato ? 'Pacchetto già saldato per intero.' : `Residuo da pagare: € ${parseFloat(pacchetto.importoResiduo ?? '0').toFixed(2)}`"
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
          <UFormField label="Tipo" :error="tipoPagamentoError" required>
            <USelect v-model="pagamento.tipo" :items="tipiPagamento" class="w-full" />
          </UFormField>
          <UFormField label="Metodo" required>
            <USelect v-model="pagamento.metodo" :items="metodiPagamento" class="w-full" />
          </UFormField>
        </div>

        <UCheckbox v-model="pagamento.fattura" label="Richiede fattura" />

        <!-- Storico pagamenti del pacchetto -->
        <div v-if="storico.length" class="border-t border-slate-100 pt-3">
          <p class="text-xs font-medium text-slate-500 mb-2">Pagamenti registrati</p>
          <div class="space-y-1.5 max-h-64 overflow-auto">
            <div
              v-for="p in storico"
              :key="p.id"
              class="bg-slate-50 rounded-md px-3 py-2"
            >
              <!-- Riga normale -->
              <div v-if="editingId !== p.id" class="flex items-center justify-between text-sm">
                <div>
                  <span class="font-medium text-slate-800">€ {{ parseFloat(p.importo).toFixed(2) }}</span>
                  <span class="text-slate-400 ml-2">{{ new Date(p.dataPagamento).toLocaleDateString('it-IT') }}</span>
                  <span class="text-slate-400 ml-2">{{ p.metodoPagamento }}</span>
                  <UBadge size="xs" variant="subtle" color="neutral" class="ml-2">{{ p.tipoPagamento }}</UBadge>
                </div>
                <div class="flex gap-1 items-center">
                  <UTooltip v-if="p.fatturaEmessa" text="Fattura già emessa: non puoi né modificare né eliminare questo pagamento.">
                    <span class="inline-flex text-slate-400 p-1 cursor-help">
                      <UIcon name="i-heroicons-lock-closed" class="w-4 h-4" />
                    </span>
                  </UTooltip>
                  <UButton v-if="!p.fatturaEmessa" icon="i-heroicons-pencil" size="xs" color="neutral" variant="ghost" title="Modifica" @click="iniziaModifica(p)" />
                  <UButton v-if="!p.fatturaEmessa" icon="i-heroicons-trash" size="xs" color="error" variant="ghost" title="Elimina" @click="chiediEliminazione(p)" />
                </div>
              </div>

              <!-- Riga in modifica -->
              <div v-else class="space-y-2">
                <div class="grid grid-cols-2 gap-2">
                  <UInputNumber v-model="editForm.importo" :min="0.01" :step="10" size="xs" />
                  <UInput v-model="editForm.data" type="date" size="xs" />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <USelect v-model="editForm.tipo" :items="tipiPagamento" size="xs" class="w-full" />
                    <p v-if="editTipoError" class="text-red-500 text-[10px] mt-0.5 leading-tight">{{ editTipoError }}</p>
                  </div>
                  <USelect v-model="editForm.metodo" :items="metodiPagamento" size="xs" />
                </div>
                <div class="flex justify-end gap-2 mt-2">
                  <UButton size="xs" variant="ghost" @click="editingId = null">Annulla</UButton>
                  <UButton size="xs" color="primary" :disabled="!!editTipoError" @click="chiediModifica(p)">Salva</UButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" @click="isOpen = false">Annulla</UButton>
        <UButton :loading="salvandoPagamento" :disabled="giaSaldato || !!tipoPagamentoError" @click="salvaPagamento">Registra Pagamento</UButton>
      </div>
    </template>
  </UModal>

  <ConfirmDialog
    v-model:open="confirmAperto"
    :title="confirmConfig.title"
    :description="confirmConfig.description"
    :confirm-label="confirmConfig.confirmLabel"
    :confirm-color="confirmConfig.confirmColor"
    :loading="confirmLoading"
    @confirm="eseguiAzioneConfermata"
  />
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps<{ pacchetto: any | null }>()
const emit = defineEmits<{ refresh: [] }>()
const isOpen = defineModel<boolean>('open', { default: false })

const toast = useToast()
const salvandoPagamento = ref(false)
const storico = ref<any[]>([])
const giaSaldato = computed(() => !!props.pacchetto?.stati?.includes('PAGATO'))

import { METODI_PAGAMENTO_ITEMS, TIPI_PAGAMENTO_ITEMS } from '~/utils/contabilita'
const tipiPagamento = TIPI_PAGAMENTO_ITEMS
const metodiPagamento = METODI_PAGAMENTO_ITEMS

const pagamento = reactive({
  importo: 0,
  data:    new Date().toISOString().slice(0, 10),
  tipo:    'SALDO' as string,
  metodo:  'CONTANTI' as string,
  fattura: false,
})

const residuo = computed(() => parseFloat(props.pacchetto?.importoResiduo || '0'))

function calcolaTipoPagamento(num: number) {
  const isFull = num >= residuo.value - 0.01
  const giaPagato = parseFloat(props.pacchetto?.importoPagato || '0')
  const hadSaldo = props.pacchetto?.stati?.includes('PAGATO') || 
                   giaPagato >= parseFloat(props.pacchetto?.prezzoTotale || '0') ||
                   storico.value.some(p => p.tipoPagamento === 'SALDO' || p.tipoPagamento === 'INTEGRAZIONE')

  if (hadSaldo) {
    pagamento.tipo = 'INTEGRAZIONE'
  } else if (isFull) {
    pagamento.tipo = 'SALDO'
  } else if (giaPagato === 0) {
    pagamento.tipo = 'ACCONTO'
  } else {
    pagamento.tipo = 'RATA'
  }
}

watch(() => pagamento.importo, (newVal) => {
  calcolaTipoPagamento(Number(newVal))
})

const tipoPagamentoError = computed(() => {
  const num = Number(pagamento.importo)
  if (pagamento.tipo === 'SALDO' && num < residuo.value - 0.01) {
    return 'Il saldo deve coprire l\'intero residuo.'
  }
  if (pagamento.tipo !== 'SALDO' && pagamento.tipo !== 'INTEGRAZIONE' && num >= residuo.value - 0.01) {
    return 'L\'intero importo copre il residuo: seleziona Saldo.'
  }
  return undefined
})

// ─── Modifica inline di un pagamento esistente ───
const editingId = ref<string | null>(null)
const editForm = reactive({ importo: 0, data: '', tipo: 'SALDO' as string, metodo: 'CONTANTI' as string })

function iniziaModifica(p: any) {
  editingId.value = p.id
  editForm.importo = parseFloat(p.importo)
  editForm.data    = new Date(p.dataPagamento).toISOString().slice(0, 10)
  editForm.tipo    = p.tipoPagamento
  editForm.metodo  = p.metodoPagamento
}

const editResiduo = computed(() => {
  if (!editingId.value || !props.pacchetto) return 0
  const originalPayment = storico.value.find(p => p.id === editingId.value)
  if (!originalPayment) return 0
  return parseFloat(props.pacchetto.importoResiduo) + parseFloat(originalPayment.importo)
})

function calcolaEditTipoPagamento(num: number) {
  const isFull = num >= editResiduo.value - 0.01
  const originalPayment = storico.value.find(p => p.id === editingId.value)
  const isFirstPayment = !storico.value.some(p => p.id !== editingId.value && new Date(p.dataPagamento) <= new Date(originalPayment?.dataPagamento || new Date()))
  
  const hadSaldoBefore = storico.value.some(p => 
    p.id !== editingId.value && 
    (p.tipoPagamento === 'SALDO' || p.tipoPagamento === 'INTEGRAZIONE') &&
    new Date(p.dataPagamento) <= new Date(originalPayment?.dataPagamento || new Date())
  )

  if (hadSaldoBefore) {
    editForm.tipo = 'INTEGRAZIONE'
  } else if (isFull) {
    editForm.tipo = 'SALDO'
  } else if (isFirstPayment) {
    editForm.tipo = 'ACCONTO'
  } else {
    editForm.tipo = 'RATA'
  }
}

watch(() => editForm.importo, (newVal) => {
  calcolaEditTipoPagamento(Number(newVal))
})

const editTipoError = computed(() => {
  const num = Number(editForm.importo)
  if (editForm.tipo === 'SALDO' && num < editResiduo.value - 0.01) {
    return 'L\'importo non copre il residuo.'
  }
  if (editForm.tipo !== 'SALDO' && editForm.tipo !== 'INTEGRAZIONE' && num >= editResiduo.value - 0.01) {
    return 'Scegli Saldo (copre il residuo).'
  }
  return undefined
})

// ─── Conferma (modifica/eliminazione) — niente alert/confirm nativi ───
const confirmAperto  = ref(false)
const confirmLoading = ref(false)
const confirmConfig  = reactive({ title: '', description: '', confirmLabel: 'Conferma', confirmColor: 'primary' as 'primary' | 'error' })
const azionePendente = ref<{ tipo: 'modifica' | 'elimina'; paymentId: string } | null>(null)

function chiediModifica(p: any) {
  azionePendente.value = { tipo: 'modifica', paymentId: p.id }
  confirmConfig.title = 'Confermi la modifica?'
  confirmConfig.description = `Il pagamento verrà aggiornato a € ${editForm.importo.toFixed(2)} (${editForm.tipo}, ${editForm.metodo}), e la scrittura in contabilità collegata verrà aggiornata di conseguenza.`
  confirmConfig.confirmLabel = 'Salva modifica'
  confirmConfig.confirmColor = 'primary'
  confirmAperto.value = true
}

function chiediEliminazione(p: any) {
  azionePendente.value = { tipo: 'elimina', paymentId: p.id }
  confirmConfig.title = 'Confermi l\'eliminazione?'
  confirmConfig.description = `Il pagamento di € ${parseFloat(p.importo).toFixed(2)} verrà eliminato definitivamente, insieme alla scrittura in contabilità collegata. Il saldo del pacchetto verrà ricalcolato.`
  confirmConfig.confirmLabel = 'Elimina'
  confirmConfig.confirmColor = 'error'
  confirmAperto.value = true
}

async function eseguiAzioneConfermata() {
  if (!azionePendente.value) return
  const { tipo, paymentId } = azionePendente.value
  confirmLoading.value = true
  try {
    if (tipo === 'elimina') {
      await $fetch(`/api/payments/${paymentId}`, { method: 'DELETE' })
      toast.add({ title: 'Pagamento eliminato', color: 'success' })
    } else {
      await $fetch(`/api/payments/${paymentId}`, {
        method: 'PUT',
        body: {
          importo:         Number(editForm.importo),
          tipoPagamento:   editForm.tipo,
          metodoPagamento: editForm.metodo,
          dataPagamento:   editForm.data,
        },
      })
      toast.add({ title: 'Pagamento modificato', color: 'success' })
      editingId.value = null
    }
    confirmAperto.value = false
    await caricaStorico()
    emit('refresh')
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Operazione non riuscita', color: 'error' })
  } finally {
    confirmLoading.value = false
  }
}

async function caricaStorico() {
  if (!props.pacchetto) { storico.value = []; return }
  try {
    const res = await $fetch('/api/payments', { query: { packageId: props.pacchetto.id, limit: 100 } }) as any
    storico.value = res?.data ?? []
    calcolaTipoPagamento(Number(pagamento.importo))
  } catch {
    storico.value = []
  }
}

watch(isOpen, (val) => {
  if (val && props.pacchetto) {
    pagamento.importo = parseFloat(props.pacchetto.importoResiduo) || 0
    pagamento.data    = new Date().toISOString().slice(0, 10)
    pagamento.tipo    = 'SALDO'
    pagamento.metodo  = 'CONTANTI'
    pagamento.fattura = false
    editingId.value   = null
    caricaStorico()
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
        importo:         Number(pagamento.importo),
        tipoPagamento:   pagamento.tipo,
        metodoPagamento: pagamento.metodo,
        dataPagamento:   pagamento.data,
        fatturaRichiesta: pagamento.fattura,
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
