<template>
  <UBadge :color="colore" variant="subtle" size="xs">{{ stato }}</UBadge>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ stato: string, pacchetto?: any }>()

const progresso = computed(() => {
  if (!props.pacchetto) return 0
  if (props.pacchetto.tipo === 'MENSILE') {
    const tot = props.pacchetto.giorniAcquistati || 0
    const res = props.pacchetto.giorniResiduo || 0
    if (tot === 0) return 0
    return (res / tot) * 100
  } else {
    const tot = parseFloat(props.pacchetto.oreAcquistate || '0')
    const res = parseFloat(props.pacchetto.oreResiduo || '0')
    if (tot === 0) return 0
    return (res / tot) * 100
  }
})

const colore = computed(() => {
  switch (props.stato) {
    case 'ATTIVO':       return 'success'
    case 'DA_RINNOVARE': return 'warning'
    case 'SCADUTO':      return 'error'
    case 'ESAURITO':     return 'error'
    case 'DA_PAGARE':
      // Se il pacchetto ha più del 90% rimanente, il badge "Da PAGARE" è neutro (meno allarmante)
      if (props.pacchetto && progresso.value > 90) return 'neutral'
      return 'warning'
    case 'PAGATO':       return 'success'
    case 'CHIUSO':       return 'neutral'
    default:             return 'neutral'
  }
})
</script>
