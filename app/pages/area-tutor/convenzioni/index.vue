<template>
  <PortaleConvenzioni
    :convenzioni="data"
    :pending="pending"
    sottotitolo="Sconti per chi insegna con noi. Basta mostrare la card alla cassa."
    base="/area-tutor/convenzioni"
    card="/area-tutor/card"
    :campanella="false"
  />
</template>

<script setup lang="ts">
import type { Convenzione } from '#shared/convenzioni'

// LE CONVENZIONI DEL TUTOR (bozza Convenzioni): le stesse delle famiglie (D5), stessa pagina
// (components/portale/Convenzioni.vue). Niente "Segnala un negozio": il numero della
// segreteria sta nelle impostazioni del portale, che il tutor non legge.
definePageMeta({ layout: 'tutor', middleware: ['tutor-only'] })
useHead({ title: 'Convenzioni — Area Tutor' })

const { data, pending } = useLazyFetch<Convenzione[]>('/api/tutor/convenzioni')
</script>
