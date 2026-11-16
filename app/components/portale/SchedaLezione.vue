<template>
  <!-- La scheda di una lezione prenotata (schermata 2): chi, quando è stata prenotata,
       stato, materie e, finché l'orario lo permette, Modifica e Annulla. -->
  <article class="bg-white rounded-[22px] p-4 flex flex-col gap-3 pf-ombra" :class="annullata ? 'opacity-70' : ''">
    <div class="flex items-center gap-3">
      <PortaleAvatar :nome="nome" :indice="indice" />
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-base text-pf-testo truncate">{{ nome }}</p>
        <p class="text-[13px] text-pf-grigio">Prenotata il {{ prenotataIl }}</p>
      </div>
      <PortaleStato :tono="stato.tono">{{ stato.etichetta }}</PortaleStato>
    </div>

    <ul class="flex flex-wrap gap-1.5" aria-label="Materie">
      <li v-for="m in lezione.subjects" :key="m.name" class="text-[13px] font-semibold px-2.5 py-1 rounded-[10px] bg-pf-celeste text-pf-blu-scuro">
        {{ m.name }}
      </li>
    </ul>

    <p v-if="lezione.notes" class="text-[13px] text-pf-grigio-scuro">Nota: «{{ lezione.notes }}»</p>

    <template v-if="!annullata && giorno >= oggi">
      <div v-if="modificabile || annullabile" class="grid grid-cols-2 gap-2">
        <PortaleBottone v-if="modificabile" variante="chiaro" :to="`/portale/prenota?studente=${lezione.studentId}&data=${giorno}`" piccolo>
          Modifica
        </PortaleBottone>
        <PortaleBottone v-if="annullabile" variante="bordo" piccolo :class="modificabile ? '' : 'col-span-2'" @click="emit('annulla')">
          Annulla
        </PortaleBottone>
      </div>
      <p class="text-xs leading-[17px] text-pf-grigio">
        <template v-if="modificabile || annullabile">Puoi modificare entro le 11:30 e annullare entro le 12:30 del giorno stesso.</template>
        <template v-else>Orario limite superato: per cambiare qualcosa scrivi alla segreteria.</template>
      </p>
    </template>
  </article>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  lezione: { id: string; studentId: string | null; requestedDate: string; createdAt: string; status: string; notes?: string | null; subjects: { name: string }[] }
  nome: string
  indice?: number
}>(), { indice: 0 })
const emit = defineEmits<{ annulla: [] }>()

const oggi = adessoItalia().giorno
const giorno = computed(() => giornoPrenotazione(props.lezione))
const annullata = computed(() => props.lezione.status === 'CANCELLED')
const stato = computed(() => statoLezione(props.lezione.status, giorno.value))
const modificabile = computed(() => lezioneModificabile(giorno.value) && !!props.lezione.studentId)
const annullabile = computed(() => lezioneAnnullabile(giorno.value))
const prenotataIl = computed(() => new Date(props.lezione.createdAt).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long' }))
</script>
