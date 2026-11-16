<template>
  <!-- L'etichetta di stato del portale (Attivo, Scaduto, Confermata…). La parola
       c'è sempre: lo stato non si capisce mai solo dal colore. -->
  <span class="inline-flex items-center shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" :class="TONI[tono]">
    <slot />
  </span>
</template>

<script setup lang="ts">
import type { TonoStato } from '~/utils/portale'

// Coppie fondo/testo con contrasto ≥ 4,5:1
const TONI: Record<TonoStato, string> = {
  verde:  'bg-pf-verde-chiaro text-pf-verde',
  rosso:  'bg-pf-rosso-chiaro text-pf-rosso',
  grigio: 'bg-pf-bordo text-pf-grigio-scuro',
  blu:    'bg-pf-celeste text-pf-blu-scuro',
  crema:  'bg-pf-crema text-pf-crema-testo',
}

withDefaults(defineProps<{ tono?: TonoStato }>(), { tono: 'grigio' })
</script>
