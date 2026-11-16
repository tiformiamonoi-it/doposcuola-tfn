// Su iPhone Safari lo stato :active (il bottone che si schiaccia o si schiarisce, vedi main.css)
// scatta al tocco solo se la pagina ascolta il touchstart: basta un ascoltatore vuoto.
export default defineNuxtPlugin(() => {
  document.addEventListener('touchstart', () => {}, { passive: true })
})
