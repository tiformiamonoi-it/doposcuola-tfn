<template>
  <!-- Grafica v6 (schermata 10). Tutto dal nostro sito: logo, caratteri e icone disegnate
       qui sotto. Il codice sta nell'indirizzo, la pagina non chiama nessun altro sito. -->
  <div class="min-h-screen bg-white text-pf-testo font-sans flex justify-center">
    <div class="w-full max-w-md min-h-screen flex flex-col">
      <header class="px-5 py-4 border-b border-pf-bordo flex items-center justify-between">
        <img src="/logo.svg" alt="tiformiamonoi.it" class="h-10 w-auto" />
        <span class="text-xs text-pf-grigio">Verifica card</span>
      </header>

      <main class="px-5 pt-8 flex flex-col items-center gap-3.5 text-center">
        <!-- "idle" conta come attesa: col fetch solo dal browser il server non chiede niente
             (stato idle) e deve disegnare lo stesso scheletro che il telefono disegna mentre
             chiede (pending). Con `pending` il server disegnava "Card non valida", il telefono
             lo scheletro: Vue trovava due pagine diverse e il riquadro restava vuoto. -->
        <USkeleton v-if="status === 'idle' || status === 'pending'" class="h-72 w-full rounded-[20px]" />

        <div v-else-if="esito?.valida" class="w-full flex flex-col items-center gap-3.5" role="status">
          <span class="size-24 rounded-full bg-pf-verde-chiaro text-pf-verde flex items-center justify-center" aria-hidden="true">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
          </span>
          <h1 class="font-heading font-bold text-[28px] text-pf-verde">Card valida</h1>
          <p class="text-[15px] text-pf-grigio-scuro">Puoi applicare lo sconto della convenzione.</p>
          <dl class="mt-2.5 w-full px-4 py-1.5 rounded-[20px] bg-pf-fondo flex flex-col divide-y divide-pf-bordo text-sm">
            <div class="flex justify-between gap-3 py-3">
              <dt class="text-pf-grigio">{{ esito.tipo === 'GENITORE' ? 'Genitore' : esito.tipo === 'TUTOR' ? 'Tutor' : 'Studente' }}</dt>
              <dd class="font-semibold">{{ esito.nome }} {{ esito.inizialeCognome }}.</dd>
            </div>
            <div v-if="esito.validaFino" class="flex justify-between gap-3 py-3">
              <dt class="text-pf-grigio">Valida fino al</dt>
              <dd class="font-semibold">{{ giorno(esito.validaFino) }}</dd>
            </div>
          </dl>
        </div>

        <div v-else class="w-full flex flex-col items-center gap-3.5" role="status">
          <span
            class="size-24 rounded-full flex items-center justify-center"
            :class="error?.statusCode === 429 ? 'bg-pf-bordo text-pf-grigio-scuro' : 'bg-pf-rosso-chiaro text-pf-rosso'"
            aria-hidden="true"
          >
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </span>
          <h1 class="font-heading font-bold text-[28px]" :class="error?.statusCode === 429 ? 'text-pf-grigio-scuro' : 'text-pf-rosso'">
            {{ error?.statusCode === 429 ? 'Troppi controlli' : 'Card non valida' }}
          </h1>
          <p class="text-[15px] text-pf-grigio-scuro">
            {{ error?.statusCode === 429 ? 'Riprova tra qualche minuto.' : 'In questo caso lo sconto non si applica.' }}
          </p>
        </div>

        <!-- L'ora la scrive il server: una foto vecchia della pagina si riconosce dall'ora -->
        <p v-if="esito" class="text-xs text-pf-grigio">Controllo del {{ esito.controllatoAlle }}</p>
      </main>

      <p class="mt-auto px-5 pt-8 pb-6 text-xs leading-[17px] text-pf-grigio text-center">
        Per la privacy dello studente, qui compaiono solo il nome, l'iniziale del cognome e la scadenza.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
// LA PAGINA DEL NEGOZIO (schermata 10). Pubblica: la apre il telefono di chi inquadra il QR.
// Mostra solo valida sì/no, nome, iniziale del cognome, "valida fino al" e l'ora del
// controllo (regolamento, art. 6.1). Nessun motivo, nessun altro dato.
definePageMeta({ layout: false })
useHead({ title: 'Verifica Card studente — tiformiamonoi', meta: [{ name: 'robots', content: 'noindex' }] })

const route = useRoute()

type Esito =
  | { valida: true; tipo: 'STUDENTE' | 'GENITORE' | 'TUTOR'; nome: string; inizialeCognome: string; validaFino: string | null; controllatoAlle: string }
  | { valida: false; controllatoAlle: string }

// Solo dal browser (server: false): così ogni apertura è un controllo nuovo, fatto
// adesso, e il limite di tentativi conta l'indirizzo vero del telefono del negozio.
const { data: esito, status, error } = useFetch<Esito>(
  () => `/api/verifica-card/${encodeURIComponent(String(route.params.codice ?? ''))}`,
  { server: false },
)

const giorno = (g: string) => g.split('-').reverse().join('/')
</script>
