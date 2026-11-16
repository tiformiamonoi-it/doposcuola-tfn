<template>
  <div class="space-y-6 max-w-2xl mx-auto">
    <!-- /area-tutor per Super Tutor e Admin: il calendario disponibilità nella veste di sempre
         del gestionale (D1). Le regole stanno in composables/useDisponibilitaTutor.ts. -->
    <!-- Intestazione -->
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Area Personale Tutor</h1>
      <p class="text-slate-500">Gestisci le tue presenze, lezioni e note.</p>
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
          <div v-if="sempreDisponibile" class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-red-50 border border-red-200"></div> Assente</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200"></div> Non selezionabile (passato, chiusura, domenica)</div>
        </div>
        <p v-if="forfait" class="text-xs text-primary-600 mb-4 font-medium">
          Con il fisso mensile sei sempre disponibile dal lunedì al venerdì: puoi aggiungere disponibilità solo il sabato.
        </p>
        <p v-else-if="sempreDisponibile" class="text-xs text-primary-600 mb-4 font-medium">
          Sei sempre disponibile dal lunedì al venerdì: tocca un giorno per segnare che quel giorno non ci sei.
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
                : (isDisponibile(day.dateStr) ? 'bg-primary-50 border-primary-300 text-primary-700 font-bold'
                  : isAssente(day.dateStr) ? 'bg-red-50 border-red-200 text-red-600 line-through hover:border-red-300'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300')
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
const {
  nomeMeseCorrente, blankDays, giorniMese, cambiaMese, forfait, sempreDisponibile,
  isDisponibile, isAssente, motivoBlocco, salvandoGiorno, toggleDisponibilita,
} = useDisponibilitaTutor()
</script>
