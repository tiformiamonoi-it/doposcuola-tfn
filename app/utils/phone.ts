/**
 * Normalizza un numero di telefono italiano nel formato +39XXXXXXXXXX
 * Accetta qualsiasi formato di input (spazi, trattini, parentesi, prefissi vari)
 */
export function normalizzaTelefono(tel: string): string {
  if (!tel || !tel.trim()) return ''

  // Rimuovi spazi, trattini, punti, parentesi
  let t = tel.replace(/[\s\-\.\(\)]/g, '')

  // Rimuovi prefisso internazionale esistente
  if (t.startsWith('+39')) t = t.substring(3)
  else if (t.startsWith('0039')) t = t.substring(4)

  // Rimuovi eventuali caratteri non numerici rimasti
  t = t.replace(/\D/g, '')

  if (!t) return ''

  return '+39' + t
}
