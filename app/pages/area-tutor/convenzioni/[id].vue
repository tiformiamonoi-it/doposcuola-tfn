<template>
  <PortaleConvenzioneDettaglio
    :convenzione="convenzione"
    :pending="pending"
    base="/area-tutor/convenzioni"
    card="/area-tutor/card"
    nome-card="card tutor"
    :campanella="false"
  />
</template>

<script setup lang="ts">
import type { Convenzione } from '#shared/convenzioni'

// IL DETTAGLIO DI UNA CONVENZIONE per il tutor: come per le famiglie, è una delle
// convenzioni valide dell'elenco; se è scaduta non c'è più.
definePageMeta({ layout: 'tutor', middleware: ['tutor-only'] })

const route = useRoute()
const { data, pending } = useLazyFetch<Convenzione[]>('/api/tutor/convenzioni')
const convenzione = computed(() => (data.value ?? []).find((c) => c.id === route.params.id))
useHead({ title: () => `${convenzione.value?.nome ?? 'Convenzione'} — Area Tutor` })
</script>
