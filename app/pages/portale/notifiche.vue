<template>
  <div>
    <PortaleTestata titolo="Notifiche" indietro="/portale" :campanella="false">
      <template #destra>
        <button
          type="button"
          class="min-h-11 px-1 text-sm font-semibold text-white disabled:opacity-60 hover:underline underline-offset-2"
          :disabled="nuove === 0 || segnando"
          @click="segnaTutteLette"
        >
          Segna tutte come lette
        </button>
      </template>
      <div role="group" aria-label="Filtra le notifiche" class="flex flex-wrap gap-2">
        <button
          v-for="f in filtri"
          :key="f.value"
          type="button"
          :aria-pressed="filtro === f.value"
          class="min-h-11 px-3.5 rounded-full text-sm transition-colors"
          :class="filtro === f.value ? 'bg-white text-pf-blu font-semibold' : 'bg-pf-blu-tasto text-white font-medium hover:bg-pf-blu-scuro'"
          @click="() => { filtro = f.value }"
        >
          {{ f.label }}
        </button>
      </div>
    </PortaleTestata>

    <div class="px-5 pt-5 flex flex-col gap-2.5">
      <USkeleton v-if="pending" class="h-40 w-full rounded-[22px]" />

      <div v-else-if="visibili.length === 0" class="bg-white rounded-[22px] p-6 text-center pf-ombra flex flex-col items-center gap-2">
        <img src="/portale/scena-notifiche.webp" alt="" class="w-40 object-contain" />
        <p class="font-semibold">Nessuna notifica</p>
        <p class="text-sm text-pf-grigio">Qui trovi le novità degli ultimi due mesi.</p>
      </div>

      <template v-for="gruppo in gruppi" v-else :key="gruppo.titolo">
        <h2 class="mt-2 mb-0.5 text-[13px] font-bold text-pf-grigio uppercase tracking-wide">{{ gruppo.titolo }}</h2>
        <component
          :is="v.link ? NuxtLink : 'article'"
          v-for="v in gruppo.voci"
          :key="v.id"
          :to="v.link"
          class="relative bg-white rounded-[22px] p-3.5 flex gap-3 items-start text-pf-testo pf-ombra"
          :class="v.link ? 'hover:bg-pf-fondo transition-colors' : ''"
        >
          <!-- La nota: l'iniziale del ragazzo di cui parla, mai chi l'ha scritta -->
          <PortaleAvatar v-if="v.chi" :nome="v.chi" :indice="indiceDi(v.chi)" misura="ico" />
          <span v-else class="size-12 shrink-0 rounded-2xl bg-pf-fondo flex items-center justify-center">
            <img :src="illustrazione(v.id)" alt="" class="size-[38px] object-contain" loading="lazy" />
          </span>
          <span class="flex-1 min-w-0 flex flex-col gap-1" :class="v.nuova ? 'pr-4' : ''">
            <span class="font-semibold text-[15px]"><span v-if="v.nuova" class="sr-only">Nuova: </span>{{ v.titolo }}</span>
            <span
              v-if="v.categoria === 'TUTOR'"
              class="px-3 py-2.5 rounded-[14px] bg-pf-crema text-[15px] leading-[21px] text-pf-giallo-testo whitespace-pre-line"
            >«{{ v.testo }}»</span>
            <span v-else class="text-sm leading-5 text-pf-grigio-scuro whitespace-pre-line line-clamp-4">{{ v.testo }}</span>
            <img v-if="v.immagine" :src="v.immagine" alt="" loading="lazy" class="mt-1 max-h-48 w-auto self-start rounded-xl border border-pf-bordo" />
            <span class="text-xs text-pf-grigio">{{ quando(v.data) }}</span>
          </span>
          <span v-if="v.nuova" class="absolute top-4 right-4 size-[9px] rounded-full bg-pf-giallo" aria-hidden="true" />
        </component>
      </template>

      <!-- Le note e le comunicazioni più vecchie di due mesi restano nel loro archivio -->
      <NuxtLink v-if="!isStudente" to="/portale/note" class="self-center mt-3 py-3 text-sm font-semibold text-pf-blu hover:text-pf-blu-scuro">
        Tutte le note e le comunicazioni
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'

// LE NOTIFICHE (schermata 11): calcolate al volo dal server (notifiche-portale.service.ts),
// raggruppate per Oggi / Questa settimana / Prima. Le note dei tutor qui si leggono
// intere, senza il nome di chi le ha scritte (deciso). L'alunno non riceve note.
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
  chi?: string
}

const { user } = useUserSession()
const isStudente = computed(() => user.value?.role === 'STUDENTE')

// All'alunno niente "Dai tutor": le note le legge il genitore
const filtri = computed(() => [
  { label: 'Tutte', value: 'TUTTE' },
  ...(isStudente.value ? [] : [{ label: 'Dai tutor', value: 'TUTOR' }]),
  { label: 'Lezioni', value: 'LEZIONI' },
  { label: 'Avvisi', value: 'AVVISI' },
])
const filtro = ref('TUTTE')

// Stessa chiave del layout: una lettura sola, e "segna come lette" aggiorna anche la campanella
const { data, pending, refresh } = useLazyFetch<{ voci: Voce[]; nuove: number }>('/api/portal/notifiche', { server: false, key: 'portale-notifiche-menu' })
const voci = computed(() => data.value?.voci ?? [])
const nuove = computed(() => data.value?.nuove ?? 0)
const visibili = computed(() => (filtro.value === 'TUTTE' ? voci.value : voci.value.filter((v) => v.categoria === filtro.value)))

const { data: studentsData } = useLazyFetch<{ firstName: string }[]>('/api/portal/students')
const indiceDi = (nome: string) => Math.max(0, (studentsData.value ?? []).findIndex((s) => s.firstName === nome))

// ─── Gruppi: Oggi, Questa settimana (ultimi 7 giorni), Prima ───
const oggi = adessoItalia().giorno
const giornoDi = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date(iso))
const settimanaFa = new Date(`${oggi}T12:00:00Z`)
settimanaFa.setUTCDate(settimanaFa.getUTCDate() - 6)
const inizioSettimana = settimanaFa.toISOString().slice(0, 10)

const gruppi = computed(() => {
  const g = [
    { titolo: 'Oggi', voci: [] as Voce[] },
    { titolo: 'Questa settimana', voci: [] as Voce[] },
    { titolo: 'Prima', voci: [] as Voce[] },
  ]
  for (const v of visibili.value) {
    const giorno = giornoDi(v.data)
    g[giorno >= oggi ? 0 : giorno >= inizioSettimana ? 1 : 2]!.voci.push(v)
  }
  return g.filter((x) => x.voci.length > 0)
})

// Oggi l'ora, in settimana il giorno, prima la data
function quando(iso: string) {
  const giorno = giornoDi(iso)
  const d = new Date(iso)
  if (giorno >= oggi) return d.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
  if (giorno >= inizioSettimana) return d.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', weekday: 'long' })
  return d.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long' })
}

// L'illustrazione dal tipo di voce (l'id comincia con il tipo, vedi notifiche-portale.service.ts)
function illustrazione(id: string) {
  const tipo = id.split(':')[0]
  if (tipo === 'lezione') return '/portale/calendario.webp'
  if (tipo === 'comunicazione') return '/portale/megafono.webp'
  if (tipo?.startsWith('card')) return '/portale/tessera.webp'
  if (tipo === 'convenzione') return '/portale/regalo.webp'
  if (tipo === 'pagamento' || tipo?.startsWith('pacchetto')) return '/portale/portafoglio.webp'
  return '/portale/megafono.webp'
}

// Il pallino della campanella (layouts/portal.vue) legge lo stesso numero
const nuoveNelMenu = useState<number>('portal-notifiche-nuove', () => 0)
watchEffect(() => { if (data.value) nuoveNelMenu.value = data.value.nuove })

// Le comunicazioni della segreteria qui si leggono per intero: aprire la pagina le segna
// lette (la segreteria vede quante famiglie le hanno lette), come faceva Comunicazioni.
onMounted(() => {
  if (user.value?.role === 'GENITORE') $fetch('/api/portal/notes-seen', { method: 'POST' }).catch(() => {})
})

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
</script>
