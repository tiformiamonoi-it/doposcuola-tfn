<template>
  <PortaleConvenzioneDettaglio :convenzione="convenzione" :pending="pending" />
</template>

<script setup lang="ts">
import type { Convenzione } from '#shared/convenzioni'

// IL DETTAGLIO DI UNA CONVENZIONE (schermata 17). Nessuna API nuova: è una delle
// convenzioni valide che il portale già riceve; se è scaduta non c'è più.
// La pagina vera è components/portale/ConvenzioneDettaglio.vue, la stessa dei tutor.
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})

const route = useRoute()
const { data, pending } = useLazyFetch<Convenzione[]>('/api/portal/sconti')
const convenzione = computed(() => (data.value ?? []).find((c) => c.id === route.params.id))
useHead({ title: () => `${convenzione.value?.nome ?? 'Convenzione'} — Portale Famiglie` })
</script>
