<template>
  <div class="space-y-6 max-w-3xl mx-auto">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Cronologia Note</h1>
      <p class="text-slate-500">Tutte le note che hai scritto sugli studenti.</p>
    </div>

    <UCard>
      <div v-if="pending" class="space-y-4">
        <USkeleton v-for="i in 3" :key="i" class="h-20 w-full" />
      </div>

      <div v-else-if="!note?.length" class="py-10 text-center text-slate-400">
        <UIcon name="i-heroicons-document-text" class="w-8 h-8 mx-auto mb-2" />
        <p>Non hai scritto alcuna nota.</p>
      </div>

      <div v-else class="divide-y divide-slate-100">
        <div v-for="n in note" :key="n.id" class="py-4">
          <div class="flex items-start justify-between mb-1">
            <div class="flex items-center gap-2">
              <UAvatar :alt="n.student?.firstName || 'S'" size="sm" class="bg-primary-100 text-primary-600" />
              <div>
                <NuxtLink :to="`/studenti/${n.studentId}`" class="font-medium text-slate-800 hover:text-primary-600">
                  {{ n.student?.firstName }} {{ n.student?.lastName }}
                </NuxtLink>
                <span class="text-xs text-slate-400 ml-2">{{ formatDataOra(n.createdAt) }}</span>
              </div>
            </div>
            <UBadge :color="n.visibilita === 'FAMIGLIA' ? 'success' : 'warning'" variant="subtle" size="xs">
              {{ n.visibilita === 'FAMIGLIA' ? 'Famiglia' : 'Interna' }}
            </UBadge>
          </div>
          <p class="text-sm text-slate-700 whitespace-pre-wrap mt-1">{{ n.contenuto }}</p>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['tutor-only'] })
useHead({ title: 'Cronologia Note — Area Tutor' })

const { data: note, pending } = await useFetch<any[]>('/api/notes/me')

function formatDataOra(d: string) {
  return new Date(d).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
</script>
