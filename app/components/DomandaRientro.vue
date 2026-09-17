<template>
  <!-- Compare solo se la segreteria ha acceso la domanda nella pagina Rientri
       e se c'è almeno un figlio attivo: altrimenti il server risponde vuoto. -->
  <section v-if="figli.length" class="space-y-4" aria-labelledby="titolo-domanda-rientro">
    <h2 id="titolo-domanda-rientro" class="text-lg font-bold text-slate-800 flex items-center gap-2">
      <UIcon name="i-heroicons-calendar-days" class="w-5 h-5 text-tfn-500" />
      Il nuovo anno scolastico
    </h2>

    <UCard
      v-for="f in figli"
      :key="f.studentId"
      class="border border-tfn-100 rounded-xl"
    >
      <div class="space-y-4">
        <h3 :id="`domanda-rientro-${f.studentId}`" class="font-semibold text-slate-800">
          {{ f.firstName }} torna da noi quest'anno ({{ anno }})?
        </h3>

        <!-- La risposta l'ha segnata la segreteria: si legge soltanto -->
        <p v-if="!f.puoRispondere" class="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">
          Abbiamo registrato: {{ fraseRegistrata(f) }}.
          Se è cambiato qualcosa, scrivici o chiamaci.
        </p>

        <template v-else>
          <!-- Tre bottoni veri: quello scelto è annunciato come "premuto" e ha la
               spunta, così la scelta non si capisce solo dal colore -->
          <div
            role="group"
            :aria-labelledby="`domanda-rientro-${f.studentId}`"
            class="grid grid-cols-1 sm:grid-cols-3 gap-2"
          >
            <UButton
              v-for="s in SCELTE"
              :key="s.value"
              block
              size="lg"
              :color="scelte[f.studentId] === s.value ? 'primary' : 'neutral'"
              :variant="scelte[f.studentId] === s.value ? 'solid' : 'outline'"
              :icon="scelte[f.studentId] === s.value ? 'i-heroicons-check' : undefined"
              :aria-pressed="scelte[f.studentId] === s.value"
              @click="() => { scelte[f.studentId] = s.value }"
            >
              {{ s.label }}
            </UButton>
          </div>

          <UFormField label="Vuoi aggiungere qualcosa? (facoltativo)" :name="`nota-rientro-${f.studentId}`">
            <UTextarea
              v-model="note[f.studentId]"
              :rows="2"
              :maxlength="500"
              class="w-full"
              placeholder="Es. preferiamo i pomeriggi del martedì"
            />
          </UFormField>

          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <UButton
              color="primary"
              size="lg"
              class="justify-center"
              :loading="inInvio === f.studentId"
              :disabled="!daInviare(f)"
              @click="() => invia(f)"
            >
              {{ f.stato === 'DA_SENTIRE' ? 'Invia la risposta' : 'Aggiorna la risposta' }}
            </UButton>
            <!-- role="status": chi usa un lettore di schermo sente il "grazie" -->
            <p v-if="f.stato !== 'DA_SENTIRE'" role="status" class="text-sm text-slate-600">
              Grazie! Abbiamo ricevuto la risposta «{{ etichetta(f.stato) }}»<template v-if="f.dataRisposta"> il {{ formatGiorno(f.dataRisposta) }}</template>.
              Se cambia qualcosa puoi aggiornarla qui.
            </p>
          </div>
        </template>
      </div>
    </UCard>
  </section>
</template>

<script setup lang="ts">
// La domanda di inizio anno nella home del portale del GENITORE:
// «Luca torna da noi quest'anno?» Sì / Non lo so ancora / No.
// Le regole (interruttore, figli attivi, risposte già segnate dalla segreteria)
// le decide il server: qui si mostra solo quello che arriva.
import type { StatoRientro } from '#shared/rientri'
import { formatGiorno } from '~/utils/contatti'

type Risposta = Exclude<StatoRientro, 'DA_SENTIRE'>

interface FiglioRientro {
  studentId: string
  firstName: string
  lastName: string
  stato: StatoRientro
  dataRisposta: string | null
  /** false = l'ha segnata la segreteria: la famiglia la vede e basta */
  puoRispondere: boolean
}

const SCELTE: { value: Risposta; label: string }[] = [
  { value: 'CONFERMATO', label: 'Sì, torna' },
  { value: 'IN_FORSE',   label: 'Non lo so ancora' },
  { value: 'NON_TORNA',  label: 'No, non torna' },
]

const toast = useToast()

const { data, refresh } = useLazyFetch<{ anno: string; figli: FiglioRientro[] }>('/api/portal/rientri', { server: false })

const anno  = computed(() => data.value?.anno ?? '')
const figli = computed(() => data.value?.figli ?? [])

// La scelta sui bottoni e la nota che si sta scrivendo, per ogni figlio
const scelte = reactive<Record<string, Risposta | undefined>>({})
const note   = reactive<Record<string, string>>({})

// All'arrivo dei dati i bottoni partono dalla risposta già data (se c'è)
watch(figli, (lista) => {
  for (const f of lista) {
    scelte[f.studentId] = f.stato === 'DA_SENTIRE' ? undefined : f.stato
  }
}, { immediate: true })

const etichetta = (stato: StatoRientro) => SCELTE.find((s) => s.value === stato)?.label ?? ''

function fraseRegistrata(f: FiglioRientro): string {
  if (f.stato === 'CONFERMATO') return `${f.firstName} torna`
  if (f.stato === 'NON_TORNA')  return `${f.firstName} non torna`
  return 'ci state ancora pensando'
}

// Si invia se c'è una scelta nuova, o la stessa di prima con una nota in più
function daInviare(f: FiglioRientro): boolean {
  const scelta = scelte[f.studentId]
  if (!scelta) return false
  return scelta !== f.stato || Boolean(note[f.studentId]?.trim())
}

const inInvio = ref<string | null>(null)

async function invia(f: FiglioRientro) {
  const stato = scelte[f.studentId]
  if (!stato || inInvio.value) return

  inInvio.value = f.studentId
  try {
    await $fetch('/api/portal/rientri', {
      method: 'POST',
      body: { studentId: f.studentId, stato, nota: note[f.studentId]?.trim() || undefined },
    })
    note[f.studentId] = ''
    toast.add({ title: 'Grazie, abbiamo ricevuto la tua risposta', color: 'success' })
    // Si rilegge dal server: la data della risposta la mette lui
    await refresh()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'Non è stato possibile inviare la risposta. Riprova fra poco.', color: 'error' })
    // Nel frattempo può essere cambiato qualcosa (la segreteria ha già segnato la
    // risposta, o ha spento la domanda): si rilegge, così il riquadro dice il vero.
    await refresh()
  } finally {
    inInvio.value = null
  }
}
</script>
