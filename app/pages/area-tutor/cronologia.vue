<template>
  <div />
</template>

<script setup lang="ts">
// La vecchia "Cronologia Note" ora è la linguetta "Le mie" della pagina Note:
// l'indirizzo resta valido e ci rimanda lì.
definePageMeta({ redirect: { path: '/area-tutor/note', query: { tab: 'mie' } } })
</script>
