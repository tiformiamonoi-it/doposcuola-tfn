<template>
  <!-- Solo nella Home del portale famiglie (lo staff non lo usa): grafica v6 -->
  <section v-if="mostra" aria-labelledby="t-installa" class="bg-white rounded-[22px] p-4 flex gap-3 items-start pf-ombra">
    <img src="/favicon.svg" alt="" class="size-11 shrink-0" />
    <div class="flex-1 min-w-0 flex flex-col gap-1">
      <h2 id="t-installa" class="font-heading font-bold text-base">Installa l'app sul telefono</h2>
      <p v-if="isIos" class="text-[13px] leading-[18px] text-pf-grigio">
        Tocca <UIcon name="i-heroicons-arrow-up-on-square" class="size-4 inline align-text-bottom" aria-hidden="true" /> Condividi,
        poi «Aggiungi alla schermata Home»
      </p>
      <template v-else>
        <p class="text-[13px] leading-[18px] text-pf-grigio">Icona sulla Home, si apre come una vera app</p>
        <PortaleBottone piccolo class="self-start mt-2" @click="installa">Installa</PortaleBottone>
      </template>
    </div>
    <button type="button" aria-label="Chiudi l'invito a installare l'app" class="size-11 -m-2 shrink-0 rounded-full flex items-center justify-center text-pf-grigio-scuro hover:bg-pf-fondo" @click="chiudi">
      <UIcon name="i-heroicons-x-mark" class="size-5" aria-hidden="true" />
    </button>
  </section>
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

// Dentro l'app per telefono è già installata: l'invito non serve (vale anche per iPhone)
const inApp = useInApp()
const mostra = computed(() =>
  !inApp && !dismissed.value && !giaInstallata.value && (!!promptNativo.value || isIos.value)
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
