<template>
  <UModal v-model:open="isOpen" :title="`Nuovo Studente — Step ${step} di 4`" :ui="{ width: 'max-w-2xl' }">
    <template #body>
      <!-- Barra di progresso -->
      <div class="flex items-center gap-2 mb-6">
        <div v-for="n in 4" :key="n" class="flex-1 h-2 rounded-full transition-colors"
          :class="n <= step ? 'bg-tfn-500' : 'bg-slate-200'"
        />
      </div>

      <!-- ─── STEP 1: Dati Studente ─── -->
      <div v-if="step === 1" class="space-y-4">
        <UForm ref="form1" :schema="Step1Schema" :state="dati.studente" @submit="onStepSubmit" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="firstName" label="Nome" required>
              <UInput v-model="dati.studente.firstName" placeholder="Mario" class="w-full" />
            </UFormField>
            <UFormField name="lastName" label="Cognome" required>
              <UInput v-model="dati.studente.lastName" placeholder="Rossi" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="classe" label="Classe">
              <USelectMenu v-model="dati.studente.classe" :items="CLASSI_LISTA" searchable placeholder="Seleziona classe..." class="w-full" />
            </UFormField>
            <UFormField name="scuola" label="Scuola">
              <template v-if="!altreScuola">
                <USelectMenu v-model="dati.studente.scuola" :items="SCUOLE_TRAPANI" searchable placeholder="Cerca scuola..." class="w-full" />
                <button type="button" class="text-xs text-tfn-500 hover:underline mt-1 block" @click="altreScuola = true">
                  Non trovi la scuola? Inserisci manualmente
                </button>
              </template>
              <template v-else>
                <div class="flex gap-2">
                  <UInput v-model="dati.studente.scuola" placeholder="Nome scuola" class="flex-1" />
                  <UButton variant="ghost" size="xs" @click="altreScuola = false; dati.studente.scuola = ''">← Lista</UButton>
                </div>
              </template>
            </UFormField>
          </div>
        </UForm>
      </div>

      <!-- ─── STEP 2: Dati Genitore ─── -->
      <div v-if="step === 2" class="space-y-4">
        <UForm ref="form2" :schema="Step2Schema" :state="dati.genitore" @submit="onStepSubmit" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="parentName" label="Nome Genitore">
              <UInput v-model="dati.genitore.parentName" placeholder="Luigi Rossi" class="w-full" />
            </UFormField>
            <UFormField name="parentPhone" label="Telefono Genitore">
              <UInput v-model="dati.genitore.parentPhone" placeholder="+39 333 1234567" class="w-full"
                @blur="dati.genitore.parentPhone = normalizzaTelefono(dati.genitore.parentPhone)" />
            </UFormField>
          </div>
          <UFormField name="parentEmail" label="Email genitore" hint="Obbligatoria solo se creerai l'account portale">
            <UInput v-model="dati.genitore.parentEmail" type="email" placeholder="genitore@email.it" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="parentCF" label="Codice Fiscale">
              <UInput v-model="dati.genitore.parentCF" placeholder="RSSMRA85T10A562S" class="w-full" />
            </UFormField>
            <UFormField name="parentPIva" label="Partita IVA">
              <UInput v-model="dati.genitore.parentPIva" placeholder="12345678901" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="parentIndirizzo" label="Indirizzo">
              <UInput v-model="dati.genitore.parentIndirizzo" placeholder="Via Roma 1" class="w-full" />
            </UFormField>
            <UFormField name="parentCitta" label="Città">
              <UInput v-model="dati.genitore.parentCitta" placeholder="Trapani" class="w-full" />
            </UFormField>
          </div>
          <UFormField name="parentCap" label="CAP">
            <UInput v-model="dati.genitore.parentCap" placeholder="91100" class="w-full" />
          </UFormField>
          <UFormField name="note" label="Note">
            <UTextarea v-model="dati.genitore.note" placeholder="Eventuali note..." :rows="2" class="w-full" />
          </UFormField>
        </UForm>
      </div>

      <!-- ─── STEP 3: Creazione Pacchetto (opzionale) ─── -->
      <div v-if="step === 3" class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-medium text-slate-800">Crea un pacchetto per questo studente</h3>
          <UCheckbox v-model="dati.pacchetto.crea" label="Crea pacchetto" />
        </div>

        <div v-if="dati.pacchetto.crea" class="space-y-4 border border-slate-100 rounded-lg p-4 bg-slate-50/50">
          <template v-if="templateOptions.length > 0">
            <UFormField label="Scegli template (opzionale)">
              <div class="flex gap-2 w-full items-center">
                <USelectMenu v-model="templatePkgSelezionato" :items="templateOptions" searchable
                  value-attribute="value" placeholder="Seleziona un pacchetto standard..." class="flex-1"
                  @update:model-value="applicaTemplatePkg" />
                <UButton v-if="dati.pacchetto.standardPackageId" variant="ghost" color="neutral"
                  icon="i-heroicons-x-mark" title="Scollega template e personalizza"
                  @click="applicaTemplatePkg(null); templatePkgSelezionato = ''" />
              </div>
            </UFormField>
            <USeparator label="oppure compila manualmente" />
          </template>
          <UFormField label="Nome pacchetto" required>
            <UInput v-model="dati.pacchetto.nome" placeholder="Es: 10 ore Matematica" class="w-full" />
          </UFormField>
          <UFormField label="Tipo" required>
            <USelect v-model="dati.pacchetto.tipo" :items="[
              { label: 'Pacchetto ORE', value: 'ORE' },
              { label: 'Pacchetto MENSILE', value: 'MENSILE' },
              { label: 'Pacchetto A CONSUMO', value: 'A_CONSUMO' },
            ]" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Ore / Giorni acquistati" required>
              <UInputNumber v-model="dati.pacchetto.oreAcquistate" :min="0.5" :step="0.5" class="w-full" />
            </UFormField>
            <UFormField label="Prezzo totale (€)" required>
              <UInputNumber v-model="dati.pacchetto.prezzoTotale" :min="0" :step="10" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Data inizio" required>
              <UInput v-model="dati.pacchetto.dataInizio" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Data scadenza">
              <UInput v-model="dati.pacchetto.dataScadenza" type="date" class="w-full" />
            </UFormField>
          </div>
          <div v-if="dati.pacchetto.tipo === 'MENSILE'" class="grid grid-cols-2 gap-4">
            <UFormField label="Giorni acquistati" required>
              <UInputNumber v-model="dati.pacchetto.giorniAcquistati" :min="1" :step="1" class="w-full" />
            </UFormField>
            <UFormField label="Ore al giorno" required>
              <UInputNumber v-model="dati.pacchetto.orarioGiornaliero" :min="0.5" :step="0.5" class="w-full" />
            </UFormField>
          </div>
          <div v-if="dati.pacchetto.tipo === 'A_CONSUMO'">
            <UFormField label="Tariffa oraria (€/h)" required>
              <UInputNumber v-model="dati.pacchetto.tariffaOraria" :min="1" :step="0.5" class="w-full" />
            </UFormField>
          </div>
          <USeparator label="Pagamento iniziale (opzionale)" />
          <UFormField label="Acconto subito (€)">
            <UInputNumber v-model="dati.pacchetto.accontoImporto" :min="0" :step="10" class="w-full" />
          </UFormField>
          <div v-if="dati.pacchetto.accontoImporto > 0" class="grid grid-cols-2 gap-4">
            <UFormField label="Metodo pagamento" required>
              <USelect v-model="dati.pacchetto.accontoMetodo" :items="[
                { label: 'Contanti', value: 'CONTANTI' },
                { label: 'Bonifico', value: 'BONIFICO' },
                { label: 'POS', value: 'POS' },
                { label: 'Assegno', value: 'ASSEGNO' },
              ]" class="w-full" />
            </UFormField>
            <div class="flex items-center gap-2 mt-6">
              <UCheckbox v-model="dati.pacchetto.accontoFattura" label="Richiede fattura" />
            </div>
          </div>
        </div>
      </div>

      <!-- ─── STEP 4: Credenziali Portale ─── -->
      <div v-if="step === 4" class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-medium text-slate-800">Genera account portale per il genitore</h3>
          <UCheckbox v-model="dati.portale.crea" label="Crea account portale" />
        </div>

        <div v-if="dati.portale.crea" class="space-y-4 border border-slate-100 rounded-lg p-4 bg-slate-50/50">
          <UAlert color="info" variant="subtle" icon="i-heroicons-information-circle"
            title="Verrà generata una password temporanea"
            description="Il genitore riceverà una password casuale di 10 caratteri. Consigliagli di cambiarla al primo accesso."
          />
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Nome" required>
              <UInput v-model="dati.portale.firstName" :placeholder="dati.genitore.parentName?.split(' ')[0] || 'Genitore'" class="w-full" />
            </UFormField>
            <UFormField label="Cognome" required>
              <UInput v-model="dati.portale.lastName" :placeholder="dati.studente.lastName || 'Rossi'" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Email" required>
            <UInput v-model="dati.portale.email" type="email" :placeholder="dati.genitore.parentEmail || 'genitore@email.it'" class="w-full" />
          </UFormField>
          <div class="flex items-center gap-2">
            <UCheckbox v-model="dati.portale.abilitaPrenotazione" label="Abilita prenotazione online" />
          </div>
        </div>

        <!-- Riepilogo -->
        <div class="mt-4 space-y-2">
          <h4 class="text-sm font-medium text-slate-700">Riepilogo</h4>
          <div class="text-sm text-slate-600 space-y-1">
            <p><strong>Studente:</strong> {{ dati.studente.firstName }} {{ dati.studente.lastName }}</p>
            <p><strong>Genitore:</strong> {{ dati.genitore.parentName || dati.genitore.parentEmail || '—' }}</p>
            <p v-if="dati.pacchetto.crea"><strong>Pacchetto:</strong> {{ dati.pacchetto.nome }} ({{ dati.pacchetto.tipo }}, €{{ dati.pacchetto.prezzoTotale }})</p>
            <p v-if="dati.portale.crea"><strong>Portale:</strong> Account per {{ dati.portale.email || dati.genitore.parentEmail }}</p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between gap-3">
        <UButton v-if="step > 1" variant="ghost" @click="prevStep">Indietro</UButton>
        <div class="flex gap-3 ml-auto">
          <UButton v-if="step === 1" @click="form1?.submit()">Avanti</UButton>
          <UButton v-else-if="step === 2" @click="form2?.submit()">Avanti</UButton>
          <UButton v-else-if="step < 4" @click="step++">Avanti</UButton>
          <UButton v-else :loading="salvando" color="primary" @click="salvaTutto">
            Salva Tutto
          </UButton>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Risultato finale -->
  <UModal v-model:open="risultatoAperto" title="Studente creato con successo!" :ui="{ width: 'max-w-md' }">
    <template #body>
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <UIcon name="i-heroicons-check-circle" class="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <p class="font-medium text-slate-800">{{ dati.studente.firstName }} {{ dati.studente.lastName }}</p>
            <p class="text-sm text-slate-500">Studente creato con successo</p>
          </div>
        </div>
        <div v-if="risultato.pacchettoCreato" class="text-sm text-slate-600">
          ✅ Pacchetto <strong>{{ dati.pacchetto.nome }}</strong> creato
        </div>
        <div v-if="risultato.portaleCreato" class="text-sm text-slate-600">
          ✅ Account portale creato per <strong>{{ risultato.portaleEmail }}</strong>
        </div>
        <div v-if="risultato.tempPassword" class="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p class="text-xs font-medium text-amber-700 uppercase tracking-wide">Password temporanea</p>
          <div class="flex items-center gap-2 mt-1">
            <code class="text-lg font-mono text-amber-800">{{ risultato.tempPassword }}</code>
            <UButton size="xs" variant="ghost" icon="i-heroicons-clipboard" @click="copiaPassword" />
          </div>
          <p class="text-xs text-amber-600 mt-1">Copia e condividi con il genitore</p>
          <p v-if="risultato.emailInviata" class="text-xs text-emerald-600 mt-1">✅ Credenziali inviate anche via email al genitore</p>
          <p v-else class="text-xs text-amber-600 mt-1">⚠️ Email non inviata (servizio non configurato): comunica la password a mano</p>
        </div>
        <div v-if="risultato.portaleEsistente" class="text-sm text-amber-600">
          ⚠️ Esiste già un account con email {{ risultato.portaleEmail }}. Lo studente è stato collegato all'account esistente.
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" @click="risultatoAperto = false; chiudi()">Chiudi</UButton>
        <UButton :to="`/studenti/${risultato.studentId}`">Vai alla scheda</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { z } from 'zod'
import { normalizzaTelefono } from '~/utils/phone'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', val: boolean): void; (e: 'refresh'): void }>()

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const toast = useToast()
const step = ref(1)
const salvando = ref(false)
const altreScuola = ref(false)

import { SCUOLE_TRAPANI, CLASSI_LISTA } from '~/utils/schools'

const Step1Schema = z.object({
  firstName: z.string().min(1, 'Il nome è obbligatorio').max(100),
  lastName: z.string().min(1, 'Il cognome è obbligatorio').max(100),
  classe: z.string().optional().nullable(),
  scuola: z.string().optional().nullable(),
})

const Step2Schema = z.object({
  parentName: z.string().optional().nullable(),
  parentPhone: z.string().optional().nullable(),
  // Opzionale come nello schema canonico (student.schema.ts); diventa necessaria
  // solo se si crea l'account portale (controllo in salvaTutto)
  parentEmail: z.string().email('Email non valida').optional().or(z.literal('')),
  parentCF: z.string().optional().nullable(),
  parentPIva: z.string().optional().nullable(),
  parentIndirizzo: z.string().optional().nullable(),
  parentCitta: z.string().optional().nullable(),
  parentCap: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

const dati = reactive({
  studente: {
    firstName: '',
    lastName: '',
    classe: '',
    scuola: '',
  },
  genitore: {
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    parentCF: '',
    parentPIva: '',
    parentIndirizzo: '',
    parentCitta: '',
    parentCap: '',
    note: '',
  },
  pacchetto: {
    crea: false,
    nome: '',
    tipo: 'ORE' as 'ORE' | 'MENSILE' | 'A_CONSUMO',
    oreAcquistate: 10,
    prezzoTotale: 0,
    dataInizio: new Date().toISOString().slice(0, 10),
    dataScadenza: '',
    giorniAcquistati: 12,
    orarioGiornaliero: 3,
    tariffaOraria: 10,
    accontoImporto: 0,
    accontoMetodo: 'CONTANTI',
    accontoFattura: false,
    standardPackageId: '',
  },
  portale: {
    crea: false,
    firstName: '',
    lastName: '',
    email: '',
    abilitaPrenotazione: true,
  },
})

const form1 = ref()
const form2 = ref()

// ─── Template pacchetti standard (stesso comportamento di ModalCreaPacchetto) ───
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
const templatePkgSelezionato = ref<string>('')

function applicaTemplatePkg(val: any) {
  if (!val) {
    dati.pacchetto.standardPackageId = ''
    return
  }
  const templateId = typeof val === 'string' ? val : val.value
  const opt = templateOptions.value.find((t: any) => t.value === templateId)
  if (!opt?.raw) return
  const t = opt.raw
  dati.pacchetto.standardPackageId = t.id
  dati.pacchetto.nome = t.nome
  dati.pacchetto.tipo = t.tipo
  dati.pacchetto.oreAcquistate = parseFloat(t.oreIncluse)
  dati.pacchetto.prezzoTotale = parseFloat(t.prezzoStandard)
  if (t.giorniInclusi) dati.pacchetto.giorniAcquistati = t.giorniInclusi
  if (t.orarioGiornaliero) dati.pacchetto.orarioGiornaliero = parseFloat(t.orarioGiornaliero)
  if (t.tipo === 'A_CONSUMO') dati.pacchetto.tariffaOraria = parseFloat(t.tariffaOraria)
}

function onStepSubmit() {
  step.value++
}

function prevStep() {
  step.value--
}

function chiudi() {
  isOpen.value = false
  step.value = 1
  Object.assign(dati.studente, { firstName: '', lastName: '', classe: '', scuola: '' })
  Object.assign(dati.genitore, { parentName: '', parentPhone: '', parentEmail: '', parentCF: '', parentPIva: '', parentIndirizzo: '', parentCitta: '', parentCap: '', note: '' })
  Object.assign(dati.pacchetto, { crea: false, nome: '', tipo: 'ORE', oreAcquistate: 10, prezzoTotale: 0, dataInizio: new Date().toISOString().slice(0, 10), dataScadenza: '', giorniAcquistati: 12, orarioGiornaliero: 3, tariffaOraria: 10, accontoImporto: 0, accontoMetodo: 'CONTANTI', accontoFattura: false, standardPackageId: '' })
  templatePkgSelezionato.value = ''
  Object.assign(dati.portale, { crea: false, firstName: '', lastName: '', email: '', abilitaPrenotazione: true })
}

const risultatoAperto = ref(false)
const risultato = reactive({
  studentId: '',
  pacchettoCreato: false,
  portaleCreato: false,
  portaleEsistente: false,
  portaleEmail: '',
  tempPassword: '',
  emailInviata: false,
})

function copiaPassword() {
  navigator.clipboard.writeText(risultato.tempPassword)
  toast.add({ title: 'Password copiata', color: 'success' })
}

async function salvaTutto() {
  // L'account portale richiede un'email (campo portale o email genitore)
  if (dati.portale.crea && !dati.portale.email && !dati.genitore.parentEmail) {
    toast.add({
      title: 'Email mancante per il portale',
      description: "Inserisci l'email del genitore o dell'account portale.",
      color: 'error',
    })
    step.value = 3
    return
  }

  salvando.value = true
  try {
    // 1. Crea studente
    const studenteBody = {
      firstName: dati.studente.firstName,
      lastName: dati.studente.lastName,
      classe: dati.studente.classe || undefined,
      scuola: dati.studente.scuola || undefined,
      parentName: dati.genitore.parentName || undefined,
      parentPhone: dati.genitore.parentPhone || undefined,
      parentEmail: dati.genitore.parentEmail || undefined,
      parentCF: dati.genitore.parentCF || undefined,
      parentPIva: dati.genitore.parentPIva || undefined,
      parentIndirizzo: dati.genitore.parentIndirizzo || undefined,
      parentCitta: dati.genitore.parentCitta || undefined,
      parentCap: dati.genitore.parentCap || undefined,
      note: dati.genitore.note || undefined,
    }

    const studenteRes = await $fetch('/api/students', { method: 'POST', body: studenteBody }) as any
    const studenteId = studenteRes.data?.id
    if (!studenteId) throw new Error('Creazione studente fallita')

    risultato.studentId = studenteId

    // 2. Crea pacchetto (se richiesto)
    if (dati.pacchetto.crea) {
      const pkgBody: any = {
        studentId: studenteId,
        nome: dati.pacchetto.nome,
        tipo: dati.pacchetto.tipo,
        oreAcquistate: dati.pacchetto.oreAcquistate,
        prezzoTotale: dati.pacchetto.prezzoTotale,
        dataInizio: dati.pacchetto.dataInizio,
        standardPackageId: dati.pacchetto.standardPackageId || undefined,
      }
      if (dati.pacchetto.dataScadenza) pkgBody.dataScadenza = dati.pacchetto.dataScadenza
      if (dati.pacchetto.tipo === 'MENSILE') {
        pkgBody.giorniAcquistati = dati.pacchetto.giorniAcquistati
        pkgBody.orarioGiornaliero = dati.pacchetto.orarioGiornaliero
      } else if (dati.pacchetto.tipo === 'A_CONSUMO') {
        pkgBody.tariffaOraria = dati.pacchetto.tariffaOraria
      }
      if (dati.pacchetto.accontoImporto > 0) {
        pkgBody.pagamentoIniziale = {
          importo: dati.pacchetto.accontoImporto,
          metodoPagamento: dati.pacchetto.accontoMetodo,
          richiedeFattura: dati.pacchetto.accontoFattura,
        }
      }
      await $fetch('/api/packages', { method: 'POST', body: pkgBody })
      risultato.pacchettoCreato = true
    }

    // 3. Crea portale (se richiesto)
    if (dati.portale.crea) {
      const portalBody = {
        studentId: studenteId,
        email: dati.portale.email || dati.genitore.parentEmail,
        firstName: dati.portale.firstName || dati.genitore.parentName?.split(' ')[0] || 'Genitore',
        lastName: dati.portale.lastName || dati.studente.lastName,
      }
      const portalRes = await $fetch('/api/admin/students/' + studenteId + '/portal-access', {
        method: 'POST',
        body: portalBody,
      }) as any

      // L'endpoint risponde con i campi al livello principale (niente wrapper .data)
      risultato.portaleEmail = portalRes.email || portalBody.email
      if (portalRes.tempPassword) {
        risultato.portaleCreato = true
        risultato.tempPassword = portalRes.tempPassword
        risultato.emailInviata = portalRes.emailInviata === true
      } else if (portalRes.requiresConfirmation) {
        // Esiste già, forziamo il collegamento
        const forceRes = await $fetch('/api/admin/students/' + studenteId + '/portal-access', {
          method: 'POST',
          body: { ...portalBody, force: true },
        }) as any
        risultato.portaleEsistente = true
        risultato.portaleEmail = forceRes.user?.email || portalBody.email
      }

      // Abilita prenotazione se richiesto
      if (dati.portale.abilitaPrenotazione) {
        await $fetch('/api/admin/students/' + studenteId + '/portal-access', {
          method: 'PUT',
          body: { action: 'toggle-prenotazione', abilitato: true },
        })
      }
    }

    isOpen.value = false
    risultatoAperto.value = true
    emit('refresh')
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? err?.message ?? 'Operazione non riuscita', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// Watch per pre-compilare dati portale
watch(() => dati.genitore.parentEmail, (email) => {
  if (email && !dati.portale.email) {
    dati.portale.email = email
  }
})
watch(() => dati.genitore.parentName, (name) => {
  if (name && !dati.portale.firstName) {
    dati.portale.firstName = name.split(' ')[0] || name
  }
})
watch(() => dati.studente.lastName, (ln) => {
  if (ln && !dati.portale.lastName) {
    dati.portale.lastName = ln
  }
})
</script>
