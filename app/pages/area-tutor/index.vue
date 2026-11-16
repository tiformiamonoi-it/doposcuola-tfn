<template>
  <AreaTutorHome v-if="user?.role === 'TUTOR'" />
  <AreaTutorDisponibilitaGestionale v-else />
</template>

<script setup lang="ts">
// /area-tutor: per il TUTOR è la Home dell'area nuova; Super Tutor e Admin qui hanno
// il loro calendario disponibilità, nella veste del gestionale (D1).
// Il layout lo sceglie il middleware per ruolo (middleware/layout-di-ruolo.ts)
definePageMeta({ middleware: ['staff-only', 'layout-di-ruolo'] })
useHead({ title: 'Area Tutor — tiformiamonoi.it' })

const { user } = useUserSession()
</script>
