// Genera un cookie di sessione ADMIN valido per test locale (stessa password del .env)
import * as Iron from 'iron-webcrypto'
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'

const env = readFileSync('.env', 'utf8')
const password = env.match(/^NUXT_SESSION_PASSWORD\s*=\s*"?([^"\r\n]+)"?/m)?.[1]
if (!password) { console.error('password mancante'); process.exit(1) }

const session = {
  id: 'debugsession',
  createdAt: Date.now(),
  data: {
    user: {
      id: 'debug-admin',
      email: 'debug@local',
      firstName: 'Debug',
      lastName: 'Admin',
      role: 'ADMIN',
      linkedStudentIds: [],
      mustChangePassword: false,
      termsAccepted: true,
      tutorialVisto: true,
    },
  },
}

const sealed = await Iron.seal(webcrypto, session, password, { ...Iron.defaults, ttl: 0 })
console.log(sealed)
