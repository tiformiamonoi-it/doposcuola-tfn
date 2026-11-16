<template>
  <!-- BENVENUTO (primo accesso) e NOVITÀ (chi ha già l'app), a schermo intero con le
       illustrazioni (bozze v6). Riusa il meccanismo di sempre: user.tutorialVisto con
       /api/auth/tutorial-visto, user.novitaVista con /api/auth/novita-vista, le schermate
       Novità scritte in shared/changelog.ts. "Rivedi il tutorial" nel Profilo usa lo
       stato condiviso 'tutorial-riapri', come prima. Dal 17/11/2026 anche per i tutor
       (layouts/tutor.vue), con schermate e bottoni loro. -->
  <div
    v-if="schermata"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="`pres-titolo-${indice}`"
    class="pf fixed inset-0 z-50 bg-white overflow-y-auto"
    @keydown.esc="chiudi"
  >
    <div class="mx-auto max-w-[440px] min-h-full flex flex-col">
      <div class="flex items-center justify-between px-5 pt-4">
        <span v-if="tipo === 'novita'" class="text-[13px] font-bold px-3 py-1.5 rounded-full bg-pf-crema text-pf-crema-testo">Novità</span>
        <span v-else class="text-[17px] font-bold tracking-tight text-pf-testo" style="font-family: Helvetica, Arial, sans-serif">
          ti<span class="text-pf-blu">formiamo</span>noi.it
        </span>
        <button
          ref="tastoSalta"
          type="button"
          aria-label="Salta"
          class="size-11 rounded-full bg-pf-fondo text-pf-grigio-scuro flex items-center justify-center hover:bg-pf-bordo"
          :disabled="chiudendo"
          @click="chiudi"
        >
          <UIcon name="i-heroicons-x-mark" class="size-5" aria-hidden="true" />
        </button>
      </div>

      <div class="mx-4 mt-4 h-[clamp(260px,50vh,430px)] rounded-[36px] bg-tfn-100 relative overflow-hidden flex items-center justify-center">
        <span aria-hidden="true" class="absolute -top-[70px] -right-20 size-60 rounded-full bg-tfn-200" />
        <span aria-hidden="true" class="absolute left-[34px] top-14 size-[26px] rounded-full bg-pf-giallo" />
        <span aria-hidden="true" class="absolute left-[60px] bottom-[50px] size-3.5 rounded-full bg-pf-blu-bolla" />
        <img :src="`/portale/${schermata.immagine}`" alt="" class="relative max-w-[86%] max-h-[80%] object-contain" />
      </div>

      <div class="px-7 pt-7 flex flex-col gap-3.5">
        <div class="flex gap-1.5" aria-hidden="true">
          <span v-for="(_, i) in schermate" :key="i" class="h-2 rounded-full transition-all" :class="i === indice ? 'w-[26px] bg-pf-giallo' : 'w-2 bg-slate-300'" />
        </div>
        <p class="sr-only">Schermata {{ indice + 1 }} di {{ schermate.length }}</p>
        <h1 :id="`pres-titolo-${indice}`" class="font-heading text-[29px] leading-9 font-medium text-pf-testo">
          {{ schermata.titolo }} <span class="font-bold text-pf-blu">{{ schermata.evidenza }}</span>
        </h1>
        <p class="text-[17px] leading-[25px] text-pf-grigio-scuro">{{ schermata.testo }}</p>
      </div>

      <div class="flex-1 min-h-6" />
      <div class="px-5 pb-8">
        <PortaleBottone grande blocco :loading="chiudendo" @click="avanti">{{ etichettaBottone }}</PortaleBottone>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { novitaGiaVista, ultimaNovitaFamiglie, ultimaNovitaTutor } from '#shared/changelog'

type Schermata = { immagine: string; titolo: string; evidenza: string; testo: string }

// Il benvenuto: tre-quattro schermate, diverse per genitore, alunno e tutor. All'alunno niente
// schermata delle note: le note dei tutor le legge il genitore (deciso il 16/11/2026).
const BENVENUTO: Record<string, Schermata[]> = {
  GENITORE: [
    { immagine: 'scena-benvenuto.webp', titolo: 'Che bello', evidenza: 'averti qui!', testo: 'Il tuo doposcuola a Trapani ora sta anche nel telefono. Accompagniamo i tuoi ragazzi, passo dopo passo.' },
    { immagine: 'scena-calendario.webp', titolo: 'Prenotare è', evidenza: 'semplicissimo', testo: 'Scegli il giorno e le materie: la lezione è subito confermata. Un pensiero in meno per te.' },
    { immagine: 'scena-notifiche.webp', titolo: 'Restiamo', evidenza: 'sempre in contatto', testo: 'Quando un tutor scrive due righe sui tuoi ragazzi, lo sai subito. Nessuno viene lasciato indietro.' },
    { immagine: 'scena-card.webp', titolo: 'Un piccolo', evidenza: 'regalo per voi', testo: 'Ogni ragazzo iscritto ha la sua card: sconti nei negozi amici della zona.' },
  ],
  STUDENTE: [
    { immagine: 'scena-benvenuto.webp', titolo: 'Che bello', evidenza: 'averti qui!', testo: 'Il tuo doposcuola a Trapani ora sta anche nel telefono: lezioni, card e convenzioni sempre con te.' },
    { immagine: 'scena-calendario.webp', titolo: 'Prenotare è', evidenza: 'semplicissimo', testo: 'Scegli il giorno e le materie: la lezione è subito confermata.' },
    { immagine: 'scena-card.webp', titolo: 'Un piccolo', evidenza: 'regalo per te', testo: 'Hai la tua card studente: sconti nei negozi amici della zona.' },
  ],
  TUTOR: [
    { immagine: 'scena-benvenuto.webp', titolo: 'Benvenuto', evidenza: 'nella squadra!', testo: 'Da qui gestisci le tue lezioni, la disponibilità e le note sugli alunni. Tutto dal telefono, anche tra una lezione e l\'altra.' },
    { immagine: 'scena-calendario.webp', titolo: 'Le tue lezioni,', evidenza: 'giorno per giorno', testo: 'In Lezioni c\'è la griglia oraria di oggi: registra i tuoi alunni entro le 20:00. I giorni in cui ci sei li segni in Disponibilità, entro le 9:30 del giorno stesso.' },
    { immagine: 'scena-notifiche.webp', titolo: 'Due righe', evidenza: 'fanno la differenza', testo: 'Dopo la lezione scrivi una nota dalla Home. Può restare tra noi, oppure arrivare alla famiglia dopo che l\'ha letta la segreteria.' },
    { immagine: 'scena-card.webp', titolo: 'Un grazie', evidenza: 'anche per te', testo: 'Hai la tua card tutor: sconti nei negozi amici della zona. La trovi al centro del menu, e in Convenzioni vedi dove usarla.' },
  ],
}

const route = useRoute()
const { user, fetch: refreshSession } = useUserSession()
const ruolo = computed(() => user.value?.role ?? '')
const riapri = useState('tutorial-riapri', () => false)
// Il tutor ha le sue Novità (campo `tutorSchermate` del changelog), le famiglie le loro
const novita = computed(() => ruolo.value === 'TUTOR' ? ultimaNovitaTutor() : ultimaNovitaFamiglie())
// Chiusa in questa pagina: sparisce subito, senza aspettare il server
const chiusaOra = ref(false)
const chiudendo = ref(false)
const indice = ref(0)

const tipo = computed<'benvenuto' | 'novita' | null>(() => {
  const u = user.value
  if (!u || !['GENITORE', 'STUDENTE', 'TUTOR'].includes(u.role)) return null
  if (riapri.value) return 'benvenuto'
  if (chiusaOra.value) return null
  // Prima le cose obbligatorie: password, termini, autorizzazioni per i minori
  // (il tutor i termini non li ha: per lui termsAccepted è sempre vero)
  if (u.mustChangePassword === true || u.termsAccepted === false || route.path === '/portale/accetta-termini') return null
  if (u.tutorialVisto === false) return 'benvenuto'
  if (novita.value && !novitaGiaVista(novita.value.versione, u.novitaVista)) return 'novita'
  return null
})

// La schermata "il mensile" ha senso solo con la sezione pagamenti accesa: si chiede al
// server solo quando le Novità stanno per comparire a un genitore.
const { data: pagamenti, execute: caricaPagamenti } = useLazyFetch<{ attivi: boolean }>('/api/portal/pagamenti', { server: false, immediate: false })
watch(tipo, (t) => { if (t === 'novita' && ruolo.value === 'GENITORE') caricaPagamenti() }, { immediate: true })

const schermate = computed<Schermata[]>(() => {
  if (tipo.value === 'benvenuto') return BENVENUTO[ruolo.value] ?? []
  if (tipo.value === 'novita') {
    if (ruolo.value === 'TUTOR') return novita.value?.tutorSchermate ?? []
    return (novita.value?.famiglie ?? []).filter((s) => (!s.solo || s.solo === ruolo.value) && (!s.conPagamenti || pagamenti.value?.attivi === true))
  }
  return []
})
const schermata = computed(() => schermate.value[indice.value])
const ultima = computed(() => indice.value >= schermate.value.length - 1)

const etichettaBottone = computed(() => {
  if (tipo.value === 'novita') return ultima.value ? 'Entra nell\'app' : indice.value === 0 ? 'Scopri cosa c\'è di nuovo' : 'Avanti'
  // Le bozze dei tutor chiudono con "Iniziamo", quelle delle famiglie con "Iniziamo insieme"
  if (ultima.value) return ruolo.value === 'TUTOR' ? 'Iniziamo' : 'Iniziamo insieme'
  return 'Avanti'
})

// Il fuoco va sul tasto "Salta" quando la presentazione compare: chi usa la tastiera
// o un lettore di schermo parte da dentro la finestra, non dalla pagina dietro.
const tastoSalta = ref<HTMLButtonElement | null>(null)
watch(() => !!schermata.value, async (aperta) => { if (aperta) { await nextTick(); tastoSalta.value?.focus() } }, { immediate: true })

function avanti() {
  if (ultima.value) return chiudi()
  indice.value++
}

async function chiudi() {
  const era = tipo.value
  indice.value = 0
  if (riapri.value) {
    riapri.value = false
    // Riaperto dal Profilo da chi l'aveva già visto: basta chiudere
    if (user.value?.tutorialVisto !== false) return
  }
  chiusaOra.value = true
  chiudendo.value = true
  try {
    if (era === 'benvenuto') await $fetch('/api/auth/tutorial-visto', { method: 'POST' })
    else if (era === 'novita' && novita.value) await $fetch('/api/auth/novita-vista', { method: 'POST', body: { versione: novita.value.versione } })
    await refreshSession()
  } catch {
    // Se fallisce ricomparirà al prossimo caricamento: non blocca nulla
  } finally {
    chiudendo.value = false
  }
}
</script>
