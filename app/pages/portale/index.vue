<template>
  <div class="space-y-6">
    <div class="text-center py-10 space-y-4">
      <div class="w-16 h-16 rounded-full bg-tfn-100 flex items-center justify-center mx-auto">
        <UIcon name="i-heroicons-home" class="w-8 h-8 text-tfn-600" />
      </div>
      <div>
        <h1 class="font-heading text-2xl font-bold text-slate-900">
          Benvenuto, {{ user?.firstName }}
        </h1>
        <p class="text-slate-500 mt-1">
          Usa il menu in basso per navigare nel portale.
        </p>
      </div>
    </div>

    <!-- Dashboard coming soon -->
    <UCard class="border border-dashed border-slate-300 bg-slate-50">
      <div class="text-center py-6 space-y-2">
        <UIcon name="i-heroicons-chart-bar" class="w-8 h-8 text-slate-400 mx-auto" />
        <p class="text-sm font-medium text-slate-600">Riepilogo in arrivo</p>
        <p class="text-xs text-slate-400">
          Il pannello con ore residue e ultime lezioni sarà disponibile prossimamente.
        </p>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Home — Portale Famiglie' })

const { user } = useUserSession()
</script>
