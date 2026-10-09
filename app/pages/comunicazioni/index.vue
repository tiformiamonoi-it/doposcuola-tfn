<template>
  <div class="space-y-6">

    <!-- ═══ INTESTAZIONE ═══ -->
    <div>
      <h2 class="text-xl font-semibold text-slate-900">Comunicazioni</h2>
      <p class="text-sm text-slate-500 mt-0.5">
        Un avviso a tutte le famiglie con l'account del portale: lo trovano nel portale e nella posta,
        firmato «Segreteria».
      </p>
    </div>

    <!-- ═══ NUOVA COMUNICAZIONE ═══ -->
    <UCard>
      <template #header>
        <h3 class="font-semibold text-slate-800">Nuova comunicazione</h3>
      </template>

      <div class="space-y-4">
        <UFormField label="Titolo" required :hint="`${titolo.length}/150`">
          <UInput v-model="titolo" :maxlength="150" placeholder="Es. Chiusura per le vacanze di Natale" class="w-full" />
        </UFormField>

        <UFormField label="Testo" required :hint="`${testo.length}/5000`" help="Gli a capo restano come li scrivi.">
          <UTextarea v-model="testo" :maxlength="5000" :rows="6" autoresize class="w-full" />
        </UFormField>

        <!-- Nessuna scelta già fatta, apposta: informativa o promozionale decide chi
             la riceve (le promozioni solo a chi ha dato il consenso), e una scelta
             che conta per la privacy va fatta ogni volta, non ereditata per abitudine. -->
        <fieldset>
          <legend class="text-sm font-medium text-slate-700 mb-2">Che tipo di comunicazione è? <span class="text-error">*</span></legend>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label
              v-for="o in OPZIONI_TIPO"
              :key="o.value"
              class="flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-tfn-400"
              :class="tipo === o.value ? 'border-tfn-500 bg-tfn-50' : 'border-slate-200 hover:border-slate-300'"
            >
              <input v-model="tipo" type="radio" name="tipo-comunicazione" :value="o.value" class="mt-1">
              <span>
                <span class="block text-sm font-semibold text-slate-800">{{ o.label }}</span>
                <span class="block text-xs text-slate-500">{{ o.descrizione }}</span>
              </span>
            </label>
          </div>
        </fieldset>

        <!-- Il numero cambia appena si cambia tipo: aria-live lo fa leggere anche
             a chi usa un lettore di schermo -->
        <p class="text-sm" aria-live="polite">
          <span v-if="!tipo" class="text-slate-500">Scegli il tipo per vedere quante famiglie la riceveranno.</span>
          <span v-else-if="contando" class="text-slate-500">Conto le famiglie…</span>
          <span v-else-if="conteggio !== null" class="font-semibold text-slate-800">
            {{ testoFamiglie(conteggio) }}<span v-if="tipo === 'PROMOZIONALE'" class="font-normal text-slate-500"> (solo chi ha dato il consenso alle promozioni)</span>
          </span>
        </p>

        <div class="flex flex-wrap justify-end gap-2">
          <UButton
            variant="outline"
            color="neutral"
            icon="i-heroicons-envelope"
            :loading="inviandoProva"
            :disabled="!pronta"
            @click="inviaProva"
          >
            Invia una prova a me
          </UButton>
          <UButton
            icon="i-heroicons-paper-airplane"
            :disabled="!pronta || contando || !conteggio"
            @click="chiediInvio"
          >
            Invia
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- ═══ STORICO ═══ -->
    <div class="space-y-3">
      <h3 class="text-lg font-semibold text-slate-800">Inviate</h3>

      <USkeleton v-if="pendingStorico && !storico.length" class="h-28 w-full rounded-xl" />

      <p v-else-if="!storico.length" class="text-sm text-slate-500">Nessuna comunicazione inviata finora.</p>

      <template v-else>
        <UCard v-for="c in storico" :key="c.id" :class="c.eliminataAt ? 'opacity-60' : ''">
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge :color="c.tipo === 'PROMOZIONALE' ? 'warning' : 'info'" variant="subtle" size="sm">
                {{ c.tipo === 'PROMOZIONALE' ? 'Promozionale' : 'Informativa' }}
              </UBadge>
              <UBadge v-if="c.eliminataAt" color="neutral" variant="subtle" size="sm">Eliminata</UBadge>
              <span class="text-xs text-slate-500">
                {{ formatDataOra(c.createdAt) }}<template v-if="c.autore"> · scritta da {{ c.autore }}</template>
              </span>
            </div>
  
            <p class="font-semibold text-slate-800">{{ c.titolo }}</p>
  
            <details class="text-sm">
              <summary class="cursor-pointer text-slate-500">Mostra il testo</summary>
              <p class="mt-2 text-slate-700 whitespace-pre-wrap">{{ c.testo }}</p>
            </details>
  
            <p class="text-sm text-slate-600">
              Ricevuta da <strong>{{ c.destinatari }}</strong> · letta da <strong>{{ c.lette }}</strong>
              · email partite <strong>{{ c.emailInviate }}</strong>
              <template v-if="c.emailNonPartite > 0">
                · <span class="text-error font-semibold">non partite {{ c.emailNonPartite }}</span>
              </template>
              <StatHelp text="«Letta» vuol dire che il genitore ha aperto la pagina Comunicazioni del portale dopo l'invio. Chi la legge solo nella posta qui non risulta." />
            </p>
  
            <div v-if="!c.eliminataAt" class="flex flex-wrap justify-end gap-2 pt-1">
              <UButton
                v-if="c.emailNonPartite > 0"
                size="sm"
                variant="soft"
                color="warning"
                icon="i-heroicons-arrow-path"
                :loading="riprovando === c.id"
                @click="riprova(c.id)"
              >
                Riprova le email non partite
              </UButton>
              <UButton
                size="sm"
                variant="ghost"
                color="error"
                icon="i-heroicons-trash"
                @click="chiediEliminazione(c.id, c.titolo)"
              >
                Elimina
              </UButton>
            </div>
          </div>
        </UCard>
      </template>
    </div>

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
      :confirm-label="confirmLabel"
      :confirm-color="confirmColor"
      :loading="confirmLoading"
      @confirm="eseguiConferma"
    />
  </div>
</template>

<script setup lang="ts">
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import type { ComunicazioneTipo } from '#shared/schemas/comunicazione.schema'

definePageMeta({ middleware: ['admin-or-super'] })
useHead({ title: 'Comunicazioni' })

const toast = useToast()
const { confirmOpen, confirmTitle, confirmDescription, confirmLabel, confirmColor, confirmLoading, chiediConferma, eseguiConferma } = useConfirm()

const OPZIONI_TIPO: { value: ComunicazioneTipo; label: string; descrizione: string }[] = [
  { value: 'INFORMATIVA',  label: 'Informativa',  descrizione: 'Chiusure, orari, scadenze. Va a tutte le famiglie con il portale.' },
  { value: 'PROMOZIONALE', label: 'Promozionale', descrizione: 'Corsi, offerte, novità. Va solo a chi ha dato il consenso alle promozioni.' },
]

// ─── Il modulo ───
const titolo = ref('')
const testo = ref('')
const tipo = ref<ComunicazioneTipo | null>(null)

const pronta = computed(() => !!titolo.value.trim() && !!testo.value.trim() && !!tipo.value)

function corpo() {
  return { titolo: titolo.value, testo: testo.value, tipo: tipo.value }
}

function messaggioErrore(err: unknown, ripiego: string): string {
  return (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? ripiego
}

function testoFamiglie(n: number): string {
  return n === 1 ? 'La riceverà 1 famiglia' : `La riceveranno ${n} famiglie`
}

// ─── "La riceveranno N famiglie" ───
const conteggio = ref<number | null>(null)
const contando = ref(false)

watch(tipo, async (t) => {
  conteggio.value = null
  contando.value = false
  if (!t) return
  contando.value = true
  try {
    const r = await $fetch('/api/comunicazioni/anteprima', { query: { tipo: t } })
    // Se nel frattempo si è cambiato tipo, questo numero non vale più
    if (tipo.value === t) conteggio.value = r.destinatari
  } catch (err) {
    toast.add({ title: messaggioErrore(err, 'Non è stato possibile contare le famiglie'), color: 'error' })
  } finally {
    if (tipo.value === t) contando.value = false
  }
})

// ─── Prova a sé stessi ───
const inviandoProva = ref(false)
async function inviaProva() {
  inviandoProva.value = true
  try {
    const r = await $fetch('/api/comunicazioni/prova', { method: 'POST', body: corpo() })
    if (r.sent) {
      toast.add({ title: `Prova inviata a ${r.email}`, description: 'Non è stato salvato niente e nessuna famiglia l\'ha ricevuta.', color: 'success' })
    } else {
      toast.add({ title: 'La prova non è partita', description: r.dettaglio ?? r.motivo, color: 'error' })
    }
  } catch (err) {
    toast.add({ title: messaggioErrore(err, 'Non è stato possibile inviare la prova'), color: 'error' })
  } finally {
    inviandoProva.value = false
  }
}

// ─── Invio vero ───
function chiediInvio() {
  if (!pronta.value || !conteggio.value) return
  const promo = tipo.value === 'PROMOZIONALE'
  chiediConferma({
    title: promo ? 'Inviare la comunicazione PROMOZIONALE?' : 'Inviare la comunicazione INFORMATIVA?',
    description: `«${titolo.value.trim()}» arriverà nel portale e per email a ${conteggio.value} ${conteggio.value === 1 ? 'famiglia' : 'famiglie'}`
      + (promo ? ' (solo chi ha dato il consenso alle promozioni)' : '')
      + '. Dopo l\'invio non si può più modificare.',
    confirmLabel: 'Invia',
    attendi: true,
  }, invia)
}

async function invia() {
  try {
    const r = await $fetch('/api/comunicazioni', { method: 'POST', body: corpo() })
    toast.add({
      title: `Inviata a ${r.destinatari} ${r.destinatari === 1 ? 'famiglia' : 'famiglie'}, email partite ${r.inviate}, non partite ${r.nonPartite}`,
      color: r.nonPartite > 0 ? 'warning' : 'success',
    })
    titolo.value = ''
    testo.value = ''
    tipo.value = null
    await refreshStorico()
  } catch (err) {
    toast.add({ title: messaggioErrore(err, 'Non è stato possibile inviare la comunicazione'), color: 'error' })
    throw err // la finestra di conferma resta aperta per riprovare
  }
}

// ─── Storico ───
const { data: storicoData, pending: pendingStorico, refresh: refreshStorico } = useLazyFetch('/api/comunicazioni')
const storico = computed(() => storicoData.value ?? [])

const riprovando = ref<string | null>(null)
async function riprova(id: string) {
  riprovando.value = id
  try {
    const r = await $fetch(`/api/comunicazioni/${id}/riprova`, { method: 'POST' })
    toast.add({
      title: `Email partite ${r.inviate}, non partite ${r.nonPartite}`,
      color: r.nonPartite > 0 ? 'warning' : 'success',
    })
    await refreshStorico()
  } catch (err) {
    toast.add({ title: messaggioErrore(err, 'Non è stato possibile riprovare'), color: 'error' })
  } finally {
    riprovando.value = null
  }
}

function chiediEliminazione(id: string, titoloComunicazione: string) {
  chiediConferma({
    title: 'Eliminare la comunicazione?',
    description: `«${titoloComunicazione}» sparirà dal portale delle famiglie. Le email già partite non si possono richiamare: restano nella posta di chi le ha ricevute.`,
    confirmLabel: 'Elimina',
    confirmColor: 'error',
    attendi: true,
  }, async () => {
    try {
      await $fetch(`/api/comunicazioni/${id}`, { method: 'DELETE' })
      toast.add({ title: 'Comunicazione tolta dal portale', color: 'success' })
      await refreshStorico()
    } catch (err) {
      toast.add({ title: messaggioErrore(err, 'Non è stato possibile eliminarla'), color: 'error' })
      throw err
    }
  })
}
</script>
