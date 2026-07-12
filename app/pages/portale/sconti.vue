<template>
  <div class="space-y-6">
    <div>
      <h2 class="font-heading text-xl font-bold text-slate-900">Sconti e convenzioni</h2>
      <p class="text-sm text-slate-500 mt-0.5">
        Le attività convenzionate con Ti Formiamo Noi offrono questi vantaggi agli studenti iscritti.
      </p>
    </div>

    <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <USkeleton v-for="i in 4" :key="i" class="h-52 w-full" />
    </div>

    <div v-else-if="sconti.length === 0" class="py-16 text-center">
      <div class="text-4xl mb-3">🎁</div>
      <p class="font-medium text-slate-600">Stiamo preparando nuove convenzioni per voi!</p>
      <p class="text-sm text-slate-400 mt-1">
        Cartolibrerie, palestre e altre attività della zona: torna a trovarci presto,
        i primi sconti sono in arrivo. ✨
      </p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <UCard v-for="(s, idx) in sconti" :key="idx" :ui="{ body: 'p-0 sm:p-0' }">
        <img
          v-if="s.immagine"
          :src="s.immagine"
          :alt="s.nome"
          class="w-full h-36 object-cover rounded-t-lg"
        />
        <div v-else class="w-full h-36 bg-slate-100 rounded-t-lg flex items-center justify-center">
          <UIcon name="i-heroicons-building-storefront" class="w-10 h-10 text-slate-300" />
        </div>
        <div class="p-4">
          <h3 class="font-semibold text-slate-800">{{ s.nome }}</h3>
          <p class="text-sm text-slate-500 mt-1 whitespace-pre-line">{{ s.descrizione }}</p>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Sconti — Portale Famiglie' })

const { data: scontiData, pending } = useLazyFetch('/api/portal/sconti')
const sconti = computed(() => (scontiData.value as { nome: string; descrizione: string; immagine: string }[]) ?? [])
</script>
