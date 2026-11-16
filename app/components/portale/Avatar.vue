<template>
  <!-- Il pallino con l'iniziale di un ragazzo. Il colore segue l'ordine dei figli
       (il primo oro, il secondo celeste, poi di nuovo), così resta lo stesso in ogni schermata. -->
  <span
    aria-hidden="true"
    class="shrink-0 rounded-full flex items-center justify-center font-heading font-bold"
    :class="[
      MISURE[misura],
      indice % 2 === 0 ? 'bg-pf-oro text-pf-oro-testo' : 'bg-pf-cielo text-pf-blu-scuro',
      anello ? (indice % 2 === 0 ? 'border-[3px] border-white ring-2 ring-pf-giallo' : 'border-[3px] border-white ring-2 ring-pf-blu') : '',
    ]"
  >
    {{ (nome ?? '?').trim().charAt(0).toUpperCase() || '?' }}
  </span>
</template>

<script setup lang="ts">
const MISURE = { sm: 'size-10 text-base', md: 'size-11 text-base', ico: 'size-12 text-[17px]', lg: 'size-[58px] text-lg' } as const

withDefaults(defineProps<{
  nome?: string | null
  indice?: number
  misura?: keyof typeof MISURE
  anello?: boolean
}>(), { indice: 0, misura: 'md' })
</script>
