<template>
  <PaginaLegale titolo="Regolamento della Card studente" :testo="REGOLAMENTO_CARD_TESTO" />
</template>

<script setup lang="ts">
import { REGOLAMENTO_CARD_TESTO } from '#shared/legal'
import PaginaLegale from '~/components/PaginaLegale.vue'

// Pubblica come Termini e Privacy: si legge, non si accetta (niente versione da firmare)
definePageMeta({ layout: false })
useHead({ title: 'Regolamento della Card studente — tiformiamonoi' })
</script>
