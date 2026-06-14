<template>
  <div>
    <h1 class="font-heading text-2xl font-bold text-slate-900 mb-1">
      Gestionale Ti Formiamo Noi
    </h1>
    <p class="text-slate-500 text-sm mb-6">
      Fase 7 completata — layout e design system attivi
    </p>

    <div class="flex flex-wrap gap-3 mb-8">
      <UBadge color="success" variant="subtle">Sistema operativo</UBadge>
      <UBadge color="primary" variant="subtle">Nuxt 4</UBadge>
      <UBadge color="neutral" variant="subtle">Nuxt UI v3</UBadge>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
      <div class="p-4 bg-white rounded-xl border border-slate-200">
        <p class="text-xs text-slate-400 uppercase tracking-wide mb-1">Primary</p>
        <div class="w-8 h-8 rounded-lg bg-tfn-500" />
        <p class="text-xs text-slate-600 mt-1 font-mono">#0063A6</p>
      </div>
      <div class="p-4 bg-white rounded-xl border border-slate-200">
        <p class="text-xs text-slate-400 uppercase tracking-wide mb-1">Warning</p>
        <div class="w-8 h-8 rounded-lg bg-orange-500" />
        <p class="text-xs text-slate-600 mt-1 font-mono">#E74C1B</p>
      </div>
    </div>

    <div class="mt-8 flex gap-3">
      <UButton>Bottone Primary</UButton>
      <UButton color="neutral" variant="outline">Bottone Neutral</UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['admin-or-super'] })
useHead({ title: 'Dashboard — Ti Formiamo Noi' })
</script>
