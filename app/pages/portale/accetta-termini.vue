<template>
  <div>
    <PortaleTestata :campanella="false">
      <template #titolo>
        <div class="flex items-center gap-3">
          <div class="flex-1 flex flex-col gap-1.5">
            <h1 class="font-heading text-[25px] leading-[31px] font-medium">
              {{ titolo }}<template v-if="(isStudente || serveTermini) && user?.firstName">, <span class="font-bold">{{ user.firstName }}</span></template>
            </h1>
            <p class="text-sm leading-5 text-pf-su-blu">{{ sottotitolo }}</p>
          </div>
          <img src="/portale/libri.webp" alt="" class="size-20 shrink-0 object-contain" />
        </div>
      </template>
    </PortaleTestata>

    <div class="px-5 pt-[22px] flex flex-col gap-3.5">
      <!-- I documenti da leggere: un estratto, e "Leggi tutto" apre il testo completo sul posto -->
      <section v-for="d in documenti" :key="d.id" :aria-labelledby="`t-${d.id}`" class="bg-white rounded-[22px] p-4 flex flex-col gap-2.5 pf-ombra">
        <h2 :id="`t-${d.id}`" class="font-semibold text-base">{{ d.titolo }}</h2>
        <div
          :id="`testo-${d.id}`"
          class="text-[13px] leading-[19px] text-pf-grigio-scuro p-3 rounded-[14px] bg-pf-fondo whitespace-pre-wrap"
          :class="aperti[d.id] ? 'max-h-80 overflow-y-auto' : 'max-h-[76px] overflow-hidden'"
          :tabindex="aperti[d.id] ? 0 : undefined"
        >{{ d.testo }}</div>
        <button type="button" class="self-start min-h-11 text-sm font-semibold text-pf-blu hover:text-pf-blu-scuro" :aria-expanded="!!aperti[d.id]" :aria-controls="`testo-${d.id}`" @click="() => { aperti[d.id] = !aperti[d.id] }">
          {{ aperti[d.id] ? 'Riduci' : 'Leggi tutto' }}<span class="sr-only"> {{ d.titolo }}</span>
        </button>
      </section>

      <!-- Il regolamento della card si legge, non si accetta (piano, sintesi legale) -->
      <NuxtLink v-if="!isStudente && serveTermini" to="/regolamento-card" class="bg-white rounded-[22px] px-4 min-h-14 flex items-center gap-3 pf-ombra hover:text-pf-blu">
        <img src="/portale/tessera.webp" alt="" class="size-9 object-contain" />
        <span class="flex-1 font-semibold text-[15px]">Regolamento della card</span>
        <UIcon name="i-heroicons-chevron-right" class="size-5 text-pf-grigio" aria-hidden="true" />
      </NuxtLink>

      <!-- Le conferme -->
      <section aria-label="Conferme" class="bg-white rounded-[22px] px-4 py-[18px] flex flex-col gap-3.5 pf-ombra">
        <template v-if="isStudente">
          <label class="flex gap-3 items-start text-[15px] leading-[21px] min-h-11 cursor-pointer">
            <input v-model="accettoPrivacy" type="checkbox" class="size-[22px] shrink-0 mt-px accent-pf-blu" />
            Ho letto e capito l'informativa privacy
          </label>
        </template>
        <template v-else>
          <template v-if="serveTermini">
            <label class="flex gap-3 items-start text-[15px] leading-[21px] min-h-11 cursor-pointer">
              <input v-model="accettoTermini" type="checkbox" class="size-[22px] shrink-0 mt-px accent-pf-blu" />
              Ho letto e accetto i Termini e condizioni
            </label>
            <label class="flex gap-3 items-start text-[15px] leading-[21px] min-h-11 cursor-pointer">
              <input v-model="accettoPrivacy" type="checkbox" class="size-[22px] shrink-0 mt-px accent-pf-blu" />
              Ho letto l'Informativa privacy
            </label>
          </template>
          <label v-for="figlio in dichiarazioni" :key="figlio.id" class="flex gap-3 items-start text-[15px] leading-[21px] min-h-11 cursor-pointer">
            <input v-model="firmate[figlio.id]" type="checkbox" class="size-[22px] shrink-0 mt-px accent-pf-blu" />
            Autorizzo il trattamento dei dati di {{ figlio.nome }} come dichiarato qui sopra
          </label>
        </template>
        <p v-if="errorMsg" role="alert" class="text-sm text-pf-rosso">{{ errorMsg }}</p>
      </section>
    </div>

    <div class="px-5 pt-4 pb-4 flex flex-col gap-2">
      <PortaleBottone grande blocco :disabled="!tuttoSpuntato" :loading="saving" @click="accetta">
        {{ isStudente ? 'Accetto e continuo' : 'Accetta e continua' }}
      </PortaleBottone>
      <p v-if="!isStudente" class="text-xs text-pf-grigio text-center">Le scelte facoltative (foto, offerte) le trovi poi nel Profilo.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  TERMINI_TESTO, PRIVACY_TESTO, PRIVACY_STUDENTE_TESTO,
  TERMS_VERSION, PRIVACY_STUDENTE_VERSION, testoConsensoMinore14,
} from '#shared/legal'

// PRIMO ACCESSO: TERMINI (schermata 13). Viene prima di tutto il resto, quindi senza menu.
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
  senzaMenu: true,
})
useHead({ title: 'Termini e privacy — Portale Famiglie' })

const { user, fetch: refreshSession } = useUserSession()
const isStudente = computed(() => user.value?.role === 'STUDENTE')

// Le due cose che possono mancare, separate: un genitore che ha già accettato i
// documenti mesi fa e oggi iscrive un figlio di 11 anni vede SOLO la dichiarazione.
const serveTermini  = computed(() => user.value?.termsAccepted === false)
const dichiarazioni = computed(() => (isStudente.value ? [] : user.value?.dichiarazioniMinori ?? []))

const titolo = computed(() => {
  if (isStudente.value) return 'Ciao'
  return serveTermini.value ? 'Benvenuto' : 'Un\'ultima autorizzazione'
})

const sottotitolo = computed(() => {
  if (isStudente.value) return 'Prima di usare il portale leggi come usiamo i tuoi dati.'
  if (!serveTermini.value) return 'Serve la tua autorizzazione per i figli che non hanno ancora 14 anni.'
  return 'Prima di iniziare, leggi e accetta questi documenti. Ci vuole un minuto.'
})

// Una dichiarazione per ciascun figlio sotto i 14 anni: il testo dice su CHI la si fa
const documenti = computed(() => {
  if (isStudente.value) return [{ id: 'privacy-studente', titolo: 'Informativa privacy per studenti', testo: PRIVACY_STUDENTE_TESTO }]
  return [
    ...(serveTermini.value
      ? [
          { id: 'termini', titolo: 'Termini e condizioni', testo: TERMINI_TESTO },
          { id: 'privacy', titolo: 'Informativa privacy', testo: PRIVACY_TESTO },
        ]
      : []),
    ...dichiarazioni.value.map((f) => ({ id: `minore-${f.id}`, titolo: `Autorizzazione per ${f.nome}`, testo: testoConsensoMinore14(f.nome) })),
  ]
})
const aperti = reactive<Record<string, boolean>>({})

const accettoTermini = ref(false)
const accettoPrivacy = ref(false)
// Una spunta per ciascun figlio da autorizzare, per id
const firmate = reactive<Record<string, boolean>>({})
const errorMsg = ref('')
const saving = ref(false)

const tuttoSpuntato = computed(() => {
  if (isStudente.value) return accettoPrivacy.value
  if (serveTermini.value && !(accettoTermini.value && accettoPrivacy.value)) return false
  return dichiarazioni.value.every((f) => firmate[f.id] === true)
})

async function accetta() {
  errorMsg.value = ''
  saving.value = true
  try {
    await $fetch('/api/auth/accept-terms', {
      method: 'POST',
      body: {
        // La versione si manda solo se i documenti vanno davvero accettati adesso:
        // rimandarla a vuoto riscriverebbe la data di accettazione di chi l'ha già data.
        version: isStudente.value
          ? PRIVACY_STUDENTE_VERSION
          : (serveTermini.value ? TERMS_VERSION : undefined),
        dichiarazioni: dichiarazioni.value.map((f) => f.id),
      },
    })
    await refreshSession()
    await navigateTo('/portale')
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage ?? 'Errore durante il salvataggio, riprova'
  } finally {
    saving.value = false
  }
}
</script>
