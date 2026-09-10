<template>
  <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">

    <!-- 1. È partita l'email? -->
    <p v-if="emailInviata" class="text-sm text-emerald-700 flex items-start gap-1.5">
      <UIcon name="i-heroicons-check-circle" class="w-4 h-4 mt-0.5 shrink-0" />
      <span>Email inviata a <strong>{{ email }}</strong></span>
    </p>
    <p v-else class="text-sm text-amber-800 flex items-start gap-1.5">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 mt-0.5 shrink-0" />
      <span>{{ spiegazioneMancatoInvio }}</span>
    </p>

    <!-- 2. Il link da copiare -->
    <div class="flex items-center gap-2">
      <UInput
        ref="campoLink"
        :model-value="linkCompleto"
        readonly
        size="sm"
        class="flex-1 min-w-0"
        :aria-label="`Link per scegliere la password${nome ? ' di ' + nome : ''}`"
        @focus="selezionaTutto"
      />
      <UButton size="sm" icon="i-heroicons-clipboard-document" :loading="copiando" @click="copiaLink">
        Copia link
      </UButton>
    </div>

    <!-- 3. Cosa farci -->
    <p class="text-xs text-amber-700">
      Manda questo link a {{ nome || 'questa persona' }}: gli permette di scegliere la sua password.
      Vale 7 giorni e funziona una volta sola.
    </p>
  </div>
</template>

<script setup lang="ts">
// IL PIANO B DELLA SEGRETERIA.
// Quando la posta non parte (servizio email spento o bloccato) l'account resterebbe
// irraggiungibile: qui il link si legge a schermo e si copia con un clic, per
// mandarlo su WhatsApp. Il gestionale non dipende più dalla posta per far entrare
// una famiglia.

const props = defineProps<{
  /** Link restituito dall'API. Può essere relativo se il dominio non è configurato. */
  link: string
  /** Email a cui il messaggio è stato (o non è stato) spedito */
  email?: string
  /** Nome di battesimo del destinatario, per la riga di spiegazione */
  nome?: string
  /** Esito dell'invio email riportato dal server */
  emailInviata?: boolean
  /** Perché l'email non è partita (arriva dal server). Assente = motivo sconosciuto. */
  motivoEmail?: 'NON_CONFIGURATO' | 'RIFIUTATO' | 'RETE'
  /** Riga di spiegazione tecnica breve, es. il messaggio con cui la posta ha rifiutato l'invio */
  dettaglioEmail?: string
}>()

// PERCHE': prima qui c'era scritto sempre "servizio di posta non attivo", anche
// quando la posta era attivissima e aveva rifiutato l'invio per un altro motivo
// (mittente non verificato, account bloccato…). Un messaggio sbagliato manda la
// segreteria a cercare il problema nel posto sbagliato: meglio dire cosa è
// successo davvero e lasciare comunque il piano B (il link da copiare).
const spiegazioneMancatoInvio = computed(() => {
  const coda = ': manda tu il link qui sotto'
  switch (props.motivoEmail) {
    case 'NON_CONFIGURATO':
      return `Servizio di posta non configurato${coda}`
    case 'RIFIUTATO':
      return props.dettaglioEmail
        ? `La posta ha rifiutato l'invio (${props.dettaglioEmail})${coda}`
        : `La posta ha rifiutato l'invio${coda}`
    case 'RETE':
      return `Non è stato possibile contattare il servizio di posta${coda}`
    default:
      return `Email non inviata${coda}`
  }
})

const toast = useToast()
const campoLink = ref<any>(null)
const copiando = ref(false)

// Se il server non ha il dominio configurato (appUrl vuoto) restituisce un link
// relativo tipo "/imposta-password?token=...": lo completiamo con l'indirizzo
// del gestionale che la segreteria ha già aperto nel browser.
const linkCompleto = computed(() => {
  if (!props.link) return ''
  if (props.link.startsWith('http')) return props.link
  if (import.meta.client) return `${window.location.origin}${props.link}`
  return props.link
})

// Fallback per browser/contesti senza clipboard (http non sicuro, permessi negati):
// selezioniamo il testo così basta un Ctrl+C.
function selezionaTutto() {
  // UInput espone il campo vero con `inputRef` (Nuxt UI); il querySelector è la rete di sicurezza
  const input = campoLink.value?.inputRef ?? campoLink.value?.$el?.querySelector?.('input')
  input?.select?.()
}

async function copiaLink() {
  copiando.value = true
  try {
    if (!navigator?.clipboard?.writeText) throw new Error('clipboard non disponibile')
    await navigator.clipboard.writeText(linkCompleto.value)
    toast.add({ title: 'Link copiato', description: 'Ora puoi incollarlo su WhatsApp', color: 'success', icon: 'i-heroicons-check-circle' })
  } catch {
    selezionaTutto()
    toast.add({
      title: 'Copia il link a mano',
      description: 'Il testo è selezionato: premi Ctrl+C (o tieni premuto e scegli Copia).',
      color: 'warning',
      icon: 'i-heroicons-clipboard-document',
    })
  } finally {
    copiando.value = false
  }
}
</script>
