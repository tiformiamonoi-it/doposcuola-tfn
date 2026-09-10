import { z } from 'zod'

// LE REGOLE DELLA PASSWORD, IN UN POSTO SOLO.
// Sono esattamente le stesse già usate da /api/auth/change-password
// (minimo 8 caratteri, massimo 100): la pagina pubblica "scegli la tua password"
// non deve essere né più permissiva né più severa del cambio password interno,
// altrimenti un utente potrebbe impostare dal link una password che poi il
// gestionale rifiuterebbe.
export const NuovaPasswordSchema = z.string().min(8, 'Minimo 8 caratteri').max(100)

// Le stesse regole scritte in italiano semplice, da mostrare sotto i campi
export const REGOLE_PASSWORD = 'Almeno 8 caratteri. Scegli qualcosa che ricordi ma che nessun altro possa indovinare.'

export const ImpostaPasswordSchema = z.object({
  token:    z.string().min(1),
  password: NuovaPasswordSchema,
})

export type ImpostaPasswordInput = z.infer<typeof ImpostaPasswordSchema>
