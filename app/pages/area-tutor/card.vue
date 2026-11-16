<template>
  <div>
    <PortaleTestata titolo="Card tutor" sovrapposta :campanella="false" />

    <USkeleton v-if="pending" class="relative -mt-[52px] mx-5 h-[214px] rounded-3xl" />

    <p v-else-if="!card" class="relative -mt-[52px] mx-5 bg-white rounded-3xl p-6 text-center text-sm text-pf-grigio-scuro pf-ombra-alta">
      Nessuna card da mostrare. Chiedi in segreteria.
    </p>

    <div v-else>
      <!-- La card: blu notte se attiva, grigia se spenta (come quella delle famiglie) -->
      <section
        :aria-label="`Card di ${card.firstName} ${card.lastName}, tutor, ${card.attiva ? 'attiva' : 'non attiva'}`"
        class="relative -mt-[52px] mx-5 min-h-[214px] rounded-3xl text-white p-5 flex flex-col justify-between gap-4 overflow-hidden"
        :class="card.attiva ? 'bg-pf-notte shadow-[0_16px_32px_rgb(11_47_79/0.30)]' : 'bg-pf-spenta shadow-[0_16px_32px_rgb(15_27_45/0.18)]'"
      >
        <span aria-hidden="true" class="absolute -right-[50px] -top-[60px] size-[200px] rounded-full border-[28px]" :class="card.attiva ? 'border-pf-notte-anello' : 'border-white/10'" />
        <img v-if="card.attiva" src="/portale/tessera.webp" alt="" class="absolute right-3.5 bottom-14 size-16 object-contain" />
        <div class="relative flex justify-between items-start gap-3">
          <div class="flex flex-col gap-0.5">
            <span class="font-heading font-bold text-[17px]">tiformiamonoi.it</span>
            <span class="text-xs text-pf-su-blu">Card tutor · convenzioni</span>
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-white" :class="card.attiva ? 'text-pf-verde' : 'text-pf-rosso'">
            {{ card.attiva ? 'Attiva' : 'Non attiva' }}
          </span>
        </div>
        <!-- pr-16 = lo spazio della tessera: il nome va a capo, non si taglia mai -->
        <div class="relative flex flex-col gap-1 pr-16">
          <span class="font-heading font-bold leading-7 break-words" :class="classeNomeCard(`${card.firstName} ${card.lastName}`)">{{ card.firstName }} {{ card.lastName }}</span>
          <span class="text-[13px] text-pf-su-blu">Tutor</span>
        </div>
        <div v-if="card.attiva" class="relative flex flex-col gap-0.5">
          <span class="text-[11px] text-pf-su-blu uppercase tracking-wider">Valida</span>
          <span class="text-[15px] font-semibold">finché collabori con noi</span>
        </div>
        <p v-else class="relative text-[13px] text-white">Il codice non è valido finché la card non è attiva.</p>
      </section>

      <template v-if="card.attiva">
        <!-- Il QR: il negozio lo inquadra e si apre la pagina di verifica -->
        <section aria-labelledby="t-qr" class="mx-5 mt-4 bg-white border border-pf-bordo rounded-3xl p-5 flex flex-col items-center gap-3">
          <h2 id="t-qr" class="sr-only">Codice da mostrare al negozio</h2>
          <div class="size-48" role="img" :aria-label="`Codice QR della card di ${card.firstName}`" v-html="qr(card.codiceCard)" />
          <span class="font-mono text-base tracking-[0.18em] font-semibold">{{ card.codiceCard }}</span>
          <p class="text-[13px] leading-[18px] text-pf-grigio text-center">Mostra questo codice alla cassa del negozio convenzionato.</p>
        </section>

        <section aria-labelledby="t-valida" class="mx-5 mt-4 flex flex-col gap-2.5">
          <h2 id="t-valida" class="font-semibold text-base">Quando è valida</h2>
          <p class="flex gap-3 items-start text-sm leading-5 text-pf-grigio-scuro">
            <span class="size-7 shrink-0 rounded-[9px] bg-pf-verde-chiaro text-pf-verde flex items-center justify-center" aria-hidden="true"><UIcon name="i-heroicons-check" class="size-4" /></span>
            Si attiva da sola quando la segreteria ti registra come tutor.
          </p>
          <p class="flex gap-3 items-start text-sm leading-5 text-pf-grigio-scuro">
            <span class="size-7 shrink-0 rounded-[9px] bg-pf-rosso-chiaro text-pf-rosso flex items-center justify-center" aria-hidden="true"><UIcon name="i-heroicons-x-mark" class="size-4" /></span>
            Se la collaborazione finisce, la card si spegne insieme al tuo accesso.
          </p>
          <p class="flex gap-3 items-start text-sm leading-5 text-pf-grigio-scuro">
            <span class="size-7 shrink-0 rounded-[9px] bg-pf-celeste text-pf-blu flex items-center justify-center" aria-hidden="true"><UIcon name="i-heroicons-user" class="size-4" /></span>
            È personale: vale solo per te, non per amici o parenti.
          </p>
        </section>

        <div class="mx-5 mt-5"><PortaleBottone to="/area-tutor/convenzioni" blocco>Vedi i negozi convenzionati</PortaleBottone></div>
      </template>

      <!-- Card spenta: cosa fare -->
      <section v-else aria-labelledby="t-cosa" class="mx-5 mt-4 bg-white rounded-3xl p-5 flex flex-col items-center gap-2.5 text-center pf-ombra">
        <img src="/portale/portafoglio.webp" alt="" class="size-[84px] object-contain" />
        <h2 id="t-cosa" class="font-heading font-bold text-[19px]">Card non attiva</h2>
        <p class="text-sm leading-5 text-pf-grigio-scuro">{{ TESTO_CARD_TUTOR_SPENTA }}</p>
      </section>

      <NuxtLink to="/regolamento-card" class="mx-5 mt-4 min-h-11 flex items-center justify-between text-sm text-pf-grigio-scuro hover:text-pf-blu">
        <span>Regolamento della card</span>
        <UIcon name="i-heroicons-chevron-right" class="size-4" aria-hidden="true" />
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { renderSVG } from 'uqr'

// LA CARD TUTOR (bozza Card). Lo stato lo decide il server: attiva finché l'account
// tutor è attivo, senza scadenza (D4). Qui non si decide niente.
definePageMeta({ layout: 'tutor', middleware: ['tutor-only'] })
useHead({ title: 'Card tutor — Area Tutor' })

type CardTutor = {
  tipo: 'TUTOR'
  id: string
  firstName: string
  lastName: string
  codiceCard: string
  attiva: boolean
}

const { data: card, pending } = useLazyFetch<CardTutor | null>('/api/tutor/card')

// Il QR porta l'indirizzo COMPLETO della pagina del negozio, come la card delle famiglie
const origine = useRequestURL().origin
const qr = (codice: string) => renderSVG(`${origine}/verifica/${codice}`)
</script>
