<template>
  <div class="space-y-6">
    <div>
      <h2 class="font-heading text-xl font-bold text-slate-900">Sconti e convenzioni</h2>
      <p class="text-sm text-slate-500 mt-0.5">
        Le attività convenzionate con tiformiamonoi.it offrono questi vantaggi agli studenti iscritti.
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
      <UCard v-for="s in sconti" :key="s.id" :ui="{ body: 'p-0 sm:p-0' }">
        <!-- La foto dal suo indirizzo: l'elenco non se le porta dietro tutte -->
        <img
          v-if="s.foto"
          :src="s.foto"
          :alt="s.nome"
          loading="lazy"
          class="w-full h-36 object-cover object-center rounded-t-lg"
        />
        <div v-else class="w-full h-36 bg-slate-100 rounded-t-lg flex items-center justify-center">
          <UIcon name="i-heroicons-building-storefront" class="w-10 h-10 text-slate-300" />
        </div>
        <div class="p-4">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold text-slate-800">{{ s.nome }}</h3>
            <UBadge v-if="s.sconto" color="success" variant="subtle" class="shrink-0">{{ s.sconto }}</UBadge>
          </div>
          <p v-if="s.categoria || s.citta" class="text-xs text-slate-400 mt-0.5">{{ [s.categoria, s.citta].filter(Boolean).join(' · ') }}</p>
          <p class="text-sm text-slate-500 mt-1 whitespace-pre-line">{{ s.descrizione }}</p>
          <!-- Campi facoltativi (blocco 2): compare solo quello che la segreteria ha compilato -->
          <ul class="mt-2 space-y-0.5 text-xs text-slate-500">
            <li v-if="s.indirizzo">📍 {{ [s.indirizzo, s.citta].filter(Boolean).join(', ') }}</li>
            <li v-if="s.orari">🕒 {{ s.orari }}</li>
            <li v-if="s.telefono">📞 <a :href="`tel:${s.telefono.replace(/[^\d+]/g, '')}`" class="hover:underline">{{ s.telefono }}</a></li>
            <li v-if="s.validaFino">Valida fino al {{ s.validaFino.split('-').reverse().join('/') }}</li>
          </ul>
          <UButton
            v-if="linkMappe(s)"
            :to="linkMappe(s)!"
            target="_blank"
            rel="noopener noreferrer"
            size="xs"
            variant="soft"
            icon="i-heroicons-map-pin"
            class="mt-3"
          >
            Apri in Mappe
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { linkMappe, type Convenzione } from '#shared/convenzioni'

definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Sconti — Portale Famiglie' })

// Le scadute le ha già tolte il server (sconti.get.ts): qui arrivano solo quelle valide
const { data: scontiData, pending } = useLazyFetch<Convenzione[]>('/api/portal/sconti')
const sconti = computed(() => scontiData.value ?? [])
</script>
