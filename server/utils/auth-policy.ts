// Mappa di policy per le route API.
// Per ogni prefisso path, i ruoli ammessi. La prima corrispondenza vince.
// Le route NON elencate ricadono nel default: solo staff interno.

type Role = 'ADMIN' | 'SUPER_TUTOR' | 'TUTOR' | 'GENITORE' | 'STUDENTE'

const STAFF: Role[] = ['ADMIN', 'SUPER_TUTOR', 'TUTOR']
const ADMIN_SUPER: Role[] = ['ADMIN', 'SUPER_TUTOR']
const ADMIN_ONLY: Role[] = ['ADMIN']
const FAMIGLIA: Role[] = ['GENITORE', 'STUDENTE']

// Path pubblici: nessun login richiesto
export const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/forgot-password', // recupero password self-service (rate-limited)
  '/api/_auth/session', // gestito da nuxt-auth-utils
  '/api/contact',       // endpoint pubblico del form
]

// Regole ordinate: la PRIMA che matcha decide i ruoli ammessi.
// `mutationRoles` (opzionale): ruoli ammessi per i metodi di scrittura (POST/PUT/PATCH/DELETE);
// se assente, `roles` vale per tutti i metodi.
export const API_POLICY: Array<{ prefix: string; roles: Role[]; mutationRoles?: Role[] }> = [
  // Endpoint auth accessibili anche a genitori/studenti (il default STAFF li escluderebbe)
  { prefix: '/api/auth/change-password',    roles: [...STAFF, ...FAMIGLIA] },
  { prefix: '/api/auth/accept-terms',       roles: FAMIGLIA },
  { prefix: '/api/auth/tutorial-visto',     roles: [...STAFF, ...FAMIGLIA] },
  { prefix: '/api/auth/logout',             roles: [...STAFF, ...FAMIGLIA] },
  { prefix: '/api/accounting',              roles: ADMIN_ONLY },
  // Portale: GENITORE/STUDENTE + ADMIN/SUPER in preview (gli handler restituiscono [] agli altri)
  { prefix: '/api/portal',                  roles: [...FAMIGLIA, 'ADMIN', 'SUPER_TUTOR'] },
  { prefix: '/api/admin',                   roles: ADMIN_SUPER },
  { prefix: '/api/tutors/availabilities',   roles: STAFF },
  { prefix: '/api/tutors/today-pool',       roles: STAFF },
  { prefix: '/api/tutor-payments',          roles: ADMIN_SUPER },
  { prefix: '/api/notes',                   roles: STAFF },
  // Lettura studenti aperta allo STAFF (i dati dei genitori vengono rimossi per i TUTOR
  // nei handler GET); scritture (crea/modifica/disattiva/anonimizza) solo ADMIN/SUPER.
  { prefix: '/api/students',                roles: STAFF, mutationRoles: ADMIN_SUPER },
  // Lettura pacchetti aperta allo STAFF (serve al tutor per scalare le ore in una lezione),
  // ma i campi economici vengono rimossi per i TUTOR nei handler GET; scritture solo ADMIN/SUPER.
  { prefix: '/api/packages',                roles: STAFF, mutationRoles: ADMIN_SUPER },
  { prefix: '/api/standard-packages',       roles: ADMIN_SUPER },
  // I tutor possono creare/modificare solo le proprie lezioni del giorno, entro le 20:00
  // (controllo granulare dentro service/handler) — la policy qui apre solo l'accesso di massima.
  { prefix: '/api/lessons',                 roles: STAFF },
  { prefix: '/api/payments',                roles: ADMIN_SUPER },
  { prefix: '/api/settings/timeslots',      roles: STAFF, mutationRoles: ADMIN_SUPER },
  { prefix: '/api/settings',                roles: ADMIN_SUPER },
  { prefix: '/api/matching',                roles: ADMIN_SUPER },
  { prefix: '/api/tutors',                  roles: ADMIN_SUPER },
]

const DEFAULT_ROLES: Role[] = STAFF

// Endpoint interni consentiti senza login, per prefisso ESPLICITO (non tutto /api/_:
// una futura route /api/_qualcosa non deve nascere pubblica per convenzione di nome).
// - /api/_auth/     → sessione nuxt-auth-utils
// - /api/_nuxt_icon → icone @nuxt/icon (servono anche sulla pagina /login)
// - /api/_cron/     → job schedulati, self-protetti con CRON_SECRET
const INTERNAL_PUBLIC_PREFIXES = ['/api/_auth/', '/api/_nuxt_icon', '/api/_cron/']

export function isPublicApi(path: string): boolean {
  if (INTERNAL_PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return true
  return PUBLIC_API_PREFIXES.some((p) => path.startsWith(p))
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function allowedRolesFor(path: string, method = 'GET'): Role[] {
  const rule = API_POLICY.find((r) => path.startsWith(r.prefix))
  if (!rule) return DEFAULT_ROLES
  if (rule.mutationRoles && MUTATION_METHODS.has(method.toUpperCase())) return rule.mutationRoles
  return rule.roles
}
