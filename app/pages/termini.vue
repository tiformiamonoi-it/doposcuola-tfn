<template>
  <PaginaLegale titolo="Termini e condizioni" :testo="TERMINI_TESTO" :versione="TERMS_VERSION" />
</template>

<script setup lang="ts">
import { TERMINI_TESTO, TERMS_VERSION } from '#shared/legal'
import PaginaLegale from '~/components/PaginaLegale.vue'

definePageMeta({ layout: false })
useHead({ title: 'Termini e condizioni — Ti Formiamo Noi' })
</script>
