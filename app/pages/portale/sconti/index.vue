<template>
  <PortaleConvenzioni :convenzioni="scontiData" :pending="pending" :whatsapp="whatsapp" />
</template>

<script setup lang="ts">
import type { Convenzione } from '#shared/convenzioni'

// LE CONVENZIONI (schermata 8). Le scadute le ha già tolte il server (sconti.get.ts).
// L'indirizzo resta /portale/sconti perché ci portano le email e le notifiche.
// La pagina vera è components/portale/Convenzioni.vue, la stessa dei tutor.
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Convenzioni — Portale Famiglie' })

const { data: scontiData, pending } = useLazyFetch<Convenzione[]>('/api/portal/sconti')

const { data: portalConfigs } = useLazyFetch<{ whatsapp_numero?: string }>('/api/portal/configs')
const whatsapp = computed(() => portalConfigs.value?.whatsapp_numero ?? '')
</script>
