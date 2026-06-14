// Mappa di policy per le route API.
// Per ogni prefisso path, i ruoli ammessi. La prima corrispondenza vince.
// Le route NON elencate ricadono nel default: solo staff interno.

type Role = 'ADMIN' | 'SUPER_TUTOR' | 'TUTOR' | 'GENITORE'

const STAFF: Role[] = ['ADMIN', 'SUPER_TUTOR', 'TUTOR']
const ADMIN_SUPER: Role[] = ['ADMIN', 'SUPER_TUTOR']
const ADMIN_ONLY: Role[] = ['ADMIN']
const GENITORE_ONLY: Role[] = ['GENITORE']

// Path pubblici: nessun login richiesto
export const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/_auth/session', // gestito da nuxt-auth-utils
]

// Regole ordinate: la PRIMA che matcha decide i ruoli ammessi
export const API_POLICY: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/api/accounting',              roles: ADMIN_ONLY },
  { prefix: '/api/portal',                  roles: GENITORE_ONLY },
  { prefix: '/api/admin',                   roles: ADMIN_SUPER },
  { prefix: '/api/tutors/availabilities',   roles: STAFF },
  { prefix: '/api/notes',                   roles: STAFF },
  { prefix: '/api/students',                roles: STAFF },
  { prefix: '/api/packages',                roles: ADMIN_SUPER },
  { prefix: '/api/standard-packages',       roles: ADMIN_SUPER },
  { prefix: '/api/lessons',                 roles: ADMIN_SUPER },
  { prefix: '/api/payments',                roles: ADMIN_SUPER },
  { prefix: '/api/settings',                roles: ADMIN_SUPER },
  { prefix: '/api/matching',                roles: ADMIN_SUPER },
  { prefix: '/api/tutors',                  roles: ADMIN_SUPER },
]

const DEFAULT_ROLES: Role[] = STAFF

export function isPublicApi(path: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => path.startsWith(p))
}

export function allowedRolesFor(path: string): Role[] {
  const rule = API_POLICY.find((r) => path.startsWith(r.prefix))
  return rule?.roles ?? DEFAULT_ROLES
}
