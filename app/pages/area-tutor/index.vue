<template>
  <div class="space-y-6 max-w-2xl mx-auto">
    <!-- Intestazione -->
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Area Personale Tutor</h1>
      <p class="text-slate-500">Gestisci le tue presenze, lezioni e note.</p>
    </div>

    <!-- Navigazione rapida -->
    <div class="flex gap-2">
      <UButton to="/tutor-calendario" icon="i-heroicons-calendar-days" variant="soft" size="sm">Il mio Calendario</UButton>
      <UButton to="/area-tutor/cronologia" icon="i-heroicons-document-text" variant="soft" size="sm">Cronologia Note</UButton>
    </div>

    <!-- CALENDARIO DISPONIBILITÀ -->
    <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-slate-800">Le tue disponibilità</h2>
            <div class="flex items-center gap-2">
              <UButton icon="i-heroicons-chevron-left" color="neutral" variant="ghost" size="sm" @click="cambiaMese(-1)" />
              <span class="text-sm font-medium w-24 text-center">{{ nomeMeseCorrente }}</span>
              <UButton icon="i-heroicons-chevron-right" color="neutral" variant="ghost" size="sm" @click="cambiaMese(1)" />
            </div>
          </div>
        </template>
        
        <!-- Legenda -->
        <div class="flex flex-wrap gap-4 text-xs mb-4 text-slate-500">
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-primary-100 border border-primary-300"></div> Disponibile</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-white border border-slate-200"></div> Non disponibile</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200"></div> Non selezionabile (passato, chiusura, domenica)</div>
        </div>
        <p v-if="forfait" class="text-xs text-primary-600 mb-4 font-medium">
          Con il fisso mensile sei sempre disponibile dal lunedì al venerdì: puoi aggiungere disponibilità solo il sabato.
        </p>
        <p class="text-xs text-slate-400 mb-4">La disponibilità di oggi si può modificare solo entro le 9:30.</p>

        <!-- Griglia Giorni -->
        <div class="grid grid-cols-7 gap-1 text-center">
          <!-- Intestazioni -->
          <div v-for="g in ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']" :key="g" class="text-xs font-medium text-slate-400 py-1">
            {{ g }}
          </div>

          <!-- Celle Vuote Iniziali -->
          <div v-for="blank in blankDays" :key="'b'+blank" class="p-2"></div>

          <!-- Giorni del Mese -->
          <button
            v-for="day in giorniMese"
            :key="day.dateStr"
            @click="toggleDisponibilita(day.dateStr)"
            class="p-2 rounded-md border text-sm transition-colors relative flex items-center justify-center min-h-[40px]"
            :class="[
              motivoBlocco(day.dateStr)
                ? (isDisponibile(day.dateStr) ? 'bg-primary-50/50 border-primary-100 text-primary-300 cursor-not-allowed' : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed')
                : (isDisponibile(day.dateStr) ? 'bg-primary-50 border-primary-300 text-primary-700 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300')
            ]"
            :disabled="salvandoGiorno === day.dateStr || !!motivoBlocco(day.dateStr)"
            :title="motivoBlocco(day.dateStr) ?? ''"
          >
            <UIcon v-if="salvandoGiorno === day.dateStr" name="i-heroicons-arrow-path" class="animate-spin w-4 h-4 text-slate-400" />
            <span v-else>{{ day.numero }}</span>
          </button>
        </div>
      </UCard>
  </div>
</template>

<script setup lang="ts">
import { startOfMonth, endOfMonth, addMonths, format, getDay, getDaysInMonth, setDate } from 'date-fns'
import { it } from 'date-fns/locale'

definePageMeta({ middleware: ['staff-only'] })
useHead({ title: 'Area Tutor — Ti Formiamo Noi' })

const toast = useToast()

// ─── CALENDARIO DISPONIBILITÀ ───
const meseRiferimento = ref(startOfMonth(new Date()))

const nomeMeseCorrente = computed(() => format(meseRiferimento.value, 'MMMM yyyy', { locale: it }))

const blankDays = computed(() => {
  const dayOfWeek = getDay(meseRiferimento.value)
  // getDay() => 0 (Dom) - 6 (Sab). Vogliamo Lunedì = 0
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1
})

const giorniMese = computed(() => {
  const tot = getDaysInMonth(meseRiferimento.value)
  const arr = []
  for (let i = 1; i <= tot; i++) {
    const d = setDate(meseRiferimento.value, i)
    arr.push({
      numero: i,
      dateStr: format(d, 'yyyy-MM-dd')
    })
  }
  return arr
})

function cambiaMese(dir: number) {
  meseRiferimento.value = addMonths(meseRiferimento.value, dir)
}

// Fetch presenze del mese
const fromStr = computed(() => format(meseRiferimento.value, 'yyyy-MM-dd'))
const toStr = computed(() => format(endOfMonth(meseRiferimento.value), 'yyyy-MM-dd'))

const { data: availData, refresh: refreshAvail } = useLazyFetch<any>('/api/tutors/availabilities/me', {
  query: computed(() => ({ from: fromStr.value, to: toStr.value })),
  watch: [meseRiferimento]
})

const forfait = computed(() => availData.value?.forfait ?? false)

function isFerialeForfait(dateStr: string) {
  const giorno = new Date(dateStr + 'T00:00:00Z').getUTCDay()
  return forfait.value && giorno >= 1 && giorno <= 5
}

function isDisponibile(dateStr: string) {
  // Fisso mensile: lun-ven sempre disponibile d'ufficio (salvo chiusure)
  if (isFerialeForfait(dateStr) && !chiusure.value.has(dateStr)) return true
  const lista = availData.value?.disponibilita ?? []
  return lista.some((a: any) => format(new Date(a.date), 'yyyy-MM-dd') === dateStr)
}

// ─── Giorni bloccati: passati, oggi dopo le 9:30 (ora del SERVER), domeniche, chiusure ───
const chiusure = computed(() => new Set<string>(availData.value?.chiusure ?? []))
const oggiServer = computed(() => availData.value?.oggi ?? '')
const oggiBloccato = computed(() => availData.value?.oggiBloccato ?? false)

function motivoBlocco(dateStr: string): string | null {
  if (new Date(dateStr + 'T00:00:00Z').getUTCDay() === 0) return 'La domenica il centro è chiuso'
  if (chiusure.value.has(dateStr)) return 'Giorno di chiusura'
  if (isFerialeForfait(dateStr)) return 'Sempre disponibile (fisso mensile)'
  if (oggiServer.value && dateStr < oggiServer.value) return 'Giorno passato'
  if (dateStr === oggiServer.value && oggiBloccato.value) return 'Modificabile solo entro le 9:30'
  return null
}

const salvandoGiorno = ref<string | null>(null)

async function toggleDisponibilita(dateStr: string) {
  const blocco = motivoBlocco(dateStr)
  if (blocco) {
    toast.add({ title: 'Giorno non modificabile', description: blocco, color: 'warning' })
    return
  }
  salvandoGiorno.value = dateStr
  try {
    await $fetch('/api/tutors/availabilities/toggle', {
      method: 'POST',
      body: { date: dateStr }
    })
    await refreshAvail()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile salvare la disponibilità', color: 'error' })
  } finally {
    salvandoGiorno.value = null
  }
}

</script>

