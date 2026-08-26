<template>
  <UModal v-model:open="aperto" title="Importa contatti da un file CSV" :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <div class="space-y-4">

        <!-- ═══ 1. SCELTA DEL FILE ═══ -->
        <template v-if="fase === 'scelta'">
          <div class="rounded-xl bg-slate-50 p-4 space-y-2 text-sm text-slate-600">
            <p class="font-medium text-slate-800">Come si fa</p>
            <ol class="list-decimal pl-5 space-y-1">
              <li>
                Scarica il modello già pronto:
                <a
                  href="/template-contatti.csv" download
                  class="text-tfn-600 font-medium hover:underline inline-flex items-center gap-1"
                >
                  <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
                  Scarica il template
                </a>
              </li>
              <li>Aprilo con Excel, riempi una riga per ogni persona e cancella le due righe di esempio.</li>
              <li>Salva mantenendo il formato CSV, poi ricaricalo qui sotto.</li>
            </ol>
            <p class="text-xs text-slate-500">
              Le colonne che non ti servono si lasciano vuote. La colonna «tipo» vuota vale
              <strong>{{ labelTipo(tipoDefault) }}</strong>, cioè la scheda che hai aperto.
            </p>
          </div>

          <UFormField label="File da caricare" name="file" hint="Solo file .csv">
            <input
              ref="campoFile"
              type="file"
              accept=".csv,text/csv"
              class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              @change="onFileScelto"
            >
          </UFormField>

          <UAlert
            v-if="erroreFile"
            color="error" variant="subtle" icon="i-heroicons-exclamation-triangle"
            :title="erroreFile"
          />
        </template>

        <!-- ═══ 2. ANTEPRIMA ═══ -->
        <template v-else-if="fase === 'anteprima'">
          <div class="flex flex-wrap gap-3">
            <div class="rounded-xl bg-slate-50 px-4 py-3">
              <p class="text-xs text-slate-500">Righe lette</p>
              <p class="text-xl font-bold text-slate-900">{{ righeValide.length + righeErrate.length }}</p>
            </div>
            <div class="rounded-xl bg-emerald-50 px-4 py-3">
              <p class="text-xs text-emerald-700">Pronte da importare</p>
              <p class="text-xl font-bold text-emerald-700">{{ righeValide.length }}</p>
            </div>
            <div v-if="righeErrate.length > 0" class="rounded-xl bg-red-50 px-4 py-3">
              <p class="text-xs text-red-700">Righe con errori (escluse)</p>
              <p class="text-xl font-bold text-red-700">{{ righeErrate.length }}</p>
            </div>
          </div>

          <p class="text-xs text-slate-500">File: {{ nomeFile }}</p>

          <!-- Prime 5 righe valide -->
          <div v-if="righeValide.length > 0">
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Anteprima (prime {{ Math.min(5, righeValide.length) }} righe)
            </p>
            <div class="overflow-x-auto rounded-xl ring-1 ring-slate-200">
              <table class="w-full text-sm">
                <thead class="bg-slate-50 text-slate-600">
                  <tr>
                    <th class="text-left font-semibold px-3 py-2">Riga</th>
                    <th class="text-left font-semibold px-3 py-2">Scheda</th>
                    <th class="text-left font-semibold px-3 py-2">Nome</th>
                    <th class="text-left font-semibold px-3 py-2">Recapito</th>
                    <th class="text-left font-semibold px-3 py-2">Fonte</th>
                    <th class="text-left font-semibold px-3 py-2">Stato</th>
                    <th class="text-left font-semibold px-3 py-2">Ricontatto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in righeValide.slice(0, 5)" :key="r.numeroRiga" class="border-t border-slate-100">
                    <td class="px-3 py-2 text-slate-400">{{ r.numeroRiga }}</td>
                    <td class="px-3 py-2">{{ schedaRiga(r.dati) }}</td>
                    <td class="px-3 py-2 font-medium text-slate-800">
                      {{ [r.dati.cognome, r.dati.nome].filter(Boolean).join(' ') }}
                    </td>
                    <td class="px-3 py-2 text-slate-600">{{ r.dati.telefono || r.dati.email || r.dati.socialLink }}</td>
                    <td class="px-3 py-2">{{ labelCanale(r.dati.canaleOrigine) }}</td>
                    <td class="px-3 py-2">{{ labelStato(r.dati.stato) }}</td>
                    <td class="px-3 py-2">{{ r.dati.prossimoRicontatto ? formatGiorno(r.dati.prossimoRicontatto) : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Errori riga per riga -->
          <div v-if="righeErrate.length > 0">
            <p class="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
              Righe che verranno saltate
            </p>
            <ul class="text-sm text-slate-700 space-y-1 max-h-48 overflow-y-auto rounded-xl bg-red-50 p-3">
              <li v-for="e in righeErrate" :key="e.numeroRiga">
                <span class="font-medium">Riga {{ e.numeroRiga }}:</span> {{ e.motivo }}
              </li>
            </ul>
            <p class="text-xs text-slate-500 mt-1">
              Correggile nel file e ricaricalo, oppure vai avanti: verranno semplicemente ignorate.
            </p>
          </div>

          <UAlert
            v-if="righeValide.length === 0"
            color="warning" variant="subtle" icon="i-heroicons-exclamation-triangle"
            title="Non c'è nessuna riga da importare"
            description="Controlla che il file abbia le colonne del template e almeno un recapito per riga: telefono, email o profilo social."
          />
        </template>

        <!-- ═══ 3. RIEPILOGO ═══ -->
        <template v-else>
          <div class="flex flex-wrap gap-3">
            <div class="rounded-xl bg-emerald-50 px-4 py-3">
              <p class="text-xs text-emerald-700">Importati</p>
              <p class="text-xl font-bold text-emerald-700">{{ esito.importati }}</p>
            </div>
            <div class="rounded-xl bg-amber-50 px-4 py-3">
              <p class="text-xs text-amber-700">Saltati (doppioni)</p>
              <p class="text-xl font-bold text-amber-700">{{ esito.saltati.length }}</p>
            </div>
            <div class="rounded-xl bg-red-50 px-4 py-3">
              <p class="text-xs text-red-700">Con errori</p>
              <p class="text-xl font-bold text-red-700">{{ esito.errori.length }}</p>
            </div>
          </div>

          <p class="text-sm text-slate-600">
            {{ esito.importati }} importati, {{ esito.saltati.length }} saltati (doppioni),
            {{ esito.errori.length }} con errori.
          </p>

          <div v-if="esito.saltati.length > 0">
            <p class="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Saltati</p>
            <ul class="text-sm text-slate-700 space-y-1 max-h-40 overflow-y-auto rounded-xl bg-amber-50 p-3">
              <li v-for="s in esito.saltati" :key="`s-${s.riga}`">
                <span class="font-medium">Riga {{ s.riga }}:</span> {{ s.motivo }}
              </li>
            </ul>
          </div>

          <div v-if="esito.errori.length > 0">
            <p class="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Con errori</p>
            <ul class="text-sm text-slate-700 space-y-1 max-h-40 overflow-y-auto rounded-xl bg-red-50 p-3">
              <li v-for="e in esito.errori" :key="`e-${e.riga}`">
                <span class="font-medium">Riga {{ e.riga }}:</span> {{ e.motivo }}
              </li>
            </ul>
          </div>
        </template>

      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <template v-if="fase === 'scelta'">
          <UButton variant="ghost" @click="chiudi">Chiudi</UButton>
        </template>

        <template v-else-if="fase === 'anteprima'">
          <UButton variant="ghost" :disabled="importando" @click="ricomincia">Scegli un altro file</UButton>
          <UButton :loading="importando" :disabled="righeValide.length === 0" @click="importa">
            Importa {{ righeValide.length }} contatti
          </UButton>
        </template>

        <template v-else>
          <UButton variant="ghost" @click="ricomincia">Importa un altro file</UButton>
          <UButton @click="chiudi">Chiudi</UButton>
        </template>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Caricamento di una lista di contatti preparata in Excel.
// Il file viene letto QUI nel browser (nessuna libreria esterna): così si vede
// subito l'anteprima e quali righe sono sbagliate, prima di toccare il database.
import { labelTipo, labelStato, labelCanale } from '#shared/contatti'
import type { TipoContatto } from '#shared/contatti'
import { normalizzaRigaImport, COLONNE_IMPORT } from '#shared/contatti-import'
import type { RigaImportContatto } from '#shared/contatti-import'
import type { CreateContactInput } from '#shared/schemas/contact.schema'
import { formatGiorno } from '~/utils/contatti'

const props = defineProps<{
  /** Scheda aperta: vale per le righe che lasciano vuota la colonna "tipo" */
  tipoDefault: TipoContatto
}>()

const emit = defineEmits<{ imported: [] }>()
const aperto = defineModel<boolean>('open', { default: false })

const toast = useToast()

// Nell'anteprima un candidato tutor si riconosce a colpo d'occhio dalla famiglia
const schedaRiga = (d: CreateContactInput): string =>
  d.tipo === 'DOPOSCUOLA' && d.doposcuolaRuolo === 'TUTOR'
    ? `${labelTipo(d.tipo)} · tutor`
    : labelTipo(d.tipo)

// Oltre questa soglia il file è quasi sicuramente sbagliato (o troppo grosso)
const MAX_RIGHE = 5000
// Quante righe si mandano al server in una volta sola
const BLOCCO = 500

type Fase = 'scelta' | 'anteprima' | 'riepilogo'
const fase = ref<Fase>('scelta')

const campoFile  = ref<HTMLInputElement | null>(null)
const nomeFile   = ref('')
const erroreFile = ref('')

const righeValide = ref<Array<{ numeroRiga: number; grezza: RigaImportContatto; dati: CreateContactInput }>>([])
const righeErrate = ref<Array<{ numeroRiga: number; motivo: string }>>([])

const importando = ref(false)
const esito = ref<{
  importati: number
  saltati: Array<{ riga: number; motivo: string }>
  errori:  Array<{ riga: number; motivo: string }>
}>({ importati: 0, saltati: [], errori: [] })

// Ogni apertura riparte da zero; alla chiusura si avvisa la pagina (che ricarica
// lista e pallino del menu) se qualcosa è stato davvero importato.
watch(aperto, (adessoAperto) => {
  if (adessoAperto) ricomincia()
  else if (esito.value.importati > 0) emit('imported')
})

function chiudi() {
  aperto.value = false
}

function ricomincia() {
  fase.value = 'scelta'
  nomeFile.value = ''
  erroreFile.value = ''
  righeValide.value = []
  righeErrate.value = []
  esito.value = { importati: 0, saltati: [], errori: [] }
  if (campoFile.value) campoFile.value.value = ''
}

// ─────────────────────────────────────────────
// LETTURA DEL FILE
// ─────────────────────────────────────────────

/**
 * Excel salva i CSV in due modi: "CSV UTF-8" (col BOM in testa) e "CSV" normale
 * (codifica Windows). Qui si riconoscono entrambi, altrimenti le lettere
 * accentate arriverebbero storte.
 */
async function testoDelFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/**
 * Legge un CSV con separatore ';'. Gestisce le celle fra virgolette (che possono
 * contenere ';', a capo e virgolette raddoppiate) e i fine riga sia Windows sia Mac/Linux.
 * Restituisce il numero di riga NEL FILE, così i messaggi indicano la riga giusta.
 */
function leggiCsv(testo: string): Array<{ numeroRiga: number; celle: string[] }> {
  const t = testo.replace(/^\uFEFF/, '')
  const righe: Array<{ numeroRiga: number; celle: string[] }> = []

  let celle: string[] = []
  let cella = ''
  let fraVirgolette = false
  let numeroRiga = 1

  const chiudiRiga = () => {
    celle.push(cella)
    // Le righe completamente vuote non si contano come dati, ma il numero avanza lo stesso
    if (celle.some((c) => c.trim() !== '')) righe.push({ numeroRiga, celle })
    celle = []
    cella = ''
    numeroRiga++
  }

  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (fraVirgolette) {
      if (ch === '"') {
        if (t[i + 1] === '"') { cella += '"'; i++ }
        else fraVirgolette = false
      } else {
        cella += ch
      }
      continue
    }
    if (ch === '"') fraVirgolette = true
    else if (ch === ';') { celle.push(cella); cella = '' }
    else if (ch === '\n') chiudiRiga()
    else if (ch !== '\r') cella += ch
  }
  // Ultima riga senza a capo finale
  if (cella !== '' || celle.length > 0) chiudiRiga()

  return righe
}

async function onFileScelto(evento: Event) {
  const file = (evento.target as HTMLInputElement).files?.[0]
  if (!file) return

  erroreFile.value = ''
  nomeFile.value = file.name

  try {
    const righe = leggiCsv(await testoDelFile(file))
    if (righe.length < 2) {
      erroreFile.value = 'Il file non contiene righe di dati: c\'è solo l\'intestazione (o è vuoto).'
      return
    }
    if (righe.length - 1 > MAX_RIGHE) {
      erroreFile.value = `Il file ha più di ${MAX_RIGHE} righe: dividilo in più file.`
      return
    }

    // La prima riga è l'intestazione: si accettano sia "prossimo_ricontatto"
    // sia "Prossimo ricontatto" (maiuscole, spazi e accenti non contano)
    const intestazione = righe[0]!.celle.map(nomeColonna)
    if (!intestazione.includes('nome')) {
      erroreFile.value = 'Il file non ha le colonne del template: manca la colonna «nome». Scarica il template e ricomincia da quello.'
      return
    }

    const valide: typeof righeValide.value = []
    const errate: typeof righeErrate.value = []

    for (const riga of righe.slice(1)) {
      const grezza: RigaImportContatto = { riga: riga.numeroRiga }
      intestazione.forEach((colonna, indice) => {
        if ((COLONNE_IMPORT as readonly string[]).includes(colonna)) {
          ;(grezza as Record<string, unknown>)[colonna] = riga.celle[indice] ?? ''
        }
      })

      const risultato = normalizzaRigaImport(grezza, props.tipoDefault)
      if (risultato.ok) valide.push({ numeroRiga: riga.numeroRiga, grezza, dati: risultato.dati })
      else errate.push({ numeroRiga: riga.numeroRiga, motivo: risultato.errori.join(' · ') })
    }

    righeValide.value = valide
    righeErrate.value = errate
    fase.value = 'anteprima'
  } catch {
    erroreFile.value = 'Non è stato possibile leggere il file. Controlla che sia un CSV salvato da Excel.'
  }
}

/** "Prossimo Ricontatto" / "prossimo_ricontatto" → "prossimo_ricontatto" */
function nomeColonna(testo: string): string {
  return (testo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// ─────────────────────────────────────────────
// INVIO
// ─────────────────────────────────────────────

async function importa() {
  if (righeValide.value.length === 0) return
  importando.value = true

  const totale = { importati: 0, saltati: [] as Array<{ riga: number; motivo: string }>, errori: [] as Array<{ riga: number; motivo: string }> }

  try {
    // Si manda a blocchi: file lunghi non fanno una richiesta enorme
    for (let i = 0; i < righeValide.value.length; i += BLOCCO) {
      const blocco = righeValide.value.slice(i, i + BLOCCO).map((r) => r.grezza)
      const res = await $fetch<{ data: typeof totale }>('/api/contacts/import', {
        method: 'POST',
        body: { tipoDefault: props.tipoDefault, righe: blocco },
      })
      totale.importati += res.data.importati
      totale.saltati.push(...res.data.saltati)
      totale.errori.push(...res.data.errori)
    }

    // Alle righe già scartate nell'anteprima si aggiungono quelle rifiutate dal server
    totale.errori.push(...righeErrate.value.map((e) => ({ riga: e.numeroRiga, motivo: e.motivo })))
    totale.errori.sort((a, b) => a.riga - b.riga)

    esito.value = totale
    fase.value = 'riepilogo'
    toast.add({
      title: `${totale.importati} contatti importati`,
      description: `${totale.saltati.length} saltati (doppioni), ${totale.errori.length} con errori`,
      color: totale.importati > 0 ? 'success' : 'warning',
    })
    emit('imported')
  } catch (err: any) {
    // I blocchi già inviati sono salvati: non bisogna dire "nessun contatto aggiunto"
    // se i primi 500 sono andati a buon fine (ricaricando il file verranno saltati come doppioni)
    const giaSalvati = totale.importati
    toast.add({
      title: err?.data?.statusMessage ?? 'Importazione non riuscita',
      description: giaSalvati > 0
        ? `${giaSalvati} contatti erano già stati salvati prima dell'errore; il resto non è stato aggiunto. Se ricarichi lo stesso file, quelli già salvati verranno saltati come doppioni.`
        : 'Nessun contatto è stato aggiunto. Controlla il file e riprova.',
      color: 'error',
    })
    if (giaSalvati > 0) emit('imported')
  } finally {
    importando.value = false
  }
}
</script>
