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

        <!-- Foto facoltativa: si vede INTERA sotto il testo, nel portale e nell'email -->
        <UFormField label="Foto (facoltativa)">
          <UFileUpload
            v-model="fileImmagine"
            accept="image/*"
            label="Trascina o clicca per scegliere"
            description="JPG/PNG fino a 10 MB — viene ridotta automaticamente"
            class="w-full min-h-24"
          />
          <p class="text-xs text-slate-500 mt-1">
            Consigliata orizzontale, 1200 × 800 pixel. Va bene anche una locandina verticale: si vede intera.
          </p>
          <p class="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
            Se nella foto si riconoscono degli alunni, usala solo con quelli che hanno dato il consenso foto e video.
          </p>
          <div v-if="immagine" class="mt-2 flex items-start gap-2">
            <img :src="immagine" alt="Anteprima della foto" class="max-h-48 rounded border border-slate-200" />
            <UButton size="xs" variant="ghost" color="error" icon="i-heroicons-x-mark" @click="() => { immagine = null }">Togli</UButton>
          </div>
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
              <summary class="cursor-pointer text-slate-500">Mostra {{ c.conImmagine ? 'la foto e il testo' : 'il testo' }}</summary>
              <!-- Foto in cima e intera, come la vedono le famiglie. Dal suo indirizzo, non
                   dentro l'elenco: si scarica solo aprendo -->
              <img v-if="c.conImmagine && !c.eliminataAt" :src="`/api/immagini/comunicazioni/${c.id}`" alt="" loading="lazy" class="mt-2 max-h-64 rounded border border-slate-200" />
              <p class="mt-2 text-slate-700 whitespace-pre-wrap">{{ c.testo }}</p>
            </details>
  
            <p class="text-sm text-slate-600">
              Ricevuta da <strong>{{ c.destinatari }}</strong> · letta da <strong>{{ c.lette }}</strong>
              · email partite <strong>{{ c.emailInviate }}</strong>
              <template v-if="c.emailNonPartite > 0">
                · <span class="text-error font-semibold">non partite {{ c.emailNonPartite }}</span>
                <span v-if="c.emailSpente > 0" class="text-slate-500">
                  ({{ c.emailSpente === c.emailNonPartite ? 'tutte' : c.emailSpente }} perché l'invio email è spento nelle Impostazioni)
                </span>
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
// La foto, già ridotta nel browser (app/utils/immagini.ts): 1200 px sul lato lungo
const immagine = ref<string | null>(null)
const fileImmagine = ref<File | null>(null)
watch(fileImmagine, async (file) => {
  if (!file) return
  try {
    immagine.value = await ridimensionaImmagine(file)
  } catch (e: any) {
    toast.add({ title: 'Foto non caricata', description: e?.message, color: 'error' })
  } finally {
    fileImmagine.value = null
  }
})

const pronta = computed(() => !!titolo.value.trim() && !!testo.value.trim() && !!tipo.value)

function corpo() {
  return { titolo: titolo.value, testo: testo.value, tipo: tipo.value, immagine: immagine.value }
}

function messaggioErrore(err: unknown, ripiego: string): string {
  const dati = (err as { data?: { statusMessage?: string; data?: { errors?: Record<string, string[]> } } })?.data
  // Una foto rifiutata dal server (troppo pesante, formato strano) ha il suo messaggio
  return dati?.data?.errors?.immagine?.[0] ?? dati?.statusMessage ?? ripiego
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
      toast.add({ title: `Prova inviata a ${r.email}`, description: 'Nessuna famiglia l\'ha ricevuta e nello storico non compare.', color: 'success' })
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

// Email spente in Impostazioni: la comunicazione è comunque nel portale, va detto
// chiaro, altrimenti "non partite" sembra un guasto della posta.
function avvisoEmailSpente(spente: number): string | undefined {
  if (!spente) return undefined
  return 'Invio email spento nelle Impostazioni (scheda Email): la comunicazione è comunque nel portale. '
    + 'Quando riaccendi l\'invio puoi usare «Riprova le email non partite».'
}

async function invia() {
  try {
    const r = await $fetch('/api/comunicazioni', { method: 'POST', body: corpo() })
    toast.add({
      title: `Inviata a ${r.destinatari} ${r.destinatari === 1 ? 'famiglia' : 'famiglie'}, email partite ${r.inviate}, non partite ${r.nonPartite}`,
      description: avvisoEmailSpente(r.spente),
      color: r.nonPartite > 0 ? 'warning' : 'success',
    })
    titolo.value = ''
    testo.value = ''
    tipo.value = null
    immagine.value = null
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
      description: avvisoEmailSpente(r.spente),
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
    description: `«${titoloComunicazione}» sparirà dal portale delle famiglie. Le email già partite non si possono richiamare: restano nella posta di chi le ha ricevute, ma senza più la foto.`,
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
