// "La mia sessione vale ancora?" La chiede la pagina /login prima di rimandare a casa
// chi risulta già collegato. Il controllo vero lo fa la guardia (01.auth-guard), che
// passa da qui come da ogni altra API: account disattivato o password cambiata → 401.
// Se si arriva fin qui la sessione è buona.
export default defineEventHandler(() => ({ ok: true }))
