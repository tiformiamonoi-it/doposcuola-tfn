<template>
  <div>
    <PortaleTestata titolo="La mia disponibilità" indietro="/tutor-calendario" :campanella="false">
      <div class="flex items-center justify-between gap-2 p-1 bg-pf-blu-tasto rounded-[14px]">
        <button type="button" aria-label="Mese precedente" class="size-11 rounded-[11px] flex items-center justify-center hover:bg-pf-blu-scuro" @click="cambiaMese(-1)">
          <UIcon name="i-heroicons-chevron-left" class="size-5" aria-hidden="true" />
        </button>
        <span class="font-semibold text-[15px] first-letter:uppercase" aria-live="polite">{{ nomeMeseCorrente }}</span>
        <button type="button" aria-label="Mese successivo" class="size-11 rounded-[11px] flex items-center justify-center hover:bg-pf-blu-scuro" @click="cambiaMese(1)">
          <UIcon name="i-heroicons-chevron-right" class="size-5" aria-hidden="true" />
        </button>
      </div>
    </PortaleTestata>

    <p v-if="oggiServer && toStr >= oggiServer" class="mx-5 mt-5 text-[15px] text-pf-grigio-scuro" aria-live="polite">
      Da qui a fine mese ci sei <strong class="text-pf-testo">{{ giorniCiSei === 1 ? '1 giorno' : `${giorniCiSei} giorni` }}</strong>.
    </p>

    <section :aria-label="`Calendario di ${nomeMeseCorrente}`" class="mx-5 mt-4 bg-white rounded-3xl p-4 pf-ombra flex flex-col gap-4">
      <!-- Legenda: il colore non è mai l'unico segnale (c'è anche l'etichetta di ogni giorno) -->
      <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-pf-grigio-scuro">
        <span class="flex items-center gap-1.5"><span aria-hidden="true" class="size-3.5 rounded bg-pf-blu" />Ci sei</span>
        <span class="flex items-center gap-1.5"><span aria-hidden="true" class="size-3.5 rounded bg-white border border-pf-grigio/50" />Non ci sei</span>
        <span v-if="sempreDisponibile" class="flex items-center gap-1.5"><span aria-hidden="true" class="size-3.5 rounded bg-pf-rosso-chiaro" />Assente</span>
        <span class="flex items-center gap-1.5"><span aria-hidden="true" class="size-3.5 rounded bg-pf-bordo" />Non si cambia</span>
      </div>

      <div class="grid grid-cols-7 gap-1.5 text-center">
        <span v-for="g in ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']" :key="g" aria-hidden="true" class="text-xs font-semibold text-pf-grigio py-1">{{ g }}</span>
        <span v-for="b in blankDays" :key="'b' + b" aria-hidden="true" />
        <button
          v-for="day in giorniMese"
          :key="day.dateStr"
          type="button"
          class="min-h-11 rounded-xl text-[15px] flex items-center justify-center transition-colors"
          :class="[classeGiorno(day.dateStr), day.dateStr === oggiServer ? 'shadow-[inset_0_0_0_2px_var(--color-pf-giallo)]' : '']"
          :aria-label="etichettaGiorno(day)"
          :aria-pressed="isDisponibile(day.dateStr)"
          :disabled="salvandoGiorno === day.dateStr || !!motivoBlocco(day.dateStr)"
          :title="motivoBlocco(day.dateStr) ?? undefined"
          @click="toggleDisponibilita(day.dateStr)"
        >
          <UIcon v-if="salvandoGiorno === day.dateStr" name="i-heroicons-arrow-path" class="size-4 animate-spin" aria-hidden="true" />
          <span v-else>{{ day.numero }}</span>
        </button>
      </div>
    </section>

    <!-- Le regole: gli stessi testi di sempre -->
    <p v-if="forfait" class="mx-5 mt-4 p-4 rounded-[18px] bg-pf-celeste text-sm leading-5 text-pf-blu-scuro font-medium">
      Con il fisso mensile sei sempre disponibile dal lunedì al venerdì: puoi aggiungere disponibilità solo il sabato.
    </p>
    <p v-else-if="sempreDisponibile" class="mx-5 mt-4 p-4 rounded-[18px] bg-pf-celeste text-sm leading-5 text-pf-blu-scuro font-medium">
      Sei sempre disponibile dal lunedì al venerdì: tocca un giorno per segnare che quel giorno non ci sei.
    </p>
    <ul class="mx-5 mt-4 flex flex-col gap-2.5">
      <li v-for="r in REGOLE" :key="r.testo" class="flex gap-3 items-start text-sm leading-5 text-pf-grigio-scuro">
        <span class="size-7 shrink-0 rounded-[9px] bg-pf-celeste text-pf-blu flex items-center justify-center" aria-hidden="true"><UIcon :name="r.icona" class="size-4" /></span>
        {{ r.testo }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// LA MIA DISPONIBILITÀ (bozza Disponibilita): il calendario che prima stava in /area-tutor.
// Le regole sono le stesse di sempre, in composables/useDisponibilitaTutor.ts.
definePageMeta({ layout: 'tutor', middleware: ['tutor-only'] })
useHead({ title: 'La mia disponibilità — Area Tutor' })

const {
  nomeMeseCorrente, blankDays, giorniMese, cambiaMese, toStr, forfait, sempreDisponibile, oggiServer,
  isDisponibile, isAssente, motivoBlocco, salvandoGiorno, toggleDisponibilita,
} = useDisponibilitaTutor()

const REGOLE = [
  { icona: 'i-heroicons-hand-raised', testo: 'Tocca un giorno per dire se ci sei. Si salva subito.' },
  { icona: 'i-heroicons-clock', testo: 'La disponibilità di oggi si può modificare solo entro le 9:30.' },
  { icona: 'i-heroicons-lock-closed', testo: 'Domeniche, giorni passati e chiusure del centro non si toccano.' },
]

const giorniCiSei = computed(() => giorniMese.value
  .filter((d) => d.dateStr >= oggiServer.value && isDisponibile(d.dateStr)).length)

function classeGiorno(dateStr: string) {
  if (motivoBlocco(dateStr)) {
    return isDisponibile(dateStr) ? 'bg-pf-cielo text-pf-blu-scuro font-bold cursor-not-allowed' : 'bg-pf-bordo text-pf-grigio-scuro cursor-not-allowed'
  }
  if (isDisponibile(dateStr)) return 'bg-pf-blu text-white font-bold hover:bg-pf-blu-scuro'
  if (isAssente(dateStr)) return 'bg-pf-rosso-chiaro text-pf-rosso line-through'
  return 'bg-white border border-pf-grigio/50 text-pf-grigio-scuro hover:border-pf-blu'
}

// Per chi usa il lettore dello schermo: il giorno, se ci sei, e perché non si cambia
function etichettaGiorno(day: { numero: number, dateStr: string }) {
  const mese = nomeMeseCorrente.value.split(' ')[0]
  const stato = isDisponibile(day.dateStr) ? 'ci sei' : isAssente(day.dateStr) ? 'assente' : 'non ci sei'
  const blocco = motivoBlocco(day.dateStr)
  return `${day.numero} ${mese}, ${stato}${blocco ? `, ${blocco.toLowerCase()}` : ''}`
}
</script>
