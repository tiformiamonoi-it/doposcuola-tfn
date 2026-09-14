<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <!-- "Comunicazioni" e non più "Note del tutor": a firmare è a volte la
           segreteria e a volte una persona con nome e cognome, quindi il vecchio
           titolo prometteva un mittente che spesso non era quello. -->
      <h2 class="font-heading text-xl font-bold text-slate-900">Comunicazioni</h2>
      <UBadge v-if="notes.length > 0" color="neutral" variant="subtle">
        {{ notes.length }} {{ notes.length === 1 ? 'comunicazione' : 'comunicazioni' }}
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
          <p class="text-sm text-slate-500">Nessuna comunicazione al momento</p>
          <p class="text-xs text-slate-400">
            Qui arrivano le comunicazioni del centro su tuo figlio.
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
                <span class="text-xs font-semibold text-tfn-700">{{ iniziale(nota) }}</span>
              </div>
              <!-- La firma arriva già decisa dal server: "Segreteria" per le note
                   scritte da un tutor, il nome vero se a scrivere è stato un
                   responsabile. Qui non si sceglie niente, si stampa e basta. -->
              <span class="text-sm font-medium text-slate-800">{{ firma(nota) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="nota.student" class="text-xs text-slate-500">
                {{ nota.student.firstName }} {{ nota.student.lastName }}
              </span>
              <!-- La data è quella in cui la comunicazione è arrivata a te, non
                   quella in cui è stata scritta: l'elenco è ordinato così, e due
                   criteri diversi farebbero sembrare le date fuori ordine. -->
              <span class="text-xs text-slate-400">
                {{ formatDate(nota.approvataAt ?? nota.createdAt) }}
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
useHead({ title: 'Comunicazioni — Portale Famiglie' })

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

// Chi firma la comunicazione. Il server manda già il nome giusto ("Segreteria"
// oppure nome e cognome del responsabile): qui non si decide nulla, si legge.
function firma(nota: any): string {
  const nome = `${nota?.author?.firstName ?? ''} ${nota?.author?.lastName ?? ''}`.trim()
  return nome || 'Segreteria'
}

// L'iniziale nel pallino colorato, presa dalla firma che si vede accanto: così
// le due cose non possono mai dire due lettere diverse.
function iniziale(nota: any): string {
  return firma(nota).charAt(0).toUpperCase()
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
</script>

