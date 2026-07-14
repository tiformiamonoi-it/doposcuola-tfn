<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="font-heading text-xl font-bold text-slate-900">Note del tutor</h2>
      <UBadge v-if="notes.length > 0" color="neutral" variant="subtle">
        {{ notes.length }} note
      </UBadge>
    </div>

    <template v-if="pending">
      <div v-for="i in 3" :key="i">
        <USkeleton class="h-24 w-full rounded-xl" />
      </div>
    </template>

    <template v-else-if="notes.length === 0">
      <UCard>
        <div class="text-center py-8 space-y-2">
          <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-slate-300 mx-auto" />
          <p class="text-sm text-slate-500">Nessuna nota condivisa al momento</p>
          <p class="text-xs text-slate-400">
            Qui appariranno i commenti del tutor sulle sessioni di tuo figlio.
          </p>
        </div>
      </UCard>
    </template>

    <template v-else>
      <UCard
        v-for="nota in notes"
        :key="nota.id"
        class="space-y-2"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-full bg-tfn-100 flex items-center justify-center">
                <span class="text-xs font-semibold text-tfn-700">S</span>
              </div>
              <span class="text-sm font-medium text-slate-800">Segreteria</span>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="nota.student" class="text-xs text-slate-500">
                {{ nota.student.firstName }} {{ nota.student.lastName }}
              </span>
              <span class="text-xs text-slate-400">
                {{ formatDate(nota.createdAt) }}
              </span>
            </div>
          </div>
        </template>

        <p class="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
          {{ nota.contenuto }}
        </p>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Note — Portale Famiglie' })

// Le note didattiche sono riservate alla famiglia: l'account studente non le vede
const { user: sessionUser } = useUserSession()
if (sessionUser.value?.role === 'STUDENTE') {
  await navigateTo('/portale', { replace: true })
}

const { data, pending } = useLazyFetch('/api/portal/notes')
const notes = computed(() => (data.value as any[]) ?? [])

// Visita registrata: azzera il badge "note non lette" in nav (solo genitori)
onMounted(async () => {
  if (sessionUser.value?.role !== 'GENITORE') return
  try {
    await $fetch('/api/portal/notes-seen', { method: 'POST' })
    useState<number>('portal-note-unseen', () => 0).value = 0
  } catch { /* badge non azzerato: nessun impatto funzionale */ }
})

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
</script>

