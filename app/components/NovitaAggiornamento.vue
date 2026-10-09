<template>
  <UModal
    v-model:open="aperto"
    :title="`Novità — versione v${novita?.versione}`"
    :description="dataEstesa"
  >
    <template #body>
      <ul class="list-disc pl-5 space-y-2 text-sm text-slate-700 leading-relaxed">
        <li v-for="(voce, i) in voci" :key="i">
          <!-- Grassetto senza HTML: spezzando sui '**', i pezzi dispari sono quelli in grassetto -->
          <template v-for="(pezzo, j) in voce.split('**')" :key="j">
            <strong v-if="j % 2" class="font-semibold text-slate-900">{{ pezzo }}</strong>
            <template v-else>{{ pezzo }}</template>
          </template>
        </li>
      </ul>
    </template>
    <template #footer>
      <div class="flex justify-end w-full">
        <UButton @click="chiudi">Ho capito</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ultimaNovitaPer, novitaGiaVista, type PubblicoNovita } from '#shared/changelog'

// Finestra "Novità" dopo un aggiornamento (registro in shared/changelog.ts).
// Compare UNA volta, al primo caricamento dopo l'uscita: il tutor vede le voci
// "tutor", Admin e Super Tutor quelle "segreteria". Genitori e studenti mai
// (e infatti sta solo nel layout dello staff). Chi si è perso più uscite vede
// solo l'ultima che lo riguarda. Admin e Super Tutor la riaprono cliccando il
// numero di versione in fondo al menu (stato condiviso 'novita-riapri').
const { user, fetch: refreshSession } = useUserSession()

const riapri = useState('novita-riapri', () => false)
// Chiusa in questa pagina: la finestra sparisce subito, senza aspettare il server
const chiusaOra = ref(false)

const pubblico = computed<PubblicoNovita | null>(() => {
  const ruolo = user.value?.role
  if (ruolo === 'TUTOR') return 'tutor'
  if (ruolo === 'ADMIN' || ruolo === 'SUPER_TUTOR') return 'segreteria'
  return null
})

const novita = computed(() => pubblico.value ? ultimaNovitaPer(pubblico.value) : undefined)
const voci = computed(() => novita.value && pubblico.value ? novita.value[pubblico.value] : [])

const daMostrare = computed(() =>
  !!novita.value
  && !novitaGiaVista(novita.value.versione, user.value?.novitaVista)
  // Prima le cose obbligatorie: col cambio password in corso non si disturba
  && user.value?.mustChangePassword !== true
  // Il tutor appena arrivato ha il tutorial di benvenuto (TutorialPrimoAccesso):
  // una finestra alla volta. Chiudendo il tutorial, il server segna vista anche
  // questa versione. Admin e Super Tutor il tutorial non ce l'hanno.
  && !(user.value?.role === 'TUTOR' && user.value?.tutorialVisto === false),
)

const aperto = computed({
  get: () => !!novita.value && (riapri.value || (daMostrare.value && !chiusaOra.value)),
  set: (v) => { if (!v) chiudi() },
})

const dataEstesa = computed(() => novita.value
  // A mezzogiorno: un giorno civile letto a mezzanotte UTC può scivolare al giorno prima
  ? new Date(`${novita.value.data}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
  : '')

async function chiudi() {
  riapri.value = false
  if (!daMostrare.value || chiusaOra.value || !novita.value) return
  chiusaOra.value = true
  try {
    await $fetch('/api/auth/novita-vista', { method: 'POST', body: { versione: novita.value.versione } })
    await refreshSession()
  } catch {
    // se fallisce, la finestra ricomparirà al prossimo caricamento: non blocca nulla
  }
}
</script>
