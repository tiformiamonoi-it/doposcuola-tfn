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
// Chiusura con la X o invito rifiutato → si ripropone dopo 7 giorni; solo
// l'installazione accettata lo spegne per un anno. (-v2: azzera le chiusure
// annuali date con la versione vecchia, che scattavano anche con la X.)
const dismissed = useCookie<boolean>('tfn-install-dismissed-v2', { maxAge: 60 * 60 * 24 * 7 })
const dismissedAnno = useCookie<boolean>('tfn-install-dismissed-v2', { maxAge: 60 * 60 * 24 * 365 })

// Evento catturato all'avvio da plugins/install-prompt.client.ts
const promptNativo = useState<any>('installPrompt', () => null)
const isIos = ref(false)
const giaInstallata = ref(true) // true finché non si verifica nel browser: il server non mostra nulla

onMounted(() => {
  giaInstallata.value = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true // vecchi iOS
  // iPadOS 13+ si presenta come un Mac: lo riconosce solo il touch
  isIos.value = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
})

const mostra = computed(() =>
  !dismissed.value && !giaInstallata.value && (!!promptNativo.value || isIos.value)
)

async function installa() {
  const p = promptNativo.value
  if (!p) return
  await p.prompt()
  const { outcome } = await p.userChoice
  promptNativo.value = null // l'evento vale una volta sola
  if (outcome === 'accepted') dismissedAnno.value = true
  else dismissed.value = true
}

function chiudi() {
  dismissed.value = true
}
</script>
