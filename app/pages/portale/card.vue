<template>
  <div class="space-y-6">
    <div>
      <h2 class="font-heading text-xl font-bold text-slate-900">Card studente</h2>
      <p class="text-sm text-slate-500 mt-0.5">
        Mostra il codice QR alla cassa dei negozi convenzionati per avere lo sconto.
      </p>
    </div>

    <USkeleton v-if="pending" class="h-80 w-full" />

    <p v-else-if="cards.length === 0" class="py-10 text-center text-sm text-slate-500">
      Nessuna card da mostrare.
    </p>

    <UCard v-for="c in cards" :key="c.id">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="font-semibold text-slate-800">{{ c.firstName }} {{ c.lastName }}</p>
          <p class="text-xs text-slate-500">{{ [c.classe, c.scuola].filter(Boolean).join(' · ') || '—' }}</p>
        </div>
        <UBadge :color="c.attiva ? 'success' : 'neutral'" variant="subtle">
          {{ c.attiva ? 'Attiva' : 'Sospesa' }}
        </UBadge>
      </div>

      <!-- Il QR c'è anche da sospesa: il negozio che lo inquadra vede "Card non valida" -->
      <div
        class="mt-4 mx-auto w-48 h-48"
        :class="{ 'opacity-30 grayscale': !c.attiva }"
        role="img"
        :aria-label="`Codice QR della card di ${c.firstName}`"
        v-html="qr(c.codiceCard)"
      />
      <p class="text-center font-mono tracking-widest text-lg text-slate-800 mt-2">{{ c.codiceCard }}</p>

      <p v-if="c.attiva" class="text-center text-sm text-slate-600 mt-1">
        {{ c.validaFino ? `Valida fino al ${giorno(c.validaFino)}` : 'Valida' }}
      </p>

      <UAlert
        v-if="c.attiva && c.inMargine"
        class="mt-4"
        color="warning"
        variant="subtle"
        icon="i-heroicons-clock"
        :title="`Resta attiva fino al ${giorno(c.validaFino)}`"
        :description="testoMargine(c)"
      />
      <UAlert
        v-else-if="!c.attiva"
        class="mt-4"
        color="neutral"
        variant="subtle"
        icon="i-heroicons-pause-circle"
        title="Card sospesa"
        :description="testoSospesa(c)"
      />
    </UCard>

    <NuxtLink to="/regolamento-card" class="flex items-center justify-between py-2 text-sm text-slate-600 hover:text-indigo-600 transition-colors">
      <span>Regolamento della Card studente</span>
      <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { renderSVG } from 'uqr'
import type { MotivoCard } from '#shared/card-studente'

// Pagina provvisoria per il collaudo del blocco 1: la grafica v6 arriva nel blocco 4.
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Card — Portale Famiglie' })

type Card = {
  id: string
  firstName: string
  lastName: string
  classe: string | null
  scuola: string | null
  codiceCard: string
  attiva: boolean
  validaFino: string | null
  inMargine: boolean
  // Solo per il genitore: allo studente il server non lo manda (privacy economica)
  motivo?: MotivoCard | null
}

const { data, pending } = useLazyFetch<Card[]>('/api/portal/card')
const cards = computed(() => data.value ?? [])

// Il QR porta l'indirizzo COMPLETO della pagina del negozio: la fotocamera del telefono
// lo apre da sola, senza app. useRequestURL dà lo stesso dominio sia sul server sia nel browser.
const origine = useRequestURL().origin
const qr = (codice: string) => renderSVG(`${origine}/verifica/${codice}`)

// 'AAAA-MM-GG' → 'GG/MM/AAAA' senza passare da Date: un giorno non ha fuso orario
const giorno = (g: string | null) => (g ? g.split('-').reverse().join('/') : '')

function testoMargine(c: Card) {
  if (!('motivo' in c)) return 'Chiedi in segreteria per non perderla.'
  return c.motivo === 'DA_SALDARE'
    ? 'C\'è un pacchetto da saldare: salda entro questa data per continuare ad avere gli sconti.'
    : 'Rinnova il pacchetto entro questa data per continuare ad avere gli sconti.'
}

function testoSospesa(c: Card) {
  if (!('motivo' in c)) return 'Chiedi in segreteria.'
  switch (c.motivo) {
    case 'DA_SALDARE':       return 'C\'è un pacchetto da saldare. Quando la segreteria registra il pagamento, la card torna attiva da sola.'
    case 'ORE_FINITE':       return 'Le ore del pacchetto sono finite. Rinnova il pacchetto e la card torna attiva da sola.'
    case 'NESSUN_PAGAMENTO': return 'La card si attiva con il primo pagamento del pacchetto, anche solo un acconto.'
    default:                 return 'Il pacchetto è scaduto. Rinnova il pacchetto e la card torna attiva da sola.'
  }
}
</script>
