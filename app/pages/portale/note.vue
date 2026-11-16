<template>
  <div>
    <PortaleTestata titolo="Note e comunicazioni" indietro="/portale/notifiche">
      <p class="text-sm leading-5 text-pf-su-blu">Tutto quello che il Centro ha scritto alla tua famiglia, anche più vecchio di due mesi.</p>
    </PortaleTestata>

    <div class="px-5 pt-5 flex flex-col gap-2.5">
      <template v-if="pending">
        <USkeleton v-for="i in 3" :key="i" class="h-24 w-full rounded-[22px]" />
      </template>

      <div v-else-if="totale === 0" class="bg-white rounded-[22px] p-6 text-center pf-ombra flex flex-col items-center gap-2">
        <img src="/portale/megafono.webp" alt="" class="size-16 object-contain" />
        <p class="font-semibold">Nessuna comunicazione al momento</p>
        <p class="text-sm text-pf-grigio">Qui arrivano le note e gli avvisi del Centro.</p>
      </div>

      <template v-else>
        <!-- Gli avvisi della segreteria a tutte le famiglie stanno in cima: sono pochi,
             valgono per tutti e di solito hanno una data che non deve perdersi. -->
        <template v-if="avvisi.length > 0">
          <h2 class="mt-2 text-[13px] font-bold text-pf-grigio uppercase tracking-wide">Avvisi a tutte le famiglie</h2>
          <article v-for="avviso in avvisi" :key="avviso.id" class="bg-white rounded-[22px] p-4 flex flex-col gap-1.5 pf-ombra">
            <div class="flex items-center gap-2">
              <!-- "Nuova" finché non l'hai vista: aprire la pagina la segna letta, ma il bollino resta fino alla prossima visita -->
              <PortaleStato v-if="!avviso.lettaAt" tono="rosso">Nuova</PortaleStato>
              <span class="text-xs text-pf-grigio">Segreteria · {{ formatDate(avviso.createdAt) }}</span>
            </div>
            <!-- La foto in cima, intera (mai ritagliata), come nell'email -->
            <img v-if="avviso.conImmagine" :src="`/api/immagini/comunicazioni/${avviso.id}`" alt="" loading="lazy" class="w-full h-auto rounded-xl" />
            <h3 class="font-semibold text-base">{{ avviso.titolo }}</h3>
            <p class="text-sm leading-5 text-pf-grigio-scuro whitespace-pre-wrap">{{ avviso.testo }}</p>
          </article>
        </template>

        <template v-if="notes.length > 0">
          <h2 class="mt-2 text-[13px] font-bold text-pf-grigio uppercase tracking-wide">Sui tuoi ragazzi</h2>
          <article v-for="nota in notes" :key="nota.id" class="bg-white rounded-[22px] p-4 flex gap-3 items-start pf-ombra">
            <PortaleAvatar :nome="nota.student?.firstName" :indice="indiceDi(nota.student?.firstName)" misura="ico" />
            <div class="flex-1 min-w-0 flex flex-col gap-1.5">
              <!-- La firma arriva già decisa dal server: "Segreteria" per le note scritte da
                   un tutor, il nome vero se a scrivere è stato un responsabile. -->
              <p class="text-[13px] text-pf-grigio">
                <strong class="text-pf-testo">{{ firma(nota) }}</strong> su {{ nota.student?.firstName }}
                · {{ formatDate(nota.approvataAt ?? nota.createdAt) }}
              </p>
              <p class="px-3 py-2.5 rounded-[14px] bg-pf-fondo text-[15px] leading-[21px] whitespace-pre-wrap">{{ nota.contenuto }}</p>
            </div>
          </article>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// L'ARCHIVIO di note e comunicazioni (il genitore). Non ha una bozza v6: le novità ora
// arrivano nelle Notifiche e nella Home, qui resta tutto lo storico. Ci portano le email
// ("leggi nel portale") e le notifiche, per questo l'indirizzo non cambia.
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Note e comunicazioni — Portale Famiglie' })

// Le note didattiche sono riservate alla famiglia: l'account studente non le vede
const { user: sessionUser } = useUserSession()
if (sessionUser.value?.role === 'STUDENTE') {
  await navigateTo('/portale', { replace: true })
}

const { data, pending } = useLazyFetch<any[]>('/api/portal/notes')
const notes = computed(() => data.value ?? [])

// Avvisi della segreteria a tutte le famiglie. Qui il caricamento si ASPETTA
// (await, non lazy) apposta: la pagina appena montata li segna come letti, e se
// quella chiamata arrivasse prima di questa il bollino "Nuova" non si vedrebbe mai.
const { data: avvisiData } = await useFetch('/api/portal/comunicazioni')
const avvisi = computed(() => avvisiData.value ?? [])
const totale = computed(() => notes.value.length + avvisi.value.length)

const { data: studentsData } = useLazyFetch<{ firstName: string }[]>('/api/portal/students')
const indiceDi = (nome?: string) => Math.max(0, (studentsData.value ?? []).findIndex((s) => s.firstName === nome))

// Visita registrata: comunicazioni e note risultano lette (solo genitori)
onMounted(async () => {
  if (sessionUser.value?.role !== 'GENITORE') return
  try {
    await $fetch('/api/portal/notes-seen', { method: 'POST' })
  } catch { /* nessun impatto per la famiglia */ }
})

// Chi firma la comunicazione: il server manda già il nome giusto, qui si legge e basta
function firma(nota: any): string {
  const nome = `${nota?.author?.firstName ?? ''} ${nota?.author?.lastName ?? ''}`.trim()
  return nome || 'Segreteria'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>
