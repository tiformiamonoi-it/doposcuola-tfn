// Telefoni ed email — UNICA FONTE per server e frontend.
// Il server importa con `#shared/phone`, il browser tramite `app/utils/phone.ts`
// (che ri-esporta queste funzioni per l'auto-import di Nuxt).

/**
 * Normalizza un numero di telefono italiano nel formato +39XXXXXXXXXX
 * Accetta qualsiasi formato di input (spazi, trattini, parentesi, prefissi vari)
 */
export function normalizzaTelefono(tel: string): string {
  if (!tel || !tel.trim()) return ''

  // Rimuovi spazi, trattini, punti, parentesi
  let t = tel.replace(/[\s\-.()]/g, '')

  // Rimuovi prefisso internazionale esistente
  if (t.startsWith('+39')) t = t.substring(3)
  else if (t.startsWith('0039')) t = t.substring(4)

  // Rimuovi eventuali caratteri non numerici rimasti
  t = t.replace(/\D/g, '')

  if (!t) return ''

  return '+39' + t
}

/**
 * Vero se il testo "sembra" un numero di telefono: solo cifre, spazi, +, -,
 * parentesi e punti, con almeno 6 cifre. Serve a smistare il campo unico
 * "contatto" del form pubblico /prenota nella colonna giusta.
 */
export function sembraTelefono(valore: string): boolean {
  const v = (valore ?? '').trim()
  if (!v) return false
  if (!/^[\d\s+\-.()]+$/.test(v)) return false
  return v.replace(/\D/g, '').length >= 6
}

/** Vero se il testo "sembra" un'email: contiene una @ e un punto dopo di essa. */
export function sembraEmail(valore: string): boolean {
  const v = (valore ?? '').trim()
  const at = v.indexOf('@')
  if (at <= 0) return false
  const dopo = v.slice(at + 1)
  const punto = dopo.indexOf('.')
  // il punto deve esserci, non subito dopo la @ e non come ultimo carattere
  return punto > 0 && punto < dopo.length - 1
}
