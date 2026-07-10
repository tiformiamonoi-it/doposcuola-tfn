<template>
  <UPopover>
    <button
      type="button"
      class="inline-flex items-center align-middle text-slate-300 hover:text-slate-500 transition-colors"
      aria-label="Cosa significa?"
    >
      <UIcon name="i-heroicons-question-mark-circle" class="w-4 h-4" />
    </button>
    <template #content>
      <p class="p-3 text-xs text-slate-600 max-w-[16rem] leading-relaxed">{{ text }}</p>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
// Icona "?" con spiegazione al click (popover: funziona anche su touch, il tooltip no)
defineProps<{ text: string }>()
</script>
