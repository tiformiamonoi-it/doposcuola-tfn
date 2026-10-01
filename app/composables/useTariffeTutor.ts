import { determinaTipoLezione, type TipoLezione } from '#shared/tariffe'

// Tipo di lezione nelle modali del calendario, con la stessa regola del server
// (shared/tariffe.ts) e l'interruttore "maxi gruppo attivo" configurato dall'admin.
// Il COMPENSO invece non si calcola più qui: con le tariffe speciali la cifra vera la
// sa solo il server → useAnteprimaCompenso qui sotto.
// NB: /api/settings è riservato ad ADMIN/SUPER_TUTOR → per il TUTOR niente chiamata
// (darebbe 403): al tutor le modali non mostrano né compenso né tipo (isTutor).
export function useTariffeTutor() {
  const { user } = useUserSession()
  const isTutor = computed(() => user.value?.role === 'TUTOR')
  const { data } = useFetch<Record<string, string>>('/api/settings/configs', {
    lazy: true,
    immediate: user.value?.role !== 'TUTOR',
  })

  // Maxi gruppo acceso salvo "false" esplicito (system_configs → maxi_gruppo_attivo), come il server
  const maxiAttivo = computed(() => (data.value?.maxi_gruppo_attivo ?? '').trim().toLowerCase() !== 'false')

  // Stessa regola del server (shared/tariffe.ts). giaMaxi: la lezione salvata è già MAXI
  // e il server la lascia MAXI anche a maxi spento.
  function tipoLezione(num: number, forzaGruppo: boolean, giaMaxi = false): TipoLezione | '' {
    return num === 0 ? '' : determinaTipoLezione(num, forzaGruppo, maxiAttivo.value || giaMaxi)
  }

  return { tipoLezione, maxiAttivo, isTutor }
}

/** Una lezione da mettere in anteprima (vedi AnteprimaCompensoSchema) */
export interface LezioneInAnteprima {
  lessonId?: string
  timeSlotId: string
  studentIds: string[]
  forzaGruppo: boolean
  mezzaLezione: boolean
  compensoForzato?: number | null
}

/** Risposta di POST /api/tariffe-speciali/anteprima, una per lezione */
export interface EsitoAnteprima {
  compenso: number
  tariffaOraria: number
  fonte: 'LISTINO' | 'REGOLA' | 'FORZATO'
  descrizione: string
  tipo: TipoLezione
  /** lezione in modifica che non verrebbe ricalcolata: resta il compenso salvato */
  invariato: boolean
}

// ANTEPRIMA VERA del compenso, chiesta al server (listino + tariffe speciali + forzatura):
// la formula è una sola e sta sul server, così l'anteprima non può promettere una cifra
// diversa da quella che verrà salvata.
// `richiesta` restituisce null quando non c'è niente da chiedere (o per il TUTOR, che
// non vede soldi e riceverebbe un 403). Si aspetta un attimo che l'utente smetta di
// cliccare, e una risposta arrivata in ritardo non sovrascrive quella più nuova.
export function useAnteprimaCompenso(richiesta: () => { tutorId: string, data: string, lezioni: LezioneInAnteprima[] } | null) {
  const esiti = ref<EsitoAnteprima[]>([])
  const caricamento = ref(false)
  let giro = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(() => JSON.stringify(richiesta()), () => {
    clearTimeout(timer)
    const questoGiro = ++giro
    const body = richiesta()
    if (!body || body.lezioni.length === 0) {
      esiti.value = []
      caricamento.value = false
      return
    }
    caricamento.value = true
    timer = setTimeout(async () => {
      try {
        const res = await $fetch<{ data: EsitoAnteprima[] }>('/api/tariffe-speciali/anteprima', { method: 'POST', body })
        if (questoGiro === giro) esiti.value = res.data
      } catch {
        if (questoGiro === giro) esiti.value = []
      } finally {
        if (questoGiro === giro) caricamento.value = false
      }
    }, 300)
  }, { immediate: true })

  onScopeDispose(() => clearTimeout(timer))

  return { esiti, caricamento }
}
