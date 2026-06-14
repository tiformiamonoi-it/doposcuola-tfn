<template>
  <div class="space-y-6">

    <!-- Intestazione -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">Contabilità</h2>
        <p class="text-sm text-slate-500 mt-0.5">Cruscotto finanziario e gestione movimenti</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton icon="i-heroicons-arrow-path" variant="outline" size="sm" :loading="pending" @click="refreshAll">
          Aggiorna
        </UButton>
        <UButton icon="i-heroicons-plus" size="sm" @click="modalNuovoMovimentoAperto = true">
          Nuovo Movimento
        </UButton>
      </div>
    </div>

    <!-- Skeleton caricamento -->
    <template v-if="pending">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <USkeleton v-for="i in 3" :key="i" class="h-28 rounded-xl" />
      </div>
      <USkeleton class="h-48 rounded-xl" />
    </template>

    <template v-else-if="dash">

      <!-- ─── ULTIMI 30 GIORNI ─── -->
      <div>
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Ultimi 30 giorni</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          <UCard class="bg-green-50 border-green-100">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs text-green-600 font-medium uppercase tracking-wide">Entrate</p>
                <p class="text-2xl font-bold text-green-700 mt-1">
                  € {{ fmt(dash.margineUltimi30Giorni.entrate) }}
                </p>
              </div>
              <UIcon name="i-heroicons-arrow-trending-up" class="w-6 h-6 text-green-400" />
            </div>
          </UCard>

          <UCard class="bg-red-50 border-red-100">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs text-red-600 font-medium uppercase tracking-wide">Uscite</p>
                <p class="text-2xl font-bold text-red-700 mt-1">
                  € {{ fmt(dash.margineUltimi30Giorni.uscite) }}
                </p>
              </div>
              <UIcon name="i-heroicons-arrow-trending-down" class="w-6 h-6 text-red-400" />
            </div>
          </UCard>

          <UCard :class="dash.margineUltimi30Giorni.margine >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide" :class="dash.margineUltimi30Giorni.margine >= 0 ? 'text-blue-600' : 'text-orange-600'">
                  Margine netto
                </p>
                <p class="text-2xl font-bold mt-1" :class="dash.margineUltimi30Giorni.margine >= 0 ? 'text-blue-700' : 'text-orange-700'">
                  € {{ fmt(dash.margineUltimi30Giorni.margine) }}
                </p>
              </div>
              <UIcon name="i-heroicons-scale" class="w-6 h-6" :class="dash.margineUltimi30Giorni.margine >= 0 ? 'text-blue-400' : 'text-orange-400'" />
            </div>
          </UCard>

          <UCard :class="dash.fattureInAttesa.count > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-slate-50'">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide" :class="dash.fattureInAttesa.count > 0 ? 'text-yellow-600' : 'text-slate-400'">
                  Fatture da emettere
                </p>
                <p class="text-2xl font-bold mt-1" :class="dash.fattureInAttesa.count > 0 ? 'text-yellow-700' : 'text-slate-600'">
                  {{ dash.fattureInAttesa.count }}
                </p>
              </div>
              <UIcon name="i-heroicons-document-text" class="w-6 h-6" :class="dash.fattureInAttesa.count > 0 ? 'text-yellow-400' : 'text-slate-300'" />
            </div>
          </UCard>

        </div>
      </div>

      <!-- ─── TOTALI DALL'INIZIO ─── -->
      <div>
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Totali dall'inizio attività</p>
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">

          <UCard>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <UIcon name="i-heroicons-banknotes" class="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p class="text-xs text-slate-400">Contanti</p>
                <p class="text-base font-bold text-slate-800">€ {{ fmt(dash.cashFlow.totale.contanti) }}</p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <UIcon name="i-heroicons-building-library" class="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p class="text-xs text-slate-400">Bonifici</p>
                <p class="text-base font-bold text-slate-800">€ {{ fmt(dash.cashFlow.totale.bonifico) }}</p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <UIcon name="i-heroicons-credit-card" class="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p class="text-xs text-slate-400">POS</p>
                <p class="text-base font-bold text-slate-800">€ {{ fmt(dash.cashFlow.totale.pos) }}</p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                <UIcon name="i-heroicons-document" class="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <p class="text-xs text-slate-400">Assegni</p>
                <p class="text-base font-bold text-slate-800">€ {{ fmt(dash.cashFlow.totale.assegno) }}</p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-tfn-100 flex items-center justify-center shrink-0">
                <UIcon name="i-heroicons-circle-stack" class="w-4 h-4 text-tfn-600" />
              </div>
              <div>
                <p class="text-xs text-slate-400">Totale</p>
                <p class="text-base font-bold text-tfn-700">€ {{ fmt(dash.cashFlow.totale.totale) }}</p>
              </div>
            </div>
          </UCard>

        </div>
      </div>

      <!-- ─── PREVISIONI (CREDITI E DEBITI) ─── -->
      <div class="mt-8">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Previsionale (Movimenti futuri)</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          <UCard class="bg-indigo-50 border-indigo-100">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs text-indigo-600 font-medium uppercase tracking-wide">Da Incassare (Crediti)</p>
                <p class="text-2xl font-bold text-indigo-700 mt-1">
                  € {{ fmt(dash.previsioni.crediti) }}
                </p>
              </div>
              <UIcon name="i-heroicons-arrow-down-tray" class="w-6 h-6 text-indigo-400" />
            </div>
          </UCard>

          <UCard class="bg-pink-50 border-pink-100">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs text-pink-600 font-medium uppercase tracking-wide">Da Pagare (Debiti)</p>
                <p class="text-2xl font-bold text-pink-700 mt-1">
                  € {{ fmt(dash.previsioni.debiti) }}
                </p>
              </div>
              <UIcon name="i-heroicons-arrow-up-tray" class="w-6 h-6 text-pink-400" />
            </div>
          </UCard>
        </div>
      </div>

      <!-- ─── LISTA MOVIMENTI ─── -->
      <UCard class="mt-8">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-list-bullet" class="w-5 h-5 text-slate-500" />
            <span class="font-medium text-slate-800">Tutti i Movimenti</span>
          </div>
        </template>
        
        <div class="flex flex-wrap gap-3 mb-4 items-end">
          <UFormField label="Dal">
            <UInput type="date" v-model="filtroEntries.dataInizio" @change="caricaEntries" />
          </UFormField>
          <UFormField label="Al">
            <UInput type="date" v-model="filtroEntries.dataFine" @change="caricaEntries" />
          </UFormField>
          <UFormField label="Tipo">
            <USelect v-model="filtroEntries.tipo" :items="[{label: 'Tutti', value: 'TUTTI'}, {label: 'Entrata', value: 'ENTRATA'}, {label: 'Uscita', value: 'USCITA'}, {label: 'Credito', value: 'CREDITO'}, {label: 'Debito', value: 'DEBITO'}, {label: 'Nota/Atteso', value: 'NOTA'}, {label: 'Storno', value: 'STORNO'}]" @change="caricaEntries" class="w-40" />
          </UFormField>
          <UFormField label="Categoria">
            <UInput v-model="filtroEntries.categoria" placeholder="Es. stipendi..." @change="caricaEntries" @keyup.enter="caricaEntries" />
          </UFormField>
        </div>

        <UTable :data="entries" :columns="colonneEntries" :loading="pendingEntries">
          <template #data-cell="{ row }">{{ formatData(row.original.data) }}</template>
          <template #tipo-cell="{ row }">
            <UBadge :color="row.original.tipo === 'ENTRATA' ? 'success' : row.original.tipo === 'USCITA' ? 'error' : row.original.tipo === 'CREDITO' ? 'indigo' : row.original.tipo === 'DEBITO' ? 'pink' : row.original.tipo === 'NOTA' ? 'warning' : 'neutral'" variant="subtle" size="xs">
              {{ row.original.tipo }}
            </UBadge>
          </template>
          <template #descrizione-cell="{ row }">
            <span class="text-sm text-slate-700">{{ row.original.descrizione }}</span>
          </template>
          <template #categoria-cell="{ row }">
            <UBadge color="neutral" variant="outline" size="xs">{{ row.original.categoria }}</UBadge>
          </template>
          <template #importo-cell="{ row }">
            <span class="font-medium" :class="row.original.tipo === 'USCITA' || row.original.tipo === 'DEBITO' ? 'text-error-600' : 'text-slate-800'">
              {{ row.original.tipo === 'USCITA' || row.original.tipo === 'DEBITO' ? '-' : '' }}€ {{ fmt(parseFloat(row.original.importo)) }}
            </span>
          </template>
          <template #azioni-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                v-if="isManuale(row.original)"
                icon="i-heroicons-pencil-square"
                size="xs" color="neutral" variant="ghost"
                title="Modifica"
                @click="apriModifica(row.original)"
              />
              <UTooltip v-else text="Movimento automatico: modificalo dal pagamento di origine">
                <UButton icon="i-heroicons-pencil-square" size="xs" color="neutral" variant="ghost" disabled />
              </UTooltip>
              <UButton
                icon="i-heroicons-trash"
                size="xs" color="error" variant="ghost"
                title="Elimina"
                @click="apriElimina(row.original)"
              />
            </div>
          </template>
        </UTable>
        <div class="mt-4 flex justify-center border-t border-slate-100 pt-4" v-if="metaEntries && metaEntries.totalPages > 1">
          <UPagination v-model:page="filtroEntries.page" :total="metaEntries.total" :items-per-page="filtroEntries.limit" @update:page="caricaEntries" />
        </div>
      </UCard>

      <!-- ─── FATTURE IN ATTESA ─── -->
      <UCard v-if="dash.fattureInAttesa.count > 0" class="mt-8">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-document-text" class="w-4 h-4 text-yellow-500" />
            <span class="font-medium text-slate-800">Fatture da emettere</span>
            <UBadge color="warning" variant="subtle">{{ dash.fattureInAttesa.count }}</UBadge>
          </div>
        </template>
        <UTable
          :data="dash.fattureInAttesa.lista"
          :columns="colonneFatture"
        >
          <template #importo-cell="{ row }">
            <span class="font-medium text-slate-800">€ {{ fmt(parseFloat(row.original.importo)) }}</span>
          </template>
          <template #dataPagamento-cell="{ row }">
            <span class="text-slate-600 text-sm">{{ formatData(row.original.dataPagamento) }}</span>
          </template>
          <template #metodoPagamento-cell="{ row }">
            <UBadge color="neutral" variant="outline" size="xs">{{ row.original.metodoPagamento }}</UBadge>
          </template>
          <template #azione-cell="{ row }">
            <UButton
              size="xs"
              color="warning"
              variant="outline"
              :loading="segnandoFattura === row.original.entryId"
              @click="segnaFatturaEmessa(row.original)"
            >
              Segna emessa
            </UButton>
          </template>
        </UTable>
      </UCard>

    </template>

    <!-- ─── MODAL NUOVO MOVIMENTO ─── -->
    <UModal v-model:open="modalNuovoMovimentoAperto" title="Nuovo Movimento Manuale">
      <template #body>
        <UForm :state="nuovoMovimento" class="space-y-4" @submit="salvaMovimento">
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="tipo" label="Tipo" required>
              <USelect v-model="nuovoMovimento.tipo" :items="[{label: 'Entrata (Cassa Reale)', value: 'ENTRATA'}, {label: 'Uscita (Cassa Reale)', value: 'USCITA'}, {label: 'Credito (Da incassare)', value: 'CREDITO'}, {label: 'Debito (Da pagare)', value: 'DEBITO'}]" class="w-full" />
            </UFormField>
            <UFormField name="data" label="Data" required>
              <UInput type="date" v-model="nuovoMovimento.data" class="w-full" />
            </UFormField>
          </div>

          <UFormField name="descrizione" label="Descrizione" required>
            <UInput v-model="nuovoMovimento.descrizione" placeholder="Es. Pagamento affitto" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="importo" label="Importo (€)" required>
              <UInputNumber v-model="nuovoMovimento.importo" :min="0.01" :step="0.01" class="w-full" />
            </UFormField>
            <UFormField name="metodoPagamento" label="Metodo">
              <USelect v-model="nuovoMovimento.metodoPagamento" :items="['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']" class="w-full" />
            </UFormField>
          </div>

          <UFormField name="categoria" label="Categoria">
            <UInput v-model="nuovoMovimento.categoria" placeholder="Es. spese_generali" class="w-full" />
          </UFormField>

          <div class="flex justify-end gap-3 pt-4">
            <UButton variant="ghost" @click="modalNuovoMovimentoAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvandoMovimento">Registra</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- ─── MODAL ELIMINA MOVIMENTO (elimina / storno) ─── -->
    <UModal v-model:open="modalEliminaAperto" title="Elimina movimento">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-slate-600">
            Stai per eliminare il movimento
            <strong>{{ movimentoDaEliminare?.descrizione }}</strong>
            (€ {{ movimentoDaEliminare ? fmt(parseFloat(movimentoDaEliminare.importo)) : '' }}).
          </p>
          <p v-if="movimentoDaEliminare && isAuto(movimentoDaEliminare)" class="text-sm text-amber-600">
            ⚠️ È un movimento <strong>automatico</strong> collegato a un pagamento: "Elimina definitivamente"
            rimuoverà anche il pagamento di origine e ricalcolerà i saldi.
          </p>
          <p class="text-sm text-slate-500">
            Lo <strong>storno</strong> mantiene lo storico creando un movimento opposto (consigliato a fini fiscali).
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton variant="ghost" @click="modalEliminaAperto = false">Annulla</UButton>
          <UButton color="neutral" variant="outline" :loading="eliminando === 'storno'" @click="eseguiElimina('storno')">Crea storno</UButton>
          <UButton color="error" :loading="eliminando === 'delete'" @click="eseguiElimina('delete')">Elimina definitivamente</UButton>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL MODIFICA MOVIMENTO MANUALE ─── -->
    <UModal v-model:open="modalModificaAperto" title="Modifica movimento manuale">
      <template #body>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Tipo">
              <USelect v-model="modificaMovimento.tipo" :items="[{label:'Entrata',value:'ENTRATA'},{label:'Uscita',value:'USCITA'},{label:'Credito',value:'CREDITO'},{label:'Debito',value:'DEBITO'},{label:'Nota',value:'NOTA'}]" class="w-full" />
            </UFormField>
            <UFormField label="Data">
              <UInput type="date" v-model="modificaMovimento.data" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Descrizione">
            <UInput v-model="modificaMovimento.descrizione" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Importo (€)">
              <UInputNumber v-model="modificaMovimento.importo" :min="0.01" :step="0.01" class="w-full" />
            </UFormField>
            <UFormField label="Metodo">
              <USelect v-model="modificaMovimento.metodoPagamento" :items="['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Categoria">
            <UInput v-model="modificaMovimento.categoria" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton variant="ghost" @click="modalModificaAperto = false">Annulla</UButton>
          <UButton :loading="salvandoModifica" @click="salvaModifica">Salva modifiche</UButton>
        </div>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['admin-only'] })

const toast = useToast()

// ─── Fetch dashboard ───
const { data: dash, pending, refresh: refreshDash } = useLazyFetch('/api/accounting/dashboard')

// ─── Lista Movimenti ───
const filtroEntries = reactive({
  dataInizio: '',
  dataFine: '',
  tipo: 'TUTTI',
  categoria: '',
  page: 1,
  limit: 50,
})

const { data: entriesData, pending: pendingEntries, refresh: refreshEntries } = useLazyFetch('/api/accounting/entries', {
  query: computed(() => ({ 
    ...filtroEntries,
    tipo: (filtroEntries.tipo && filtroEntries.tipo !== 'TUTTI') ? filtroEntries.tipo : undefined,
    categoria: filtroEntries.categoria || undefined,
  })),
  watch: false
})
const entries = computed(() => entriesData.value?.data ?? [])
const metaEntries = computed(() => entriesData.value?.meta)

function caricaEntries() {
  filtroEntries.page = 1
  refreshEntries()
}

function refreshAll() {
  refreshDash()
  refreshEntries()
}

// ─── Formato numeri ───
function fmt(n: number) {
  return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatData(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Colonne Tabelle ───
const colonneEntries = [
  { accessorKey: 'data', header: 'Data' },
  { accessorKey: 'tipo', header: 'Tipo' },
  { accessorKey: 'categoria', header: 'Categoria' },
  { accessorKey: 'descrizione', header: 'Descrizione' },
  { accessorKey: 'metodoPagamento', header: 'Metodo' },
  { accessorKey: 'importo', header: 'Importo' },
  { id: 'azioni', header: '' },
]

const colonneFatture = [
  { accessorKey: 'importo',         header: 'Importo' },
  { accessorKey: 'dataPagamento',   header: 'Data pagamento' },
  { accessorKey: 'tipoPagamento',   header: 'Tipo' },
  { accessorKey: 'metodoPagamento', header: 'Metodo' },
  { id: 'azione', accessorKey: 'entryId', header: '' },
]

// ─── Segna fattura emessa ───
const segnandoFattura = ref<string | null>(null)

async function segnaFatturaEmessa(row: any) {
  segnandoFattura.value = row.entryId
  try {
    await $fetch(`/api/payments/${row.paymentId}/invoice`, { method: 'PUT', body: { fatturaEmessa: true } })
    toast.add({ title: 'Fattura segnata come emessa', color: 'success', icon: 'i-heroicons-check-circle' })
    refreshDash()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile aggiornare', color: 'error' })
  } finally {
    segnandoFattura.value = null
  }
}

// ─── Nuovo Movimento Manuale ───
const modalNuovoMovimentoAperto = ref(false)
const salvandoMovimento = ref(false)

const nuovoMovimento = reactive({
  tipo: 'USCITA',
  importo: 0,
  descrizione: '',
  categoria: 'spese_generali',
  metodoPagamento: 'BONIFICO',
  data: new Date().toISOString().substring(0, 10),
})

async function salvaMovimento() {
  if (!nuovoMovimento.importo || !nuovoMovimento.descrizione) return
  salvandoMovimento.value = true
  try {
    await $fetch('/api/accounting/entries', {
      method: 'POST',
      body: {
        tipo: nuovoMovimento.tipo,
        importo: Number(nuovoMovimento.importo),
        descrizione: nuovoMovimento.descrizione,
        categoria: nuovoMovimento.categoria || 'varie',
        metodoPagamento: nuovoMovimento.metodoPagamento,
        data: nuovoMovimento.data,
      }
    })
    toast.add({ title: 'Movimento registrato', color: 'success' })
    modalNuovoMovimentoAperto.value = false
    
    // Reset form
    nuovoMovimento.importo = 0
    nuovoMovimento.descrizione = ''
    
    refreshAll()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: 'Impossibile salvare il movimento', color: 'error' })
  } finally {
    salvandoMovimento.value = false
  }
}

// ─── Azioni movimenti: elimina (con storno) / modifica (solo manuali) ───
function isAuto(row: any) {
  return !!(row.paymentId || row.tutorPaymentId || row.reimbursementId)
}
function isManuale(row: any) {
  return !isAuto(row)
}

const modalEliminaAperto = ref(false)
const movimentoDaEliminare = ref<any>(null)
const eliminando = ref<'delete' | 'storno' | null>(null)

function apriElimina(row: any) {
  movimentoDaEliminare.value = row
  modalEliminaAperto.value = true
}

async function eseguiElimina(mode: 'delete' | 'storno') {
  if (!movimentoDaEliminare.value) return
  eliminando.value = mode
  try {
    await $fetch(`/api/accounting/entries/${movimentoDaEliminare.value.id}`, { method: 'DELETE', query: { mode } })
    toast.add({ title: mode === 'storno' ? 'Storno creato' : 'Movimento eliminato', color: 'success' })
    modalEliminaAperto.value = false
    movimentoDaEliminare.value = null
    refreshAll()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Operazione non riuscita', color: 'error' })
  } finally {
    eliminando.value = null
  }
}

const modalModificaAperto = ref(false)
const salvandoModifica = ref(false)
const modificaMovimento = reactive({
  id: '', tipo: 'USCITA', importo: 0, descrizione: '', categoria: '', metodoPagamento: 'BONIFICO', data: '',
})

function apriModifica(row: any) {
  modificaMovimento.id          = row.id
  modificaMovimento.tipo        = row.tipo
  modificaMovimento.importo     = parseFloat(row.importo)
  modificaMovimento.descrizione = row.descrizione
  modificaMovimento.categoria   = row.categoria ?? ''
  modificaMovimento.metodoPagamento = row.metodoPagamento ?? 'BONIFICO'
  modificaMovimento.data        = row.data ? new Date(row.data).toISOString().substring(0, 10) : ''
  modalModificaAperto.value     = true
}

async function salvaModifica() {
  salvandoModifica.value = true
  try {
    await $fetch(`/api/accounting/entries/${modificaMovimento.id}`, {
      method: 'PUT',
      body: {
        tipo:            modificaMovimento.tipo,
        importo:         Number(modificaMovimento.importo),
        descrizione:     modificaMovimento.descrizione,
        categoria:       modificaMovimento.categoria || null,
        metodoPagamento: modificaMovimento.metodoPagamento || null,
        data:            modificaMovimento.data,
      },
    })
    toast.add({ title: 'Movimento aggiornato', color: 'success' })
    modalModificaAperto.value = false
    refreshAll()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Modifica non riuscita', color: 'error' })
  } finally {
    salvandoModifica.value = false
  }
}
</script>

