<template>
  <!-- La scheda di un ragazzo: iniziale, nome, classe e scuola, stato del pacchetto.
       Sotto, nello slot, quello che serve alla pagina (prossima lezione, pacchetto…).
       Con `riga` diventa una riga di elenco, senza cornice (Profilo). -->
  <article
    class="flex flex-col gap-3.5"
    :class="riga ? 'py-3' : 'bg-white rounded-3xl p-[18px] pf-ombra-alta'"
  >
    <div class="flex items-center gap-3.5">
      <PortaleAvatar :nome="alunno.firstName" :indice="indice" :misura="riga ? 'sm' : 'lg'" :anello="!riga" />
      <div class="flex-1 min-w-0">
        <p class="text-pf-testo truncate" :class="riga ? 'text-[15px] font-semibold' : 'font-heading font-bold text-[17px]'">
          {{ riga ? `${alunno.firstName} ${alunno.lastName ?? ''}` : alunno.firstName }}
        </p>
        <p class="text-[13px] text-pf-grigio truncate">{{ [alunno.classe, alunno.scuola].filter(Boolean).join(' · ') || 'Classe non indicata' }}</p>
      </div>
      <PortaleStato :tono="stato.tono">{{ stato.etichetta }}</PortaleStato>
    </div>
    <slot />
  </article>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  alunno: { firstName: string; lastName?: string | null; classe?: string | null; scuola?: string | null; packages?: { stati?: string[] | null }[] }
  indice?: number
  riga?: boolean
}>(), { indice: 0 })

// Il server manda solo l'ultimo pacchetto non chiuso, e solo il suo stato
const stato = computed(() => statoPacchettoPortale(props.alunno.packages?.[0]))
</script>
