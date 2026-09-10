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
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField name="firstName" label="Nome" required>
              <UInput v-model="dati.studente.firstName" placeholder="Mario" class="w-full" />
            </UFormField>
            <UFormField name="lastName" label="Cognome" required>
              <UInput v-model="dati.studente.lastName" placeholder="Rossi" class="w-full" />
            </UFormField>
          </div>
          <!-- Facoltativa: serve al campanellino dei compleanni, non blocca nulla -->
          <UFormField name="dataNascita" label="Data di nascita" hint="Facoltativa">
            <UInput v-model="dati.studente.dataNascita" type="date" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <!-- ─── STEP 2: Dati Genitori ─── -->
      <div v-if="step === 2" class="space-y-4">
        <UForm ref="form2" :schema="Step2Schema" :state="dati.genitore" @submit="onStepSubmit" class="space-y-4">

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField name="relazione" label="Che parentela ha con l'alunno?">
              <USelect v-model="dati.genitore.relazione" :items="RELAZIONI_ITEMS" placeholder="Scegli..." class="w-full" />
              <UInput v-if="dati.genitore.relazione === 'Altro'" v-model="dati.genitore.relazioneAltro"
                placeholder="Es. Nonna, Zio…" class="w-full mt-2" :maxlength="50" />
            </UFormField>
            <UFormField name="dataNascita" label="Data di nascita" hint="Facoltativa">
              <UInput v-model="dati.genitore.dataNascita" type="date" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField name="parentCF" label="Codice Fiscale">
              <UInput v-model="dati.genitore.parentCF" placeholder="RSSMRA85T10A562S" class="w-full" />
            </UFormField>
            <UFormField name="parentPIva" label="Partita IVA">
              <UInput v-model="dati.genitore.parentPIva" placeholder="12345678901" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <!-- ─── SECONDO GENITORE ───
             Serve quando i genitori sono separati (ognuno vuole il suo accesso) o
             quando le comunicazioni vanno mandate a tutti e due.
             Da qui in poi si raccoglie l'ANAGRAFICA COMPLETA: viene salvata sulla
             scheda dell'alunno anche se non gli si dà l'accesso al portale. -->
        <USeparator />
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-medium text-slate-800 text-sm">C'è un secondo genitore</p>
            <p class="text-xs text-slate-500">Es. genitori separati, o entrambi da tenere aggiornati.</p>
          </div>
          <UCheckbox v-model="dati.genitore2.attivo" aria-label="C'è un secondo genitore" />
        </div>

        <div v-if="dati.genitore2.attivo" class="space-y-4 border border-slate-100 rounded-lg p-4 bg-slate-50/50">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Nome secondo genitore">
              <UInput v-model="dati.genitore2.nome" placeholder="Anna Rossi" class="w-full" />
            </UFormField>
            <UFormField label="Telefono">
              <UInput v-model="dati.genitore2.telefono" placeholder="+39 333 7654321" class="w-full"
                @blur="dati.genitore2.telefono = normalizzaTelefono(dati.genitore2.telefono)" />
            </UFormField>
          </div>
          <UFormField label="Email" hint="Obbligatoria solo se creerai il suo account portale">
            <UInput v-model="dati.genitore2.email" type="email" placeholder="secondo.genitore@email.it" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Che parentela ha con l'alunno?">
              <USelect v-model="dati.genitore2.relazione" :items="RELAZIONI_ITEMS" placeholder="Scegli..." class="w-full" />
              <UInput v-if="dati.genitore2.relazione === 'Altro'" v-model="dati.genitore2.relazioneAltro"
                placeholder="Es. Nonna, Zio…" class="w-full mt-2" :maxlength="50" />
            </UFormField>
            <UFormField label="Data di nascita" hint="Facoltativa">
              <UInput v-model="dati.genitore2.dataNascita" type="date" class="w-full" />
            </UFormField>
          </div>

          <!-- Dati fiscali anche per il secondo: se un domani la fattura va intestata
               a lui, i suoi dati sono già in archivio e non si rincorre nessuno. -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Codice Fiscale">
              <UInput v-model="dati.genitore2.cf" placeholder="RSSNNA80A41L331P" class="w-full" />
            </UFormField>
            <UFormField label="Partita IVA">
              <UInput v-model="dati.genitore2.piva" placeholder="12345678901" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Indirizzo">
              <UInput v-model="dati.genitore2.indirizzo" placeholder="Via Roma 1" class="w-full" />
            </UFormField>
            <UFormField label="Città">
              <UInput v-model="dati.genitore2.citta" placeholder="Trapani" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="CAP">
            <UInput v-model="dati.genitore2.cap" placeholder="91100" class="w-full" />
          </UFormField>

          <p class="text-xs text-slate-500">
            Questi dati restano salvati sulla scheda dell'alunno anche se non gli darai
            l'accesso al portale.
          </p>
        </div>
      </div>

      <!-- ─── STEP 3: Creazione Pacchetto (opzionale) ─── -->
      <div v-if="step === 3" class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-medium text-slate-800">Crea un pacchetto per questo studente</h3>
          <UCheckbox v-model="dati.pacchetto.crea" label="Crea pacchetto" />
        </div>

        <div v-if="dati.pacchetto.crea" class="space-y-4 border border-slate-100 rounded-lg p-4 bg-slate-50/50">
          <template v-if="templateOptions.length > 0">
            <UFormField label="Pacchetto standard (da Impostazioni)" required>
              <div class="flex gap-2 w-full items-center">
                <USelectMenu v-model="templatePkgSelezionato" :items="templateOptions" searchable
                  value-attribute="value" placeholder="Seleziona un pacchetto standard..." class="flex-1"
                  @update:model-value="applicaTemplatePkg" />
                <UButton v-if="dati.pacchetto.standardPackageId" variant="ghost" color="neutral"
                  icon="i-heroicons-x-mark" title="Scollega template e personalizza i dettagli (il nome resta quello del pacchetto standard)"
                  @click="applicaTemplatePkg(null); templatePkgSelezionato = ''" />
              </div>
            </UFormField>
            <USeparator label="dettagli (personalizzabili)" />
          </template>
          <UFormField label="Nome pacchetto" required>
            <UInput v-model="dati.pacchetto.nome" :disabled="templateOptions.length > 0" placeholder="Deriva dal pacchetto standard scelto" class="w-full" />
            <template #description>
              <span v-if="templateOptions.length > 0" class="text-xs text-slate-400">
                Il nome deriva sempre dal pacchetto standard (modificabile solo in Impostazioni)
              </span>
            </template>
          </UFormField>
          <UFormField label="Tipo" required>
            <USelect v-model="dati.pacchetto.tipo" :items="[
              { label: 'Pacchetto ORE', value: 'ORE' },
              { label: 'Pacchetto MENSILE', value: 'MENSILE' },
              { label: 'Pacchetto A CONSUMO', value: 'A_CONSUMO' },
            ]" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Ore / Giorni acquistati" required>
              <UInputNumber v-model="dati.pacchetto.oreAcquistate" :min="0.5" :step="0.5" class="w-full" />
            </UFormField>
            <UFormField label="Prezzo totale (€)" required>
              <UInputNumber v-model="dati.pacchetto.prezzoTotale" :min="0" :step="10" :step-snapping="false" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Data inizio" required>
              <UInput v-model="dati.pacchetto.dataInizio" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Data scadenza">
              <UInput v-model="dati.pacchetto.dataScadenza" type="date" class="w-full" />
            </UFormField>
          </div>
          <div v-if="dati.pacchetto.tipo === 'MENSILE'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <UInputNumber v-model="dati.pacchetto.accontoImporto" :min="0" :step="10" :step-snapping="false" class="w-full" />
          </UFormField>
          <div v-if="dati.pacchetto.accontoImporto > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Metodo pagamento" required>
              <USelect v-model="dati.pacchetto.accontoMetodo" :items="METODI_PAGAMENTO_ITEMS" class="w-full" />
            </UFormField>
            <div class="flex items-center gap-2 mt-6">
              <UCheckbox v-model="dati.pacchetto.accontoFattura" label="Richiede fattura" />
            </div>
          </div>
        </div>
      </div>

      <!-- ─── STEP 4: Accessi al portale ─── -->
      <div v-if="step === 4" class="space-y-4">
        <p class="text-sm text-slate-500">
          L'accesso al portale si decide per ogni genitore separatamente: puoi darlo a uno,
          a tutti e due o a nessuno.
        </p>

        <!-- PRIMO GENITORE -->
        <div class="border border-slate-100 rounded-lg p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-medium text-slate-800 text-sm">
              Accesso per {{ dati.genitore.parentName || 'il primo genitore' }}
            </h3>
            <UCheckbox v-model="dati.portale.crea" aria-label="Crea l'accesso al portale per il primo genitore" />
          </div>

          <div v-if="dati.portale.crea" class="space-y-4 mt-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Nome" required>
                <UInput v-model="dati.portale.firstName" placeholder="Luigi" class="w-full" />
              </UFormField>
              <UFormField label="Cognome" required>
                <UInput v-model="dati.portale.lastName" placeholder="Rossi" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Email" required>
              <UInput v-model="dati.portale.email" type="email" placeholder="genitore@email.it" class="w-full" />
            </UFormField>
          </div>
        </div>

        <!-- SECONDO GENITORE -->
        <div v-if="dati.genitore2.attivo" class="border border-slate-100 rounded-lg p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-medium text-slate-800 text-sm">
              Accesso per {{ dati.genitore2.nome || 'il secondo genitore' }}
            </h3>
            <UCheckbox v-model="dati.portale2.crea" aria-label="Crea l'accesso al portale per il secondo genitore" />
          </div>

          <div v-if="dati.portale2.crea" class="space-y-4 mt-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Nome" required>
                <UInput v-model="dati.portale2.firstName" placeholder="Anna" class="w-full" />
              </UFormField>
              <UFormField label="Cognome" required>
                <UInput v-model="dati.portale2.lastName" placeholder="Rossi" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Email" required>
              <UInput v-model="dati.portale2.email" type="email" placeholder="secondo.genitore@email.it" class="w-full" />
            </UFormField>
          </div>

          <!-- I dati anagrafici sono già al sicuro (Step 2): qui si decide solo
               se dargli o no le credenziali del portale. -->
          <p v-else class="text-xs text-slate-500 mt-2">
            I suoi dati restano salvati sulla scheda dell'alunno. L'accesso al portale
            puoi dargli in qualsiasi momento, anche più avanti.
          </p>
        </div>

        <!-- Impostazione dell'ALUNNO, non del singolo genitore: vale per tutti gli accessi -->
        <div v-if="dati.portale.crea || dati.portale2.crea" class="flex items-center gap-2">
          <UCheckbox v-model="dati.abilitaPrenotazione" label="Abilita la prenotazione online per questo alunno" />
        </div>

        <!-- Riepilogo -->
        <div class="mt-4 space-y-2">
          <h4 class="text-sm font-medium text-slate-700">Riepilogo</h4>
          <div class="text-sm text-slate-600 space-y-1">
            <p><strong>Studente:</strong> {{ dati.studente.firstName }} {{ dati.studente.lastName }}</p>
            <p><strong>Genitore:</strong> {{ dati.genitore.parentName || dati.genitore.parentEmail || '—' }}</p>
            <p v-if="dati.genitore2.attivo"><strong>Secondo genitore:</strong> {{ dati.genitore2.nome || dati.genitore2.email || '—' }}</p>
            <p v-if="dati.pacchetto.crea"><strong>Pacchetto:</strong> {{ dati.pacchetto.nome }} ({{ dati.pacchetto.tipo }}, €{{ dati.pacchetto.prezzoTotale }})</p>
            <p v-if="dati.portale.crea"><strong>Portale:</strong> Account per {{ dati.portale.email || dati.genitore.parentEmail }}</p>
            <p v-if="dati.portale2.crea"><strong>Portale (2° genitore):</strong> Account per {{ dati.portale2.email || dati.genitore2.email }}</p>
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
        <UAlert v-else-if="risultato.errorePacchetto" color="warning" variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          title="Il pacchetto non è stato creato"
          :description="`${risultato.errorePacchetto} — lo studente però è salvato: puoi creare il pacchetto dalla sua scheda.`"
        />

        <!-- UN RIQUADRO PER OGNI GENITORE: prima si mostrava solo il primo, e
             l'accesso del secondo restava invisibile (quindi mai consegnato). -->
        <div v-for="acc in risultato.accessi" :key="acc.chiave" class="space-y-2">
          <p class="text-xs font-medium text-slate-500 uppercase tracking-wide">{{ acc.etichetta }}</p>

          <div v-if="acc.creato" class="text-sm text-slate-600">
            ✅ Account portale creato per <strong>{{ acc.email }}</strong>
          </div>

          <LinkPrimoAccesso
            v-if="acc.linkPassword"
            :link="acc.linkPassword"
            :email="acc.email"
            :nome="acc.nome"
            :email-inviata="acc.emailInviata"
            :motivo-email="acc.motivoEmail"
            :dettaglio-email="acc.dettaglioEmail"
          />

          <div v-if="acc.collegato" class="text-sm text-emerald-700">
            ✅ Alunno collegato all'account già esistente di <strong>{{ acc.email }}</strong>.
          </div>

          <!-- Email già registrata: NON si collega da soli, si chiede -->
          <div v-else-if="acc.collegaEsistente" class="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p class="text-sm font-medium text-slate-800">Genitore già registrato</p>
            <p class="text-sm text-slate-600">
              L'email <strong>{{ acc.collegaEsistente.email }}</strong> appartiene già all'account di
              <strong>{{ acc.collegaEsistente.nome || 'un genitore esistente' }}</strong> (probabilmente un altro figlio è già iscritto).
              Collegare anche questo studente allo stesso account? La password non cambierà.
            </p>
            <div class="flex gap-2 justify-end">
              <UButton size="xs" variant="ghost" @click="acc.collegaEsistente = null">Non collegare</UButton>
              <UButton size="xs" color="primary" :loading="acc.collegando" @click="confermaCollegamentoEsistente(acc)">
                Collega allo stesso account
              </UButton>
            </div>
          </div>

          <!-- Un genitore andato storto non deve far sparire tutto il resto -->
          <UAlert v-if="acc.errore" color="error" variant="subtle" icon="i-heroicons-exclamation-triangle"
            title="Accesso non creato" :description="acc.errore" />
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
import type { EsitoInvitoEmail } from '#shared/email'
import { oggiISO } from '~/utils/format'
import { METODI_PAGAMENTO_ITEMS } from '~/utils/contabilita'
import { z } from 'zod'
import { normalizzaTelefono } from '~/utils/phone'

// `prefill` = dati già noti (es. presi da un contatto del mini-CRM): all'apertura
// il wizard parte con quei campi già scritti. Senza `prefill` non cambia nulla.
interface PrefillStudente {
  firstName?: string
  lastName?: string
  classe?: string
  scuola?: string
  parentName?: string
  parentPhone?: string
  parentEmail?: string
  note?: string
}

const props = defineProps<{ open: boolean; prefill?: PrefillStudente | null }>()
const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'refresh'): void
  /** Id dello studente appena creato (serve a chi ha aperto il wizard per collegarlo) */
  (e: 'created', studentId: string): void
}>()

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const toast = useToast()
const step = ref(1)
const salvando = ref(false)
const altreScuola = ref(false)

import { SCUOLE_TRAPANI, CLASSI_LISTA } from '~/utils/schools'

// Parentela con l'alunno: `student_parents.relazione` è testo libero da 50
// caratteri, ma proporre una lista evita di ritrovarsi "madre", "Madre", "MAMMA"
// e "mamma di Luca" come quattro cose diverse. "Altro" lascia comunque scrivere.
const RELAZIONI_ITEMS = ['Madre', 'Padre', 'Tutore legale', 'Altro']

const Step1Schema = z.object({
  firstName: z.string().min(1, 'Il nome è obbligatorio').max(100),
  lastName: z.string().min(1, 'Il cognome è obbligatorio').max(100),
  dataNascita: z.string().optional().nullable(),
  classe: z.string().optional().nullable(),
  scuola: z.string().optional().nullable(),
})

const Step2Schema = z.object({
  parentName: z.string().optional().nullable(),
  parentPhone: z.string().optional().nullable(),
  // Opzionale come nello schema canonico (student.schema.ts); diventa necessaria
  // solo se si crea l'account portale (controllo in salvaTutto)
  parentEmail: z.string().email('Email non valida').optional().or(z.literal('')),
  relazione: z.string().optional().nullable(),
  relazioneAltro: z.string().max(50).optional().nullable(),
  dataNascita: z.string().optional().nullable(),
  parentCF: z.string().optional().nullable(),
  parentPIva: z.string().optional().nullable(),
  parentIndirizzo: z.string().optional().nullable(),
  parentCitta: z.string().optional().nullable(),
  parentCap: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

const STUDENTE_VUOTO = { firstName: '', lastName: '', dataNascita: '', classe: '', scuola: '' }
const GENITORE_VUOTO = {
  parentName: '', parentPhone: '', parentEmail: '',
  relazione: '', relazioneAltro: '', dataNascita: '',
  parentCF: '', parentPIva: '', parentIndirizzo: '', parentCitta: '', parentCap: '', note: '',
}
// Anagrafica completa anche per il secondo: finisce sulle colonne parent2* dello
// studente, quindi si salva pure quando non gli si crea l'accesso al portale.
const GENITORE2_VUOTO = {
  attivo: false, nome: '', telefono: '', email: '',
  relazione: '', relazioneAltro: '', dataNascita: '',
  cf: '', piva: '', indirizzo: '', citta: '', cap: '',
}
const PACCHETTO_VUOTO = {
  crea: false, nome: '', tipo: 'ORE' as 'ORE' | 'MENSILE' | 'A_CONSUMO',
  oreAcquistate: 10, prezzoTotale: 0, dataInizio: oggiISO(), dataScadenza: '',
  giorniAcquistati: 12, orarioGiornaliero: 3, tariffaOraria: 10,
  accontoImporto: 0, accontoMetodo: 'CONTANTI', accontoFattura: false, standardPackageId: '',
}
const PORTALE_VUOTO = { crea: false, firstName: '', lastName: '', email: '' }

const dati = reactive({
  studente:  { ...STUDENTE_VUOTO },
  genitore:  { ...GENITORE_VUOTO },
  genitore2: { ...GENITORE2_VUOTO },
  pacchetto: { ...PACCHETTO_VUOTO },
  portale:   { ...PORTALE_VUOTO },
  portale2:  { ...PORTALE_VUOTO },
  // Impostazione dell'ALUNNO (students.abilitatoPrenotazioneOnline), non del
  // singolo genitore: sta fuori dai due riquadri perché vale per entrambi.
  abilitaPrenotazione: true,
})

const form1 = ref()
const form2 = ref()

// L'etichetta vera da mandare all'API: la voce scelta, oppure il testo libero se
// si è scelto "Altro". Stringa vuota = campo omesso dal body (nessuna etichetta).
function relazioneDa(g: { relazione: string; relazioneAltro: string }): string {
  if (!g.relazione) return ''
  if (g.relazione === 'Altro') return g.relazioneAltro.trim().slice(0, 50)
  return g.relazione
}

// ─── Precompilazione (solo se arriva `prefill`) ───
// Si riparte sempre dallo step 1 così l'utente vede subito cosa è già scritto e
// può correggerlo. Senza `prefill` questo blocco non fa assolutamente nulla.
watch(() => props.open, (apertoAdesso) => {
  const p = props.prefill
  if (!apertoAdesso || !p) return

  step.value = 1
  Object.assign(dati.studente, {
    firstName: p.firstName ?? '',
    lastName:  p.lastName ?? '',
    classe:    p.classe ?? '',
    scuola:    p.scuola ?? '',
  })
  Object.assign(dati.genitore, {
    parentName:  p.parentName ?? '',
    parentPhone: p.parentPhone ?? '',
    parentEmail: p.parentEmail ?? '',
    note:        p.note ?? '',
  })
  // Se la scuola scritta non è nell'elenco, si passa da soli alla scrittura libera
  altreScuola.value = Boolean(p.scuola) && !SCUOLE_TRAPANI.includes(p.scuola as string)
}, { immediate: true })

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
  Object.assign(dati.studente,  { ...STUDENTE_VUOTO })
  Object.assign(dati.genitore,  { ...GENITORE_VUOTO })
  Object.assign(dati.genitore2, { ...GENITORE2_VUOTO })
  Object.assign(dati.pacchetto, { ...PACCHETTO_VUOTO, dataInizio: oggiISO() })
  templatePkgSelezionato.value = ''
  Object.assign(dati.portale,  { ...PORTALE_VUOTO })
  Object.assign(dati.portale2, { ...PORTALE_VUOTO })
  dati.abilitaPrenotazione = true
  risultato.accessi = []
  risultato.pacchettoCreato = false
  risultato.errorePacchetto = ''
}

// L'esito dell'accesso di UN genitore. Ce n'è uno per genitore a cui è stato
// chiesto l'accesso: così il link del secondo non può più restare invisibile.
interface AccessoRisultato {
  chiave: 'primo' | 'secondo'
  etichetta: string
  nome: string
  email: string
  creato: boolean
  linkPassword: string
  emailInviata: boolean
  motivoEmail?: EsitoInvitoEmail['motivoEmail']
  dettaglioEmail?: EsitoInvitoEmail['dettaglioEmail']
  errore: string
  /** Email già di un genitore registrato: collegamento in attesa di conferma */
  collegaEsistente: null | { email: string; nome: string }
  collegando: boolean
  collegato: boolean
}

const risultatoAperto = ref(false)
const risultato = reactive({
  studentId: '',
  pacchettoCreato: false,
  errorePacchetto: '',
  accessi: [] as AccessoRisultato[],
})

async function confermaCollegamentoEsistente(acc: AccessoRisultato) {
  if (!acc.collegaEsistente || !risultato.studentId) return
  acc.collegando = true
  try {
    await $fetch(`/api/admin/students/${risultato.studentId}/portal-access`, {
      method: 'POST',
      body: {
        email: acc.collegaEsistente.email,
        force: true,
        relazione: acc.chiave === 'primo'
          ? relazioneDa(dati.genitore) || undefined
          : relazioneDa(dati.genitore2) || undefined,
      },
    })
    acc.collegato = true
    acc.email = acc.collegaEsistente.email
    acc.collegaEsistente = null
    toast.add({ title: 'Studente collegato all\'account esistente', color: 'success' })
    emit('refresh')
  } catch (e: any) {
    acc.errore = e?.data?.statusMessage ?? 'Collegamento non riuscito'
    toast.add({ title: 'Errore', description: acc.errore, color: 'error' })
  } finally {
    acc.collegando = false
  }
}

// Crea l'accesso di UN genitore e ne registra l'esito.
// Ogni genitore ha il suo try/catch: se il secondo va storto, il primo (e lo
// studente, e il pacchetto) restano salvati e a schermo.
async function creaAccessoGenitore(
  chiave: 'primo' | 'secondo',
  etichetta: string,
  body: { email: string; firstName: string; lastName: string; relazione?: string; phone?: string | null; dataNascita?: string | null },
  studenteId: string,
) {
  const acc: AccessoRisultato = {
    chiave,
    etichetta,
    nome: body.firstName || 'il genitore',
    email: body.email,
    creato: false,
    linkPassword: '',
    emailInviata: false,
    errore: '',
    collegaEsistente: null,
    collegando: false,
    collegato: false,
  }
  risultato.accessi.push(acc)

  try {
    const res = await $fetch(`/api/admin/students/${studenteId}/portal-access`, {
      method: 'POST',
      body,
    }) as any

    // L'endpoint risponde con i campi al livello principale (niente wrapper .data)
    acc.email = res.email || body.email

    if (res.linkPassword) {
      acc.creato = true
      acc.linkPassword = res.linkPassword
      acc.emailInviata = res.emailInviata === true
      acc.motivoEmail = res.motivoEmail
      acc.dettaglioEmail = res.dettaglioEmail
    } else if (res.requiresConfirmation) {
      // Email già registrata come genitore (probabile altro figlio):
      // NON colleghiamo in automatico — chiediamo conferma nel riepilogo finale.
      // Vale per il primo genitore come per il secondo, senza differenze.
      acc.collegaEsistente = {
        email: res.existingUser?.email ?? body.email,
        nome: `${res.existingUser?.firstName ?? ''} ${res.existingUser?.lastName ?? ''}`.trim(),
      }
    } else if (res.alreadyExisted) {
      // Collegato a un account che esisteva già: nessun link da consegnare,
      // la password del genitore non è stata toccata.
      acc.collegato = true
    }
  } catch (err: any) {
    acc.errore = err?.data?.statusMessage ?? err?.message ?? 'Accesso non creato'
  }
}

async function salvaTutto() {
  // Il nome pacchetto deriva sempre dal pacchetto standard scelto
  if (dati.pacchetto.crea && !dati.pacchetto.nome) {
    toast.add({
      title: 'Scegli un pacchetto standard',
      description: 'Il nome del pacchetto deriva sempre da quello standard (Impostazioni).',
      color: 'error',
    })
    step.value = 3
    return
  }

  // Ogni accesso richiesto ha bisogno di un'email: senza, il genitore non potrebbe
  // mai entrare (l'email È il nome utente).
  if (dati.portale.crea && !dati.portale.email && !dati.genitore.parentEmail) {
    toast.add({
      title: 'Email mancante per il portale',
      description: "Inserisci l'email del primo genitore o dell'account portale.",
      color: 'error',
    })
    step.value = 4
    return
  }
  if (dati.portale2.crea && !dati.portale2.email && !dati.genitore2.email) {
    toast.add({
      title: 'Email mancante per il secondo genitore',
      description: "Inserisci l'email del secondo genitore o togli la spunta al suo accesso.",
      color: 'error',
    })
    step.value = 4
    return
  }

  const email1 = (dati.portale.email || dati.genitore.parentEmail).trim().toLowerCase()
  const email2 = (dati.portale2.email || dati.genitore2.email).trim().toLowerCase()
  if (dati.portale.crea && dati.portale2.crea && email1 && email1 === email2) {
    toast.add({
      title: 'Stessa email per tutti e due i genitori',
      description: 'Ogni accesso ha bisogno di un indirizzo diverso: è quello con cui si entra.',
      color: 'error',
    })
    step.value = 4
    return
  }

  salvando.value = true
  try {
    // 1. Crea studente — se questo fallisce non c'è niente da salvare dopo
    const studenteBody = {
      firstName: dati.studente.firstName,
      lastName: dati.studente.lastName,
      dataNascita: dati.studente.dataNascita || undefined,
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
      parentRelazione: relazioneDa(dati.genitore) || undefined,
      note: dati.genitore.note || undefined,
      // Il secondo genitore si salva sull'anagrafica dell'alunno indipendentemente
      // dall'accesso al portale: la spunta dello Step 2 basta e avanza.
      ...(dati.genitore2.attivo ? {
        parent2Name: dati.genitore2.nome || undefined,
        parent2Phone: dati.genitore2.telefono || undefined,
        parent2Email: dati.genitore2.email || undefined,
        parent2CF: dati.genitore2.cf || undefined,
        parent2PIva: dati.genitore2.piva || undefined,
        parent2Indirizzo: dati.genitore2.indirizzo || undefined,
        parent2Citta: dati.genitore2.citta || undefined,
        parent2Cap: dati.genitore2.cap || undefined,
        parent2DataNascita: dati.genitore2.dataNascita || undefined,
        parent2Relazione: relazioneDa(dati.genitore2) || undefined,
      } : {}),
    }

    const studenteRes = await $fetch('/api/students', { method: 'POST', body: studenteBody }) as any
    const studenteId = studenteRes.data?.id
    if (!studenteId) throw new Error('Creazione studente fallita')

    risultato.studentId = studenteId
    risultato.accessi = []
    risultato.pacchettoCreato = false
    risultato.errorePacchetto = ''
    // Lo studente esiste: avvisiamo subito chi ha aperto il wizard (es. la scheda
    // contatto, che lo collega e segna il contatto come "Convertito").
    emit('created', studenteId)

    // 2. Crea pacchetto (se richiesto).
    // Da qui in poi ogni passo ha il suo try/catch: lo studente è già salvato e
    // non deve sparire dallo schermo perché un passo successivo va storto.
    if (dati.pacchetto.crea) {
      try {
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
      } catch (err: any) {
        risultato.errorePacchetto = err?.data?.statusMessage ?? err?.message ?? 'Errore sconosciuto'
      }
    }

    // 3. Accessi al portale, uno per genitore, in sequenza.
    // In sequenza e non in parallelo apposta: se i due genitori avessero per
    // sbaglio la stessa email, due richieste insieme si accavallerebbero sullo
    // stesso account; una alla volta il secondo trova il primo e chiede conferma.
    if (dati.portale.crea) {
      await creaAccessoGenitore(
        'primo',
        `Primo genitore${dati.genitore.parentName ? ' — ' + dati.genitore.parentName : ''}`,
        {
          email: dati.portale.email || dati.genitore.parentEmail,
          firstName: dati.portale.firstName || dati.genitore.parentName?.split(' ')[0] || 'Genitore',
          lastName: dati.portale.lastName || dati.studente.lastName,
          relazione: relazioneDa(dati.genitore) || undefined,
          phone: dati.genitore.parentPhone || null,
          dataNascita: dati.genitore.dataNascita || null,
        },
        studenteId,
      )
    }

    if (dati.genitore2.attivo && dati.portale2.crea) {
      await creaAccessoGenitore(
        'secondo',
        `Secondo genitore${dati.genitore2.nome ? ' — ' + dati.genitore2.nome : ''}`,
        {
          email: dati.portale2.email || dati.genitore2.email,
          firstName: dati.portale2.firstName || dati.genitore2.nome?.split(' ')[0] || 'Genitore',
          lastName: dati.portale2.lastName || dati.studente.lastName,
          relazione: relazioneDa(dati.genitore2) || undefined,
          phone: dati.genitore2.telefono || null,
          dataNascita: dati.genitore2.dataNascita || null,
        },
        studenteId,
      )
    }

    // 4. Prenotazione online: impostazione dell'ALUNNO, si chiede una volta sola
    if (dati.abilitaPrenotazione && (dati.portale.crea || dati.portale2.crea)) {
      try {
        await $fetch(`/api/admin/students/${studenteId}/portal-access`, {
          method: 'PUT',
          body: { action: 'toggle-prenotazione', abilitato: true },
        })
      } catch {
        toast.add({
          title: 'Prenotazione online non attivata',
          description: 'Puoi attivarla dalla scheda dell\'alunno, nella sezione Portale.',
          color: 'warning',
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

// Pre-compila i dati degli accessi ENTRANDO nello step 4 (i vecchi watch
// per-tasto copiavano solo il primo carattere digitato e poi smettevano).
watch(step, (s) => {
  if (s !== 4) return

  if (!dati.portale.email && dati.genitore.parentEmail) {
    dati.portale.email = dati.genitore.parentEmail
  }
  if (!dati.portale.firstName && dati.genitore.parentName) {
    dati.portale.firstName = dati.genitore.parentName.trim().split(/\s+/)[0] ?? ''
  }
  if (!dati.portale.lastName) {
    const cognomeGenitore = dati.genitore.parentName?.trim().split(/\s+/).slice(1).join(' ')
    dati.portale.lastName = cognomeGenitore || dati.studente.lastName || ''
  }

  if (!dati.genitore2.attivo) return
  if (!dati.portale2.email && dati.genitore2.email) {
    dati.portale2.email = dati.genitore2.email
  }
  if (!dati.portale2.firstName && dati.genitore2.nome) {
    dati.portale2.firstName = dati.genitore2.nome.trim().split(/\s+/)[0] ?? ''
  }
  if (!dati.portale2.lastName) {
    const cognome2 = dati.genitore2.nome?.trim().split(/\s+/).slice(1).join(' ')
    dati.portale2.lastName = cognome2 || dati.studente.lastName || ''
  }
})
</script>
