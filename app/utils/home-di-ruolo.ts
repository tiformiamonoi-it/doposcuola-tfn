// Pagina "casa" di ogni ruolo. Usata dai middleware quando un utente finisce
// su una pagina non sua: mai rimandare a una rotta che lo respingerebbe di
// nuovo, altrimenti si crea un loop infinito di redirect (bug del 14/07/2026:
// TUTOR su "/" veniva rimandato a "/" all'infinito).
export function homeDiRuolo(role?: string): string {
  if (role === 'ADMIN' || role === 'SUPER_TUTOR') return '/'
  if (role === 'TUTOR') return '/area-tutor'
  if (role === 'GENITORE' || role === 'STUDENTE') return '/portale'
  return '/login'
}
