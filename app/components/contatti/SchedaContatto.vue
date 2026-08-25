<template>
  <USlideover
    v-model:open="aperto"
    side="right"
    :title="contatto ? nomeContatto(contatto) : 'Scheda contatto'"
    :description="contatto ? labelTipo(contatto.tipo) : ''"
    :ui="{ content: 'max-w-xl w-full' }"
  >
    <template #body>

      <!-- Caricamento -->
      <div v-if="caricando && !contatto" class="py-16 text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-7 h-7 text-slate-300 mx-auto animate-spin" />
        <p class="text-sm text-slate-400 mt-2">Sto aprendo la scheda…</p>
      </div>

      <div v-else-if="contatto" class="space-y-5">

        <!-- Intestazione: stato + scorciatoie -->
        <div class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge color="neutral" variant="subtle">{{ labelTipo(contatto.tipo) }}</UBadge>
            <UBadge v-if="contatto.archiviatoAt" color="neutral" variant="soft">Archiviato</UBadge>
            <UBadge v-if="contatto.anonimizzatoAt" color="warning" variant="soft">Anonimizzato (GDPR)</UBadge>
            <UBadge :color="coloreStato(contatto.stato)" variant="soft">{{ labelStato(contatto.stato) }}</UBadge>
          </div>

          <!-- Pulizia automatica dopo 12 mesi da "Perso": i dati personali non ci sono più -->
          <p v-if="contatto.anonimizzatoAt" class="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-2">
            Questa scheda è stata svuotata dalla pulizia privacy del
            {{ formatQuando(contatto.anonimizzatoAt) }}: nome, recapiti e note sono stati cancellati
            e non è più possibile modificarla. Restano solo le date, utili alle statistiche.
          </p>

          <div class="flex flex-wrap items-end gap-3">
            <UFormField label="Stato" name="stato" class="flex-1 min-w-[12rem]">
              <USelect
                :model-value="contatto.stato"
                :items="STATI_ITEMS"
                :loading="salvandoStato"
                class="w-full"
                @update:model-value="cambiaStato"
              />
            </UFormField>

            <div class="flex items-center gap-1 pb-1">
              <UButton
                v-if="contatto.telefono"
                icon="i-heroicons-phone" color="neutral" variant="soft"
                :to="linkTelefono(contatto.telefono)"
                title="Chiama" aria-label="Chiama"
              />
              <UButton
                v-if="contatto.telefono"
                icon="i-heroicons-chat-bubble-left-ellipsis" color="success" variant="soft"
                :to="linkWhatsapp(contatto.telefono)" target="_blank"
                title="Scrivi su WhatsApp" aria-label="Scrivi su WhatsApp"
              />
              <UButton
                v-if="contatto.email"
                icon="i-heroicons-envelope" color="neutral" variant="soft"
                :to="linkEmail(contatto.email)"
                title="Manda una email" aria-label="Manda una email"
              />
              <UButton
                v-if="indirizzoSocial"
                icon="i-heroicons-at-symbol" color="neutral" variant="soft"
                :to="indirizzoSocial" target="_blank"
                title="Apri la chat/profilo" aria-label="Apri la chat o il profilo social"
              />
            </div>
          </div>
        </div>

        <!-- Dati della persona -->
        <dl class="text-sm space-y-2">
          <InfoRow label="Fonte" :value="labelCanale(contatto.canaleOrigine)" />
          <InfoRow label="Inserito il" :value="inserito" />
          <InfoRow label="Telefono" :value="contatto.telefono" />
          <InfoRow label="Email" :value="contatto.email" />
          <InfoRow label="Profilo social" :value="contatto.socialLink" />

          <template v-if="contatto.tipo === 'DOPOSCUOLA'">
            <InfoRow label="Studente" :value="contatto.nomeStudente" />
            <InfoRow label="Classe / Scuola" :value="contatto.classeScuola" />
            <InfoRow label="Materie" :value="contatto.materie" />
          </template>
          <template v-else>
            <InfoRow label="Ruolo" :value="contatto.marketingRuolo ? labelRuoloMarketing(contatto.marketingRuolo) : null" />
            <InfoRow label="Attività" :value="contatto.azienda" />
            <InfoRow label="Servizio" :value="contatto.servizioInteresse" />
          </template>

          <InfoRow
            label="Prossimo ricontatto"
            :value="contatto.prossimoRicontatto ? formatGiorno(contatto.prossimoRicontatto) : 'Nessun promemoria'"
            :highlight="ricontattoScaduto(contatto)"
          />
          <InfoRow label="Ultimo contatto" :value="formatQuando(contatto.ultimoContattoAt)" />
          <InfoRow label="Privacy" :value="contatto.privacyInformata ? 'Informativa comunicata' : 'Informativa NON comunicata'" />
        </dl>

        <!-- Note (testo libero, va a capo come è stato scritto) -->
        <div v-if="contatto.note" class="bg-slate-50 rounded-xl p-3">
          <p class="text-xs text-slate-400 mb-1">Note</p>
          <p class="text-sm text-slate-700 whitespace-pre-line">{{ contatto.note }}</p>
        </div>

        <!-- Collegamento allo studente creato dalla conversione -->
        <NuxtLink
          v-if="contatto.studentId"
          :to="`/studenti/${contatto.studentId}`"
          class="inline-flex items-center gap-1.5 text-sm text-tfn-600 hover:underline"
        >
          <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-4 h-4" />
          Vai alla scheda studente{{ contatto.studenteNome ? ` (${contatto.studenteNome})` : '' }}
        </NuxtLink>

        <!-- Azioni -->
        <div class="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          <UButton v-if="!contatto.anonimizzatoAt" icon="i-heroicons-plus" @click="() => { modalInterazioneAperta = true }">
            Annota chiamata/messaggio
          </UButton>
          <UButton
            v-if="!contatto.anonimizzatoAt"
            icon="i-heroicons-pencil-square" variant="soft" color="neutral"
            @click="() => { modalModificaAperta = true }"
          >
            Modifica
          </UButton>

          <!-- Conversione: solo Doposcuola, contatto attivo e non ancora collegato a uno studente -->
          <UButton
            v-if="puoCreareStudente"
            icon="i-heroicons-academic-cap" variant="soft" color="success"
            title="Apri il modulo Nuovo studente già compilato con questi dati"
            @click="apriWizardStudente"
          >
            Crea studente
          </UButton>

          <UButton
            v-if="!contatto.archiviatoAt"
            icon="i-heroicons-archive-box-arrow-down" variant="ghost" color="neutral"
            @click="() => { confermaArchiviaAperta = true }"
          >
            Archivia
          </UButton>
          <UButton
            v-else
            icon="i-heroicons-arrow-uturn-left" variant="ghost" color="neutral"
            @click="() => { confermaRipristinaAperta = true }"
          >
            Ripristina
          </UButton>
        </div>

        <!-- ─── DIARIO ─── -->
        <div class="border-t border-slate-200 pt-4">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Diario ({{ contatto.interazioni.length }})
          </p>

          <div v-if="contatto.interazioni.length === 0" class="py-8 text-center">
            <UIcon name="i-heroicons-inbox" class="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p class="text-sm text-slate-400">Nessuna interazione ancora.</p>
          </div>

          <ul v-else class="space-y-3">
            <li
              v-for="riga in contatto.interazioni"
              :key="riga.id"
              class="flex gap-3 rounded-xl border border-slate-200 p-3"
            >
              <UIcon :name="iconaInterazione(riga.tipo)" class="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span class="font-medium text-slate-700">{{ formatQuando(riga.data) }}</span>
                  <span>·</span>
                  <span>{{ labelTipoInterazione(riga.tipo) }}</span>
                  <span>·</span>
                  <span>{{ riga.direzione === 'RICEVUTA' ? 'Ricevuta' : 'Effettuata' }}</span>
                  <span>·</span>
                  <span>{{ labelCanale(riga.canale) }}</span>
                  <UBadge v-if="riga.esito" :color="coloreEsito(riga.esito)" variant="soft" size="xs">
                    {{ labelEsito(riga.esito) }}
                  </UBadge>
                </div>
                <p v-if="riga.note" class="text-sm text-slate-700 whitespace-pre-line mt-1">{{ riga.note }}</p>
                <p v-if="riga.autoreNome" class="text-[11px] text-slate-400 mt-1">Annotata da {{ riga.autoreNome }}</p>
              </div>
              <UButton
                icon="i-heroicons-trash" size="xs" variant="ghost" color="error"
                title="Elimina questa riga del diario" aria-label="Elimina questa riga del diario"
                @click="() => { interazioneDaEliminare = riga }"
              />
            </li>
          </ul>
        </div>

      </div>

      <div v-else class="py-16 text-center text-slate-400 text-sm">Contatto non trovato.</div>
    </template>
  </USlideover>

  <!-- Annota chiamata/messaggio -->
  <ContattiModalInterazione
    v-if="contatto"
    v-model:open="modalInterazioneAperta"
    :contatto="contatto"
    @saved="dopoModifica"
  />

  <!-- Conversione in studente: il wizard si apre già compilato coi dati del contatto -->
  <WizardNuovoStudente
    v-if="wizardMontato"
    v-model:open="wizardAperto"
    :prefill="prefillStudente"
    @created="dopoStudenteCreato"
  />

  <!-- Modifica dati del contatto -->
  <ContattiModalContatto
    v-if="contatto"
    v-model:open="modalModificaAperta"
    :tipo="contatto.tipo"
    :contatto="contatto"
    @saved="dopoModifica"
  />

  <!-- Conferme (mai il confirm() del browser) -->
  <ConfirmDialog
    v-model:open="confermaArchiviaAperta"
    title="Archiviare il contatto?"
    description="Il contatto sparisce dalla lista ma non viene cancellato: puoi ritrovarlo con la spunta «Mostra archiviati» e ripristinarlo quando vuoi."
    confirm-label="Archivia"
    confirm-color="warning"
    :loading="operazioneInCorso"
    @confirm="archivia"
  />

  <ConfirmDialog
    v-model:open="confermaRipristinaAperta"
    title="Ripristinare il contatto?"
    description="Il contatto torna nella lista normale."
    confirm-label="Ripristina"
    :loading="operazioneInCorso"
    @confirm="ripristina"
  />

  <ConfirmDialog
    :open="interazioneDaEliminare !== null"
    title="Eliminare questa riga del diario?"
    description="L'annotazione viene cancellata definitivamente. Il campo «ultimo contatto» viene ricalcolato."
    confirm-label="Elimina"
    confirm-color="error"
    :loading="operazioneInCorso"
    @update:open="(v: boolean) => { if (!v) interazioneDaEliminare = null }"
    @confirm="eliminaInterazione"
  />
</template>

<script setup lang="ts">
// Pannello laterale con tutti i dati di una persona e lo storico dei contatti.
import { labelTipo, labelStato, labelCanale, labelRuoloMarketing, labelTipoInterazione, labelEsito } from '#shared/contatti'
import {
  STATI_ITEMS, nomeContatto, formatGiorno, formatQuando, iconaInterazione,
  ricontattoScaduto, linkTelefono, linkWhatsapp, linkEmail, linkSocial, coloreStato, coloreEsito,
} from '~/utils/contatti'
import type { ContattoDettaglio, Interazione } from '~/utils/contatti'

const props = defineProps<{ contactId: string | null }>()
const emit = defineEmits<{ changed: [] }>()
const aperto = defineModel<boolean>('open', { default: false })

const toast = useToast()

const contatto  = ref<ContattoDettaglio | null>(null)
const caricando = ref(false)

// La scheda si rilegge a ogni apertura: i dati sono sempre quelli del server
async function carica() {
  if (!props.contactId) return
  caricando.value = true
  try {
    const res = await $fetch<{ data: ContattoDettaglio }>(`/api/contacts/${props.contactId}`)
    contatto.value = res.data
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'Contatto non trovato', color: 'error' })
    contatto.value = null
  } finally {
    caricando.value = false
  }
}

watch(aperto, (v) => {
  if (v) {
    carica()
  } else {
    contatto.value = null
    wizardMontato.value = false
  }
})
watch(() => props.contactId, () => { if (aperto.value) carica() })

// Indirizzo da aprire per la chat/profilo social: se non si può ricavare
// (es. solo "@nomeutente" senza sapere quale social) il bottone non compare.
const indirizzoSocial = computed(() => {
  const c = contatto.value
  return c ? linkSocial(c.socialLink, c.canaleOrigine) ?? undefined : undefined
})

const inserito = computed(() => {
  const c = contatto.value
  if (!c) return null
  const quando = formatQuando(c.createdAt)
  return c.creatoDaNome ? `${quando} da ${c.creatoDaNome}` : quando
})

// ─── Cambio stato al volo ─────────────────────
const salvandoStato = ref(false)

async function cambiaStato(nuovo: unknown) {
  const c = contatto.value
  if (!c || typeof nuovo !== 'string' || nuovo === c.stato) return
  salvandoStato.value = true
  try {
    await $fetch(`/api/contacts/${c.id}`, { method: 'PUT', body: { stato: nuovo } })
    toast.add({ title: 'Stato aggiornato', color: 'success' })
    await carica()
    emit('changed')
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'Non è stato possibile aggiornare lo stato', color: 'error' })
  } finally {
    salvandoStato.value = false
  }
}

// ─── Da contatto a studente ───────────────────
// Il bottone compare solo nel cassetto Doposcuola, se il contatto è attivo e non
// è già stato collegato a uno studente.
const wizardAperto = ref(false)
// Il wizard si carica solo quando serve davvero (porta con sé la lista dei
// pacchetti standard): una volta caricato resta, così la finestra di riepilogo
// "Studente creato" non sparisce quando il contatto diventa Convertito.
const wizardMontato = ref(false)

function apriWizardStudente() {
  wizardMontato.value = true
  wizardAperto.value = true
}

const puoCreareStudente = computed(() => {
  const c = contatto.value
  return Boolean(c && c.tipo === 'DOPOSCUOLA' && !c.archiviatoAt && !c.anonimizzatoAt && !c.studentId)
})

// Traduce i dati del contatto nei campi del modulo "Nuovo studente".
const prefillStudente = computed(() => {
  const c = contatto.value
  if (!c) return null

  // "Luca Verdi" → nome "Luca", cognome "Verdi". Se c'è solo il nome di battesimo
  // si usa il cognome del referente (di solito il genitore).
  const pezziStudente = (c.nomeStudente ?? '').trim().split(/\s+/).filter(Boolean)
  const firstName = pezziStudente[0] ?? ''
  const lastName  = pezziStudente.length > 1
    ? pezziStudente.slice(1).join(' ')
    : (c.cognome ?? '')

  // "2ª media / Dante" → classe "2ª media", scuola "Dante"
  const grezzo = (c.classeScuola ?? '').trim()
  const taglio = grezzo.search(/[/-]/)
  const classe = taglio >= 0 ? grezzo.slice(0, taglio).trim() : grezzo
  const scuola = taglio >= 0 ? grezzo.slice(taglio + 1).trim() : ''

  const provenienza = ['Dal contatto CRM.', c.materie ? `Materie: ${c.materie}.` : null]
    .filter(Boolean).join(' ')
  const note = [provenienza, c.note].filter(Boolean).join('\n')

  return {
    firstName,
    lastName,
    classe,
    scuola,
    parentName:  [c.nome, c.cognome].filter(Boolean).join(' '),
    parentPhone: c.telefono ?? '',
    parentEmail: c.email ?? '',
    note,
  }
})

// Lo studente è stato creato: colleghiamolo al contatto e segniamolo "Convertito".
async function dopoStudenteCreato(studentId: string) {
  const c = contatto.value
  if (!c) return
  try {
    await $fetch(`/api/contacts/${c.id}`, {
      method: 'PUT',
      body: { studentId, stato: 'CONVERTITO' },
    })
    toast.add({ title: 'Studente creato e contatto segnato come Convertito', color: 'success' })
  } catch {
    toast.add({
      title: 'Lo studente è stato creato ma il contatto non è stato aggiornato',
      description: 'Segna a mano lo stato «Convertito» in questa scheda.',
      color: 'error',
    })
  }
  await dopoModifica()
}

// ─── Finestre collegate ───────────────────────
const modalInterazioneAperta = ref(false)
const modalModificaAperta    = ref(false)

async function dopoModifica() {
  await carica()
  emit('changed')
}

// ─── Archivia / ripristina / elimina riga ─────
const confermaArchiviaAperta   = ref(false)
const confermaRipristinaAperta = ref(false)
const interazioneDaEliminare   = ref<Interazione | null>(null)
const operazioneInCorso        = ref(false)

async function archivia() {
  const c = contatto.value
  if (!c) return
  operazioneInCorso.value = true
  try {
    await $fetch(`/api/contacts/${c.id}`, { method: 'DELETE' })
    toast.add({ title: 'Contatto archiviato', color: 'success' })
    confermaArchiviaAperta.value = false
    aperto.value = false
    emit('changed')
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'Non è stato possibile archiviare', color: 'error' })
  } finally {
    operazioneInCorso.value = false
  }
}

async function ripristina() {
  const c = contatto.value
  if (!c) return
  operazioneInCorso.value = true
  try {
    await $fetch(`/api/contacts/${c.id}/ripristina`, { method: 'POST' })
    toast.add({ title: 'Contatto ripristinato', color: 'success' })
    confermaRipristinaAperta.value = false
    await dopoModifica()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'Non è stato possibile ripristinare', color: 'error' })
  } finally {
    operazioneInCorso.value = false
  }
}

async function eliminaInterazione() {
  const c = contatto.value
  const riga = interazioneDaEliminare.value
  if (!c || !riga) return
  operazioneInCorso.value = true
  try {
    await $fetch(`/api/contacts/${c.id}/interactions/${riga.id}`, { method: 'DELETE' })
    toast.add({ title: 'Riga del diario eliminata', color: 'success' })
    interazioneDaEliminare.value = null
    await dopoModifica()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'Non è stato possibile eliminare la riga', color: 'error' })
  } finally {
    operazioneInCorso.value = false
  }
}
</script>
