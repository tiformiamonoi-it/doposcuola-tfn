<template>
  <UPopover v-model:open="aperto" :content="{ align: 'end', sideOffset: 8 }">
    <!-- IL CAMPANELLINO -->
    <button
      type="button"
      class="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tfn-500"
      :aria-label="etichettaCampanellino"
      :title="etichettaCampanellino"
    >
      <UIcon name="i-heroicons-bell" class="w-5 h-5" />
      <!-- Pallino col numero: solo per le notifiche vere, mai per i compleanni
           (vedi il commento su numeroNonLette nel service) -->
      <span
        v-if="numeroNonLette > 0"
        class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
      >
        {{ numeroNonLette > 99 ? '99+' : numeroNonLette }}
      </span>
      <!-- Pallino piccolo senza numero: c'è un compleanno ma niente da "sbrigare" -->
      <span
        v-else-if="compleanni.length > 0"
        class="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-tfn-500"
      />
    </button>

    <template #content>
      <!-- Larghezza: sul telefono quasi tutto lo schermo, su desktop una colonna
           stretta. max-h + overflow perché l'elenco non deve mai uscire dalla pagina. -->
      <div class="w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto">

        <div class="sticky top-0 bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-slate-900">Notifiche</p>
          <UButton
            v-if="numeroNonLette > 0"
            size="xs"
            variant="ghost"
            :loading="segnandoTutte"
            @click="segnaTutteLette"
          >
            Segna tutte come lette
          </UButton>
        </div>

        <div v-if="stato === 'pending' && !dati" class="p-4 text-sm text-slate-400">
          Caricamento…
        </div>

        <template v-else>
          <!-- ─── COMPLEANNI ─── -->
          <section class="px-3 py-3 border-b border-slate-100">
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Compleanni
            </h3>

            <p v-if="compleanni.length === 0" class="text-sm text-slate-400">
              Nessun compleanno oggi né domani.
            </p>

            <ul v-else class="space-y-2">
              <li
                v-for="c in compleanni"
                :key="c.id"
                class="flex items-start gap-2.5 rounded-lg p-2 hover:bg-slate-50"
              >
                <UIcon name="i-heroicons-cake" class="w-5 h-5 mt-0.5 shrink-0 text-pink-500" />
                <div class="min-w-0 flex-1">
                  <NuxtLink
                    :to="c.link"
                    class="text-sm font-medium text-slate-800 hover:text-tfn-600 hover:underline block truncate"
                    @click="aperto = false"
                  >
                    {{ c.nome }}
                  </NuxtLink>
                  <p class="text-xs text-slate-500">
                    {{ c.quando === 'OGGI' ? 'Oggi' : 'Domani' }} compie {{ c.anni }} anni ·
                    {{ c.chi === 'ALUNNO' ? 'alunno' : 'tutor' }}
                  </p>
                  <!-- Il 29 febbraio va detto, altrimenti sembra un errore del gestionale -->
                  <p v-if="c.festeggiaIl28" class="text-[11px] text-slate-400">
                    Nato il 29 febbraio: quest'anno festeggia il 28.
                  </p>
                  <p v-if="c.telefonoDi" class="text-[11px] text-slate-400 truncate">
                    Numero di {{ c.telefonoDi }}
                  </p>
                </div>
                <UButton
                  v-if="c.telefono"
                  :to="linkAuguriWhatsapp(c)"
                  target="_blank"
                  rel="noopener"
                  size="xs"
                  variant="soft"
                  color="success"
                  icon="i-heroicons-chat-bubble-left-right"
                  :aria-label="`Manda gli auguri a ${c.nome} su WhatsApp`"
                  :title="`Manda gli auguri a ${c.nome} su WhatsApp`"
                />
              </li>
            </ul>
          </section>

          <!-- ─── NOTIFICHE ─── -->
          <section class="px-3 py-3">
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Notifiche
            </h3>

            <p v-if="nonLette.length === 0 && ultimeLette.length === 0" class="text-sm text-slate-400">
              Nessuna notifica.
            </p>

            <ul v-if="nonLette.length > 0" class="space-y-1.5">
              <li
                v-for="n in nonLette"
                :key="n.id"
                class="rounded-lg border border-tfn-100 bg-tfn-50/60 p-2.5"
              >
                <div class="flex items-start gap-2">
                  <div class="min-w-0 flex-1">
                    <NuxtLink
                      v-if="n.link"
                      :to="n.link"
                      class="text-sm font-medium text-slate-800 block hover:text-tfn-600 hover:underline"
                      @click="aperto = false"
                    >
                      {{ n.titolo }}
                    </NuxtLink>
                    <p v-else class="text-sm font-medium text-slate-800">{{ n.titolo }}</p>
                    <p class="text-xs text-slate-600 mt-0.5">{{ n.messaggio }}</p>
                    <p class="text-[11px] text-slate-400 mt-1">{{ formatDataOra(n.createdAt) }}</p>
                  </div>
                  <UButton
                    size="xs"
                    variant="ghost"
                    icon="i-heroicons-check"
                    :loading="segnando === n.id"
                    :aria-label="`Segna come letta: ${n.titolo}`"
                    :title="'Segna come letta'"
                    @click="segnaLetta(n.id)"
                  />
                </div>
              </li>
            </ul>

            <!-- Le già lette: servono solo a ricordarsi "l'avevo vista?" -->
            <template v-if="ultimeLette.length > 0">
              <p class="text-[11px] text-slate-400 mt-3 mb-1.5">Già lette</p>
              <ul class="space-y-1">
                <li v-for="n in ultimeLette" :key="n.id" class="px-2.5 py-2 rounded-lg hover:bg-slate-50">
                  <NuxtLink
                    v-if="n.link"
                    :to="n.link"
                    class="text-sm text-slate-500 block truncate hover:text-tfn-600 hover:underline"
                    @click="aperto = false"
                  >
                    {{ n.titolo }}
                  </NuxtLink>
                  <p v-else class="text-sm text-slate-500 truncate">{{ n.titolo }}</p>
                  <p class="text-[11px] text-slate-400">
                    Letta {{ formatDataOra(n.lettaAt) }}<span v-if="n.lettaDa">
                      da {{ n.lettaDa.firstName }} {{ n.lettaDa.lastName }}</span>
                  </p>
                </li>
              </ul>
            </template>
          </section>
        </template>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
// IL CENTRO NOTIFICHE.
//
// Due sezioni con due nature diverse, apposta:
//  • Compleanni — calcolati al volo dal server, sempre visibili, senza "letto/non
//    letto": un compleanno non si archivia, passa da solo a mezzanotte.
//  • Notifiche — righe vere, con la spunta "letta" CONDIVISA da tutta la
//    segreteria: se un admin la segna, sparisce per tutti (siamo in 2-3, chiudere
//    la stessa pratica tre volte non aiuta nessuno).
//
// In questo blocco la tabella delle notifiche è ancora vuota: qui si vedono solo
// i compleanni. È voluto — il posto è pronto per i consensi del blocco successivo.

import { formatDataOra } from '~/utils/format'
import { normalizzaTelefono } from '~/utils/phone'

const aperto = ref(false)
const segnando = ref<string | null>(null)
const segnandoTutte = ref(false)

// server: false — il campanellino non deve rallentare il primo disegno della
// pagina: si riempie subito dopo, nel browser.
const { data: dati, status: stato, refresh } = useLazyFetch('/api/notifiche', { server: false })

const compleanni  = computed(() => dati.value?.compleanni ?? [])
const nonLette    = computed(() => dati.value?.nonLette ?? [])
const ultimeLette = computed(() => dati.value?.ultimeLette ?? [])
const numeroNonLette = computed(() => dati.value?.numeroNonLette ?? 0)

// L'etichetta per chi naviga con la tastiera o con il lettore di schermo: deve
// dire cosa c'è dentro, non solo "notifiche".
const etichettaCampanellino = computed(() => {
  const pezzi: string[] = []
  if (numeroNonLette.value > 0) pezzi.push(`${numeroNonLette.value} da leggere`)
  if (compleanni.value.length > 0) pezzi.push(`${compleanni.value.length} compleanni`)
  return pezzi.length > 0 ? `Notifiche: ${pezzi.join(', ')}` : 'Notifiche: nessuna novità'
})

// Auguri già scritti: si apre WhatsApp col numero giusto e il messaggio pronto,
// così basta premere invio. Stesso schema di linkWhatsapp() usato in Contatti e
// Rientri, con in più il testo precompilato.
function linkAuguriWhatsapp(c: { nome: string; telefono: string | null; telefonoDi: string | null; anni: number }) {
  const numero = normalizzaTelefono(c.telefono ?? '').replace('+', '')
  const nomeProprio = c.nome.split(' ')[0] ?? c.nome
  const testo = c.telefonoDi
    // Il numero è del genitore: gli auguri vanno fatti "a nome di", non a lui
    ? `Tanti auguri a ${nomeProprio} da tutto lo staff di tiformiamonoi! 🎂`
    : `Tanti auguri ${nomeProprio}! 🎂 Da tutto lo staff di tiformiamonoi.`
  return `https://wa.me/${numero}?text=${encodeURIComponent(testo)}`
}

async function segnaLetta(id: string) {
  segnando.value = id
  try {
    await $fetch(`/api/notifiche/${id}/letta`, { method: 'POST' })
    await refresh()
  } finally {
    segnando.value = null
  }
}

async function segnaTutteLette() {
  segnandoTutte.value = true
  try {
    await $fetch('/api/notifiche/lette', { method: 'POST' })
    await refresh()
  } finally {
    segnandoTutte.value = false
  }
}
</script>
