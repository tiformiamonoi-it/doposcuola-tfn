<template>
  <div class="space-y-6">
    <div>
      <h2 class="font-heading text-xl font-bold text-slate-900">Pagamenti</h2>
      <p class="text-sm text-slate-500 mt-0.5">Salda i pacchetti con un bonifico.</p>
    </div>

    <USkeleton v-if="pending" class="h-40 w-full" />

    <!-- Interruttore spento (o account studente): la sezione c'è ma non si apre -->
    <UCard v-else-if="!dati?.attivi">
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-banknotes" class="w-6 h-6 text-slate-300" />
        <div>
          <p class="font-medium text-slate-700">Paga il mensile</p>
          <UBadge color="neutral" variant="subtle" class="mt-1">In arrivo</UBadge>
        </div>
      </div>
    </UCard>

    <template v-else>
      <UCard>
        <p class="text-xs text-slate-500">Intestatario</p>
        <div class="flex items-center justify-between gap-2">
          <p class="font-medium text-slate-800">{{ dati.intestatario || '—' }}</p>
          <UButton v-if="dati.intestatario" size="xs" variant="ghost" icon="i-heroicons-clipboard-document" @click="copia(dati.intestatario, 'Intestatario')">Copia</UButton>
        </div>
        <p class="text-xs text-slate-500 mt-3">IBAN</p>
        <div class="flex items-center justify-between gap-2">
          <p class="font-mono text-sm text-slate-800 break-all">{{ ibanLeggibile || '—' }}</p>
          <UButton v-if="dati.iban" size="xs" variant="ghost" icon="i-heroicons-clipboard-document" @click="copia(dati.iban, 'IBAN')">Copia</UButton>
        </div>
      </UCard>

      <div v-for="f in dati.figli" :key="f.studentId" class="space-y-2">
        <p class="text-sm font-semibold text-slate-700">{{ f.nome }}</p>
        <p v-if="f.pacchetti.length === 0" class="text-sm text-slate-500">Niente da saldare. ✅</p>
        <UCard v-for="p in f.pacchetti" :key="p.id">
          <div class="flex items-center justify-between gap-2">
            <p class="font-medium text-slate-800">{{ p.nome }}</p>
            <div class="flex items-center gap-1">
              <span class="font-semibold text-slate-900">{{ euro(p.importo) }}</span>
              <UButton size="xs" variant="ghost" icon="i-heroicons-clipboard-document" :aria-label="`Copia l'importo di ${p.nome}`" @click="copia(p.importo.toFixed(2).replace('.', ','), 'Importo')" />
            </div>
          </div>
          <p class="text-xs text-slate-500 mt-2">Causale</p>
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm text-slate-700">{{ p.causale }}</p>
            <UButton size="xs" variant="ghost" icon="i-heroicons-clipboard-document" @click="copia(p.causale, 'Causale')">Copia</UButton>
          </div>
        </UCard>
      </div>

      <p class="text-xs text-slate-400">
        Il pagamento risulta quando la segreteria lo registra: di solito entro qualche giorno dal bonifico.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
// Pagina provvisoria per il collaudo del blocco 2: la grafica v6 arriva nel blocco 4.
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Pagamenti — Portale Famiglie' })

type Pagamenti =
  | { attivi: false }
  | {
      attivi: true
      intestatario: string
      iban: string
      figli: { studentId: string; nome: string; pacchetti: { id: string; nome: string; importo: number; causale: string }[] }[]
    }

const { data: dati, pending } = useLazyFetch<Pagamenti>('/api/portal/pagamenti')
const toast = useToast()

// IT60X0542811101000000123456 → IT60 X054 2811 … : a gruppi di 4 si ricontrolla a occhio
const ibanLeggibile = computed(() => (dati.value?.attivi ? dati.value.iban.replace(/(.{4})/g, '$1 ').trim() : ''))
const euro = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

async function copia(testo: string, cosa: string) {
  try {
    await navigator.clipboard.writeText(testo)
    toast.add({ title: `${cosa} copiato`, color: 'success' })
  } catch {
    // Browser senza appunti (pagina non sicura, permesso negato): il testo resta lì da selezionare
    toast.add({ title: 'Copia non riuscita', description: 'Tieni premuto sul testo per selezionarlo.', color: 'warning' })
  }
}
</script>
