<template>
  <div class="min-h-screen bg-slate-50 py-6 px-4">
    <div class="max-w-2xl mx-auto">
      <!-- Barra superiore con il ritorno alla pagina precedente -->
      <div class="flex items-center justify-between gap-3 mb-6">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-heroicons-arrow-left"
          @click="tornaIndietro"
        >
          Torna indietro
        </UButton>
        <NuxtLink to="/" class="text-xs text-slate-400 hover:text-slate-600 hover:underline">
          tiformiamonoi.it
        </NuxtLink>
      </div>

      <h1 class="font-heading text-2xl font-bold text-slate-900 mb-6">{{ titolo }}</h1>

      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <p class="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{{ testo }}</p>
      </div>

      <p v-if="versione" class="text-xs text-slate-400 mt-4">Versione: {{ versione }}</p>

      <!-- Secondo pulsante in fondo: i testi sono lunghi, chi arriva alla fine
           non deve risalire tutta la pagina per uscire. -->
      <div class="mt-6 mb-4">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-heroicons-arrow-left"
          block
          @click="tornaIndietro"
        >
          Torna indietro
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  titolo: string
  testo: string
  versione?: string
}>()

const router = useRouter()
const { loggedIn, user } = useUserSession()

// Se si arriva da un link interno si torna alla pagina precedente; se invece la pagina
// è stata aperta direttamente (link condiviso, nuova scheda) la cronologia è vuota e
// si finirebbe fuori dal sito: in quel caso si rientra dalla porta di casa del ruolo.
function tornaIndietro() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  navigateTo(loggedIn.value ? homeDiRuolo(user.value?.role) : '/login')
}
</script>
