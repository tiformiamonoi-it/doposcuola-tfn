<template>
  <!-- La testata blu curva di ogni schermata del portale (bozze v6). In alto a sinistra
       il marchio oppure "Indietro"; a destra la campanella, o quello che la pagina mette
       nello slot "destra". Con `sovrapposta` lascia spazio sotto: la prima scheda della
       pagina ci si appoggia sopra con un margine negativo. -->
  <header
    class="pf-testata-sfondo text-white rounded-b-[32px] px-5 pt-4 flex flex-col gap-5"
    :class="sovrapposta ? 'pb-16' : 'pb-6'"
  >
    <div class="flex items-center justify-between gap-3 min-h-11">
      <button
        v-if="indietro === true"
        type="button"
        aria-label="Indietro"
        class="size-11 shrink-0 rounded-[14px] bg-pf-blu-tasto hover:bg-pf-blu-scuro flex items-center justify-center transition-colors"
        @click="emit('indietro')"
      >
        <UIcon name="i-heroicons-chevron-left" class="size-5" aria-hidden="true" />
      </button>
      <NuxtLink
        v-else-if="indietro"
        :to="indietro"
        aria-label="Indietro"
        class="size-11 shrink-0 rounded-[14px] bg-pf-blu-tasto hover:bg-pf-blu-scuro flex items-center justify-center transition-colors"
      >
        <UIcon name="i-heroicons-chevron-left" class="size-5" aria-hidden="true" />
      </NuxtLink>
      <PortaleMarchio v-else />

      <slot name="destra">
        <NuxtLink
          v-if="campanella"
          to="/portale/notifiche"
          class="relative size-11 shrink-0 rounded-[14px] bg-pf-blu-tasto hover:bg-pf-blu-scuro flex items-center justify-center transition-colors"
          :aria-label="nuove > 0 ? `Notifiche, ${nuove} ${nuove === 1 ? 'nuova' : 'nuove'}` : 'Notifiche'"
        >
          <UIcon name="i-heroicons-bell" class="size-[22px]" aria-hidden="true" />
          <span
            v-if="nuove > 0"
            class="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-pf-giallo text-pf-giallo-testo text-[11px] font-bold flex items-center justify-center"
            aria-hidden="true"
          >
            {{ nuove > 99 ? '99+' : nuove }}
          </span>
        </NuxtLink>
      </slot>
    </div>

    <slot name="titolo">
      <h1 v-if="titolo" class="font-heading font-bold text-[27px] leading-tight">{{ titolo }}</h1>
    </slot>
    <slot />
  </header>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  titolo?: string
  /** Dove porta il tasto "Indietro" (true = lo decide la pagina, evento `indietro`);
      senza, in alto a sinistra c'è il marchio */
  indietro?: string | true
  campanella?: boolean
  sovrapposta?: boolean
}>(), { campanella: true })
const emit = defineEmits<{ indietro: [] }>()

// Il numero lo carica il layout (layouts/portal.vue); la pagina Notifiche lo aggiorna
const nuove = useState<number>('portal-notifiche-nuove', () => 0)
</script>
