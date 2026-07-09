<template>
  <div class="space-y-6">
    <div v-if="pending" class="py-12 flex justify-center">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-slate-300 animate-spin" />
    </div>

    <template v-else-if="pacchetto">
      <!-- Intestazione -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <UButton variant="ghost" icon="i-heroicons-arrow-left" size="sm" class="mb-2" @click="$router.back()">Torna ai pacchetti</UButton>
          <h2 class="text-xl font-semibold text-slate-900">{{ pacchetto.nome }}</h2>
          <NuxtLink :to="`/studenti/${pacchetto.studentId}`" class="text-sm text-tfn-600 hover:underline">
            {{ pacchetto.studentLastName }} {{ pacchetto.studentFirstName }}
          </NuxtLink>
        </div>
        <div class="flex flex-wrap gap-1 justify-end">
          <StatoBadge v-for="s in riassumiStati(pacchetto.stati)" :key="s" :stato="s" :pacchetto="pacchetto" />
        </div>
      </div>

      <!-- Riepilogo -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <UCard>
          <div class="text-xl font-bold text-slate-900">
            <template v-if="pacchetto.tipo === 'MENSILE'">{{ pacchetto.giorniResiduo ?? 0 }} / {{ pacchetto.giorniAcquistati ?? 0 }}</template>
            <template v-else>{{ parseFloat(pacchetto.oreResiduo) }} / {{ parseFloat(pacchetto.oreAcquistate) }}</template>
          </div>
          <div class="text-xs text-slate-500 mt-0.5">{{ pacchetto.tipo === 'MENSILE' ? 'Giorni residui' : 'Ore residue' }}</div>
        </UCard>
        <UCard>
          <div class="text-xl font-bold" :class="parseFloat(pacchetto.importoResiduo) > 0 ? 'text-orange-600' : 'text-slate-900'">
            € {{ parseFloat(pacchetto.importoResiduo).toFixed(2) }}
          </div>
          <div class="text-xs text-slate-500 mt-0.5">Importo residuo</div>
        </UCard>
        <UCard>
          <div class="text-xl font-bold text-slate-900">{{ pacchetto.dataScadenza ? formatData(pacchetto.dataScadenza) : '—' }}</div>
          <div class="text-xs text-slate-500 mt-0.5">Scadenza</div>
        </UCard>
        <UCard>
          <div class="text-xl font-bold text-slate-900">{{ lezioni.length }}</div>
          <div class="text-xs text-slate-500 mt-0.5">Lezioni svolte</div>
        </UCard>
      </div>

      <div class="flex justify-end gap-3">
        <UButton
          v-if="pacchetto?.sospeso"
          icon="i-heroicons-play-circle"
          color="success"
          variant="soft"
          size="sm"
          @click="chiediToggleSospeso(false)"
        >
          Riattiva
        </UButton>
        <UButton
          v-else
          icon="i-heroicons-pause-circle"
          color="warning"
          variant="soft"
          size="sm"
          @click="chiediToggleSospeso(true)"
        >
          Sospendi
        </UButton>
        <UButton
          icon="i-heroicons-arrow-path-rounded-square"
          color="primary"
          variant="soft"
          size="sm"
          @click="modalCreaAperto = true"
        >
          Rinnova pacchetto
        </UButton>
        <UButton
          icon="i-heroicons-pencil"
          color="neutral"
          variant="soft"
          size="sm"
          @click="modalModificaAperto = true"
        >
          Modifica pacchetto
        </UButton>
        <UButton
          v-if="puoEliminare"
          color="error" variant="soft" icon="i-heroicons-trash"
          @click="chiediEliminazionePacchetto"
        >
          Elimina pacchetto
        </UButton>
        <UTooltip v-else text="Non eliminabile: ha pagamenti e/o lezioni collegate">
          <UButton color="error" variant="soft" icon="i-heroicons-trash" disabled>Elimina pacchetto</UButton>
        </UTooltip>
        <UButton icon="i-heroicons-banknotes" :disabled="giaSaldato" @click="modalPagamentoAperto = true">
          {{ giaSaldato ? 'Già saldato' : 'Registra Pagamento' }}
        </UButton>
      </div>

      <!-- Storico lezioni (70%) + Storico pagamenti (30%), affiancati -->
      <div class="grid grid-cols-1 lg:grid-cols-10 gap-6">
        <UCard :ui="{ body: 'p-0' }" class="lg:col-span-7">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-slate-800">Storico lezioni</h3>
              <UButton v-if="lezioni.length > 0" size="xs" variant="soft" icon="i-heroicons-arrow-down-tray" @click="esportaCsv">Esporta CSV</UButton>
            </div>
          </template>
          <div v-if="lezioni.length === 0" class="p-8 text-center text-slate-400 text-sm">Nessuna lezione registrata con questo pacchetto.</div>
          <table v-else class="w-full text-left">
            <thead>
              <tr class="bg-slate-50 text-xs text-slate-500 uppercase">
                <th class="py-2.5 px-4">Data</th>
                <th class="py-2.5 px-4">Tutor</th>
                <th class="py-2.5 px-4">Tipo</th>
                <th class="py-2.5 px-4 text-right">Ore scalate</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in lezioni" :key="l.lessonId" class="border-t border-slate-100 text-sm">
                <td class="py-2.5 px-4">{{ formatData(l.data) }}</td>
                <td class="py-2.5 px-4">{{ l.tutorLastName }} {{ l.tutorFirstName }}</td>
                <td class="py-2.5 px-4"><UBadge size="xs" variant="subtle" color="neutral">{{ l.tipo }}</UBadge></td>
                <td class="py-2.5 px-4 text-right">{{ parseFloat(l.oreScalate) }}</td>
              </tr>
            </tbody>
          </table>
        </UCard>

        <UCard :ui="{ body: 'p-0' }" class="lg:col-span-3">
          <template #header><h3 class="font-semibold text-slate-800">Storico pagamenti</h3></template>
          <div v-if="pagamenti.length === 0" class="p-8 text-center text-slate-400 text-sm">Nessun pagamento registrato.</div>
          <div v-else class="divide-y divide-slate-100">
            <div v-for="p in pagamenti" :key="p.id" class="text-sm px-4 py-2.5">
              <!-- form inline modifica -->
              <div v-if="editingPaymentId === p.id" class="space-y-2 border border-primary-100 rounded p-2 bg-primary-50">
                <div class="grid grid-cols-2 gap-2">
                  <UInput v-model="editForm.importo" type="number" step="0.01" class="w-full" placeholder="Importo" />
                  <UInput v-model="editForm.dataPagamento" type="date" class="w-full" />
                  <div>
                    <USelectMenu v-model="editForm.tipoPagamento" :items="['ACCONTO', 'SALDO', 'RATA', 'INTEGRAZIONE']" class="w-full" />
                    <p v-if="editTipoError" class="text-red-500 text-[10px] mt-0.5 leading-tight">{{ editTipoError }}</p>
                  </div>
                  <USelectMenu v-model="editForm.metodoPagamento" :items="['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO']" class="w-full" />
                </div>
                <div class="flex justify-end gap-1 mt-2">
                  <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="annullaModificaPagamento" />
                  <UButton size="xs" color="primary" icon="i-heroicons-check" :disabled="!!editTipoError" @click="chiediSalvataggioPagamento" />
                </div>
              </div>
              
              <!-- visualizzazione normale -->
              <div v-else class="flex justify-between items-start">
                <div>
                  <div class="font-medium text-slate-800">€ {{ parseFloat(p.importo).toFixed(2) }}</div>
                  <div class="text-slate-400 text-xs">{{ new Date(p.dataPagamento).toLocaleDateString('it-IT') }} · {{ p.metodoPagamento }}</div>
                  <UBadge size="xs" variant="subtle" color="neutral" class="mt-1">{{ p.tipoPagamento }}</UBadge>
                </div>
                <div class="flex gap-1 items-center">
                  <UTooltip v-if="p.fatturaEmessa" text="Fattura già emessa: non puoi né modificare né eliminare questo pagamento.">
                    <span class="inline-flex text-slate-400 p-1 cursor-help mr-1">
                      <UIcon name="i-heroicons-lock-closed" class="w-4 h-4" />
                    </span>
                  </UTooltip>
                  <UButton v-if="!p.fatturaEmessa" size="xs" color="neutral" variant="ghost" icon="i-heroicons-pencil" @click="avviaModificaPagamento(p)" />
                  <UButton v-if="!p.fatturaEmessa" size="xs" color="error" variant="ghost" icon="i-heroicons-trash" @click="chiediEliminazionePagamento(p.id)" />
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </template>

    <div v-else class="py-16 text-center">
      <p class="text-slate-500">Pacchetto non trovato.</p>
    </div>

    <!-- Modali -->
    <ModalPagamentoPacchetto v-model:open="modalPagamentoAperto" :pacchetto="pacchetto" @refresh="refreshTutto" />
    <ModalModificaPacchetto v-model:open="modalModificaAperto" :pacchetto="pacchetto" @refresh="refreshTutto" />
    <ModalCreaPacchetto v-model:open="modalCreaAperto" :student-id="pacchetto?.studentId" :student-name="pacchetto?.studentLastName + ' ' + pacchetto?.studentFirstName" :rinnovo-da="pacchetto" @refresh="onPacchettoRinnovato" />

    <ConfirmDialog
      v-model:open="confirmEliminaAperto"
      title="Eliminare questo pacchetto?"
      :description="`'${pacchetto?.nome}' verrà eliminato definitivamente. Questa azione è possibile solo perché non ha pagamenti né lezioni collegate.`"
      confirm-label="Elimina"
      confirm-color="error"
      :loading="eliminandoPacchetto"
      @confirm="eliminaPacchetto"
    />

    <ConfirmDialog
      v-model:open="confirmSavePaymentAperto"
      title="Salva modifica pagamento?"
      description="Questa modifica aggiornerà automaticamente anche la contabilità collegata."
      confirm-label="Salva"
      confirm-color="primary"
      :loading="salvandoPayment"
      @confirm="salvaPagamento"
    />

    <ConfirmDialog
      v-model:open="confirmDeletePaymentAperto"
      title="Eliminare questo pagamento?"
      description="Il pagamento verrà rimosso definitivamente e la scrittura contabile collegata sarà eliminata."
      confirm-label="Elimina"
      confirm-color="error"
      :loading="eliminandoPayment"
      @confirm="eliminaPagamento"
    />

    <ConfirmDialog
      v-model:open="confirmToggleSospesoAperto"
      :title="sospesoTarget ? 'Sospendere questo pacchetto?' : 'Riattivare questo pacchetto?'"
      :description="sospesoTarget ? 'Le lezioni future non potranno più scalare ore da questo pacchetto fino alla riattivazione.' : 'Il pacchetto tornerà utilizzabile per le lezioni e gli stati verranno ricalcolati.'"
      :confirm-label="sospesoTarget ? 'Sospendi' : 'Riattiva'"
      :confirm-color="sospesoTarget ? 'warning' : 'success'"
      :loading="toggleSospesoLoading"
      @confirm="eseguiToggleSospeso"
    />
  </div>
</template>

<script setup lang="ts">
import { riassumiStati } from '~/utils/statiPacchetto'
import { formatData } from '~/utils/format'

definePageMeta({ middleware: ['admin-or-super'] })

const route = useRoute()
const toast = useToast()
const router = useRouter()
const id = route.params.id as string

const modalPagamentoAperto = ref(false)
const modalModificaAperto = ref(false)
const modalCreaAperto = ref(false)

function onPacchettoRinnovato() {
  if (pacchetto.value?.studentId) {
    router.push(`/studenti/${pacchetto.value.studentId}`)
  }
}

const { data: pacchettoRes, pending, refresh: refreshPacchetto } = useFetch(`/api/packages/${id}`, { lazy: true })
const pacchetto = computed(() => pacchettoRes.value?.data ?? null)

const { data: lezioniRes, refresh: refreshLezioni } = useFetch(`/api/packages/${id}/lessons`, { lazy: true, default: () => ({ data: [] }) })
const lezioni = computed(() => lezioniRes.value?.data ?? [])

const { data: pagamentiRes, refresh: refreshPagamenti } = useFetch('/api/payments', { lazy: true, query: { packageId: id, limit: 100 }, default: () => ({ data: [] }) })
const pagamenti = computed(() => pagamentiRes.value?.data ?? [])

const giaSaldato    = computed(() => !!pacchetto.value?.stati?.includes('PAGATO'))
const puoEliminare  = computed(() => pagamenti.value.length === 0 && lezioni.value.length === 0)


function refreshTutto() {
  refreshPacchetto()
  refreshLezioni()
  refreshPagamenti()
}



function esportaCsv() {
  const righe = [
    ['Data', 'Tutor', 'Tipo', 'Ore scalate'],
    ...lezioni.value.map((l: any) => [formatData(l.data), `${l.tutorLastName} ${l.tutorFirstName}`, l.tipo, parseFloat(l.oreScalate)]),
  ]
  const csv = righe.map(r => r.join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lezioni-${pacchetto.value?.nome ?? id}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Eliminazione pacchetto (solo se senza pagamenti/lezioni) ───
const confirmEliminaAperto = ref(false)
const eliminandoPacchetto  = ref(false)

function chiediEliminazionePacchetto() {
  confirmEliminaAperto.value = true
}

async function eliminaPacchetto() {
  eliminandoPacchetto.value = true
  try {
    await $fetch(`/api/packages/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Pacchetto eliminato', color: 'success' })
    confirmEliminaAperto.value = false
    router.push('/pacchetti')
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile eliminare il pacchetto', color: 'error' })
  } finally {
    eliminandoPacchetto.value = false
  }
}

// ─── Modifica e Cancellazione Pagamenti ───
const editingPaymentId = ref<string | null>(null)
const editForm = ref({
  importo: 0,
  dataPagamento: '',
  tipoPagamento: 'ACCONTO',
  metodoPagamento: 'CONTANTI'
})

const confirmSavePaymentAperto = ref(false)
const salvandoPayment = ref(false)

const confirmDeletePaymentAperto = ref(false)
const eliminandoPayment = ref(false)
const paymentToDelete = ref<string | null>(null)

function avviaModificaPagamento(p: any) {
  editingPaymentId.value = p.id
  editForm.value = {
    importo: parseFloat(p.importo),
    dataPagamento: new Date(p.dataPagamento).toISOString().split('T')[0],
    tipoPagamento: p.tipoPagamento,
    metodoPagamento: p.metodoPagamento
  }
}

function annullaModificaPagamento() {
  editingPaymentId.value = null
}

const editResiduo = computed(() => {
  if (!editingPaymentId.value || !pacchetto.value) return 0
  const originalPayment = pagamenti.value.find(p => p.id === editingPaymentId.value)
  if (!originalPayment) return 0
  return parseFloat(pacchetto.value.importoResiduo) + parseFloat(originalPayment.importo)
})

watch(() => editForm.value.importo, (newVal) => {
  const num = Number(newVal)
  if (num < editResiduo.value - 0.01 && editForm.value.tipoPagamento === 'SALDO') {
    editForm.value.tipoPagamento = 'ACCONTO'
  } else if (num >= editResiduo.value - 0.01 && editForm.value.tipoPagamento !== 'SALDO') {
    editForm.value.tipoPagamento = 'SALDO'
  }
})

const editTipoError = computed(() => {
  const num = Number(editForm.value.importo)
  if (editForm.value.tipoPagamento === 'SALDO' && num < editResiduo.value - 0.01) {
    return 'L\'importo non copre il residuo.'
  }
  if (editForm.value.tipoPagamento !== 'SALDO' && num >= editResiduo.value - 0.01) {
    return 'Scegli Saldo (copre il residuo).'
  }
  return undefined
})

function chiediSalvataggioPagamento() {
  confirmSavePaymentAperto.value = true
}

async function salvaPagamento() {
  if (!editingPaymentId.value) return
  salvandoPayment.value = true
  try {
    await $fetch(`/api/payments/${editingPaymentId.value}`, {
      method: 'PUT',
      body: {
        importo: Number(editForm.value.importo),
        dataPagamento: editForm.value.dataPagamento,
        tipoPagamento: editForm.value.tipoPagamento,
        metodoPagamento: editForm.value.metodoPagamento
      }
    })
    toast.add({ title: 'Pagamento aggiornato', color: 'success' })
    confirmSavePaymentAperto.value = false
    editingPaymentId.value = null
    refreshPagamenti()
    refreshPacchetto()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile modificare il pagamento', color: 'error' })
  } finally {
    salvandoPayment.value = false
  }
}

function chiediEliminazionePagamento(id: string) {
  paymentToDelete.value = id
  confirmDeletePaymentAperto.value = true
}

async function eliminaPagamento() {
  if (!paymentToDelete.value) return
  eliminandoPayment.value = true
  try {
    await $fetch(`/api/payments/${paymentToDelete.value}`, { method: 'DELETE' })
    toast.add({ title: 'Pagamento eliminato', color: 'success' })
    confirmDeletePaymentAperto.value = false
    paymentToDelete.value = null
    refreshPagamenti()
    refreshPacchetto()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile eliminare il pagamento', color: 'error' })
  } finally {
    eliminandoPayment.value = false
  }
}

// ─── Sospendi / Riattiva ───
const confirmToggleSospesoAperto = ref(false)
const toggleSospesoLoading = ref(false)
const sospesoTarget = ref(false)

function chiediToggleSospeso(val: boolean) {
  sospesoTarget.value = val
  confirmToggleSospesoAperto.value = true
}

async function eseguiToggleSospeso() {
  toggleSospesoLoading.value = true
  try {
    await $fetch(`/api/packages/${id}`, {
      method: 'PUT',
      body: { sospeso: sospesoTarget.value },
    })
    toast.add({ title: sospesoTarget.value ? 'Pacchetto sospeso' : 'Pacchetto riattivato', color: 'success' })
    confirmToggleSospesoAperto.value = false
    refreshPacchetto()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Operazione non riuscita', color: 'error' })
  } finally {
    toggleSospesoLoading.value = false
  }
}
</script>
