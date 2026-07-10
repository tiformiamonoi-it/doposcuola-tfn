<template>
  <div class="space-y-8">

    <!-- ═══ Vista SUPER_TUTOR: solo scorciatoie, niente dati economici ═══ -->
    <template v-if="!isAdmin">
      <div>
        <h2 class="font-heading text-xl font-bold text-slate-900">Ciao, {{ user?.firstName }}!</h2>
        <p class="text-sm text-slate-500 mt-1">Da dove vuoi iniziare?</p>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <UCard v-for="link in quickLinks" :key="link.route" class="hover:shadow-md transition-shadow cursor-pointer" @click="navigateTo(link.route)">
          <div class="flex flex-col items-center gap-2 py-2 text-center">
            <UIcon :name="link.icon" class="w-8 h-8 text-tfn-500" />
            <span class="text-sm font-medium text-slate-700">{{ link.label }}</span>
          </div>
        </UCard>
      </div>
    </template>

    <!-- ═══ Vista ADMIN ═══ -->
    <template v-else>

      <!-- Numeri chiave del mese -->
      <section>
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-heading text-lg font-bold text-slate-900">Numeri chiave — {{ nomeMeseCorrente }}</h2>
          <UButton to="/contabilita" variant="ghost" size="sm" trailing-icon="i-heroicons-arrow-right">
            Vai alla contabilità
          </UButton>
        </div>
        <div v-if="pendingKpi" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <USkeleton v-for="i in 4" :key="i" class="h-24 w-full" />
        </div>
        <div v-else-if="kpi" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <UCard>
            <p class="text-xs text-slate-500 flex items-center gap-1">Entrate
              <StatHelp text="Soldi incassati nel mese corrente (pagamenti pacchetti e altre entrate registrate in contabilità). Gli storni sono già sottratti." />
            </p>
            <p class="text-2xl font-bold text-emerald-600 mt-1">€ {{ fmt(kpi.corrente.entrate) }}</p>
            <p class="text-[11px] mt-1" :class="deltaClass(kpi.corrente.entrate, kpi.precedente.entrate)">
              {{ deltaLabel(kpi.corrente.entrate, kpi.precedente.entrate) }} vs {{ nomeMesePrecedente }}
            </p>
          </UCard>
          <UCard>
            <p class="text-xs text-slate-500 flex items-center gap-1">Uscite
              <StatHelp text="Soldi usciti nel mese corrente (compensi tutor pagati, spese, rimborsi)." />
            </p>
            <p class="text-2xl font-bold text-rose-600 mt-1">€ {{ fmt(kpi.corrente.uscite) }}</p>
            <p class="text-[11px] mt-1 text-slate-400">
              {{ nomeMesePrecedente }}: € {{ fmt(kpi.precedente.uscite) }}
            </p>
          </UCard>
          <UCard>
            <p class="text-xs text-slate-500 flex items-center gap-1">Margine
              <StatHelp text="Entrate meno uscite del mese corrente: quello che resta prima di costi fissi e tasse." />
            </p>
            <p class="text-2xl font-bold mt-1" :class="kpi.corrente.margine >= 0 ? 'text-blue-600' : 'text-orange-600'">
              € {{ fmt(kpi.corrente.margine) }}
            </p>
            <p class="text-[11px] mt-1" :class="deltaClass(kpi.corrente.margine, kpi.precedente.margine)">
              {{ deltaLabel(kpi.corrente.margine, kpi.precedente.margine) }} vs {{ nomeMesePrecedente }}
            </p>
          </UCard>
          <UCard>
            <p class="text-xs text-slate-500 flex items-center gap-1">Lezioni svolte
              <StatHelp text="Numero di lezioni registrate nel mese corrente (tutte, comprese quelle non ancora confermate)." />
            </p>
            <p class="text-2xl font-bold text-slate-800 mt-1">{{ kpi.corrente.lezioni }}</p>
            <p class="text-[11px] mt-1" :class="deltaClass(kpi.corrente.lezioni, kpi.precedente.lezioni)">
              {{ deltaLabel(kpi.corrente.lezioni, kpi.precedente.lezioni) }} vs {{ nomeMesePrecedente }}
            </p>
          </UCard>
        </div>
      </section>

      <!-- Guadagno medio -->
      <section>
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 class="font-heading text-lg font-bold text-slate-900 flex items-center gap-1.5">Guadagno lezioni
            <StatHelp text="Stesso calcolo del 'Ricavo stimato' del calendario: per ogni lezione, valore delle ore scalate ai prezzi dei pacchetti, meno il compenso del tutor. La media è calcolata sui soli giorni con lezioni." />
          </h2>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-for="p in presets"
              :key="p.key"
              size="xs"
              :variant="preset === p.key ? 'solid' : 'outline'"
              color="primary"
              @click="preset = p.key"
            >
              {{ p.label }}
            </UButton>
          </div>
        </div>

        <div v-if="preset === 'custom'" class="flex flex-wrap items-end gap-3 mb-3">
          <UFormField label="Dal" size="sm">
            <UInput v-model="customStart" type="date" size="sm" />
          </UFormField>
          <UFormField label="Al" size="sm">
            <UInput v-model="customEnd" type="date" size="sm" />
          </UFormField>
        </div>

        <div v-if="pendingGuadagno" class="grid grid-cols-2 gap-4">
          <USkeleton class="h-24 w-full" />
          <USkeleton class="h-24 w-full" />
        </div>
        <template v-else-if="guadagno">
          <div class="grid grid-cols-2 gap-4">
            <UCard>
              <p class="text-xs text-slate-500">Totale periodo ({{ periodoLabel }})</p>
              <p class="text-2xl font-bold mt-1" :class="guadagno.totale >= 0 ? 'text-emerald-600' : 'text-orange-600'">
                € {{ fmt(guadagno.totale) }}
              </p>
              <p class="text-[11px] text-slate-400 mt-1">{{ guadagno.giorniConLezioni }} giorni con lezioni</p>
            </UCard>
            <UCard>
              <p class="text-xs text-slate-500 flex items-center gap-1">Media giornaliera
                <StatHelp text="Guadagno totale diviso per i giorni in cui si sono svolte lezioni. I giorni chiusi non abbassano la media." />
              </p>
              <p class="text-2xl font-bold text-slate-800 mt-1">€ {{ fmt(guadagno.mediaGiornaliera) }}</p>
              <p class="text-[11px] text-slate-400 mt-1">per giorno di lezione</p>
            </UCard>
          </div>

          <UCard v-if="guadagno.giorni.length > 0" class="mt-4">
            <p class="text-xs text-slate-500 mb-3">Andamento per giorno</p>
            <div class="space-y-1.5">
              <div v-for="g in guadagno.giorni" :key="g.data" class="flex items-center gap-2 text-xs">
                <span class="w-14 shrink-0 text-slate-500">{{ formatGiorno(g.data) }}</span>
                <div class="flex-1 bg-slate-100 rounded h-4 overflow-hidden">
                  <div
                    class="h-full rounded"
                    :class="g.guadagno >= 0 ? 'bg-tfn-500/70' : 'bg-orange-400/70'"
                    :style="{ width: barWidth(g.guadagno) }"
                  />
                </div>
                <span class="w-20 shrink-0 text-right font-medium text-slate-700">€ {{ fmt(g.guadagno) }}</span>
              </div>
            </div>
          </UCard>
          <p v-else class="text-sm text-slate-400 mt-4">Nessuna lezione nel periodo selezionato.</p>
        </template>
      </section>

      <!-- Guadagno effettivo (mesi conclusi) -->
      <section>
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 class="font-heading text-lg font-bold text-slate-900 flex items-center gap-1.5">Guadagno effettivo a mese chiuso
            <StatHelp text="Per i pacchetti a prezzo fisso terminati (esauriti, scaduti o chiusi) il valore reale di un'ora è il prezzo diviso le ore DAVVERO usate: se di 60 ore ne sono state fatte 40, ogni ora vale prezzo÷40, non prezzo÷60. I pacchetti a consumo valgono sempre la loro tariffa oraria." />
          </h2>
          <USelect v-model="meseEffettivo" :items="mesiConclusi" size="sm" class="w-44" />
        </div>

        <div v-if="pendingEffettivo" class="grid grid-cols-3 gap-4">
          <USkeleton v-for="i in 3" :key="i" class="h-24 w-full" />
        </div>
        <template v-else-if="effettivo">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UCard>
              <p class="text-xs text-slate-500">Guadagno standard</p>
              <p class="text-2xl font-bold text-slate-700 mt-1">€ {{ fmt(effettivo.atteso) }}</p>
              <p class="text-[11px] text-slate-400 mt-1">valore ore ai prezzi pieni dei pacchetti</p>
            </UCard>
            <UCard>
              <p class="text-xs text-slate-500">Guadagno effettivo</p>
              <p class="text-2xl font-bold text-violet-600 mt-1">€ {{ fmt(effettivo.effettivo) }}</p>
              <p class="text-[11px] text-slate-400 mt-1">ricalcolato sulle ore davvero usate</p>
            </UCard>
            <UCard>
              <p class="text-xs text-slate-500">Differenza</p>
              <p class="text-2xl font-bold mt-1" :class="effettivo.differenza >= 0 ? 'text-emerald-600' : 'text-orange-600'">
                {{ effettivo.differenza >= 0 ? '+' : '' }}€ {{ fmt(effettivo.differenza) }}
              </p>
              <p class="text-[11px] text-slate-400 mt-1">guadagno "nascosto" dalle ore non usate</p>
            </UCard>
          </div>
          <UAlert
            v-if="effettivo.pacchettiAncoraAperti > 0"
            class="mt-3"
            color="warning"
            variant="subtle"
            icon="i-heroicons-clock"
            :description="`${effettivo.pacchettiAncoraAperti} pacchett${effettivo.pacchettiAncoraAperti === 1 ? 'o' : 'i'} di quel mese ${effettivo.pacchettiAncoraAperti === 1 ? 'è ancora' : 'sono ancora'} in corso: per quelli vale il valore standard, il dato si aggiornerà quando finiranno.`"
          />
        </template>
        <UAlert
          v-else-if="erroreEffettivo"
          color="warning"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          :description="erroreEffettivo"
        />
      </section>

    </template>
  </div>
</template>

<script setup lang="ts">
import { oggiISO } from '~/utils/format'

definePageMeta({ middleware: ['admin-or-super'] })
useHead({ title: 'Dashboard — tiformiamonoi.it' })

const { user } = useUserSession()
const isAdmin = computed(() => user.value?.role === 'ADMIN')

// ─── Scorciatoie (vista SUPER_TUTOR) ───
const quickLinks = [
  { icon: 'i-heroicons-calendar',     label: 'Calendario', route: '/calendario' },
  { icon: 'i-heroicons-users',        label: 'Studenti',   route: '/studenti' },
  { icon: 'i-heroicons-cube',         label: 'Pacchetti',  route: '/pacchetti' },
  { icon: 'i-heroicons-list-bullet',  label: 'Lezioni',    route: '/lezioni' },
]

// ─── Date helpers (solo stringhe YYYY-MM-DD, niente fusi) ───
function shiftISO(iso: string, giorni: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + giorni)
  return d.toISOString().slice(0, 10)
}
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

const oggi = oggiISO()
const annoOggi = Number(oggi.slice(0, 4))
const meseOggi = Number(oggi.slice(5, 7))

const nomeMeseCorrente = `${MESI[meseOggi - 1]} ${annoOggi}`
const nomeMesePrecedente = MESI[(meseOggi + 10) % 12]

// ─── KPI mese ───
const { data: kpi, pending: pendingKpi } = useLazyFetch<any>('/api/accounting/kpi-mese', {
  immediate: isAdmin.value,
})

// ─── Guadagno medio ───
const presets = [
  { key: 'ieri',      label: 'Ieri' },
  { key: 'settimana', label: 'Settimana scorsa' },
  { key: 'mese',      label: 'Mese scorso' },
  { key: 'custom',    label: 'Personalizzato' },
] as const
const preset = ref<'ieri' | 'settimana' | 'mese' | 'custom'>('settimana')
const customStart = ref(shiftISO(oggi, -7))
const customEnd = ref(oggi)

const range = computed(() => {
  if (preset.value === 'ieri') {
    const ieri = shiftISO(oggi, -1)
    return { start: ieri, end: ieri }
  }
  if (preset.value === 'settimana') {
    // Lunedì-domenica della settimana scorsa
    const dow = new Date(oggi + 'T00:00:00Z').getUTCDay() // 0 = domenica
    const lunediQuesta = shiftISO(oggi, -((dow + 6) % 7))
    return { start: shiftISO(lunediQuesta, -7), end: shiftISO(lunediQuesta, -1) }
  }
  if (preset.value === 'mese') {
    const anno = meseOggi === 1 ? annoOggi - 1 : annoOggi
    const mese = meseOggi === 1 ? 12 : meseOggi - 1
    const pad = String(mese).padStart(2, '0')
    const ultimo = new Date(anno, mese, 0).getDate()
    return { start: `${anno}-${pad}-01`, end: `${anno}-${pad}-${String(ultimo).padStart(2, '0')}` }
  }
  return { start: customStart.value, end: customEnd.value }
})

const periodoLabel = computed(() => `${formatGiorno(range.value.start)} → ${formatGiorno(range.value.end)}`)

const { data: guadagno, pending: pendingGuadagno } = useLazyFetch<any>('/api/accounting/guadagno', {
  query: range,
  immediate: isAdmin.value,
})

const maxGuadagno = computed(() =>
  Math.max(1, ...(guadagno.value?.giorni ?? []).map((g: any) => Math.abs(g.guadagno)))
)
function barWidth(v: number): string {
  return `${Math.round(Math.abs(v) / maxGuadagno.value * 100)}%`
}

// ─── Guadagno effettivo (mesi conclusi) ───
// Ultimi 12 mesi conclusi, dal più recente
const mesiConclusi = computed(() => {
  const items: { label: string; value: string }[] = []
  let anno = annoOggi
  let mese = meseOggi
  for (let i = 0; i < 12; i++) {
    mese--
    if (mese === 0) { mese = 12; anno-- }
    items.push({ label: `${MESI[mese - 1]} ${anno}`, value: `${anno}-${String(mese).padStart(2, '0')}` })
  }
  return items
})
const meseEffettivo = ref(mesiConclusi.value[0]!.value)

const queryEffettivo = computed(() => ({
  anno: Number(meseEffettivo.value.slice(0, 4)),
  mese: Number(meseEffettivo.value.slice(5, 7)),
}))

const { data: effettivo, pending: pendingEffettivo, error: errEffettivo } = useLazyFetch<any>('/api/accounting/guadagno-effettivo', {
  query: queryEffettivo,
  immediate: isAdmin.value,
})
const erroreEffettivo = computed(() => errEffettivo.value?.data?.statusMessage ?? null)

// ─── Formato ───
function fmt(n: number) {
  return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function formatGiorno(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}
function deltaLabel(cur: number, prev: number): string {
  if (!prev) return cur > 0 ? 'nuovo' : '—'
  const pct = ((cur - prev) / Math.abs(prev)) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`
}
function deltaClass(cur: number, prev: number): string {
  if (!prev || cur === prev) return 'text-slate-400'
  return cur > prev ? 'text-emerald-600' : 'text-orange-500'
}
</script>
