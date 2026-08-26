<template>
  <UModal v-model:open="aperto" :title="inModifica ? 'Modifica contatto' : 'Nuovo contatto'" :ui="{ content: 'max-w-2xl' }">
    <template #body>
      <form class="space-y-4" @submit.prevent="salva">

        <!-- A quale cassetto appartiene (non si cambia in modifica) -->
        <p class="text-xs text-slate-500">
          Scheda: <span class="font-semibold text-slate-700">{{ labelTipo(tipoForm) }}</span>
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Nome" name="nome" required :error="erroreDi('nome')">
            <UInput v-model="form.nome" placeholder="Maria" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Cognome" name="cognome" :error="erroreDi('cognome')">
            <UInput v-model="form.cognome" placeholder="Rossi" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField
            label="Telefono" name="telefono"
            hint="Basta uno fra telefono, email e profilo social"
            :error="erroreDi('telefono')"
          >
            <UInput
              v-model="form.telefono"
              placeholder="333 123 4567"
              inputmode="tel"
              class="w-full"
              @blur="cercaDoppioni"
            />
          </UFormField>
          <UFormField label="Email" name="email" :error="erroreDi('email')">
            <UInput
              v-model="form.email"
              type="email"
              placeholder="maria@email.it"
              class="w-full"
              @blur="cercaDoppioni"
            />
          </UFormField>
        </div>

        <!-- Chi scrive da Instagram/Facebook spesso non lascia telefono né email -->
        <UFormField
          label="Profilo / chat social" name="socialLink"
          hint="Per chi scrive solo su Instagram/Facebook/TikTok"
          :error="erroreDi('socialLink')"
        >
          <UInput
            v-model="form.socialLink"
            placeholder="Link al profilo o @nomeutente"
            class="w-full"
            @blur="cercaDoppioni"
          />
        </UFormField>

        <!-- Avviso doppioni: informa, non blocca mai il salvataggio -->
        <UAlert
          v-if="avvisiDoppioni.length > 0"
          color="warning"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          title="Attenzione: potrebbe essere un doppione"
        >
          <template #description>
            <ul class="list-disc pl-4 space-y-0.5">
              <li v-for="(avviso, i) in avvisiDoppioni" :key="i">{{ avviso }}</li>
            </ul>
            <p class="mt-1 text-xs">Puoi salvare lo stesso: è solo un avviso.</p>
          </template>
        </UAlert>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField label="Fonte (come ci ha conosciuto)" name="canaleOrigine" :error="erroreDi('canaleOrigine')">
            <USelect v-model="form.canaleOrigine" :items="CANALI_ITEMS" class="w-full" />
          </UFormField>
          <UFormField label="Stato" name="stato" :error="erroreDi('stato')">
            <USelect v-model="form.stato" :items="STATI_ITEMS" class="w-full" />
          </UFormField>
          <UFormField
            label="Prossimo ricontatto" name="prossimoRicontatto"
            hint="Quando richiamarlo"
            :error="erroreDi('prossimoRicontatto')"
          >
            <UInput v-model="form.prossimoRicontatto" type="date" class="w-full" />
          </UFormField>
        </div>

        <!-- Campi della tab Doposcuola -->
        <template v-if="tipoForm === 'DOPOSCUOLA'">
          <!-- Nella stessa scheda arrivano famiglie interessate e candidati tutor -->
          <UFormField label="Chi è" name="doposcuolaRuolo" :error="erroreDi('doposcuolaRuolo')">
            <USelect v-model="form.doposcuolaRuolo" :items="RUOLI_DOPOSCUOLA_ITEMS" class="w-full sm:w-64" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UFormField v-if="!candidatoTutor" label="Nome studente" name="nomeStudente" :error="erroreDi('nomeStudente')">
              <UInput v-model="form.nomeStudente" placeholder="Luca" class="w-full" />
            </UFormField>
            <UFormField v-if="!candidatoTutor" label="Classe / Scuola" name="classeScuola" :error="erroreDi('classeScuola')">
              <UInput v-model="form.classeScuola" placeholder="2ª media" class="w-full" />
            </UFormField>
            <UFormField
              :label="candidatoTutor ? 'Materie che insegna' : 'Materie'"
              name="materie" :error="erroreDi('materie')"
            >
              <UInput
                v-model="form.materie"
                :placeholder="candidatoTutor ? 'Matematica, Fisica' : 'Matematica, Inglese'"
                class="w-full"
              />
            </UFormField>
          </div>
        </template>

        <!-- Campi della tab Marketing -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField label="Ruolo" name="marketingRuolo" :error="erroreDi('marketingRuolo')">
            <USelect
              v-model="form.marketingRuolo"
              :items="RUOLI_MARKETING_OPZIONALI_ITEMS"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Attività / Azienda" name="azienda" :error="erroreDi('azienda')">
            <UInput v-model="form.azienda" placeholder="Bar Centrale" class="w-full" />
          </UFormField>
          <UFormField label="Servizio d'interesse" name="servizioInteresse" :error="erroreDi('servizioInteresse')">
            <UInput v-model="form.servizioInteresse" placeholder="Gestione social" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Note" name="note" :error="erroreDi('note')">
          <UTextarea v-model="form.note" :rows="3" class="w-full" placeholder="Cosa ci ha chiesto, orari preferiti…" />
        </UFormField>

        <!-- Quando ci si è sentiti la prima volta: solo alla creazione.
             In modifica il diario si aggiorna dalla scheda, riga per riga. -->
        <div v-if="!inModifica" class="rounded-xl border border-slate-200 p-3 space-y-3">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Primo contatto (facoltativo)</p>
          <p class="text-xs text-slate-500">
            Quando vi siete sentiti la prima volta: finisce nel diario e riempie «Ultimo contatto».
            Puoi anche farlo dopo dalla scheda con «Annota chiamata/messaggio».
          </p>

          <UFormField label="Quando" name="primaData" :error="errorePrimoContatto">
            <div class="flex items-center gap-2">
              <UInput v-model="primo.quando" type="datetime-local" class="w-full" />
              <UButton
                size="xs" variant="soft" color="neutral" class="shrink-0"
                @click="() => { primo.quando = adessoPerInput() }"
              >
                Adesso
              </UButton>
            </div>
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UFormField label="Chi ha contattato chi" name="primaDirezione">
              <USelect v-model="primo.direzione" :items="DIREZIONI_ITEMS" class="w-full" />
            </UFormField>
            <UFormField label="Come" name="primaTipo">
              <USelect v-model="primo.tipo" :items="TIPI_INTERAZIONE_ITEMS" class="w-full" />
            </UFormField>
            <UFormField label="Canale" name="primaCanale">
              <USelect
                v-model="primo.canale"
                :items="CANALI_ITEMS"
                class="w-full"
                @update:model-value="() => { canaleScelto = true }"
              />
            </UFormField>
          </div>

          <UFormField label="Cosa vi siete detti" name="primaNote">
            <UTextarea v-model="primo.note" :rows="2" class="w-full" placeholder="Ci ha scritto per chiedere informazioni…" />
          </UFormField>
        </div>

        <p v-else class="text-xs text-slate-500">
          Per registrare chiamate e messaggi (anche con date passate) usa «Annota chiamata/messaggio» nella scheda.
        </p>

        <UCheckbox v-model="form.privacyInformata" label="Informativa privacy comunicata" />

        <p v-if="erroreGenerale" class="text-sm text-red-600">{{ erroreGenerale }}</p>
      </form>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <UButton variant="ghost" :disabled="salvando" @click="() => { aperto = false }">Annulla</UButton>
        <UButton :loading="salvando" @click="salva">
          {{ inModifica ? 'Salva modifiche' : 'Crea contatto' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Finestra "Nuovo contatto" e "Modifica contatto": stessi campi, due usi.
// I campi cambiano a seconda della tab (Doposcuola o Marketing).
import { labelTipo, labelStato } from '#shared/contatti'
import type { TipoContatto } from '#shared/contatti'
import {
  CANALI_ITEMS, STATI_ITEMS, RUOLI_MARKETING_OPZIONALI_ITEMS, RUOLI_DOPOSCUOLA_ITEMS,
  NON_SPECIFICATO, nomeContatto,
  TIPI_INTERAZIONE_ITEMS, DIREZIONI_ITEMS, adessoPerInput, inputInIso,
} from '~/utils/contatti'
import type { Contatto } from '~/utils/contatti'

const props = defineProps<{
  /** Tab attiva: pre-seleziona il tipo quando si crea un contatto nuovo */
  tipo: TipoContatto
  /** Se presente siamo in modifica, altrimenti in creazione */
  contatto?: Contatto | null
}>()

const emit = defineEmits<{ saved: [Contatto] }>()
const aperto = defineModel<boolean>('open', { default: false })

const toast = useToast()

const inModifica = computed(() => Boolean(props.contatto?.id))
const tipoForm = computed<TipoContatto>(() => props.contatto?.tipo ?? props.tipo)

// ─── Il modulo da compilare ───────────────────
function formVuoto() {
  return {
    nome:               '',
    cognome:            '',
    telefono:           '',
    email:              '',
    socialLink:         '',
    canaleOrigine:      'ALTRO',
    stato:              'NUOVO',
    prossimoRicontatto: '',
    doposcuolaRuolo:    'STUDENTE',
    nomeStudente:       '',
    classeScuola:       '',
    materie:            '',
    azienda:            '',
    servizioInteresse:  '',
    marketingRuolo:     NON_SPECIFICATO,
    note:               '',
    privacyInformata:   false,
  }
}

const form = reactive(formVuoto())

// Con "Possibile tutor" i campi dello studente non servono e le materie cambiano senso
const candidatoTutor = computed(() => tipoForm.value === 'DOPOSCUOLA' && form.doposcuolaRuolo === 'TUTOR')

// ─── Riquadro "Primo contatto" (solo in creazione) ───
// "Quando" vuoto = non si annota niente: il contatto nasce senza diario.
function primoVuoto() {
  return {
    quando:    '',
    direzione: 'RICEVUTA',
    tipo:      'MESSAGGIO',
    canale:    'ALTRO',
    note:      '',
  }
}

const primo = reactive(primoVuoto())
// Finché il canale non viene scelto a mano, segue la Fonte del contatto
const canaleScelto = ref(false)

watch(() => form.canaleOrigine, (nuovo) => {
  if (!canaleScelto.value) primo.canale = nuovo
})

// Ogni apertura riparte pulita: in modifica coi dati del contatto, altrimenti vuota
watch(aperto, (adessoAperto) => {
  if (!adessoAperto) return
  Object.assign(form, formVuoto())
  Object.assign(primo, primoVuoto())
  canaleScelto.value = false
  errorePrimoContatto.value = ''
  erroriServer.value = {}
  erroreGenerale.value = ''
  avvisiDoppioni.value = []

  const c = props.contatto
  if (c) {
    Object.assign(form, {
      nome:               c.nome ?? '',
      cognome:            c.cognome ?? '',
      telefono:           c.telefono ?? '',
      email:              c.email ?? '',
      socialLink:         c.socialLink ?? '',
      canaleOrigine:      c.canaleOrigine ?? 'ALTRO',
      stato:              c.stato ?? 'NUOVO',
      prossimoRicontatto: c.prossimoRicontatto ?? '',
      doposcuolaRuolo:    c.doposcuolaRuolo ?? 'STUDENTE',
      nomeStudente:       c.nomeStudente ?? '',
      classeScuola:       c.classeScuola ?? '',
      materie:            c.materie ?? '',
      azienda:            c.azienda ?? '',
      servizioInteresse:  c.servizioInteresse ?? '',
      marketingRuolo:     c.marketingRuolo ?? NON_SPECIFICATO,
      note:               c.note ?? '',
      privacyInformata:   c.privacyInformata ?? false,
    })
  }
})

// ─── Errori ───────────────────────────────────
const erroriServer   = ref<Record<string, string>>({})
const erroreGenerale = ref('')
// Errore del campo "Quando" del riquadro Primo contatto
const errorePrimoContatto = ref('')

const erroreDi = (campo: string) => erroriServer.value[campo]

// ─── Avviso doppioni (non blocca) ─────────────
const avvisiDoppioni = ref<string[]>([])
let timerDoppioni: ReturnType<typeof setTimeout> | null = null

type RispostaDoppioni = {
  contatti: Array<{ id: string; nome: string; cognome: string | null; tipo: string; stato: string }>
  studenti: Array<{ id: string; nome: string; classe: string | null }>
}

async function cercaDoppioni() {
  const telefono = form.telefono.trim()
  const email    = form.email.trim()
  const social   = form.socialLink.trim()
  if (!telefono && !email && !social) { avvisiDoppioni.value = []; return }

  try {
    const res = await $fetch<RispostaDoppioni>('/api/contacts/duplicati', {
      query: { telefono: telefono || undefined, email: email || undefined, social: social || undefined },
    })
    const messaggi: string[] = []

    for (const c of res.contatti) {
      // In modifica il contatto stesso non è un doppione di se stesso
      if (props.contatto?.id === c.id) continue
      messaggi.push(`Esiste già: ${nomeContatto(c)} — ${labelTipo(c.tipo)}, ${labelStato(c.stato)}`)
    }
    for (const s of res.studenti) {
      messaggi.push(`È già cliente: studente ${s.nome}${s.classe ? ` (${s.classe})` : ''}`)
    }
    avvisiDoppioni.value = messaggi
  } catch {
    // Il controllo doppioni è un di più: se non risponde, si va avanti in silenzio
    avvisiDoppioni.value = []
  }
}

// Mentre si digita, si aspettano 400 ms dall'ultimo tasto (niente chiamata a ogni lettera)
watch([() => form.telefono, () => form.email, () => form.socialLink], () => {
  if (timerDoppioni) clearTimeout(timerDoppioni)
  timerDoppioni = setTimeout(cercaDoppioni, 400)
})

onBeforeUnmount(() => { if (timerDoppioni) clearTimeout(timerDoppioni) })

// ─── Salvataggio ──────────────────────────────
const salvando = ref(false)

// '' → null: per gli sportelli "vuoto" e "cancella" sono la stessa cosa
const vuotoNull = (v: string) => (v.trim() === '' ? null : v.trim())

function corpoDaInviare() {
  const comuni = {
    nome:               form.nome.trim(),
    cognome:            vuotoNull(form.cognome),
    telefono:           vuotoNull(form.telefono),
    email:              vuotoNull(form.email),
    socialLink:         vuotoNull(form.socialLink),
    canaleOrigine:      form.canaleOrigine,
    stato:              form.stato,
    prossimoRicontatto: vuotoNull(form.prossimoRicontatto),
    note:               vuotoNull(form.note),
    privacyInformata:   form.privacyInformata,
  }

  // Si inviano solo i campi della tab giusta: quelli dell'altra restano com'erano
  const specifici = tipoForm.value === 'DOPOSCUOLA'
    ? {
        doposcuolaRuolo: form.doposcuolaRuolo,
        // Un candidato tutor non ha uno studente né una classe: si svuotano
        nomeStudente: candidatoTutor.value ? null : vuotoNull(form.nomeStudente),
        classeScuola: candidatoTutor.value ? null : vuotoNull(form.classeScuola),
        materie:      vuotoNull(form.materie),
      }
    : {
        azienda:           vuotoNull(form.azienda),
        servizioInteresse: vuotoNull(form.servizioInteresse),
        marketingRuolo:    form.marketingRuolo === NON_SPECIFICATO ? null : form.marketingRuolo,
      }

  const base = { tipo: tipoForm.value, ...comuni, ...specifici }

  // Il primo contatto si annota solo alla creazione e solo se c'è la data
  const quando = inModifica.value ? null : inputInIso(primo.quando.trim())
  if (!quando) return base

  return {
    ...base,
    primaInterazione: {
      data:      quando,
      tipo:      primo.tipo,
      direzione: primo.direzione,
      canale:    primo.canale,
      note:      vuotoNull(primo.note),
    },
  }
}

async function salva() {
  erroriServer.value = {}
  erroreGenerale.value = ''
  errorePrimoContatto.value = ''

  // Nota scritta senza data: senza il "quando" non si può annotare niente
  if (!inModifica.value) {
    const quando = primo.quando.trim()
    if (!quando && primo.note.trim()) {
      errorePrimoContatto.value = 'Indica quando vi siete sentiti'
      return
    }
    if (quando && !inputInIso(quando)) {
      errorePrimoContatto.value = 'Data non valida'
      return
    }
  }

  if (!form.nome.trim()) {
    erroriServer.value = { nome: 'Il nome è obbligatorio' }
    return
  }
  if (!form.telefono.trim() && !form.email.trim() && !form.socialLink.trim()) {
    erroreGenerale.value = 'Inserisci almeno un recapito: telefono, email o profilo social. Serve per ricontattare la persona.'
    erroriServer.value = { telefono: 'Manca un recapito' }
    return
  }

  salvando.value = true
  try {
    const risposta = props.contatto
      ? await $fetch<{ data: Contatto }>(`/api/contacts/${props.contatto.id}`, { method: 'PUT', body: corpoDaInviare() })
      : await $fetch<{ data: Contatto }>('/api/contacts', { method: 'POST', body: corpoDaInviare() })

    toast.add({ title: props.contatto ? 'Contatto aggiornato' : 'Contatto creato', color: 'success' })
    aperto.value = false
    emit('saved', risposta.data)
  } catch (err: any) {
    const messaggio = err?.data?.statusMessage ?? 'Non è stato possibile salvare il contatto'
    const campi = err?.data?.data?.errors as Record<string, string[]> | undefined

    if (campi) {
      const mappa: Record<string, string> = {}
      for (const [chiave, valori] of Object.entries(campi)) {
        if (valori?.[0]) mappa[chiave] = valori[0]
      }
      erroriServer.value = mappa
    }
    erroreGenerale.value = Object.values(erroriServer.value)[0] ?? messaggio
    toast.add({ title: messaggio, description: erroreGenerale.value, color: 'error' })
  } finally {
    salvando.value = false
  }
}
</script>
