<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
const colorMode = useColorMode()
// Forza programmaticamente la modalità chiara ignorando la cache del telefono e il tema di sistema
colorMode.preference = 'light'
</script>
