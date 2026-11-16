<template>
  <div>
    <!-- Testata semplice, come nella bozza 9: Indietro e titolo, senza fascia blu -->
    <header class="flex items-center gap-3 px-5 pt-4 pb-2">
      <NuxtLink to="/portale" aria-label="Torna alla Home" class="size-11 shrink-0 rounded-[14px] bg-white border border-pf-bordo text-pf-testo flex items-center justify-center hover:bg-pf-fondo">
        <UIcon name="i-heroicons-chevron-left" class="size-5" aria-hidden="true" />
      </NuxtLink>
      <h1 class="font-heading font-bold text-xl">Paga il mensile</h1>
    </header>

    <USkeleton v-if="pending" class="mx-5 mt-3 h-40 rounded-3xl" />

    <!-- Interruttore spento in Impostazioni: la sezione c'è, ma dice "In arrivo" -->
    <section v-else-if="!dati?.attivi" class="mx-5 mt-3 p-6 rounded-3xl bg-white border border-pf-bordo flex flex-col items-center gap-3 text-center">
      <img src="/portale/portafoglio.webp" alt="" class="size-24 object-contain" />
      <PortaleStato tono="crema">In arrivo</PortaleStato>
      <h2 class="font-heading font-bold text-lg">Presto potrai pagare da qui</h2>
      <p class="text-sm leading-5 text-pf-grigio-scuro">Per ora i pagamenti si fanno come sempre, in segreteria.</p>
    </section>

    <template v-else>
      <p v-if="daSaldare.length === 0" class="mx-5 mt-3 p-5 rounded-3xl bg-white border border-pf-bordo text-sm text-pf-grigio-scuro flex items-center gap-3">
        <UIcon name="i-heroicons-check-circle" class="size-6 shrink-0 text-pf-verde" aria-hidden="true" />
        Niente da saldare: è tutto in ordine.
      </p>

      <!-- Cosa pagare: un riquadro per pacchetto, con importo e causale da copiare -->
      <section
        v-for="p in daSaldare"
        :key="p.id"
        :aria-label="`Da pagare per ${p.nomeAlunno}`"
        class="mx-5 mt-3 p-5 rounded-3xl bg-white border border-pf-bordo flex flex-col gap-3.5"
      >
        <div class="flex items-center gap-3">
          <PortaleAvatar :nome="p.nomeAlunno" :indice="p.indice" />
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-base truncate">{{ p.nomeAlunno }}</p>
            <p class="text-[13px] text-pf-grigio truncate">{{ p.nome }}</p>
          </div>
          <PortaleStato tono="rosso">Da pagare</PortaleStato>
        </div>
        <div class="flex items-center justify-between gap-3 pt-3.5 border-t border-pf-bordo">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm text-pf-grigio">Importo</span>
            <span class="font-heading font-bold text-[26px]">{{ euro(p.importo) }}</span>
          </div>
          <img src="/portale/portafoglio.webp" alt="" class="size-[72px] object-contain" />
        </div>
        <div class="flex items-center gap-3 pt-3 border-t border-pf-fondo">
          <div class="flex-1 min-w-0">
            <p class="text-xs text-pf-grigio">Causale</p>
            <p class="text-[15px] font-medium break-words">{{ p.causale }}</p>
          </div>
          <button type="button" :aria-label="`Copia la causale per ${p.nomeAlunno}`" class="size-11 shrink-0 rounded-xl bg-pf-celeste text-pf-blu flex items-center justify-center hover:bg-pf-cielo" @click="copia(p.causale, 'Causale copiata')">
            <UIcon name="i-heroicons-document-duplicate" class="size-5" aria-hidden="true" />
          </button>
        </div>
      </section>

      <section aria-labelledby="t-bonifico" class="mx-5 mt-4 p-5 rounded-3xl bg-white border border-pf-bordo flex flex-col gap-1">
        <h2 id="t-bonifico" class="font-semibold text-base mb-2">Paga con bonifico</h2>
        <div class="flex items-center gap-3 py-2.5 border-b border-pf-fondo">
          <div class="flex-1 min-w-0">
            <p class="text-xs text-pf-grigio">Intestatario</p>
            <p class="text-[15px] font-medium">{{ dati.intestatario || '—' }}</p>
          </div>
          <button v-if="dati.intestatario" type="button" aria-label="Copia l'intestatario" class="size-11 shrink-0 rounded-xl bg-pf-celeste text-pf-blu flex items-center justify-center hover:bg-pf-cielo" @click="copia(dati.intestatario, 'Intestatario copiato')">
            <UIcon name="i-heroicons-document-duplicate" class="size-5" aria-hidden="true" />
          </button>
        </div>
        <div class="flex items-center gap-3 py-2.5">
          <div class="flex-1 min-w-0">
            <p class="text-xs text-pf-grigio">IBAN</p>
            <p class="font-mono text-[15px] font-semibold tracking-wide break-all">{{ ibanLeggibile || '—' }}</p>
          </div>
          <button v-if="dati.iban" type="button" aria-label="Copia l'IBAN" class="size-11 shrink-0 rounded-xl bg-pf-celeste text-pf-blu flex items-center justify-center hover:bg-pf-cielo" @click="copia(dati.iban, 'IBAN copiato')">
            <UIcon name="i-heroicons-document-duplicate" class="size-5" aria-hidden="true" />
          </button>
        </div>
        <PortaleBottone v-if="dati.iban" variante="blu" blocco class="mt-2.5" @click="copia(tuttiIDati, 'Dati del bonifico copiati')">Copia tutti i dati</PortaleBottone>
      </section>

      <p class="mx-5 mt-4 px-4 py-3.5 rounded-2xl bg-pf-celeste flex gap-3 items-start text-[13px] leading-[19px] text-pf-blu-scuro">
        <UIcon name="i-heroicons-information-circle" class="size-5 shrink-0" aria-hidden="true" />
        Il pagamento risulterà nell'app quando la segreteria lo avrà registrato: di solito entro qualche giorno dal bonifico.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
// PAGA IL MENSILE (schermata 9). Solo il genitore: l'alunno non vede importi (privacy
// economica) e il server gli risponde comunque "sezione chiusa".
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Paga il mensile — Portale Famiglie' })

const { user } = useUserSession()
if (user.value?.role === 'STUDENTE') await navigateTo('/portale', { replace: true })

type Pagamenti =
  | { attivi: false }
  | {
      attivi: true
      intestatario: string
      iban: string
      figli: { studentId: string; nome: string; pacchetti: { id: string; nome: string; importo: number; causale: string }[] }[]
    }

const { data: dati, pending } = useLazyFetch<Pagamenti>('/api/portal/pagamenti')
const toast = useToast()

const daSaldare = computed(() => dati.value?.attivi
  ? dati.value.figli.flatMap((f, indice) => f.pacchetti.map((p) => ({ ...p, nomeAlunno: f.nome, indice })))
  : [])

// IT60X0542811101000000123456 → IT60 X054 2811 … : a gruppi di 4 si ricontrolla a occhio
const ibanLeggibile = computed(() => (dati.value?.attivi ? dati.value.iban.replace(/(.{4})/g, '$1 ').trim() : ''))
const euro = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

const tuttiIDati = computed(() => {
  if (!dati.value?.attivi) return ''
  return [
    `Intestatario: ${dati.value.intestatario}`,
    `IBAN: ${dati.value.iban}`,
    ...daSaldare.value.map((p) => `${euro(p.importo)} — causale: ${p.causale}`),
  ].join('\n')
})

async function copia(testo: string, messaggio: string) {
  try {
    await navigator.clipboard.writeText(testo)
    toast.add({ title: messaggio, color: 'success' })
  } catch {
    // Browser senza appunti (pagina non sicura, permesso negato): il testo resta lì da selezionare
    toast.add({ title: 'Copia non riuscita', description: 'Tieni premuto sul testo per selezionarlo.', color: 'warning' })
  }
}
</script>
