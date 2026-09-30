/**
 * Quali slot orari mostrare in una giornata del calendario (segreteria e tutor).
 * Gli slot "sempre visibili" (scelti in Impostazioni → Slot Orari) compaiono sempre;
 * gli altri solo se quel giorno hanno almeno una lezione.
 */
export function slotVisibiliNelGiorno<T extends { id: string; sempreVisibile?: boolean }>(
  slots: T[],
  lezioniDelGiorno: { timeSlotId?: string | null }[],
): T[] {
  const usati = new Set(lezioniDelGiorno.map(l => l.timeSlotId))
  return slots.filter(s => s.sempreVisibile || usati.has(s.id))
}
