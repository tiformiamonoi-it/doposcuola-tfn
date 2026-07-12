<template>
  <UModal v-model:open="isOpen" title="Nuovo Pacchetto" :ui="{ width: 'max-w-xl' }">
    <template #body>
      <div class="space-y-4">
        <!-- Scegli template (se ci sono pacchetti standard) -->
        <template v-if="templateOptions.length > 0">
          <UFormField label="Pacchetto standard (da Impostazioni)" required>
            <div class="flex gap-2 w-full items-center">
              <USelectMenu
                v-model="templateSelezionato"
                :items="templateOptions"
                searchable
                value-attribute="value"
                placeholder="Seleziona un pacchetto standard..."
                class="flex-1"
                @update:model-value="applicaTemplate"
              />
              <UButton
                v-if="nuovo.standardPackageId"
                variant="ghost"
                color="neutral"
                icon="i-heroicons-x-mark"
                @click="applicaTemplate(null); templateSelezionato = ''"
                title="Scollega template e personalizza i dettagli (il nome resta quello del pacchetto standard)"
              />
            </div>
          </UFormField>
          <USeparator label="dettagli (personalizzabili)" />
        </template>

        <!-- Studente -->
        <UFormField label="Studente" required>
          <USelectMenu
            v-model="studenteSelezionato"
            :items="studenteOptions"
            searchable
            value-attribute="value"
            placeholder="Cerca per cognome, nome, classe..."
            class="w-full"
            :disabled="!!props.studentId || !!props.rinnovoDa"
            @update:model-value="onStudenteSelezionato"
          />
        </UFormField>

        <UAlert
          v-if="pacchettiAttiviStudente.length > 0"
          color="warning" variant="subtle" icon="i-heroicons-exclamation-triangle"
          title="Questo studente ha già un pacchetto attivo"
        >
          <template #description>
            <ul class="space-y-0.5 mt-1">
              <li v-for="p in pacchettiAttiviStudente" :key="p.id">
                {{ p.nome }} — scade il {{ p.dataScadenza ? new Date(p.dataScadenza).toLocaleDateString('it-IT') : 'n/d' }}
                <span v-if="p.tipo !== 'MENSILE'">({{ parseFloat(p.oreResiduo ?? '0') }} ore residue)</span>
              </li>
            </ul>
          </template>
        </UAlert>

        <UFormField label="Nome pacchetto" required>
          <UInput v-model="nuovo.nome" :disabled="templateOptions.length > 0" placeholder="Deriva dal pacchetto standard scelto" class="w-full" />
          <template #description>
            <span v-if="templateOptions.length > 0" class="text-xs text-slate-400">
              Il nome deriva sempre dal pacchetto standard (modificabile solo in Impostazioni)
            </span>
          </template>
        </UFormField>

        <!-- Tipo pacchetto -->
        <UFormField label="Tipo" required>
          <USelect
            v-model="nuovo.tipo"
            :items="[{ label: 'Pacchetto ORE', value: 'ORE' }, { label: 'Pacchetto MENSILE', value: 'MENSILE' }, { label: 'Pacchetto A CONSUMO', value: 'A_CONSUMO' }]"
            class="w-full"
            :disabled="!!nuovo.standardPackageId"
            @change="aggiornaDatiScadenza"
          />
        </UFormField>

        <!-- ORE: ore inserite direttamente -->
        <UFormField v-if="nuovo.tipo === 'ORE'" label="Ore acquistate" required>
          <UInputNumber v-model="nuovo.oreAcquistate" :min="0.5" :step="0.5" class="w-full" :disabled="!!nuovo.standardPackageId" />
        </UFormField>

        <!-- MENSILE: giorni × ore/giorno → ore totali calcolate automaticamente -->
        <template v-else-if="nuovo.tipo === 'MENSILE'">
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Giorni acquistati" required>
              <UInputNumber v-model="nuovo.giorniAcquistati" :min="1" :step="1" class="w-full" :disabled="!!nuovo.standardPackageId" />
            </UFormField>
            <UFormField label="Ore al giorno (max)" required>
              <UInputNumber v-model="nuovo.orarioGiornaliero" :min="0.5" :step="0.5" class="w-full" :disabled="!!nuovo.standardPackageId" />
            </UFormField>
          </div>
          <UFormField label="Ore totali incluse">
            <UInputNumber :model-value="nuovo.oreAcquistate" disabled class="w-full" />
            <template #description>
              <span class="text-xs text-slate-400">
                Calcolato automaticamente: {{ nuovo.giorniAcquistati || 0 }} giorni × {{ nuovo.orarioGiornaliero || 0 }} ore = <strong>{{ nuovo.oreAcquistate }} ore</strong>
              </span>
            </template>
          </UFormField>
        </template>

        <!-- A_CONSUMO: tariffa oraria -->
        <div v-else-if="nuovo.tipo === 'A_CONSUMO'">
          <UFormField label="Tariffa oraria (€/h)" required>
            <UInputNumber v-model="nuovo.tariffaOraria" :min="1" :step="0.5" class="w-full" />
          </UFormField>
          <div class="text-xs text-slate-500 mt-2">
            Le ore iniziali verranno calcolate come: <strong>{{ (nuovo.prezzoTotale / (nuovo.tariffaOraria || 1)).toFixed(1) }}</strong>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="nuovo.tipo === 'A_CONSUMO' ? 'Prima ricarica base (€)' : 'Prezzo totale (€)'" required>
            <UInputNumber v-model="nuovo.prezzoTotale" :min="0" :step="10" class="w-full" />
          </UFormField>
          <UFormField label="Data inizio" required>
            <UInput v-model="nuovo.dataInizio" type="date" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Data scadenza">
          <UInput v-model="nuovo.dataScadenza" type="date" class="w-full" />
          <template #description>
            <span class="text-xs text-slate-400">
              Auto: ORE → 15/06/{{ annoScadenzaOre }}, MENSILE → fine mese corrente
            </span>
          </template>
        </UFormField>

        <USeparator label="Pagamento iniziale (opzionale)" />

        <UFormField label="Acconto subito (€)">
          <UInputNumber v-model="nuovo.accontoImporto" :min="0" :step="10" class="w-full" />
        </UFormField>

        <div v-if="nuovo.accontoImporto > 0" class="grid grid-cols-2 gap-4">
          <UFormField label="Metodo pagamento" required>
            <USelect
              v-model="nuovo.accontoMetodo"
              :items="[
                { label: 'Contanti', value: 'CONTANTI' },
                { label: 'Bonifico', value: 'BONIFICO' },
                { label: 'POS', value: 'POS' },
                { label: 'Assegno', value: 'ASSEGNO' },
              ]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="">
            <div class="flex items-center gap-2 mt-6">
              <UCheckbox v-model="nuovo.accontoFattura" label="Richiede fattura" />
            </div>
          </UFormField>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" @click="isOpen = false">Annulla</UButton>
        <UButton :loading="salvando" @click="creaPacchetto">Salva Pacchetto</UButton>
      </div>
    </template>
  </UModal>

  <ConfirmDialog
    v-model:open="confirmOpen"
    :title="confirmTitle"
    :description="confirmDescription"
    :confirm-label="confirmLabel"
    :confirm-color="confirmColor"
    @confirm="eseguiConferma"
  />
</template>

<script setup lang="ts">
import { oggiISO } from '~/utils/format'
import ConfirmDialog from '~/components/ConfirmDialog.vue'

const props = defineProps<{
  open: boolean
  studentId?: string
  studentName?: string
  rinnovoDa?: any // Package object to renew from
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'refresh'): void
}>()

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const toast = useToast()

// ─── Fetch studenti per selector ───
const { data: studentiData } = useLazyFetch('/api/students', {
  query: { active: 'true', limit: 1000, sortBy: 'lastName', sortDir: 'asc', light: 'true' },
})

const studenteOptions = computed(() => {
  const options = (studentiData.value?.data ?? []).map((s: any) => ({
    label: `${s.lastName} ${s.firstName}${s.classe ? ' — ' + s.classe : ''}${s.scuola ? ', ' + s.scuola : ''}`,
    value: s.id,
  }))

  if (props.studentId && !options.find((o: any) => o.value === props.studentId)) {
    if (props.studentName) {
      options.unshift({ label: props.studentName, value: props.studentId })
    }
  }

  return options
})

// ─── Fetch template pacchetti standard ───
const { data: templatesData } = useLazyFetch('/api/standard-packages')

const templateOptions = computed(() =>
  (templatesData.value ?? []).map((t: any) => ({
    label: t.tipo === 'A_CONSUMO' 
      ? `${t.nome} — A CONSUMO, €${parseFloat(t.tariffaOraria).toFixed(2)}/h (Base €${parseFloat(t.prezzoStandard).toFixed(0)})`
      : `${t.nome} — ${t.tipo}, ${t.oreIncluse} ore, €${parseFloat(t.prezzoStandard).toFixed(0)}`,
    value: t.id,
    raw: t,
  }))
)

const salvando = ref(false)
const studenteSelezionato = ref<string>('')
const templateSelezionato = ref<string>('')
const pacchettiAttiviStudente = ref<any[]>([])

const oggi = new Date()

function calcolaDataScadenza(tipo: 'ORE' | 'MENSILE' | 'A_CONSUMO', startStr?: string): string {
  const baseDate = startStr ? new Date(startStr) : new Date(nuovo?.dataInizio || oggi.toISOString())
  if (tipo === 'ORE' || tipo === 'A_CONSUMO') {
    const m = baseDate.getMonth()
    const d = baseDate.getDate()
    const anno = (m > 5 || (m === 5 && d > 15)) ? baseDate.getFullYear() + 1 : baseDate.getFullYear()
    return `${anno}-06-15`
  } else {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  }
}

const annoScadenzaOre = computed(() => {
  const baseDate = nuovo?.dataInizio ? new Date(nuovo.dataInizio) : oggi
  const m = baseDate.getMonth()
  const d = baseDate.getDate()
  return (m > 5 || (m === 5 && d > 15)) ? baseDate.getFullYear() + 1 : baseDate.getFullYear()
})

function aggiornaDatiScadenza() {
  nuovo.dataScadenza = calcolaDataScadenza(nuovo.tipo, nuovo.dataInizio)
}

const nuovo = reactive({
  studentId:         '',
  nome:              '',
  tipo:              'ORE' as 'ORE' | 'MENSILE' | 'A_CONSUMO',
  oreAcquistate:     10,
  prezzoTotale:      0,
  dataInizio:        oggiISO(),
  dataScadenza:      calcolaDataScadenza('ORE', oggiISO()),
  giorniAcquistati:  12,
  orarioGiornaliero: 3,
  accontoImporto:    0,
  accontoMetodo:     'CONTANTI' as string,
  accontoFattura:    false,
  tariffaOraria:     10,
  standardPackageId: '',
})

watch(
  () => [nuovo.tipo, nuovo.giorniAcquistati, nuovo.orarioGiornaliero, nuovo.prezzoTotale, nuovo.tariffaOraria],
  () => {
    if (nuovo.tipo === 'MENSILE') {
      nuovo.oreAcquistate = (nuovo.giorniAcquistati || 0) * (nuovo.orarioGiornaliero || 0)
    } else if (nuovo.tipo === 'A_CONSUMO') {
      nuovo.oreAcquistate = nuovo.tariffaOraria > 0 ? Number((nuovo.prezzoTotale / nuovo.tariffaOraria).toFixed(2)) : 0
    }
  },
)

watch(
  () => nuovo.dataInizio,
  (newVal) => {
    if (newVal) {
      nuovo.dataScadenza = calcolaDataScadenza(nuovo.tipo, newVal)
    }
  }
)

async function onStudenteSelezionato(val: any) {
  const id = val ? (typeof val === 'string' ? val : val.value) : ''
  nuovo.studentId = id
  pacchettiAttiviStudente.value = []

  if (id) {
    try {
      const storici = await $fetch(`/api/packages?studentId=${id}&limit=50`) as any
      const pkgList = storici.data || []
      const pkgAttivi = pkgList.filter((p: any) => p.stati.includes('ATTIVO') || p.stati.includes('DA_RINNOVARE'))
      pacchettiAttiviStudente.value = pkgAttivi

      // Se NON stiamo rinnovando esplicitamente un pacchetto (dove forziamo la data a oggi), cerchiamo l'ultimo
      if (!props.rinnovoDa && pkgAttivi.length > 0) {
        const maxScadenza = pkgAttivi.reduce((max: Date, p: any) => {
          if (!p.dataScadenza) return max
          const d = new Date(p.dataScadenza)
          return d > max ? d : max
        }, new Date(0))
        
        if (maxScadenza > new Date(0)) {
          const nextDay = new Date(maxScadenza)
          nextDay.setDate(nextDay.getDate() + 1)
          nuovo.dataInizio = nextDay.toISOString().slice(0, 10)
        }
      }
    } catch (e) {
      // ignora
    }
  }
}

watch(isOpen, async (aperto) => {
  if (aperto) {
    // Reset del form
    templateSelezionato.value = ''
    pacchettiAttiviStudente.value = []
    
    let initDataInizio = oggiISO()

    // Se è un rinnovo esplicito
    if (props.rinnovoDa) {
      const p = props.rinnovoDa
      studenteSelezionato.value = p.studentId
      nuovo.studentId = p.studentId
      
      const parts = p.nome.split(' - Rinnovo')
      nuovo.nome = parts[0] + ' - Rinnovo'
      
      nuovo.tipo = p.tipo
      if (p.tipo === 'MENSILE') {
        nuovo.giorniAcquistati = p.giorniAcquistati ?? 12
        nuovo.orarioGiornaliero = p.orarioGiornaliero ?? 3
        nuovo.oreAcquistate = (p.giorniAcquistati || 0) * (p.orarioGiornaliero || 0)
      } else {
        nuovo.oreAcquistate = parseFloat(p.oreAcquistate)
      }
      
      nuovo.prezzoTotale = parseFloat(p.prezzoTotale)
      nuovo.tariffaOraria = p.tariffaOraria ? parseFloat(p.tariffaOraria) : 10
      nuovo.standardPackageId = p.standardPackageId ?? ''
      
      nuovo.dataInizio = initDataInizio
      nuovo.dataScadenza = calcolaDataScadenza(nuovo.tipo, initDataInizio)
      
      nuovo.accontoImporto = 0
      nuovo.accontoMetodo = 'CONTANTI'
      nuovo.accontoFattura = false

      // Recuperiamo comunque gli attivi per l'alert
      try {
        const storici = await $fetch(`/api/packages?studentId=${p.studentId}&limit=50`) as any
        const pkgList = storici.data || []
        pacchettiAttiviStudente.value = pkgList.filter((x: any) => x.id !== p.id && (x.stati.includes('ATTIVO') || x.stati.includes('DA_RINNOVARE')))
      } catch(e) {}
    } 
    // Creazione normale (magari con studentId precompilato)
    else {
      Object.assign(nuovo, {
        studentId: props.studentId ?? '',
        nome: '', tipo: 'ORE', oreAcquistate: 10, prezzoTotale: 0,
        dataInizio: initDataInizio,
        dataScadenza: calcolaDataScadenza('ORE', initDataInizio),
        giorniAcquistati: 12, orarioGiornaliero: 3,
        accontoImporto: 0, accontoMetodo: 'CONTANTI', accontoFattura: false,
        tariffaOraria: 10, standardPackageId: '',
      })
      studenteSelezionato.value = props.studentId ?? ''
      if (props.studentId) {
        onStudenteSelezionato(props.studentId)
      }
    }
  }
})

function applicaTemplate(val: any) {
  if (!val) {
    nuovo.standardPackageId = ''
    return
  }
  const templateId = typeof val === 'string' ? val : val.value
  const opt = templateOptions.value.find((t: any) => t.value === templateId)
  if (!opt?.raw) return
  const t = opt.raw
  nuovo.standardPackageId  = t.id
  nuovo.nome             = t.nome
  nuovo.tipo             = t.tipo
  nuovo.oreAcquistate    = parseFloat(t.oreIncluse)
  nuovo.prezzoTotale     = parseFloat(t.prezzoStandard)
  if (t.giorniInclusi)     nuovo.giorniAcquistati  = t.giorniInclusi
  if (t.orarioGiornaliero) nuovo.orarioGiornaliero = parseFloat(t.orarioGiornaliero)
  if (t.tipo === 'A_CONSUMO') {
    nuovo.tariffaOraria = parseFloat(t.tariffaOraria)
  }
  nuovo.dataScadenza = calcolaDataScadenza(t.tipo)
}

const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmDescription = ref('')
const confirmLabel = ref('Conferma')
const confirmColor = ref<'primary' | 'error'>('primary')
const pendingAction = ref<(() => void) | null>(null)

function chiediConferma(config: { title: string; description: string; confirmLabel?: string; confirmColor?: 'primary' | 'error' }, action: () => void) {
  confirmTitle.value = config.title
  confirmDescription.value = config.description
  confirmLabel.value = config.confirmLabel ?? 'Conferma'
  confirmColor.value = config.confirmColor ?? 'primary'
  pendingAction.value = action
  confirmOpen.value = true
}

function eseguiConferma() {
  confirmOpen.value = false
  pendingAction.value?.()
  pendingAction.value = null
}

async function creaPacchetto() {
  if (!nuovo.studentId) {
    toast.add({ title: 'Seleziona uno studente', color: 'warning', icon: 'i-heroicons-exclamation-circle' })
    return
  }

  if (!nuovo.nome) {
    toast.add({ title: 'Scegli un pacchetto standard', description: 'Il nome del pacchetto deriva sempre da quello standard (Impostazioni).', color: 'warning', icon: 'i-heroicons-exclamation-circle' })
    return
  }

  if (pacchettiAttiviStudente.value.length > 0) {
    const elenco = pacchettiAttiviStudente.value
      .map((p: any) => `- ${p.nome} (scade il ${p.dataScadenza ? new Date(p.dataScadenza).toLocaleDateString('it-IT') : 'n/d'})`)
      .join('\n')
    chiediConferma(
      { title: 'Creare un altro pacchetto?', description: `Questo studente ha già ${pacchettiAttiviStudente.value.length} pacchetto/i attivo/i:\n${elenco}`, confirmLabel: 'Crea comunque', confirmColor: 'primary' },
      () => doCreaPacchetto()
    )
    return
  }

  doCreaPacchetto()
}

async function doCreaPacchetto() {
  salvando.value = true
  try {
    const body: any = {
      studentId:     nuovo.studentId,
      nome:          nuovo.nome,
      tipo:          nuovo.tipo,
      oreAcquistate: nuovo.oreAcquistate,
      prezzoTotale:  nuovo.prezzoTotale,
      dataInizio:    nuovo.dataInizio,
      standardPackageId: nuovo.standardPackageId || undefined,
    }
    if (nuovo.dataScadenza) body.dataScadenza = nuovo.dataScadenza
    if (nuovo.tipo === 'MENSILE') {
      body.giorniAcquistati  = nuovo.giorniAcquistati
      body.orarioGiornaliero = nuovo.orarioGiornaliero
    } else if (nuovo.tipo === 'A_CONSUMO') {
      body.tariffaOraria = nuovo.tariffaOraria
    }
    if (nuovo.accontoImporto > 0) {
      body.pagamentoIniziale = {
        importo:         nuovo.accontoImporto,
        metodoPagamento: nuovo.accontoMetodo,
        richiedeFattura: nuovo.accontoFattura,
      }
    }

    await $fetch('/api/packages', { method: 'POST', body })
    toast.add({ title: 'Pacchetto creato', color: 'success', icon: 'i-heroicons-check-circle' })
    isOpen.value = false
    emit('refresh')
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile creare il pacchetto', color: 'error' })
  } finally {
    salvando.value = false
  }
}
</script>
