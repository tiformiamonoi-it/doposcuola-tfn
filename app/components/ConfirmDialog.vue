<template>
  <UModal v-model:open="isOpen" :title="title" :ui="{ content: 'max-w-sm' }">
    <template #body>
      <!--
        Il tetto d'altezza serve alle conferme lunghe (per esempio l'elenco delle
        materie standard che si stanno per aggiungere): senza, su un telefono il
        testo spingerebbe i bottoni "Annulla"/"Conferma" fuori dallo schermo e la
        finestra diventerebbe un vicolo cieco. Sulle conferme corte non cambia nulla.
      -->
      <p class="text-sm text-slate-600 whitespace-pre-line max-h-[50vh] overflow-y-auto">{{ description }}</p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <UButton variant="ghost" @click="isOpen = false">Annulla</UButton>
        <UButton :color="confirmColor" :loading="loading" @click="onConfirm">{{ confirmLabel }}</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ConfirmColor } from '~/composables/useConfirm'

const props = defineProps<{
  title: string
  description: string
  confirmLabel?: string
  confirmColor?: ConfirmColor
  loading?: boolean
}>()

const emit = defineEmits<{ confirm: [] }>()
const isOpen = defineModel<boolean>('open', { default: false })

const confirmLabel = computed(() => props.confirmLabel ?? 'Conferma')
const confirmColor = computed(() => props.confirmColor ?? 'primary')

function onConfirm() {
  emit('confirm')
}
</script>
