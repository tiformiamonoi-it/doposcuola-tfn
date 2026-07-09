<template>
  <UModal v-model:open="isOpen" :title="title" :ui="{ content: 'max-w-sm' }">
    <template #body>
      <p class="text-sm text-slate-600 whitespace-pre-line">{{ description }}</p>
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
const props = defineProps<{
  title: string
  description: string
  confirmLabel?: string
  confirmColor?: 'primary' | 'error' | 'warning'
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
