// Genera una password casuale leggibile (esclude caratteri ambigui: 0/O, 1/l/I)
// Usata per la password iniziale dei tutor e per i reset da parte dell'admin.
export function generaPasswordCasuale(lunghezza = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint32Array(lunghezza)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}
