<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
    <div class="w-full max-w-sm text-center">
      <p class="font-heading font-semibold text-tfn-600 mb-6">tiformiamonoi.it · Card studente</p>

      <!-- "idle" conta come attesa: col fetch solo dal browser il server non chiede niente
           (stato idle) e deve disegnare lo stesso scheletro che il telefono disegna mentre
           chiede (pending). Con `pending` il server disegnava "Card non valida", il telefono
           lo scheletro: Vue trovava due pagine diverse e il riquadro restava vuoto. -->
      <USkeleton v-if="status === 'idle' || status === 'pending'" class="h-56 w-full rounded-2xl" />

      <div
        v-else-if="esito?.valida"
        class="rounded-2xl border-2 border-green-500 bg-white p-6 shadow-sm"
        role="status"
      >
        <UIcon name="i-heroicons-check-circle" class="w-16 h-16 text-green-600 mx-auto" />
        <p class="text-2xl font-bold text-green-700 mt-2">Card valida</p>
        <p class="text-xl font-semibold text-slate-900 mt-4">{{ esito.nome }} {{ esito.inizialeCognome }}.</p>
        <p v-if="esito.validaFino" class="text-sm text-slate-600 mt-1">Valida fino al {{ giorno(esito.validaFino) }}</p>
      </div>

      <div v-else class="rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm" role="status">
        <UIcon name="i-heroicons-x-circle" class="w-16 h-16 text-slate-500 mx-auto" />
        <p class="text-2xl font-bold text-slate-700 mt-2">
          {{ error?.statusCode === 429 ? 'Troppi controlli' : 'Card non valida' }}
        </p>
        <p v-if="error?.statusCode === 429" class="text-sm text-slate-600 mt-2">Riprova tra qualche minuto.</p>
      </div>

      <!-- L'ora la scrive il server: una foto vecchia della pagina si riconosce dall'ora -->
      <p v-if="esito" class="text-sm text-slate-500 mt-4">Controllo del {{ esito.controllatoAlle }}</p>
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
  | { valida: true; nome: string; inizialeCognome: string; validaFino: string | null; controllatoAlle: string }
  | { valida: false; controllatoAlle: string }

// Solo dal browser (server: false): così ogni apertura è un controllo nuovo, fatto
// adesso, e il limite di tentativi conta l'indirizzo vero del telefono del negozio.
const { data: esito, status, error } = useFetch<Esito>(
  () => `/api/verifica-card/${encodeURIComponent(String(route.params.codice ?? ''))}`,
  { server: false },
)

const giorno = (g: string) => g.split('-').reverse().join('/')
</script>
