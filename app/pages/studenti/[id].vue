<template>
  <div class="space-y-6">

    <!-- Skeleton caricamento -->
    <template v-if="pending">
      <div class="space-y-4">
        <USkeleton class="h-8 w-64" />
        <USkeleton class="h-40 w-full" />
        <USkeleton class="h-60 w-full" />
      </div>
    </template>

    <!-- Studente non trovato -->
    <template v-else-if="!studente">
      <UAlert icon="i-heroicons-exclamation-circle" color="error" title="Studente non trovato" description="Questo studente non esiste o è stato rimosso." />
      <UButton to="/studenti" variant="ghost" icon="i-heroicons-arrow-left">Torna alla lista</UButton>
    </template>

    <!-- Contenuto principale -->
    <template v-else>
      <!-- Intestazione -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton to="/studenti" variant="ghost" icon="i-heroicons-arrow-left" size="sm" />
          <div>
            <h2 class="text-xl font-semibold text-slate-900">{{ studente.lastName }} {{ studente.firstName }}</h2>
            <p class="text-sm text-slate-500">{{ studente.classe ?? '' }} {{ studente.scuola ? '— ' + studente.scuola : '' }}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <UBadge :color="studente.active ? 'success' : 'neutral'" variant="subtle" size="md">
            {{ studente.active ? 'Attivo' : 'Inattivo' }}
          </UBadge>
          <UButton icon="i-heroicons-pencil-square" variant="outline" size="sm" @click="apriModalModifica">Modifica</UButton>
          <UButton
            v-if="studente.active"
            icon="i-heroicons-user-minus"
            variant="outline"
            color="error"
            size="sm"
            :loading="disattivando"
            @click="disattivaStudente"
          >
            Disattiva
          </UButton>
        </div>
      </div>

      <!-- Card info studente -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-academic-cap" class="w-4 h-4 text-tfn-500" />
              <span class="font-medium text-slate-800">Dati Studente</span>
            </div>
          </template>
          <dl class="space-y-2 text-sm">
            <InfoRow label="Nome" :value="`${studente.firstName} ${studente.lastName}`" />
            <InfoRow label="Classe" :value="studente.classe" />
            <InfoRow label="Scuola" :value="studente.scuola" />
            <InfoRow label="Telefono" :value="studente.studentPhone" />
            <InfoRow label="Email" :value="studente.studentEmail" />
            <InfoRow v-if="studente.bisogniSpeciali" label="Bisogni speciali" :value="studente.bisogniSpeciali" highlight />
            <InfoRow v-if="studente.note" label="Note" :value="studente.note" />
          </dl>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-user" class="w-4 h-4 text-tfn-500" />
              <span class="font-medium text-slate-800">Dati Genitore</span>
            </div>
          </template>
          <dl class="space-y-2 text-sm">
            <InfoRow label="Nome" :value="studente.parentName" />
            <InfoRow label="Email" :value="studente.parentEmail" />
            <InfoRow label="Telefono" :value="studente.parentPhone" />
            <InfoRow label="Indirizzo" :value="studente.parentIndirizzo" />
            <InfoRow label="Città" :value="studente.parentCitta ? `${studente.parentCitta} ${studente.parentCap ?? ''}`.trim() : null" />
            <InfoRow label="Cod. Fiscale" :value="studente.parentCF" />
            <InfoRow label="P. IVA" :value="studente.parentPIva" />
          </dl>
        </UCard>
      </div>

      <!-- Sezione pacchetti -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-cube" class="w-4 h-4 text-tfn-500" />
              <span class="font-medium text-slate-800">Pacchetti</span>
              <UBadge color="neutral" variant="subtle">{{ pacchetti.length }}</UBadge>
            </div>
            <UButton icon="i-heroicons-plus" size="xs" :to="`/pacchetti?studentId=${studente.id}`">
              Nuovo pacchetto
            </UButton>
          </div>
        </template>

        <div v-if="pendingPacchetti" class="space-y-2 py-2">
          <USkeleton v-for="i in 2" :key="i" class="h-16 w-full" />
        </div>

        <div v-else-if="pacchetti.length === 0" class="py-8 text-center text-slate-400 text-sm">
          Nessun pacchetto per questo studente.
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="pkg in pacchetti"
            :key="pkg.id"
            class="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium text-sm text-slate-800">{{ pkg.nome }}</span>
                <UBadge color="neutral" variant="outline" size="xs">{{ pkg.tipo }}</UBadge>
                <StatoBadge v-for="s in pkg.stati" :key="s" :stato="s" :pacchetto="pkg" />
              </div>
              <div class="text-sm">
                <div class="font-medium">
                  <template v-if="pkg.tipo === 'ORE'">
                    {{ parseFloat(pkg.oreResiduo) }} / {{ parseFloat(pkg.oreAcquistate) }} ore
                  </template>
                  <template v-else-if="pkg.tipo === 'MENSILE'">
                    {{ pkg.giorniResiduo ?? 0 }} / {{ pkg.giorniAcquistati ?? 0 }} giorni
                    <span class="text-xs text-slate-400 font-normal block">({{ parseFloat(pkg.oreAcquistate) - parseFloat(pkg.oreResiduo) }} ore cons.)</span>
                  </template>
                  <template v-else-if="pkg.tipo === 'A_CONSUMO'">
                    {{ parseFloat(pkg.oreResiduo) }} ore (libretto)
                  </template>
                </div>
                <span v-if="pkg.importoResiduo && parseFloat(pkg.importoResiduo) > 0" class="text-orange-500 font-medium">
                  Residuo € {{ parseFloat(pkg.importoResiduo).toFixed(2) }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-4 ml-4 shrink-0">
              <div class="text-xs text-slate-400 text-right">
                <div>Inizio: {{ formatData(pkg.dataInizio) }}</div>
                <div v-if="pkg.dataScadenza">Scade: {{ formatData(pkg.dataScadenza) }}</div>
              </div>
              <UDropdownMenu v-if="azioniPacchetto(pkg).length > 0" :items="[azioniPacchetto(pkg)]">
                <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" size="xs" color="neutral" />
              </UDropdownMenu>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Sezione Note Didattiche -->
      <StudentNoteFeed :student-id="id" />

      <!-- ═══ ACCESSO PORTALE (solo ADMIN/SUPER_TUTOR) ═══ -->
      <UCard v-if="isAdmin">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-globe-alt" class="w-4 h-4 text-tfn-500" />
            <span class="font-medium text-slate-800">Accesso Portale Famiglie</span>
          </div>
        </template>

        <!-- Nessun account portale -->
        <template v-if="!(portalAccess as any)?.portalUser">
          <p class="text-sm text-slate-500 mb-4">
            Questo studente non ha ancora un account portale.
            Crea un accesso per il genitore per consentirgli di visualizzare note e richiedere lezioni.
          </p>
          <UButton icon="i-heroicons-plus" @click="apriModalCreaAccesso">
            Crea accesso portale
          </UButton>
        </template>

        <!-- Account portale esistente -->
        <template v-else>
          <dl class="space-y-2 text-sm mb-4">
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-slate-500">Email genitore</span>
              <span class="font-medium">{{ (portalAccess as any).portalUser?.email }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-slate-500">Nome</span>
              <span class="font-medium">
                {{ (portalAccess as any).portalUser?.firstName }}
                {{ (portalAccess as any).portalUser?.lastName }}
              </span>
            </div>
            <div class="flex items-center justify-between py-1 border-b border-slate-100">
              <span class="text-slate-500">Prenotazione online</span>
              <USwitch
                :model-value="(portalAccess as any).abilitatoPrenotazioneOnline"
                :loading="togglando"
                @update:model-value="togglePrenotazione"
              />
            </div>
          </dl>

          <UAlert
            v-if="resetPassword"
            color="warning"
            icon="i-heroicons-key"
            title="Nuova password temporanea"
            :description="`Comunica questa password al genitore: ${resetPassword} (mostrata una sola volta)`"
            class="mb-4"
            :close-button="{ icon: 'i-heroicons-x-mark' }"
            @close="resetPassword = null"
          />

          <UAlert
            v-if="credenziali"
            color="info"
            icon="i-heroicons-key"
            title="Account creato — comunicare al genitore:"
            :description="`Email: ${credenziali.email} | Password: ${credenziali.tempPassword}`"
            class="mb-4"
            :close-button="{ icon: 'i-heroicons-x-mark' }"
            @close="credenziali = null"
          />

          <UButton variant="outline" size="sm" @click="reimpostaPassword">
            Reimposta password
          </UButton>
        </template>

        <!-- Prenotazioni PENDING -->
        <template v-if="bookingsPending.length > 0">
          <div class="mt-4 pt-4 border-t border-slate-100">
            <div class="flex items-center gap-2 mb-3">
              <span class="text-sm font-medium text-slate-800">Prenotazioni in attesa</span>
              <UBadge color="warning" variant="subtle">{{ bookingsPending.length }}</UBadge>
            </div>
            <div class="space-y-2">
              <div
                v-for="b in bookingsPending"
                :key="b.id"
                class="flex items-start justify-between bg-amber-50 border border-amber-200 rounded-lg p-3"
              >
                <div class="text-sm space-y-0.5">
                  <p class="font-medium text-slate-800">{{ formatDateBooking(b.requestedDate) }}</p>
                  <p class="text-slate-500">{{ b.subjects?.map((s: any) => s.name).join(', ') }}</p>
                  <p v-if="b.notes" class="text-slate-400 text-xs">{{ b.notes }}</p>
                </div>
                <div class="flex gap-2 ml-3">
                  <UButton size="xs" color="success" @click="confermaBooking(b.id)">Conferma</UButton>
                  <UButton size="xs" color="error" variant="outline" @click="cancellaBooking(b.id)">Cancella</UButton>
                </div>
              </div>
            </div>
          </div>
        </template>
      </UCard>

    </template>

    <!-- ─── MODAL PAGAMENTO, RICARICA E LIBRETTO ─── -->
    <ModalPagamentoPacchetto
      v-model:open="modalPagamentoAperto"
      :pacchetto="pacchettoSelezionato"
      @refresh="refreshPacchetti"
    />

    <ModalRicaricaPacchetto
      v-model:open="modalRicaricaAperto"
      :pacchetto="pacchettoSelezionato"
      @refresh="refreshPacchetti"
    />

    <ModalLibrettoRicariche
      v-model:open="modalLibrettoAperto"
      :pacchetto="pacchettoSelezionato"
    />

    <!-- ─── MODAL CREA ACCESSO PORTALE ─── -->
    <UModal v-model:open="mostraModalCreaAccesso" title="Crea accesso portale">
      <template #body>
        <div class="space-y-4 p-4">
          <p class="text-sm text-slate-500">
            Inserisci i dati del genitore. Verrà generata una password temporanea da comunicare manualmente.
          </p>
          <UFormField label="Email genitore">
            <UInput v-model="datiCreaAccesso.email" type="email" class="w-full" placeholder="genitore@email.it" />
          </UFormField>
          <UFormField label="Nome">
            <UInput v-model="datiCreaAccesso.firstName" class="w-full" placeholder="Mario" />
          </UFormField>
          <UFormField label="Cognome">
            <UInput v-model="datiCreaAccesso.lastName" class="w-full" placeholder="Rossi" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 px-4 pb-4">
          <UButton variant="ghost" @click="mostraModalCreaAccesso = false">Annulla</UButton>
          <UButton
            color="primary"
            :loading="creandoAccesso"
            :disabled="!datiCreaAccesso.email || !datiCreaAccesso.firstName || !datiCreaAccesso.lastName"
            @click="creaAccessoPortale"
          >
            Crea account
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL MODIFICA STUDENTE ─── -->
    <UModal v-model:open="modalModificaAperto" title="Modifica Studente" :ui="{ width: 'max-w-2xl' }">
      <template #body>
        <UForm ref="formModifica" :schema="UpdateStudentSchema" :state="datiModifica" @submit="salvaModifica" class="space-y-4">

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="firstName" label="Nome" required>
              <UInput v-model="datiModifica.firstName" class="w-full" />
            </UFormField>
            <UFormField name="lastName" label="Cognome" required>
              <UInput v-model="datiModifica.lastName" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="classe" label="Classe">
              <USelectMenu
                v-model="datiModifica.classe"
                :items="CLASSI_LISTA"
                searchable
                placeholder="Seleziona classe..."
                class="w-full"
              />
            </UFormField>
            <UFormField name="scuola" label="Scuola">
              <template v-if="!altreScuolaModifica">
                <USelectMenu
                  v-model="datiModifica.scuola"
                  :items="SCUOLE_TRAPANI"
                  searchable
                  placeholder="Cerca scuola..."
                  class="w-full"
                />
                <button
                  type="button"
                  class="text-xs text-tfn-500 hover:underline mt-1 block"
                  @click="altreScuolaModifica = true"
                >
                  Non trovi la scuola? Inserisci manualmente
                </button>
              </template>
              <template v-else>
                <div class="flex gap-2">
                  <UInput v-model="datiModifica.scuola" placeholder="Nome scuola" class="flex-1" />
                  <UButton variant="ghost" size="xs" @click="altreScuolaModifica = false">← Lista</UButton>
                </div>
              </template>
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="studentPhone" label="Tel. Studente">
              <UInput
                v-model="datiModifica.studentPhone"
                class="w-full"
                @blur="datiModifica.studentPhone = normalizzaTelefono(datiModifica.studentPhone)"
              />
            </UFormField>
            <UFormField name="studentEmail" label="Email Studente">
              <UInput v-model="datiModifica.studentEmail" type="email" class="w-full" />
            </UFormField>
          </div>

          <USeparator label="Dati Genitore" />

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="parentName" label="Nome Genitore">
              <UInput v-model="datiModifica.parentName" class="w-full" />
            </UFormField>
            <UFormField name="parentPhone" label="Tel. Genitore">
              <UInput
                v-model="datiModifica.parentPhone"
                class="w-full"
                @blur="datiModifica.parentPhone = normalizzaTelefono(datiModifica.parentPhone)"
              />
            </UFormField>
          </div>

          <UFormField name="parentEmail" label="Email genitore">
            <UInput v-model="datiModifica.parentEmail" type="email" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-3 gap-4">
            <UFormField name="parentIndirizzo" label="Indirizzo" class="col-span-2">
              <UInput v-model="datiModifica.parentIndirizzo" class="w-full" />
            </UFormField>
            <UFormField name="parentCap" label="CAP">
              <UInput v-model="datiModifica.parentCap" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="parentCitta" label="Città">
              <UInput v-model="datiModifica.parentCitta" class="w-full" />
            </UFormField>
            <UFormField name="parentCF" label="Codice Fiscale">
              <UInput v-model="datiModifica.parentCF" class="w-full" />
            </UFormField>
          </div>

          <UFormField name="bisogniSpeciali" label="Bisogni speciali">
            <UTextarea v-model="datiModifica.bisogniSpeciali" :rows="2" class="w-full" />
          </UFormField>

          <UFormField name="note" label="Note interne">
            <UTextarea v-model="datiModifica.note" :rows="2" class="w-full" />
          </UFormField>

        </UForm>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="modalModificaAperto = false">Annulla</UButton>
          <UButton :loading="salvando" @click="formModifica?.submit()">Salva Modifiche</UButton>
        </div>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
import { UpdateStudentSchema } from '#shared/schemas/student.schema'
import { normalizzaTelefono } from '~/utils/phone'

definePageMeta({ middleware: ['staff-only'] })

const route = useRoute()
const toast = useToast()
const id = route.params.id as string

// ─── Scuole e classi (stesso elenco dell'index) ───
const SCUOLE_TRAPANI = [
  'Liceo Scientifico "G. Galilei" - Trapani',
  'Liceo Classico "L. Ximenes" - Trapani',
  'Liceo delle Scienze Umane "G. B. Fardella" - Trapani',
  'Liceo Artistico di Trapani',
  'ITC "P. F. Calvino" - Trapani',
  'ITIS "G. Ferro" - Trapani',
  'IPSIA "L. Cassia" - Trapani',
  'Istituto Alberghiero di Trapani',
  'I.C. "S. Borsellino-Ajello" - Trapani',
  'I.C. "G. Mazzini" - Trapani',
  'I.C. "E. De Amicis" - Trapani',
  'I.C. "G. Garibaldi" - Trapani',
  'I.C. "L. Da Vinci" - Trapani',
  'I.C. "G. Petrosino" - Petrosino (TP)',
  'Liceo "G. G. Adria" - Marsala',
  'ITIS "P. Gentili" - Marsala',
  'ITC "A. Lombardo" - Marsala',
  'I.C. di Erice',
  'I.C. di Paceco',
  'I.C. di Valderice',
]

const CLASSI_LISTA = [
  '1ª Elementare', '2ª Elementare', '3ª Elementare', '4ª Elementare', '5ª Elementare',
  '1ª Media', '2ª Media', '3ª Media',
  '1ª Superiore', '2ª Superiore', '3ª Superiore', '4ª Superiore', '5ª Superiore',
  'Università', 'Concorsi / Adulti',
]

// ─── Fetch studente ───
const { data: studente, pending, refresh } = await useFetch(`/api/students/${id}`)

// ─── Fetch pacchetti dello studente ───
const { data: datiPacchetti, pending: pendingPacchetti, refresh: refreshPacchetti } = await useFetch('/api/packages', {
  query: { studentId: id, limit: 50 },
})
const pacchetti = computed(() => datiPacchetti.value?.data ?? [])

// ─── Formato data ───
function formatData(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Disattiva studente ───
const disattivando = ref(false)

async function disattivaStudente() {
  if (!confirm('Sei sicuro di voler disattivare questo studente?')) return
  disattivando.value = true
  try {
    await $fetch(`/api/students/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Studente disattivato', color: 'success', icon: 'i-heroicons-check-circle' })
    refresh()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile disattivare', color: 'error' })
  } finally {
    disattivando.value = false
  }
}

// ─── Modal modifica ───
const modalModificaAperto  = ref(false)
const formModifica         = ref()
const salvando             = ref(false)
const altreScuolaModifica  = ref(false)

const datiModifica = reactive({
  firstName:       '',
  lastName:        '',
  classe:          '',
  scuola:          '',
  studentPhone:    '',
  studentEmail:    '',
  parentName:      '',
  parentPhone:     '',
  parentEmail:     '',
  parentIndirizzo: '',
  parentCitta:     '',
  parentCap:       '',
  parentCF:        '',
  bisogniSpeciali: '',
  note:            '',
})

function apriModalModifica() {
  if (!studente.value) return
  const s = studente.value as any
  Object.assign(datiModifica, {
    firstName:       s.firstName       ?? '',
    lastName:        s.lastName        ?? '',
    classe:          s.classe          ?? '',
    scuola:          s.scuola          ?? '',
    studentPhone:    s.studentPhone    ?? '',
    studentEmail:    s.studentEmail    ?? '',
    parentName:      s.parentName      ?? '',
    parentPhone:     s.parentPhone     ?? '',
    parentEmail:     s.parentEmail     ?? '',
    parentIndirizzo: s.parentIndirizzo ?? '',
    parentCitta:     s.parentCitta     ?? '',
    parentCap:       s.parentCap       ?? '',
    parentCF:        s.parentCF        ?? '',
    bisogniSpeciali: s.bisogniSpeciali ?? '',
    note:            s.note            ?? '',
  })
  // Se la scuola corrente non è nella lista, mostra input manuale
  altreScuolaModifica.value = !!s.scuola && !SCUOLE_TRAPANI.includes(s.scuola)
  modalModificaAperto.value = true
}

async function salvaModifica() {
  salvando.value = true
  try {
    await $fetch(`/api/students/${id}`, {
      method: 'PUT',
      body: {
        ...datiModifica,
        classe:          datiModifica.classe          || null,
        scuola:          datiModifica.scuola          || null,
        studentPhone:    datiModifica.studentPhone    || null,
        studentEmail:    datiModifica.studentEmail    || null,
        parentName:      datiModifica.parentName      || null,
        parentPhone:     datiModifica.parentPhone     || null,
        parentEmail:     datiModifica.parentEmail     || null,
        parentIndirizzo: datiModifica.parentIndirizzo || null,
        parentCitta:     datiModifica.parentCitta     || null,
        parentCap:       datiModifica.parentCap       || null,
        parentCF:        datiModifica.parentCF        || null,
        bisogniSpeciali: datiModifica.bisogniSpeciali || null,
        note:            datiModifica.note            || null,
      },
    })
    toast.add({ title: 'Modifiche salvate', color: 'success', icon: 'i-heroicons-check-circle' })
    modalModificaAperto.value = false
    refresh()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile salvare', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Azioni pacchetto ───
function azioniPacchetto(pkg: any) {
  const azioni = [
    { label: 'Registra pagamento', icon: 'i-heroicons-banknotes', onSelect: () => aprirePagamento(pkg) }
  ]
  if (pkg.tipo === 'A_CONSUMO') {
    azioni.push({ label: 'Ricarica', icon: 'i-heroicons-plus-circle', onSelect: () => apriModalRicarica(pkg) })
    azioni.push({ label: 'Libretto', icon: 'i-heroicons-list-bullet', onSelect: () => apriLibretto(pkg) })
  }
  return azioni
}

// ─── Gestione Modals Pacchetto ───
const pacchettoSelezionato = ref<any>(null)
const modalPagamentoAperto = ref(false)
const modalRicaricaAperto = ref(false)
const modalLibrettoAperto = ref(false)

function aprirePagamento(pkg: any) {
  pacchettoSelezionato.value = pkg
  modalPagamentoAperto.value = true
}

function apriModalRicarica(pkg: any) {
  pacchettoSelezionato.value = pkg
  modalRicaricaAperto.value = true
}

function apriLibretto(pkg: any) {
  pacchettoSelezionato.value = pkg
  modalLibrettoAperto.value = true
}

// ─── Portale Famiglie ───
const { user: sessionUser } = useUserSession()
const isAdmin = computed(() =>
  ['ADMIN', 'SUPER_TUTOR'].includes(sessionUser.value?.role ?? '')
)

const { data: portalAccess, refresh: refreshPortal } = await useFetch(
  `/api/admin/students/${id}/portal-access`,
  { lazy: true }
)

const { data: pendingBookings, refresh: refreshBookings } = await useFetch(
  `/api/admin/bookings?studentId=${id}`,
  { lazy: true }
)
const bookingsPending = computed(() =>
  ((pendingBookings.value as any[]) ?? []).filter((b: any) => b.status === 'PENDING')
)

const mostraModalCreaAccesso = ref(false)
const datiCreaAccesso = reactive({ email: '', firstName: '', lastName: '' })
const credenziali = ref<{ email: string; tempPassword: string } | null>(null)
const creandoAccesso = ref(false)
const resetPassword = ref<string | null>(null)
const togglando = ref(false)

function apriModalCreaAccesso() {
  const s = studente.value as any
  // Pre-compila con i dati del genitore già registrati per lo studente
  datiCreaAccesso.email = s?.parentEmail ?? ''
  if (s?.parentName) {
    const parts = (s.parentName as string).trim().split(/\s+/)
    datiCreaAccesso.firstName = parts[0] ?? ''
    datiCreaAccesso.lastName  = parts.slice(1).join(' ')
  }
  mostraModalCreaAccesso.value = true
}

async function creaAccessoPortale() {
  creandoAccesso.value = true
  try {
    const res = await $fetch(`/api/admin/students/${id}/portal-access`, {
      method: 'POST',
      body: datiCreaAccesso,
    }) as any
    credenziali.value = { email: res.email, tempPassword: res.tempPassword }
    await refreshPortal()
    toast.add({ title: 'Account portale creato', color: 'success' })
    mostraModalCreaAccesso.value = false
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile creare account',
      color: 'error',
    })
  } finally {
    creandoAccesso.value = false
  }
}

async function reimpostaPassword() {
  const acc = portalAccess.value as any
  if (!acc?.portalUser?.id) return
  try {
    const res = await $fetch(`/api/admin/students/${id}/portal-access`, {
      method: 'PUT',
      body: { action: 'reset-password', userId: acc.portalUser.id },
    }) as any
    resetPassword.value = res.tempPassword
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile reimpostare password',
      color: 'error',
    })
  }
}

async function togglePrenotazione(value: boolean) {
  togglando.value = true
  try {
    await $fetch(`/api/admin/students/${id}/portal-access`, {
      method: 'PUT',
      body: { action: 'toggle-prenotazione', abilitato: value },
    })
    await refreshPortal()
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile aggiornare',
      color: 'error',
    })
  } finally {
    togglando.value = false
  }
}

async function confermaBooking(bookingId: string) {
  try {
    await $fetch(`/api/admin/bookings/${bookingId}/status`, {
      method: 'PUT',
      body: { status: 'CONFIRMED' },
    })
    await refreshBookings()
    toast.add({ title: 'Prenotazione confermata', color: 'success' })
  } catch {
    toast.add({ title: 'Errore', color: 'error' })
  }
}

async function cancellaBooking(bookingId: string) {
  try {
    await $fetch(`/api/admin/bookings/${bookingId}/status`, {
      method: 'PUT',
      body: { status: 'CANCELLED' },
    })
    await refreshBookings()
    toast.add({ title: 'Prenotazione cancellata', color: 'neutral' })
  } catch {
    toast.add({ title: 'Errore', color: 'error' })
  }
}

function formatDateBooking(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}
</script>
