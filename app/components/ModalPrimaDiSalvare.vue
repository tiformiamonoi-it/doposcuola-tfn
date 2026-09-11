<template>
  <UModal v-model:open="isOpen" title="Prima di salvare" :ui="{ content: 'max-w-lg' }">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-slate-600">
          Questa modifica riguarda anche altro. Togli la spunta a quello che non vuoi cambiare.
        </p>
        <ul class="space-y-3">
          <li v-for="voce in voci" :key="voce.id">
            <UCheckbox v-model="spunte[voce.id]" :label="voce.etichetta" :description="voce.dettaglio" />
          </li>
        </ul>
      </div>
    </template>
    <template #footer>
      <div class="flex flex-wrap justify-end gap-3 w-full">
        <UButton variant="ghost" :disabled="salvando" @click="annulla">Annulla</UButton>
        <UButton icon="i-heroicons-check" :loading="salvando" @click="conferma">Salva</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// IL RIEPILOGO DELLE CONSEGUENZE, prima di salvare una modifica.
// Una lista di voci con la spunta ("cambia anche l'email con cui Giulia entra"),
// attive di default. La finestra non sa cosa fanno: mostra le voci e restituisce
// quali sono rimaste spuntate. Le azioni le esegue chi l'ha aperta, dopo aver
// salvato. Così si possono aggiungere voci nuove (es. "aggiorna anche sulla
// scheda del fratello") senza toccare questo file.

const props = defineProps<{
  voci: Array<{
    id: string
    etichetta: string
    /** Riga di spiegazione in piccolo sotto l'etichetta (facoltativa) */
    dettaglio?: string
    /** Com'è la spunta quando si apre la finestra */
    attiva: boolean
  }>
  salvando?: boolean
}>()

const emit = defineEmits<{ conferma: [idAttive: string[]] }>()
const isOpen = defineModel<boolean>('open', { default: false })

// Le spunte vivono qui dentro, per id: a ogni apertura ripartono come proposte
const spunte = ref<Record<string, boolean>>({})
watch(isOpen, (aperta) => {
  if (!aperta) return
  spunte.value = Object.fromEntries(props.voci.map((v) => [v.id, v.attiva]))
}, { immediate: true })

function conferma() {
  emit('conferma', props.voci.filter((v) => spunte.value[v.id]).map((v) => v.id))
}

function annulla() {
  isOpen.value = false
}
</script>
