<template>
  <div v-if="value" class="flex gap-2">
    <dt class="w-32 shrink-0 text-slate-400">{{ label }}</dt>
    <dd :class="highlight ? 'text-orange-600 font-medium' : 'text-slate-700'">{{ value }}</dd>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value?: string | null
  highlight?: boolean
}>()
</script>
