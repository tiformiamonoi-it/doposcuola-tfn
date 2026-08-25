// Le funzioni vivono in shared/phone.ts (così le usa anche il server).
// Qui restano solo ri-esportate per nome: è la forma che l'auto-import di Nuxt
// riconosce, quindi nei template si continua a scrivere normalizzaTelefono(...)
// senza import espliciti, esattamente come prima.
export { normalizzaTelefono, sembraTelefono, sembraEmail } from '#shared/phone'
