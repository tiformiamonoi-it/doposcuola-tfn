<template>
  <PaginaLegale titolo="Informativa privacy" :testo="PRIVACY_TESTO" :versione="TERMS_VERSION" />
</template>

<script setup lang="ts">
import { PRIVACY_TESTO, TERMS_VERSION } from '#shared/legal'
import PaginaLegale from '~/components/PaginaLegale.vue'

definePageMeta({ layout: false })
useHead({ title: 'Informativa privacy — Ti Formiamo Noi' })
</script>
