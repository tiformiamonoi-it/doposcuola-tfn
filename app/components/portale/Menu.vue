<template>
  <!-- Il menu in basso del portale, con il tasto Card al centro (bozze v6).
       Sul computer resta in fondo, largo quanto la colonna centrale del portale. -->
  <nav aria-label="Menu principale" class="fixed bottom-0 inset-x-0 z-40">
    <div
      class="mx-auto max-w-[640px] bg-white border-t border-pf-bordo grid grid-cols-5 items-end px-2 pt-1 md:rounded-t-3xl md:border-x"
      style="padding-bottom: max(10px, env(safe-area-inset-bottom))"
    >
      <NuxtLink
        v-for="voce in VOCI"
        :key="voce.to"
        :to="voce.to"
        :aria-current="attiva(voce.to) ? 'page' : undefined"
        class="min-h-14 flex flex-col items-center justify-end gap-1 pb-1 text-[11px] rounded-xl"
        :class="voce.centrale
          ? 'font-semibold text-pf-testo'
          : attiva(voce.to) ? 'font-semibold text-pf-blu' : 'font-medium text-pf-grigio hover:text-pf-testo'"
      >
        <span
          v-if="voce.centrale"
          class="size-[58px] -mt-[26px] rounded-full bg-pf-blu text-white border-4 border-pf-fondo flex items-center justify-center shadow-md"
          :class="attiva(voce.to) ? 'ring-2 ring-pf-giallo' : ''"
        >
          <UIcon :name="voce.icona" class="size-[26px]" aria-hidden="true" />
        </span>
        <UIcon v-else :name="voce.icona" class="size-6" aria-hidden="true" />
        {{ voce.etichetta }}
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
// Cinque voci per tutti, genitore e alunno. Prenota sta dentro Lezioni (e nella Home),
// Notifiche nella campanella, Paga e le note nella Home: così il menu non cambia
// da una famiglia all'altra e le voci restano grandi abbastanza per il dito.
const VOCI = [
  { to: '/portale',         etichetta: 'Home',        icona: 'i-heroicons-home' },
  { to: '/portale/lezioni', etichetta: 'Lezioni',     icona: 'i-heroicons-calendar-days' },
  { to: '/portale/card',    etichetta: 'Card',        icona: 'i-heroicons-qr-code', centrale: true },
  { to: '/portale/sconti',  etichetta: 'Convenzioni', icona: 'i-heroicons-tag' },
  { to: '/portale/profilo', etichetta: 'Profilo',     icona: 'i-heroicons-user' },
]

const route = useRoute()
const attiva = (to: string) => (to === '/portale' ? route.path === '/portale' : route.path.startsWith(to))
</script>
