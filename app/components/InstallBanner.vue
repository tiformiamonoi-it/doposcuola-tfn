<template>
  <div v-if="mostra" class="mb-4 bg-tfn-50 border border-tfn-200 rounded-xl p-3 flex items-center gap-3">
    <img src="/favicon.svg" alt="" class="w-10 h-10 flex-shrink-0" />
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-slate-900">Installa l'app sul telefono</p>
      <p v-if="isIos" class="text-xs text-slate-500 mt-0.5">
        Tocca <UIcon name="i-heroicons-arrow-up-on-square" class="w-3.5 h-3.5 inline align-text-bottom" /> Condividi,
        poi «Aggiungi alla schermata Home»
      </p>
      <p v-else class="text-xs text-slate-500 mt-0.5">Icona sulla Home, si apre come una vera app</p>
    </div>
    <UButton v-if="!isIos" size="xs" @click="installa">Installa</UButton>
    <button @click="chiudi" class="p-1 text-slate-400 hover:text-slate-600" title="Chiudi">
      <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
// Invito a installare la webapp (PWA).
// Android/Chrome: prompt nativo via beforeinstallprompt. iPhone/Safari: solo
// istruzioni manuali (Apple non offre nessuna API di installazione).
// Cookie e non localStorage: regola del progetto (hydration mismatch in SSR).
const dismissed = useCookie<boolean>('tfn-install-dismissed', { maxAge: 60 * 60 * 24 * 365 })

const promptNativo = ref<any>(null)
const isIos = ref(false)
const giaInstallata = ref(true) // true finché non si verifica nel browser: il server non mostra nulla

onMounted(() => {
  giaInstallata.value = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true // vecchi iOS
  isIos.value = /iphone|ipad|ipod/i.test(navigator.userAgent)
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault() // niente mini-infobar di Chrome: mostriamo noi il bottone
    promptNativo.value = e
  })
})

const mostra = computed(() =>
  !dismissed.value && !giaInstallata.value && (!!promptNativo.value || isIos.value)
)

async function installa() {
  await promptNativo.value?.prompt()
  promptNativo.value = null
  dismissed.value = true
}

function chiudi() {
  dismissed.value = true
}
</script>
