<template>
  <!-- Il marchio sulla testata blu: logo bianco + "tiformiamonoi.it", sempre con il .it.
       Un marchio non ha obblighi di contrasto (WCAG 1.4.3), ma il nome si legge comunque. -->
  <span class="flex items-center gap-2" :class="grande ? 'flex-col gap-3.5' : ''">
    <img src="/portale/logo-bianco.svg" alt="" :class="grande ? 'size-[72px]' : 'size-[26px]'" />
    <span class="font-bold tracking-tight" :class="grande ? 'text-[26px]' : 'text-[15px]'" style="font-family: Helvetica, Arial, sans-serif">
      ti<span class="text-tfn-200">formiamo</span>noi.it
    </span>
  </span>
</template>

<script setup lang="ts">
defineProps<{ grande?: boolean }>()
</script>
