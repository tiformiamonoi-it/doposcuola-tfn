<template>
  <div class="max-w-2xl mx-auto space-y-4">
    <div class="text-center">
      <h2 class="font-heading text-xl font-bold text-slate-900">{{ titolo }}</h2>
      <p class="text-sm text-slate-500 mt-1">{{ sottotitolo }}</p>
    </div>

    <!-- Variante STUDENTE: solo informativa privacy in linguaggio semplice -->
    <template v-if="isStudente">
      <UCard>
        <template #header>
          <span class="font-medium text-slate-800">Informativa privacy per studenti</span>
        </template>
        <div class="max-h-96 overflow-y-auto pr-2">
          <p class="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{{ PRIVACY_STUDENTE_TESTO }}</p>
        </div>
      </UCard>

      <UCard>
        <div class="space-y-3">
          <UCheckbox v-model="accettoPrivacy" label="Ho letto e capito l'informativa privacy" />
          <UAlert
            v-if="errorMsg"
            color="error"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            :description="errorMsg"
          />
        </div>
        <template #footer>
          <UButton block :disabled="!accettoPrivacy" :loading="saving" @click="accetta">
            Accetto e continuo
          </UButton>
        </template>
      </UCard>
    </template>

    <!-- Variante GENITORE: termini + privacy e/o le autorizzazioni per i figli minori di 14 anni -->
    <template v-else>
      <template v-if="serveTermini">
        <UCard>
          <template #header>
            <span class="font-medium text-slate-800">Termini e condizioni</span>
          </template>
          <div class="max-h-56 overflow-y-auto pr-2">
            <p class="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{{ TERMINI_TESTO }}</p>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <span class="font-medium text-slate-800">Informativa privacy</span>
          </template>
          <div class="max-h-56 overflow-y-auto pr-2">
            <p class="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{{ PRIVACY_TESTO }}</p>
          </div>
        </UCard>
      </template>

      <!-- Una dichiarazione per ciascun figlio sotto i 14 anni: il testo dice su
           CHI la si sta facendo, quindi non può essere una sola per tutti. -->
      <UCard v-for="figlio in dichiarazioni" :key="figlio.id">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-shield-check" class="w-5 h-5 text-tfn-500" />
            <span class="font-medium text-slate-800">Autorizzazione per {{ figlio.nome }}</span>
          </div>
        </template>
        <div class="max-h-56 overflow-y-auto pr-2">
          <p class="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{{ testoConsensoMinore14(figlio.nome) }}</p>
        </div>
        <template #footer>
          <p class="text-xs text-slate-500">
            Te la chiediamo perché {{ figlio.nome.split(' ')[0] }} non ha ancora 14 anni: fino a
            quell'età, per i servizi online decide chi esercita la responsabilità genitoriale.
          </p>
        </template>
      </UCard>

      <UCard>
        <div class="space-y-3">
          <template v-if="serveTermini">
            <UCheckbox v-model="accettoTermini" label="Ho letto e accetto i Termini e condizioni" />
            <UCheckbox v-model="accettoPrivacy" label="Ho letto l'Informativa privacy" />
          </template>
          <UCheckbox
            v-for="figlio in dichiarazioni"
            :key="figlio.id"
            v-model="firmate[figlio.id]"
            :label="`Autorizzo il trattamento dei dati di ${figlio.nome} come dichiarato qui sopra`"
          />
          <UAlert
            v-if="errorMsg"
            color="error"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            :description="errorMsg"
          />
        </div>
        <template #footer>
          <UButton block :disabled="!tuttoSpuntato" :loading="saving" @click="accetta">
            Accetta e continua
          </UButton>
        </template>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  TERMINI_TESTO, PRIVACY_TESTO, PRIVACY_STUDENTE_TESTO,
  TERMS_VERSION, PRIVACY_STUDENTE_VERSION, testoConsensoMinore14,
} from '#shared/legal'

definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Termini e privacy — Portale Famiglie' })

const { user, fetch: refreshSession } = useUserSession()
const isStudente = computed(() => user.value?.role === 'STUDENTE')

// Le due cose che possono mancare, separate: un genitore che ha già accettato i
// documenti mesi fa e oggi iscrive un figlio di 11 anni vede SOLO la dichiarazione.
const serveTermini   = computed(() => user.value?.termsAccepted === false)
const dichiarazioni  = computed(() => (isStudente.value ? [] : user.value?.dichiarazioniMinori ?? []))

const titolo = computed(() => {
  if (isStudente.value) return 'La tua privacy'
  if (!serveTermini.value) return 'Un\'ultima autorizzazione'
  return 'Termini e privacy'
})

const sottotitolo = computed(() => {
  if (isStudente.value) return 'Prima di usare il portale leggi come usiamo i tuoi dati.'
  if (!serveTermini.value) return 'Serve la tua autorizzazione per i figli che non hanno ancora 14 anni.'
  return 'Prima di usare il portale ti chiediamo di leggere e accettare i documenti qui sotto.'
})

const accettoTermini = ref(false)
const accettoPrivacy = ref(false)
// Una spunta per ciascun figlio da autorizzare, per id
const firmate = reactive<Record<string, boolean>>({})
const errorMsg = ref('')
const saving = ref(false)

const tuttoSpuntato = computed(() => {
  if (serveTermini.value && !(accettoTermini.value && accettoPrivacy.value)) return false
  return dichiarazioni.value.every((f) => firmate[f.id] === true)
})

async function accetta() {
  errorMsg.value = ''
  saving.value = true
  try {
    await $fetch('/api/auth/accept-terms', {
      method: 'POST',
      body: {
        // La versione si manda solo se i documenti vanno davvero accettati adesso:
        // rimandarla a vuoto riscriverebbe la data di accettazione di chi l'ha già data.
        version: isStudente.value
          ? PRIVACY_STUDENTE_VERSION
          : (serveTermini.value ? TERMS_VERSION : undefined),
        dichiarazioni: dichiarazioni.value.map((f) => f.id),
      },
    })
    await refreshSession()
    await navigateTo('/portale')
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage ?? 'Errore durante il salvataggio, riprova'
  } finally {
    saving.value = false
  }
}
</script>
