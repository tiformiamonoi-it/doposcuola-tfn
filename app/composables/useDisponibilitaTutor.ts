import { startOfMonth, endOfMonth, addMonths, format, getDay, getDaysInMonth, setDate } from 'date-fns'
import { it } from 'date-fns/locale'
import { giornoSettimana, isDomenica } from '#shared/giorno-civile'

// Il calendario delle disponibilità del tutor: le regole stanno tutte qui, una volta sola.
// Lo usano la pagina /area-tutor/disponibilita (veste nuova del TUTOR) e /area-tutor per
// Super Tutor e Admin (veste del gestionale). Spostato da pages/area-tutor/index.vue
// senza cambiare niente.
export function useDisponibilitaTutor() {
  const toast = useToast()

  const meseRiferimento = ref(startOfMonth(new Date()))

  const nomeMeseCorrente = computed(() => format(meseRiferimento.value, 'MMMM yyyy', { locale: it }))

  const blankDays = computed(() => {
    const dayOfWeek = getDay(meseRiferimento.value)
    // getDay() => 0 (Dom) - 6 (Sab). Vogliamo Lunedì = 0
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1
  })

  const giorniMese = computed(() => {
    const tot = getDaysInMonth(meseRiferimento.value)
    const arr = []
    for (let i = 1; i <= tot; i++) {
      const d = setDate(meseRiferimento.value, i)
      arr.push({
        numero: i,
        dateStr: format(d, 'yyyy-MM-dd'),
      })
    }
    return arr
  })

  function cambiaMese(dir: number) {
    meseRiferimento.value = addMonths(meseRiferimento.value, dir)
  }

  // Fetch presenze del mese
  const fromStr = computed(() => format(meseRiferimento.value, 'yyyy-MM-dd'))
  const toStr = computed(() => format(endOfMonth(meseRiferimento.value), 'yyyy-MM-dd'))

  const { data: availData, refresh: refreshAvail } = useLazyFetch<any>('/api/tutors/availabilities/me', {
    query: computed(() => ({ from: fromStr.value, to: toStr.value })),
    watch: [meseRiferimento],
  })

  const forfait = computed(() => availData.value?.forfait ?? false)

  // Sempre disponibile (il server lo manda false se il tutor è anche a fisso mensile)
  const sempreDisponibile = computed(() => availData.value?.sempreDisponibile ?? false)
  const assenze = computed(() => new Set<string>(availData.value?.assenze ?? []))

  function isFeriale(dateStr: string) {
    const giorno = giornoSettimana(dateStr)
    return giorno >= 1 && giorno <= 5
  }

  function isFerialeForfait(dateStr: string) {
    return forfait.value && isFeriale(dateStr)
  }

  // Giorno feriale non chiuso di un tutor sempre disponibile: c'è d'ufficio
  function isFerialeSempreDisponibile(dateStr: string) {
    return sempreDisponibile.value && isFeriale(dateStr) && !chiusure.value.has(dateStr)
  }

  function isDisponibile(dateStr: string) {
    // Fisso mensile: lun-ven sempre disponibile d'ufficio (salvo chiusure)
    if (isFerialeForfait(dateStr) && !chiusure.value.has(dateStr)) return true
    const lista = availData.value?.disponibilita ?? []
    const spuntato = lista.some((a: any) => format(new Date(a.date), 'yyyy-MM-dd') === dateStr)
    // Sempre disponibile: c'è, a meno che non abbia segnato l'assenza (stessa regola del server)
    if (isFerialeSempreDisponibile(dateStr)) return spuntato || !assenze.value.has(dateStr)
    return spuntato
  }

  // Il giorno feriale in cui il tutor sempre disponibile ha detto "non ci sono"
  function isAssente(dateStr: string) {
    return isFerialeSempreDisponibile(dateStr) && !isDisponibile(dateStr)
  }

  // ─── Giorni bloccati: passati, oggi dopo le 9:30 (ora del SERVER), domeniche, chiusure ───
  const chiusure = computed(() => new Set<string>(availData.value?.chiusure ?? []))
  const oggiServer = computed(() => availData.value?.oggi ?? '')
  const oggiBloccato = computed(() => availData.value?.oggiBloccato ?? false)

  function motivoBlocco(dateStr: string): string | null {
    if (isDomenica(dateStr)) return 'La domenica il centro è chiuso'
    if (chiusure.value.has(dateStr)) return 'Giorno di chiusura'
    if (isFerialeForfait(dateStr)) return 'Sempre disponibile (fisso mensile)'
    if (oggiServer.value && dateStr < oggiServer.value) return 'Giorno passato'
    if (dateStr === oggiServer.value && oggiBloccato.value) return 'Modificabile solo entro le 9:30'
    return null
  }

  const salvandoGiorno = ref<string | null>(null)

  async function toggleDisponibilita(dateStr: string) {
    const blocco = motivoBlocco(dateStr)
    if (blocco) {
      toast.add({ title: 'Giorno non modificabile', description: blocco, color: 'warning' })
      return
    }
    salvandoGiorno.value = dateStr
    try {
      await $fetch('/api/tutors/availabilities/toggle', {
        method: 'POST',
        body: { date: dateStr },
      })
      await refreshAvail()
    } catch (err: any) {
      toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile salvare la disponibilità', color: 'error' })
    } finally {
      salvandoGiorno.value = null
    }
  }

  return {
    meseRiferimento, nomeMeseCorrente, blankDays, giorniMese, cambiaMese, toStr,
    forfait, sempreDisponibile, oggiServer,
    isDisponibile, isAssente, motivoBlocco,
    salvandoGiorno, toggleDisponibilita,
  }
}
