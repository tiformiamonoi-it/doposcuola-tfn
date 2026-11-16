<template>
  <!-- Il bottone del portale. Giallo = l'azione principale (anche i link a sito e social,
       deciso il 16/11/2026); blu, celeste e bordato per le azioni secondarie.
       Con `to` diventa un collegamento vero (<a>), altrimenti un <button> vero. -->
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to"
    :type="to ? undefined : type"
    :disabled="to ? undefined : (disabled || loading)"
    :aria-busy="loading || undefined"
    class="inline-flex items-center justify-center gap-2 px-5 text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    :class="[VARIANTI[variante], grande ? 'min-h-14 rounded-[18px] text-lg' : piccolo ? 'min-h-11 rounded-[14px] text-sm' : 'min-h-12 rounded-2xl text-base', blocco ? 'w-full' : '']"
  >
    <UIcon v-if="loading" name="i-heroicons-arrow-path" class="size-5 animate-spin" aria-hidden="true" />
    <slot />
  </component>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'

const VARIANTI = {
  giallo: 'bg-pf-giallo text-pf-giallo-testo font-bold shadow-[0_10px_24px_rgb(204_128_0/0.30)] hover:brightness-95',
  blu:    'bg-pf-blu text-white font-bold hover:bg-pf-blu-scuro',
  chiaro: 'bg-pf-celeste text-pf-blu font-semibold hover:bg-pf-cielo',
  bordo:  'bg-white border border-pf-bordo text-pf-grigio-scuro font-semibold hover:bg-pf-fondo',
  scuro:  'bg-pf-testo text-white font-bold hover:bg-pf-grigio-scuro',
} as const

withDefaults(defineProps<{
  to?: string
  variante?: keyof typeof VARIANTI
  grande?: boolean
  /** 44 px: il minimo per il dito, per le azioni dentro una scheda */
  piccolo?: boolean
  blocco?: boolean
  type?: 'button' | 'submit'
  disabled?: boolean
  loading?: boolean
}>(), { variante: 'giallo', type: 'button' })
</script>
