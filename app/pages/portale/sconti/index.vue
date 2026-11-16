<template>
  <div>
    <PortaleTestata>
      <template #titolo>
        <div class="flex items-center gap-3 pb-5">
          <div class="flex-1 flex flex-col gap-1.5">
            <h1 class="font-heading font-bold text-[27px] leading-tight">Convenzioni</h1>
            <p class="text-sm leading-5 text-pf-su-blu">Sconti riservati ai ragazzi iscritti. Basta mostrare la card alla cassa.</p>
          </div>
          <img src="/portale/regalo.webp" alt="" class="size-[92px] shrink-0 object-contain" />
        </div>
      </template>
    </PortaleTestata>

    <!-- Ricerca, appoggiata sulla testata -->
    <label class="relative -mt-[26px] mx-5 min-h-[52px] px-4 rounded-2xl bg-white border border-pf-bordo shadow-[0_10px_24px_rgb(15_27_45/0.10)] flex items-center gap-2.5 text-pf-grigio focus-within:border-pf-blu">
      <UIcon name="i-heroicons-magnifying-glass" class="size-5" aria-hidden="true" />
      <span class="sr-only">Cerca un negozio</span>
      <input v-model="cerca" type="search" placeholder="Cerca un negozio" class="flex-1 bg-transparent text-[15px] text-pf-testo outline-none! py-3" />
    </label>

    <!-- Le categorie: solo quelle scritte davvero nelle convenzioni -->
    <div v-if="categorie.length > 1" role="group" aria-label="Filtra per categoria" class="mt-3.5 px-5 flex gap-2 overflow-x-auto scrollbar-nascosta">
      <button
        v-for="c in ['Tutte', ...categorie]"
        :key="c"
        type="button"
        :aria-pressed="categoria === c"
        class="shrink-0 min-h-11 px-4 rounded-full text-sm transition-colors"
        :class="categoria === c ? 'bg-pf-testo text-white font-semibold' : 'bg-white border border-pf-bordo text-pf-grigio-scuro font-medium hover:border-pf-blu'"
        @click="() => { categoria = c }"
      >
        {{ c }}
      </button>
    </div>

    <div v-if="pending" class="mx-5 mt-5 flex flex-col gap-3">
      <USkeleton v-for="i in 3" :key="i" class="h-24 w-full rounded-[20px]" />
    </div>

    <div v-else-if="sconti.length === 0" class="mx-5 mt-5 bg-white rounded-3xl p-6 text-center pf-ombra flex flex-col items-center gap-2">
      <img src="/portale/regalo.webp" alt="" class="size-20 object-contain" />
      <p class="font-semibold">Stiamo preparando nuove convenzioni per voi!</p>
      <p class="text-sm text-pf-grigio">Cartolibrerie, palestre e altre attività della zona: torna a trovarci presto.</p>
    </div>

    <template v-else>
      <!-- In evidenza: l'ultima arrivata, con la foto grande -->
      <article v-if="evidenza" class="mx-5 mt-[18px] rounded-3xl overflow-hidden bg-white border border-pf-bordo flex flex-col">
        <div class="relative h-[170px] bg-pf-bordo flex items-center justify-center">
          <img v-if="evidenza.foto" :src="evidenza.foto" alt="" class="size-full object-cover" />
          <UIcon v-else name="i-heroicons-building-storefront" class="size-10 text-pf-grigio" aria-hidden="true" />
          <span class="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full bg-pf-testo text-white">Nuova</span>
          <span v-if="evidenza.sconto" class="absolute bottom-3 right-3 font-heading text-xl font-bold px-3 py-1.5 rounded-[14px] bg-pf-giallo text-pf-giallo-testo">{{ evidenza.sconto }}</span>
        </div>
        <div class="p-4 flex flex-col gap-1.5">
          <p v-if="dove(evidenza)" class="text-xs text-pf-grigio">{{ dove(evidenza) }}</p>
          <h2 class="font-bold text-lg">{{ evidenza.nome }}</h2>
          <p class="text-sm leading-5 text-pf-grigio-scuro line-clamp-3 whitespace-pre-line">{{ evidenza.descrizione }}</p>
          <div class="flex gap-2 mt-2">
            <PortaleBottone to="/portale/card" class="flex-1">Mostra la card</PortaleBottone>
            <PortaleBottone variante="chiaro" :to="`/portale/sconti/${evidenza.id}`">Dettagli<span class="sr-only"> di {{ evidenza.nome }}</span></PortaleBottone>
          </div>
        </div>
      </article>

      <section aria-labelledby="t-tutte" class="mx-5 mt-6 flex flex-col gap-2.5">
        <h2 id="t-tutte" class="font-heading font-bold text-lg">Tutte le convenzioni</h2>
        <p v-if="filtrate.length === 0" class="text-sm text-pf-grigio">Nessun negozio trovato.</p>
        <NuxtLink
          v-for="c in filtrate"
          :key="c.id"
          :to="`/portale/sconti/${c.id}`"
          class="bg-white border border-pf-bordo rounded-[20px] p-3 flex items-center gap-3 text-pf-testo hover:border-pf-blu transition-colors"
        >
          <span class="size-16 shrink-0 rounded-[14px] bg-pf-bordo overflow-hidden flex items-center justify-center">
            <!-- Quadrata nell'elenco: ritagliata al centro (piano, sezione B) -->
            <img v-if="c.foto" :src="c.foto" alt="" loading="lazy" class="size-full object-cover object-center" />
            <UIcon v-else name="i-heroicons-building-storefront" class="size-7 text-pf-grigio" aria-hidden="true" />
          </span>
          <span class="flex-1 min-w-0 flex flex-col gap-0.5">
            <span class="font-semibold text-[15px]">{{ c.nome }}</span>
            <span v-if="dove(c)" class="text-xs text-pf-grigio">{{ dove(c) }}</span>
            <span class="text-[13px] text-pf-grigio-scuro line-clamp-2">{{ c.descrizione }}</span>
          </span>
          <span v-if="c.sconto" class="shrink-0 font-bold text-sm px-2.5 py-1.5 rounded-xl bg-pf-crema text-pf-crema-testo">{{ c.sconto }}</span>
        </NuxtLink>
      </section>
    </template>

    <!-- Invito ai negozi: un messaggio alla segreteria, già scritto -->
    <section v-if="whatsapp" class="mx-5 mt-5 p-4 rounded-[20px] border border-dashed border-pf-grigio/50 flex flex-col gap-1.5">
      <p class="font-semibold text-[15px]">Conosci un negozio che vorrebbe aderire?</p>
      <p class="text-[13px] leading-[18px] text-pf-grigio">Segnalacelo: lo contatteremo noi.</p>
      <a
        :href="whatsappSegreteria(whatsapp, 'Ciao, vorrei segnalare un negozio per le convenzioni di tiformiamonoi.it: ')"
        target="_blank"
        rel="noopener noreferrer"
        class="self-start py-2 text-sm font-semibold text-pf-blu hover:text-pf-blu-scuro"
      >Segnala un negozio<span class="sr-only"> su WhatsApp (si apre in un'altra finestra)</span></a>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Convenzione } from '#shared/convenzioni'

// LE CONVENZIONI (schermata 8). Le scadute le ha già tolte il server (sconti.get.ts).
// L'indirizzo resta /portale/sconti perché ci portano le email e le notifiche.
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Convenzioni — Portale Famiglie' })

const { data: scontiData, pending } = useLazyFetch<Convenzione[]>('/api/portal/sconti')
// Il server le ordina dalla più vecchia: qui le ultime arrivate per prime
const sconti = computed(() => [...(scontiData.value ?? [])].reverse())
const evidenza = computed(() => sconti.value[0])

const { data: portalConfigs } = useLazyFetch<{ whatsapp_numero?: string }>('/api/portal/configs')
const whatsapp = computed(() => portalConfigs.value?.whatsapp_numero ?? '')

const cerca = ref('')
const categoria = ref('Tutte')
const categorie = computed(() => [...new Set(sconti.value.map((c) => c.categoria?.trim()).filter((c): c is string => !!c))].sort())
const filtrate = computed(() => {
  const q = cerca.value.trim().toLowerCase()
  return sconti.value.filter((c) =>
    (categoria.value === 'Tutte' || c.categoria?.trim() === categoria.value)
    && (!q || [c.nome, c.descrizione, c.categoria, c.citta].some((x) => x?.toLowerCase().includes(q))))
})

const dove = (c: Convenzione) => [c.categoria, c.citta].filter(Boolean).join(' · ')
</script>
