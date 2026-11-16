<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="font-heading text-xl font-bold text-slate-900">Notifiche</h2>
        <p class="text-sm text-slate-500 mt-0.5">Le novità degli ultimi due mesi.</p>
      </div>
      <UButton size="sm" variant="soft" icon="i-heroicons-check" :disabled="nuove === 0" :loading="segnando" @click="segnaTutteLette">
        Segna tutte come lette
      </UButton>
    </div>

    <div class="flex gap-2 flex-wrap" role="group" aria-label="Filtra le notifiche">
      <UButton
        v-for="f in FILTRI"
        :key="f.value"
        size="xs"
        :variant="filtro === f.value ? 'solid' : 'outline'"
        :aria-pressed="filtro === f.value"
        @click="() => { filtro = f.value }"
      >
        {{ f.label }}
      </UButton>
    </div>

    <USkeleton v-if="pending" class="h-40 w-full" />

    <p v-else-if="visibili.length === 0" class="py-10 text-center text-sm text-slate-500">
      Nessuna notifica.
    </p>

    <ul v-else class="divide-y divide-slate-100">
      <li v-for="v in visibili" :key="v.id">
        <component :is="v.link ? NuxtLink : 'div'" :to="v.link" class="flex gap-3 py-3 px-1 hover:bg-slate-50 rounded">
          <!-- Il pallino è il "nuova"; il testo lo ripete per chi usa un lettore di schermo -->
          <span class="mt-1.5 w-2 h-2 rounded-full shrink-0" :class="v.nuova ? 'bg-red-500' : 'bg-transparent'" aria-hidden="true" />
          <div class="min-w-0">
            <p class="text-sm text-slate-800" :class="{ 'font-semibold': v.nuova }">
              <span v-if="v.nuova" class="sr-only">Nuova: </span>{{ v.titolo }}
            </p>
            <p class="text-sm text-slate-500 line-clamp-2 whitespace-pre-line">{{ v.testo }}</p>
            <img v-if="v.immagine" :src="v.immagine" alt="" loading="lazy" class="mt-2 max-h-40 rounded border border-slate-200" />
            <p class="text-xs text-slate-400 mt-0.5">{{ quando(v.data) }}</p>
          </div>
        </component>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'

// Pagina provvisoria per il collaudo del blocco 3: la grafica v6 arriva nel blocco 4.
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Notifiche — Portale Famiglie' })

type Voce = {
  id: string
  categoria: 'TUTOR' | 'LEZIONI' | 'AVVISI'
  titolo: string
  testo: string
  data: string
  nuova: boolean
  link?: string
  immagine?: string
}

const FILTRI = [
  { label: 'Tutte', value: 'TUTTE' },
  { label: 'Dai tutor', value: 'TUTOR' },
  { label: 'Lezioni', value: 'LEZIONI' },
  { label: 'Avvisi', value: 'AVVISI' },
] as const
const filtro = ref<(typeof FILTRI)[number]['value']>('TUTTE')

const { data, pending, refresh } = useLazyFetch<{ voci: Voce[]; nuove: number }>('/api/portal/notifiche')
const voci = computed(() => data.value?.voci ?? [])
const nuove = computed(() => data.value?.nuove ?? 0)
const visibili = computed(() => (filtro.value === 'TUTTE' ? voci.value : voci.value.filter((v) => v.categoria === filtro.value)))

// Il pallino del menu (layouts/portal.vue) legge lo stesso numero
const nuoveNelMenu = useState<number>('portal-notifiche-nuove', () => 0)
watchEffect(() => { if (data.value) nuoveNelMenu.value = data.value.nuove })

const segnando = ref(false)
async function segnaTutteLette() {
  segnando.value = true
  try {
    await $fetch('/api/portal/notifiche-lette', { method: 'POST' })
    await refresh()
  } finally {
    segnando.value = false
  }
}

const quando = (iso: string) => new Date(iso).toLocaleString('it-IT', {
  timeZone: 'Europe/Rome', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
})
</script>
