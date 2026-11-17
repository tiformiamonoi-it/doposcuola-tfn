<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4">
    <div class="w-full max-w-sm text-center">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-tfn-500 mb-4">
        <UIcon name="i-heroicons-computer-desktop" class="w-6 h-6 text-white" aria-hidden="true" />
      </div>
      <h1 class="font-heading text-xl font-bold text-slate-900">Il gestionale si usa dal computer</h1>
      <p class="text-sm text-slate-500 mt-2">
        Ciao {{ user?.firstName }}! L'app è pensata per famiglie, alunni e tutor.
        Per lavorare sul gestionale apri app.tiformiamonoi.it dal computer.
      </p>
      <UButton class="mt-6" block color="neutral" variant="outline" :loading="uscendo" icon="i-heroicons-arrow-right-on-rectangle" @click="logout">
        Esci
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
// D1: la segreteria (ADMIN) nell'app vede solo questa pagina. Ce la manda il gate globale
// (middleware/00.account-gate.global.ts). Chi ci arriva in altro modo (dal browser, o con
// un altro ruolo) torna alla sua casa: qui non c'è niente da fare per lui.
definePageMeta({
  layout: false,
  middleware: ['auth', () => {
    const { user } = useUserSession()
    if (user.value?.role !== 'ADMIN' || !useInApp()) return navigateTo(homeDiRuolo(user.value?.role))
  }],
})
useHead({ title: 'Usa il computer — tiformiamonoi.it' })

const { user } = useUserSession()
const { uscendo, logout } = useLogout()
</script>
