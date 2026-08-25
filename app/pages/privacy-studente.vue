<template>
  <PaginaLegale titolo="La tua privacy" :testo="PRIVACY_STUDENTE_TESTO" :versione="PRIVACY_STUDENTE_VERSION" />
</template>

<script setup lang="ts">
import { PRIVACY_STUDENTE_TESTO, PRIVACY_STUDENTE_VERSION } from '#shared/legal'
import PaginaLegale from '~/components/PaginaLegale.vue'

definePageMeta({ layout: false })
useHead({ title: 'Privacy studenti — Ti Formiamo Noi' })
</script>
