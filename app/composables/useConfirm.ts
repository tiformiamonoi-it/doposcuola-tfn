// Stato condiviso per le finestre di conferma (<ConfirmDialog>).
// Prima ogni pagina si ricopiava gli stessi 6 ref + chiediConferma/eseguiConferma.
//
// Uso tipico:
//   const { confirmOpen, confirmTitle, ..., chiediConferma, eseguiConferma } = useConfirm()
//   chiediConferma({ title: '…', description: '…', confirmLabel: 'Elimina', confirmColor: 'error' },
//                  () => faiLaCosa())
// e nel template:
//   <ConfirmDialog v-model:open="confirmOpen" :title="confirmTitle" :description="confirmDescription"
//                  :confirm-label="confirmLabel" :confirm-color="confirmColor" :loading="confirmLoading"
//                  @confirm="eseguiConferma" />

export type ConfirmColor = 'primary' | 'error' | 'warning' | 'success'

export type ConfirmConfig = {
  title: string
  description: string
  confirmLabel?: string
  confirmColor?: ConfirmColor
  // true  → la finestra resta aperta con la rotellina finché l'azione non finisce
  //         (e resta aperta se l'azione fallisce, così si può riprovare)
  // false → si chiude subito e l'azione parte per conto suo (comportamento storico)
  attendi?: boolean
}

export type ConfirmAction = () => void | Promise<unknown>

export function useConfirm() {
  const confirmOpen        = ref(false)
  const confirmTitle       = ref('')
  const confirmDescription = ref('')
  const confirmLabel       = ref('Conferma')
  const confirmColor       = ref<ConfirmColor>('primary')
  const confirmLoading     = ref(false)

  const pendingAction = ref<ConfirmAction | null>(null)
  const attendi       = ref(false)

  function chiediConferma(config: ConfirmConfig, action: ConfirmAction) {
    confirmTitle.value       = config.title
    confirmDescription.value = config.description
    confirmLabel.value       = config.confirmLabel ?? 'Conferma'
    confirmColor.value       = config.confirmColor ?? 'primary'
    attendi.value            = config.attendi ?? false
    confirmLoading.value     = false
    pendingAction.value      = action
    confirmOpen.value        = true
  }

  async function eseguiConferma() {
    const azione = pendingAction.value
    if (!azione) {
      confirmOpen.value = false
      return
    }

    // Modalità storica: chiudo e lascio correre l'azione (che si gestisce da sola)
    if (!attendi.value) {
      confirmOpen.value   = false
      pendingAction.value = null
      azione()
      return
    }

    // Modalità "attendi": rotellina sul bottone, chiusura solo a buon fine.
    // L'azione deve mostrare da sé l'eventuale messaggio di errore e rilanciare
    // l'eccezione: in quel caso la finestra resta aperta per riprovare.
    confirmLoading.value = true
    try {
      await azione()
      confirmOpen.value   = false
      pendingAction.value = null
    } catch {
      // errore già segnalato dall'azione: la finestra resta aperta
    } finally {
      confirmLoading.value = false
    }
  }

  return {
    confirmOpen,
    confirmTitle,
    confirmDescription,
    confirmLabel,
    confirmColor,
    confirmLoading,
    chiediConferma,
    eseguiConferma,
  }
}
