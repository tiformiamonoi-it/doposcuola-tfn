// Per le pagine che il tutor condivide con Super Tutor e Admin (/area-tutor e il profilo):
// il TUTOR le vede nella veste nuova (layout "tutor"), gli altri restano sul gestionale
// di sempre (layout default). Si decide qui, prima di disegnare la pagina, così anche
// la pagina preparata dal server esce già con la veste giusta (niente lampo dell'altra).
export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()
  if (user.value?.role === 'TUTOR') setPageLayout('tutor')
})
