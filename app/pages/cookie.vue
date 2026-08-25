<template>
  <PaginaLegale titolo="Cookie policy" :testo="COOKIE_TESTO" />
</template>

<script setup lang="ts">
import { COOKIE_TESTO } from '#shared/legal'
import PaginaLegale from '~/components/PaginaLegale.vue'

definePageMeta({ layout: false })
useHead({ title: 'Cookie policy — Ti Formiamo Noi' })
</script>
