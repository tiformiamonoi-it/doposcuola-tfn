<template>
  <!-- Il calendario del mese del portale (Lezioni e Prenota, bozze v6). Ogni giorno è un
       <button> vero, con un nome che dice anche i pallini ("lezione prenotata", "materia
       speciale"), così chi usa un lettore di schermo sa quello che gli altri vedono. -->
  <div class="flex flex-col gap-2.5">
    <div class="flex items-center justify-between">
      <button type="button" aria-label="Mese precedente" class="size-11 rounded-xl bg-pf-fondo text-pf-testo flex items-center justify-center hover:bg-pf-bordo" @click="sposta(-1)">
        <UIcon name="i-heroicons-chevron-left" class="size-[18px]" aria-hidden="true" />
      </button>
      <h3 class="font-heading font-bold text-[17px] capitalize" aria-live="polite">{{ titoloMese }}</h3>
      <button type="button" aria-label="Mese successivo" class="size-11 rounded-xl bg-pf-fondo text-pf-testo flex items-center justify-center hover:bg-pf-bordo" @click="sposta(1)">
        <UIcon name="i-heroicons-chevron-right" class="size-[18px]" aria-hidden="true" />
      </button>
    </div>

    <div class="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-pf-grigio" aria-hidden="true">
      <span v-for="g in ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']" :key="g">{{ g }}</span>
    </div>

    <div class="grid grid-cols-7 gap-1">
      <span v-for="v in vuoti" :key="`v${v}`" aria-hidden="true" />
      <button
        v-for="g in giorni"
        :key="g.data"
        type="button"
        :disabled="g.spento"
        :aria-pressed="g.data === modelValue"
        :aria-label="g.etichetta"
        class="h-[46px] rounded-[14px] flex flex-col items-center justify-center gap-[3px] text-sm font-medium transition-colors disabled:cursor-not-allowed"
        :class="[
          g.data === modelValue ? 'bg-pf-blu text-white font-bold shadow-[0_6px_14px_rgb(0_107_172/0.30)]'
          : g.spento ? 'text-pf-grigio/50' : 'text-pf-testo hover:bg-pf-fondo',
          g.data === oggi && g.data !== modelValue ? 'ring-2 ring-inset ring-pf-blu' : '',
        ]"
        @click="emit('update:modelValue', g.data)"
      >
        <span>{{ g.numero }}</span>
        <span class="flex gap-[3px] h-[5px]" aria-hidden="true">
          <span v-if="g.segni.lezione" class="size-[5px] rounded-full" :class="g.data === modelValue ? 'bg-white' : 'bg-pf-blu'" />
          <span v-if="g.segni.svolta" class="size-[5px] rounded-full bg-pf-svolta" />
          <span v-if="g.segni.speciale" class="size-[5px] rounded-full bg-pf-giallo" />
        </span>
      </button>
    </div>

    <!-- La legenda: ogni pallino spiegato a parole -->
    <div class="flex flex-wrap gap-x-4 gap-y-1.5 pt-2 border-t border-pf-fondo text-xs text-pf-grigio-scuro">
      <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full ring-2 ring-inset ring-pf-blu" aria-hidden="true" />Oggi</span>
      <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-pf-blu" aria-hidden="true" />Lezione prenotata</span>
      <span v-if="conSvolte" class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-pf-svolta" aria-hidden="true" />Già svolta</span>
      <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-pf-giallo" aria-hidden="true" />Materia speciale</span>
    </div>
  </div>
</template>

<script setup lang="ts">
type SegniGiorno = { lezione?: boolean; speciale?: boolean; svolta?: boolean }

const props = defineProps<{
  /** Il giorno scelto, 'AAAA-MM-GG' */
  modelValue: string
  /** Il mese mostrato, 'AAAA-MM' */
  mese: string
  segni?: (giorno: string) => SegniGiorno
  spento?: (giorno: string) => boolean
  conSvolte?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [giorno: string]; 'update:mese': [mese: string] }>()

const oggi = adessoItalia().giorno

// Tutto in UTC: il calendario ragiona in giorni civili, il fuso del telefono non conta
const anno = computed(() => Number(props.mese.slice(0, 4)))
const meseNum = computed(() => Number(props.mese.slice(5, 7)))
const titoloMese = computed(() => new Date(Date.UTC(anno.value, meseNum.value - 1, 15)).toLocaleDateString('it-IT', { timeZone: 'UTC', month: 'long', year: 'numeric' }))
// Quante caselle vuote prima del giorno 1, con la settimana che parte di lunedì
const vuoti = computed(() => (new Date(Date.UTC(anno.value, meseNum.value - 1, 1)).getUTCDay() + 6) % 7)

const giorni = computed(() => {
  const quanti = new Date(Date.UTC(anno.value, meseNum.value, 0)).getUTCDate()
  return Array.from({ length: quanti }, (_, i) => {
    const data = `${props.mese}-${String(i + 1).padStart(2, '0')}`
    const segni = props.segni?.(data) ?? {}
    const parole = [giornoInParole(data)]
    if (data === oggi) parole.push('oggi')
    if (segni.lezione) parole.push('lezione prenotata')
    if (segni.svolta) parole.push('lezione già svolta')
    if (segni.speciale) parole.push('materia speciale')
    return { data, numero: i + 1, segni, spento: props.spento?.(data) ?? false, etichetta: parole.join(', ') }
  })
})

function sposta(delta: number) {
  const d = new Date(Date.UTC(anno.value, meseNum.value - 1 + delta, 1))
  emit('update:mese', d.toISOString().slice(0, 7))
}
</script>
