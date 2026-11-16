<template>
  <div class="pb-28">
    <USkeleton v-if="pending" class="h-[270px] w-full" />

    <div v-else-if="!convenzione">
      <PortaleTestata titolo="Convenzione" indietro="/portale/sconti" />
      <p class="px-5 pt-6 text-sm text-pf-grigio-scuro">Questa convenzione non c'è più: forse è scaduta.</p>
    </div>

    <template v-else>
      <!-- La foto in alto, rettangolare, ritagliata al centro (piano, sezione B) -->
      <div class="relative h-[270px] bg-pf-bordo flex items-center justify-center">
        <img v-if="convenzione.foto" :src="convenzione.foto" alt="" class="size-full object-cover object-center" />
        <UIcon v-else name="i-heroicons-building-storefront" class="size-12 text-pf-grigio" aria-hidden="true" />
        <NuxtLink to="/portale/sconti" aria-label="Indietro" class="absolute top-4 left-5 size-11 rounded-[14px] bg-white text-pf-testo flex items-center justify-center shadow-[0_4px_12px_rgb(15_27_45/0.12)] hover:bg-pf-fondo">
          <UIcon name="i-heroicons-chevron-left" class="size-5" aria-hidden="true" />
        </NuxtLink>
      </div>

      <article class="relative -mt-10 bg-pf-fondo rounded-t-[32px] px-5 pt-[22px] flex flex-col gap-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex flex-col gap-1 min-w-0">
            <p v-if="convenzione.categoria || convenzione.citta" class="text-[13px] text-pf-grigio">{{ [convenzione.categoria, convenzione.citta].filter(Boolean).join(' · ') }}</p>
            <h1 class="font-heading font-bold text-2xl leading-[30px]">{{ convenzione.nome }}</h1>
          </div>
          <span v-if="convenzione.sconto" class="shrink-0 font-heading text-[22px] font-bold px-3 py-2 rounded-2xl bg-pf-giallo text-pf-giallo-testo">{{ convenzione.sconto }}</span>
        </div>

        <p class="text-[15px] leading-[22px] text-pf-grigio-scuro whitespace-pre-line">{{ convenzione.descrizione }}</p>

        <section class="bg-white rounded-[22px] px-4 py-3.5 flex gap-3.5 items-center pf-ombra">
          <img src="/portale/tessera.webp" alt="" class="size-14 shrink-0 object-contain" />
          <span class="flex flex-col gap-0.5">
            <span class="font-semibold text-[15px]">Come usarla</span>
            <span class="text-sm leading-5 text-pf-grigio-scuro">Alla cassa mostra la card studente: il negozio inquadra il QR e applica lo sconto.</span>
          </span>
        </section>

        <!-- Solo i campi che la segreteria ha compilato -->
        <section v-if="righe" aria-label="Informazioni" class="bg-white rounded-[22px] px-4 py-1 pf-ombra divide-y divide-pf-fondo">
          <div v-if="convenzione.indirizzo" class="flex gap-3 items-start py-3">
            <UIcon name="i-heroicons-map-pin" class="size-5 shrink-0 text-pf-blu mt-0.5" aria-hidden="true" />
            <span class="flex flex-col gap-0.5">
              <span class="text-[15px]">{{ [convenzione.indirizzo, convenzione.citta].filter(Boolean).join(', ') }}</span>
              <a v-if="mappe" :href="mappe" target="_blank" rel="noopener noreferrer" class="self-start py-1 text-[13px] font-semibold text-pf-blu hover:text-pf-blu-scuro">
                Apri in Mappe<span class="sr-only"> (si apre in un'altra finestra)</span>
              </a>
            </span>
          </div>
          <div v-if="convenzione.orari" class="flex gap-3 items-start py-3">
            <UIcon name="i-heroicons-clock" class="size-5 shrink-0 text-pf-blu mt-0.5" aria-hidden="true" />
            <span class="text-[15px] whitespace-pre-line">{{ convenzione.orari }}</span>
          </div>
          <div v-if="convenzione.telefono" class="flex gap-3 items-start py-3">
            <UIcon name="i-heroicons-phone" class="size-5 shrink-0 text-pf-blu mt-0.5" aria-hidden="true" />
            <a :href="`tel:${convenzione.telefono.replace(/[^\d+]/g, '')}`" class="text-[15px] text-pf-blu hover:text-pf-blu-scuro">{{ convenzione.telefono }}</a>
          </div>
          <div v-if="convenzione.validaFino" class="flex gap-3 items-start py-3">
            <UIcon name="i-heroicons-calendar" class="size-5 shrink-0 text-pf-blu mt-0.5" aria-hidden="true" />
            <span class="text-[15px]">Convenzione valida fino al {{ giornoInParole(convenzione.validaFino, { day: 'numeric', month: 'long', year: 'numeric' }) }}</span>
          </div>
        </section>
      </article>

      <!-- Il bottone giallo resta in fondo, sopra il menu -->
      <div class="fixed bottom-[84px] inset-x-0 z-30 pointer-events-none">
        <div class="mx-auto max-w-[640px] px-5 pb-3 pointer-events-auto">
          <PortaleBottone to="/portale/card" grande blocco>Mostra la card</PortaleBottone>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { linkMappe, type Convenzione } from '#shared/convenzioni'

// IL DETTAGLIO DI UNA CONVENZIONE (schermata 17). Nessuna API nuova: è una delle
// convenzioni valide che il portale già riceve; se è scaduta non c'è più.
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})

const route = useRoute()
const { data, pending } = useLazyFetch<Convenzione[]>('/api/portal/sconti')
const convenzione = computed(() => (data.value ?? []).find((c) => c.id === route.params.id))
const mappe = computed(() => (convenzione.value ? linkMappe(convenzione.value) : null))
const righe = computed(() => {
  const c = convenzione.value
  return !!c && !!(c.indirizzo || c.orari || c.telefono || c.validaFino)
})
useHead({ title: () => `${convenzione.value?.nome ?? 'Convenzione'} — Portale Famiglie` })
</script>
