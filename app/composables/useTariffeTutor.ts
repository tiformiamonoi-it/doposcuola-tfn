import { TARIFFE_DEFAULT, TARIFFE_MEZZA, determinaTipoLezione, type TipoLezione } from '#shared/tariffe'

// Anteprima del compenso tutor nelle modali del calendario, con le tariffe configurate
// dall'admin (system_configs → tariffe_tutor) e fallback per chiave su TARIFFE_DEFAULT.
// Stessa formula di calcCompenso sul server: mezza = tariffa fissa, piena = tariffa × ore
// dello slot. Il valore autoritativo resta quello calcolato dal server.
// NB: /api/settings è riservato ad ADMIN/SUPER_TUTOR → per il TUTOR niente chiamata
// (darebbe 403): al tutor le modali non mostrano né compenso né tipo (isTutor).
export function useTariffeTutor() {
  const { user } = useUserSession()
  const isTutor = computed(() => user.value?.role === 'TUTOR')
  const { data } = useFetch<Record<string, string>>('/api/settings/configs', {
    lazy: true,
    immediate: user.value?.role !== 'TUTOR',
  })

  const tariffe = computed<Record<TipoLezione, number>>(() => {
    let conf: Partial<Record<TipoLezione, number>> | null = null
    try { conf = JSON.parse(data.value?.tariffe_tutor ?? 'null') } catch { /* config illeggibile → default */ }
    return {
      SINGOLA: conf?.SINGOLA ?? TARIFFE_DEFAULT.SINGOLA,
      GRUPPO:  conf?.GRUPPO  ?? TARIFFE_DEFAULT.GRUPPO,
      MAXI:    conf?.MAXI    ?? TARIFFE_DEFAULT.MAXI,
    }
  })

  // Maxi gruppo acceso salvo "false" esplicito (system_configs → maxi_gruppo_attivo), come il server
  const maxiAttivo = computed(() => (data.value?.maxi_gruppo_attivo ?? '').trim().toLowerCase() !== 'false')

  // Stessa regola del server (shared/tariffe.ts). giaMaxi: la lezione salvata è già MAXI
  // e il server la lascia MAXI anche a maxi spento.
  function tipoLezione(num: number, forzaGruppo: boolean, giaMaxi = false): TipoLezione | '' {
    return num === 0 ? '' : determinaTipoLezione(num, forzaGruppo, maxiAttivo.value || giaMaxi)
  }

  // oraInizio/oraFine "HH:MM": se mancano si conta un'ora (anteprima a slot non ancora scelto)
  function compenso(tipo: string, mezza: boolean, oraInizio?: string, oraFine?: string): number {
    if (!(tipo in TARIFFE_DEFAULT)) return 0
    const t = tipo as TipoLezione
    if (mezza) return TARIFFE_MEZZA[t]
    let ore = 1
    if (oraInizio && oraFine) {
      const [h1, m1] = oraInizio.split(':').map(Number) as [number, number]
      const [h2, m2] = oraFine.split(':').map(Number) as [number, number]
      ore = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60
    }
    return tariffe.value[t] * ore
  }

  return { compenso, tipoLezione, maxiAttivo, isTutor }
}
