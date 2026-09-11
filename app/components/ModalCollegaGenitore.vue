<template>
  <UModal v-model:open="isOpen" title="Collega un genitore già registrato" :ui="{ content: 'max-w-xl' }">
    <template #body>
      <!-- 1. RICERCA -->
      <div v-if="!scelta" class="space-y-3">
        <p class="text-sm text-slate-600">
          Un fratello o una sorella di <strong>{{ nomeAlunno || "quest'alunno" }}</strong> è già iscritto?
          Trova il genitore e i suoi dati si copiano su questa scheda, compresi quelli per la fattura.
        </p>
        <CercaGenitore autofocus @scegli="scegli" />
      </div>

      <!-- 2. CONFERMA -->
      <div v-else class="space-y-4">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <p class="text-sm text-slate-700">
              <strong class="text-slate-900">{{ scelta.nome || scelta.email }}</strong><template v-if="scelta.figli[0]">, {{ parolaParentela(scelta.relazione) }} di {{ scelta.figli.map((f) => f.nome).join(', ') }}</template>
            </p>
            <UButton variant="link" size="xs" icon="i-heroicons-arrow-uturn-left" @click="() => { scelta = null }">Cambia persona</UButton>
          </div>
          <p class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span v-if="scelta.telefono">{{ scelta.telefono }}</span>
            <span v-if="scelta.email" class="break-all">{{ scelta.email }}</span>
            <span v-if="scelta.cf">CF {{ scelta.cf }}</span>
            <span v-if="scelta.piva">P.IVA {{ scelta.piva }}</span>
          </p>
        </div>

        <UAlert
          v-if="giaSuQuestaScheda"
          color="info"
          variant="subtle"
          icon="i-heroicons-information-circle"
          :description="`${scelta.nome || 'Questo genitore'} risulta già registrato su questa scheda: collegalo solo se vuoi sostituire i dati di un riquadro.`"
        />

        <URadioGroup v-model="posto" legend="Dove lo registro su questa scheda?" :items="opzioniPosto" />

        <!-- Sostituire un riquadro pieno cancella quello che c'è scritto: va detto PRIMA -->
        <UAlert
          v-if="postoScelto && occupato(postoScelto)"
          color="warning"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          :title="`I dati di ${chiE(postoScelto)} verranno sostituiti`"
          :description="`Nome, recapiti e dati fiscali del ${nomePosto(postoScelto)} diventano quelli di ${scelta.nome || 'questo genitore'}. L'eventuale suo accesso al portale resta attivo: si toglie dalla sezione Credenziali Portale Famiglie.`"
        />

        <template v-if="scelta.account">
          <UCheckbox
            v-if="!giaCollegato(scelta.account)"
            v-model="collegaAccount"
            :label="`Collega anche il suo accesso al portale: vedrà anche ${nomeAlunno || 'questo alunno'}`"
            description="Entra con la sua solita email e password: nessun account nuovo, nessun link da mandare."
          />
          <p v-else class="text-sm text-slate-500 flex items-start gap-1.5">
            <UIcon name="i-heroicons-globe-alt" class="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>Il suo accesso al portale è già collegato a {{ nomeAlunno || 'questo alunno' }}.</span>
          </p>
        </template>

        <!-- L'altro genitore del fratello: si copia solo se c'è un posto libero e
             solo se lo si chiede (fratelli con un solo genitore in comune esistono). -->
        <div v-if="altro && postoAltro" class="space-y-2 border-t border-slate-100 pt-3">
          <UCheckbox
            v-model="copiaAltro"
            :label="`Copia anche ${altro.nome || altro.email || 'l\'altro genitore'} (${parolaParentela(altro.relazione)} di ${scelta.figli[0]?.nome ?? 'suo figlio'})`"
            :description="`Va nel riquadro del ${nomePosto(postoAltro)}, che ora è libero.`"
          />
          <UCheckbox
            v-if="copiaAltro && altro.account && !giaCollegato(altro.account)"
            v-model="collegaAccountAltro"
            class="ms-6"
            :label="`Collega anche il suo accesso al portale: vedrà anche ${nomeAlunno || 'questo alunno'}`"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-wrap justify-end gap-3 w-full">
        <UButton variant="ghost" :disabled="salvando" @click="() => { isOpen = false }">Annulla</UButton>
        <UButton
          v-if="scelta"
          icon="i-heroicons-link"
          :loading="salvando"
          :disabled="!postoScelto"
          @click="collega"
        >
          Collega genitore
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// "COLLEGA UN GENITORE GIÀ REGISTRATO" dalla scheda dell'alunno (C5).
// Funziona anche per un alunno creato SENZA genitore: è proprio la richiesta.
// Cerca → scegli → decidi dove metterlo → salva. Salvare vuol dire:
// 1. copiare i suoi dati nelle colonne del posto scelto (una fotocopia: niente
//    scheda famiglia condivisa, vedi shared/genitori.ts);
// 2. se ha già l'accesso al portale, COLLEGARE questo alunno allo stesso account
//    (password invariata: entra come sempre e trova un figlio in più).
import { COLONNE_SERIE, ETICHETTE_CAMPO, haDatiGenitore, leggiSerie, parolaParentela, scriviSerie } from '#shared/genitori'
import type { AccountGenitore, CampoGenitore, PersonaGenitore, Slot } from '#shared/genitori'

const props = defineProps<{
  studentId: string
  /** Nome e cognome dell'alunno di questa scheda, per le frasi ("vedrà anche Sara Rossi") */
  nomeAlunno: string
  /** La scheda com'è ora: servono le due serie di colonne dei genitori */
  scheda: Record<string, any> | null
  /** Account del portale già collegati a questo alunno (id utente) */
  accountCollegati: string[]
}>()

const emit = defineEmits<{ collegato: [] }>()
const isOpen = defineModel<boolean>('open', { default: false })
const toast = useToast()

const scelta = ref<PersonaGenitore | null>(null)
// Il gruppo di bottoni lavora con testo: '1' = primo genitore, '2' = secondo
const posto = ref<string | undefined>(undefined)
const collegaAccount = ref(true)
const copiaAltro = ref(false)
const collegaAccountAltro = ref(true)
const salvando = ref(false)

// Ogni apertura riparte dalla ricerca
watch(isOpen, (aperta) => {
  if (aperta) scelta.value = null
})

const serie = computed(() => ({ 1: leggiSerie(props.scheda, 1), 2: leggiSerie(props.scheda, 2) }))
const occupato = (slot: Slot) => haDatiGenitore(serie.value[slot])
const nomePosto = (slot: Slot) => (slot === 1 ? 'primo genitore' : 'secondo genitore')
const chiE = (slot: Slot) => {
  const d = serie.value[slot]
  return d.nome || d.email || d.telefono || nomePosto(slot)
}
const postoScelto = computed<Slot | null>(() => (posto.value === '1' ? 1 : posto.value === '2' ? 2 : null))

const opzioniPosto = computed(() => ([1, 2] as Slot[]).map((slot) => ({
  value: String(slot),
  label: slot === 1 ? 'Primo genitore' : 'Secondo genitore',
  description: occupato(slot)
    ? `Ora c'è ${chiE(slot)}: i suoi dati verranno sostituiti.`
    : slot === 1 ? 'Libero. È quello a cui si intestano le fatture.' : 'Libero.',
})))

const altro = computed(() => scelta.value?.altroGenitore ?? null)
// L'altro genitore va nell'ALTRO riquadro, e solo se è libero: non si sostituisce
// nessuno senza che la segreteria l'abbia scelto esplicitamente.
const postoAltro = computed<Slot | null>(() => {
  if (!postoScelto.value || !altro.value) return null
  const slot: Slot = postoScelto.value === 1 ? 2 : 1
  return occupato(slot) ? null : slot
})

const giaSuQuestaScheda = computed(() => Boolean(scelta.value?.figli.some((f) => f.id === props.studentId)))
const giaCollegato = (a: AccountGenitore | null) => Boolean(a && props.accountCollegati.includes(a.userId))

function scegli(p: PersonaGenitore) {
  scelta.value = p
  // Proposto il primo posto libero; se sono pieni tutti e due, si sceglie a mano
  // quale sostituire (niente scelta già fatta: sostituire cancella dei dati).
  posto.value = !occupato(1) ? '1' : !occupato(2) ? '2' : undefined
  collegaAccount.value = true
  copiaAltro.value = false
  collegaAccountAltro.value = true
}

// Le colonne rifiutate dal server, dette con le parole della segreteria
function campoDaColonna(colonna: string): string {
  for (const slot of [1, 2] as Slot[]) {
    const campo = (Object.keys(COLONNE_SERIE[slot]) as CampoGenitore[]).find((c) => COLONNE_SERIE[slot][c] === colonna)
    if (campo) return ETICHETTE_CAMPO[campo]
  }
  return colonna
}

function descriviErrore(e: any): string {
  const errori = e?.data?.data?.errors as Record<string, unknown> | undefined
  if (errori && Object.keys(errori).length > 0) {
    const campi = [...new Set(Object.keys(errori).map(campoDaColonna))]
    return `Alcuni dati copiati non sono validi (${campi.join(', ')}): correggili sulla scheda da cui li hai presi, poi riprova.`
  }
  return e?.data?.statusMessage ?? 'Impossibile salvare i dati del genitore.'
}

async function collega() {
  const p = scelta.value
  const dest = postoScelto.value
  if (!p || !dest) return
  const altroDaCopiare = copiaAltro.value && altro.value && postoAltro.value
    ? { dati: altro.value, slot: postoAltro.value }
    : null

  salvando.value = true
  try {
    // 1. L'anagrafica: TUTTE le colonne del posto scelto, anche quelle vuote. Se
    //    si sostituisce qualcuno, niente deve restare del genitore di prima (un
    //    CAP vecchio sotto l'indirizzo nuovo farebbe una fattura sbagliata).
    const body = {
      ...scriviSerie(p, dest),
      ...(altroDaCopiare ? scriviSerie(altroDaCopiare.dati, altroDaCopiare.slot) : {}),
    }
    try {
      // Indirizzo tenuto come testo semplice: scritto "a stampo" TypeScript lo
      // confonde con /api/students/stats (solo lettura) e rifiuterebbe il PUT.
      const indirizzoScheda: string = `/api/students/${props.studentId}`
      await $fetch(indirizzoScheda, { method: 'PUT', body })
    } catch (e: any) {
      toast.add({ title: 'Genitore non collegato', description: descriviErrore(e), color: 'error' })
      return
    }

    // 2. Gli accessi al portale, uno alla volta. Se l'anagrafica è salvata e un
    //    collegamento no, lo si dice senza disfare il resto.
    const daCollegare: { nome: string; account: AccountGenitore; relazione: string | null }[] = []
    if (p.account && collegaAccount.value && !giaCollegato(p.account)) {
      daCollegare.push({ nome: p.nome || p.account.email, account: p.account, relazione: p.relazione })
    }
    const a = altroDaCopiare?.dati
    if (a?.account && collegaAccountAltro.value && !giaCollegato(a.account)) {
      daCollegare.push({ nome: a.nome || a.account.email, account: a.account, relazione: a.relazione })
    }

    const collegati: string[] = []
    const nonRiusciti: string[] = []
    for (const x of daCollegare) {
      try {
        await $fetch(`/api/admin/students/${props.studentId}/portal-access`, {
          method: 'POST',
          body: {
            email: x.account.email,
            force: true,
            ...(x.relazione ? { relazione: x.relazione.slice(0, 50) } : {}),
          },
        })
        collegati.push(x.nome)
      } catch (e: any) {
        const messaggio: string = e?.data?.statusMessage ?? ''
        // "Già collegato" non è un errore: è esattamente quello che volevamo
        if (messaggio.includes('già collegato')) collegati.push(x.nome)
        else nonRiusciti.push(`${x.nome}: ${messaggio || 'collegamento non riuscito'}`)
      }
    }

    const frasi = [`${p.nome || 'Il genitore'} ora è il ${nomePosto(dest)} di ${props.nomeAlunno || "quest'alunno"}.`]
    if (altroDaCopiare) frasi.push(`Copiato anche ${altroDaCopiare.dati.nome || "l'altro genitore"}.`)
    if (collegati.length > 0) {
      frasi.push(`${collegati.join(' e ')} ${collegati.length === 1 ? 'entra' : 'entrano'} nel portale con la solita password e ${collegati.length === 1 ? 'trova' : 'trovano'} anche ${props.nomeAlunno || "quest'alunno"}.`)
    }
    toast.add({ title: 'Genitore collegato', description: frasi.join(' '), color: 'success', icon: 'i-heroicons-check-circle' })
    if (nonRiusciti.length > 0) {
      toast.add({
        title: 'Accesso al portale non collegato',
        description: `${nonRiusciti.join(' — ')}. Puoi riprovare da Credenziali Portale Famiglie.`,
        color: 'warning',
      })
    }

    isOpen.value = false
    emit('collegato')
  } finally {
    salvando.value = false
  }
}
</script>
