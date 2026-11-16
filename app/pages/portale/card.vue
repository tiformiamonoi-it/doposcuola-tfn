<template>
  <div>
    <PortaleTestata titolo="Card studente" sovrapposta>
      <!-- Un figlio per volta: bottoni veri, quello scelto è "premuto" -->
      <div v-if="cards.length > 1" role="group" aria-label="Scegli il figlio" class="p-1 bg-pf-blu-tasto rounded-[14px] grid gap-1" :style="{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }">
        <button
          v-for="c in cards"
          :key="c.id"
          type="button"
          :aria-pressed="c.id === scelta?.id"
          class="min-h-11 rounded-[11px] text-sm px-2 truncate transition-colors"
          :class="c.id === scelta?.id ? 'bg-white text-pf-blu font-semibold' : 'text-white font-medium hover:bg-pf-blu-scuro'"
          @click="() => { sceltaId = c.id }"
        >
          {{ c.firstName }}<template v-if="!c.attiva"> · {{ c.motivo === 'DISATTIVATA' ? 'disattivata' : 'sospesa' }}</template>
        </button>
      </div>
    </PortaleTestata>

    <USkeleton v-if="pending" class="relative -mt-[52px] mx-5 h-[214px] rounded-3xl" />

    <p v-else-if="!scelta" class="relative -mt-[52px] mx-5 bg-white rounded-3xl p-6 text-center text-sm text-pf-grigio-scuro pf-ombra-alta">
      Nessuna card da mostrare.
    </p>

    <div v-else>
      <!-- La card: blu notte se attiva, grigia se sospesa -->
      <section
        :aria-label="`Card di ${scelta.firstName} ${scelta.lastName}, ${scelta.attiva ? 'attiva' : 'sospesa'}`"
        class="relative -mt-[52px] mx-5 min-h-[214px] rounded-3xl text-white p-5 flex flex-col justify-between gap-4 overflow-hidden"
        :class="scelta.attiva ? 'bg-pf-notte shadow-[0_16px_32px_rgb(11_47_79/0.30)]' : 'bg-pf-spenta shadow-[0_16px_32px_rgb(15_27_45/0.18)]'"
      >
        <span aria-hidden="true" class="absolute -right-[50px] -top-[60px] size-[200px] rounded-full border-[28px]" :class="scelta.attiva ? 'border-pf-notte-anello' : 'border-white/10'" />
        <img v-if="scelta.attiva" src="/portale/tessera.webp" alt="" class="absolute right-3.5 bottom-14 size-16 object-contain" />
        <div class="relative flex justify-between items-start gap-3">
          <div class="flex flex-col gap-0.5">
            <span class="font-heading font-bold text-[17px]">tiformiamonoi.it</span>
            <span class="text-xs text-pf-su-blu">Card studente · convenzioni</span>
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-white" :class="scelta.attiva ? 'text-pf-verde' : 'text-pf-rosso'">
            {{ scelta.attiva ? 'Attiva' : scelta.motivo === 'DISATTIVATA' ? 'Disattivata' : 'Sospesa' }}
          </span>
        </div>
        <div class="relative flex flex-col gap-1">
          <span class="font-heading font-bold text-[22px]">{{ scelta.firstName }} {{ scelta.lastName }}</span>
          <span class="text-[13px] text-pf-su-blu">{{ [scelta.classe, scelta.scuola].filter(Boolean).join(' · ') }}</span>
        </div>
        <div v-if="scelta.attiva" class="relative flex flex-col gap-0.5">
          <span class="text-[11px] text-pf-su-blu uppercase tracking-wider">Valida fino al</span>
          <!-- La data è sempre quella calcolata dal server (regola unica della card) -->
          <span class="text-[15px] font-semibold">{{ scelta.validaFino ? giornoInParole(scelta.validaFino, { day: 'numeric', month: 'long', year: 'numeric' }) : 'finché il pacchetto è attivo' }}</span>
        </div>
        <p v-else class="relative text-[13px] text-white">Il codice non è valido finché la card è {{ scelta.motivo === 'DISATTIVATA' ? 'disattivata' : 'sospesa' }}.</p>
      </section>

      <template v-if="scelta.attiva">
        <!-- Il QR (al posto del codice a barre delle bozze): il negozio lo inquadra con la fotocamera -->
        <section aria-labelledby="t-qr" class="mx-5 mt-4 bg-white border border-pf-bordo rounded-3xl p-5 flex flex-col items-center gap-3">
          <h2 id="t-qr" class="sr-only">Codice da mostrare al negozio</h2>
          <div class="size-48" role="img" :aria-label="`Codice QR della card di ${scelta.firstName}`" v-html="qr(scelta.codiceCard)" />
          <span class="font-mono text-base tracking-[0.18em] font-semibold">{{ scelta.codiceCard }}</span>
          <p class="text-[13px] leading-[18px] text-pf-grigio text-center">Mostra questo codice alla cassa del negozio convenzionato.</p>
        </section>

        <div v-if="scelta.inMargine && scelta.validaFino" class="mx-5 mt-4 p-4 rounded-[22px] bg-pf-crema flex gap-3 items-start">
          <UIcon name="i-heroicons-clock" class="size-6 shrink-0 text-pf-crema-testo" aria-hidden="true" />
          <div>
            <p class="font-semibold text-[15px] text-pf-giallo-testo">Resta attiva fino al {{ giornoNumeri(scelta.validaFino) }}</p>
            <p class="text-[13px] leading-[18px] text-pf-crema-testo">{{ testoCardInScadenza(scelta.motivo, perGenitore) }}</p>
          </div>
        </div>

        <section aria-labelledby="t-valida" class="mx-5 mt-4 flex flex-col gap-2.5">
          <h2 id="t-valida" class="font-semibold text-base">Quando è valida</h2>
          <p class="flex gap-3 items-start text-sm leading-5 text-pf-grigio-scuro">
            <span class="size-7 shrink-0 rounded-[9px] bg-pf-verde-chiaro text-pf-verde flex items-center justify-center" aria-hidden="true"><UIcon name="i-heroicons-check" class="size-4" /></span>
            Si attiva da sola con il pacchetto e resta attiva finché il pacchetto è attivo.
          </p>
          <p class="flex gap-3 items-start text-sm leading-5 text-pf-grigio-scuro">
            <span class="size-7 shrink-0 rounded-[9px] bg-pf-rosso-chiaro text-pf-rosso flex items-center justify-center" aria-hidden="true"><UIcon name="i-heroicons-x-mark" class="size-4" /></span>
            Se il pacchetto scade, la card si sospende. Rinnovando torna attiva.
          </p>
          <p class="flex gap-3 items-start text-sm leading-5 text-pf-grigio-scuro">
            <span class="size-7 shrink-0 rounded-[9px] bg-pf-celeste text-pf-blu flex items-center justify-center" aria-hidden="true"><UIcon name="i-heroicons-calendar" class="size-4" /></span>
            Resta valida 15 giorni dopo la scadenza del pacchetto.
          </p>
        </section>

        <div class="mx-5 mt-5"><PortaleBottone to="/portale/sconti" blocco>Vedi i negozi convenzionati</PortaleBottone></div>
      </template>

      <!-- Card spenta (schermata 16): cosa fare. Al genitore il perché, all'alunno solo
           "chiedi in segreteria": il motivo non gli arriva nemmeno dal server. -->
      <section v-else aria-labelledby="t-cosa" class="mx-5 mt-4 bg-white rounded-3xl p-5 flex flex-col items-center gap-2.5 text-center pf-ombra">
        <img src="/portale/portafoglio.webp" alt="" class="size-[84px] object-contain" />
        <h2 id="t-cosa" class="font-heading font-bold text-[19px]">{{ titoloSospesa }}</h2>
        <p class="text-sm leading-5 text-pf-grigio-scuro">{{ testoCardSospesa(scelta.motivo, perGenitore) }}</p>
        <PortaleBottone v-if="mostraPaga" to="/portale/pagamenti" blocco grande class="mt-1.5">Paga il mensile</PortaleBottone>
        <a
          v-if="whatsapp"
          :href="whatsappSegreteria(whatsapp)"
          target="_blank"
          rel="noopener noreferrer"
          class="py-2 px-2 text-sm font-semibold text-pf-blu hover:text-pf-blu-scuro"
        >Scrivi alla segreteria<span class="sr-only"> su WhatsApp (si apre in un'altra finestra)</span></a>
      </section>

      <NuxtLink to="/regolamento-card" class="mx-5 mt-4 min-h-11 flex items-center justify-between text-sm text-pf-grigio-scuro hover:text-pf-blu">
        <span>Regolamento della card studente</span>
        <UIcon name="i-heroicons-chevron-right" class="size-4" aria-hidden="true" />
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { renderSVG } from 'uqr'
import type { MotivoCard } from '#shared/card-studente'

// LA CARD STUDENTE (schermate 7 e 16). Stato, data e motivo li calcola il server con la
// regola unica (shared/card-studente.ts): qui non si decide niente.
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Card — Portale Famiglie' })

type Card = {
  id: string
  firstName: string
  lastName: string
  classe: string | null
  scuola: string | null
  codiceCard: string
  attiva: boolean
  validaFino: string | null
  inMargine: boolean
  // Solo per il genitore: allo studente il server non lo manda (privacy economica)
  motivo?: MotivoCard | null
}

const route = useRoute()
const { user } = useUserSession()
const perGenitore = computed(() => user.value?.role === 'GENITORE')

const { data, pending } = useLazyFetch<Card[]>('/api/portal/card')
const cards = computed(() => data.value ?? [])
// Dalla Home si arriva con ?alunno=<id> per aprire subito la card di quel figlio
const sceltaId = ref(String(route.query.alunno ?? ''))
const scelta = computed(() => cards.value.find((c) => c.id === sceltaId.value) ?? cards.value[0])

const { data: portalConfigs } = useLazyFetch<{ whatsapp_numero?: string }>('/api/portal/configs')
const whatsapp = computed(() => portalConfigs.value?.whatsapp_numero ?? '')
// "Paga il mensile" solo al genitore, solo se c'è da pagare o rinnovare e la sezione pagamenti è accesa
const { data: pagamenti } = useLazyFetch<{ attivi: boolean }>('/api/portal/pagamenti', { server: false, immediate: perGenitore.value })
const mostraPaga = computed(() => perGenitore.value && pagamenti.value?.attivi === true
  && ['DA_SALDARE', 'SCADUTO'].includes(scelta.value?.motivo ?? ''))

const titoloSospesa = computed(() => {
  if (!perGenitore.value) return 'Card sospesa'
  switch (scelta.value?.motivo) {
    case 'DISATTIVATA':      return 'Card disattivata dalla segreteria'
    case 'DA_SALDARE':       return 'Salda e la card si riattiva'
    case 'NESSUN_PAGAMENTO': return 'Si attiva con il primo pagamento'
    default:                 return 'Rinnova e la card si riattiva'
  }
})

// Il QR porta l'indirizzo COMPLETO della pagina del negozio: la fotocamera del telefono
// lo apre da sola, senza app. useRequestURL dà lo stesso dominio sia sul server sia nel browser.
const origine = useRequestURL().origin
const qr = (codice: string) => renderSVG(`${origine}/verifica/${codice}`)
</script>
