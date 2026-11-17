<template>
  <AreaTutorHome v-if="vesteTutor" />
  <AreaTutorDisponibilitaGestionale v-else />
</template>

<script setup lang="ts">
// /area-tutor: per il TUTOR (e per il SUPER_TUTOR dentro l'app, D2) è la Home dell'area
// nuova; Super Tutor e Admin nel browser qui hanno il loro calendario disponibilità,
// nella veste del gestionale (D1).
// Il layout lo sceglie il middleware per ruolo (middleware/layout-di-ruolo.ts)
definePageMeta({ middleware: ['staff-only', 'layout-di-ruolo'] })
useHead({ title: 'Area Tutor — tiformiamonoi.it' })

const vesteTutor = useVesteTutor()
</script>
