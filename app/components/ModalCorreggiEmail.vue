<template>
  <UModal v-model:open="isOpen" title="Correggi l'email di accesso">
    <template #body>
      <UForm v-if="account" ref="form" :schema="schema" :state="stato" class="space-y-4" @submit="invia">
        <p class="text-sm text-slate-600">
          È l'email con cui <strong>{{ account.nome }}</strong>
          <template v-if="account.tipo === 'GENITORE'">entra nel portale famiglie</template>
          <template v-else>entra per prenotare le lezioni</template>,
          e l'indirizzo a cui arriva il link per scegliere la password.
          <template v-if="account.tipo === 'GENITORE'">Dove la scheda riporta la vecchia email, si corregge anche lì.</template>
          <template v-else>Si corregge anche l'«Email Studente» della scheda.</template>
        </p>

        <!-- Testo e non una casella: così il tasto Invio nella nuova email salva
             subito (con due caselle di testo nel modulo il browser non lo fa). -->
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div class="text-xs text-slate-500">Email attuale</div>
          <div class="text-sm font-medium text-slate-800 break-all">{{ account.email }}</div>
        </div>

        <UFormField name="email" label="Nuova email" required>
          <UInput v-model="stato.email" type="email" autocomplete="off" placeholder="nome@esempio.it" class="w-full" />
        </UFormField>

        <!-- Un genitore con più figli entra con UNA sola email per tutti: chi
             corregge deve saperlo prima, non scoprirlo dopo. -->
        <UAlert
          v-if="account.tipo === 'GENITORE' && (account.numeroFigli ?? 1) > 1"
          color="info"
          variant="subtle"
          icon="i-heroicons-users"
          :description="`${account.nome} entra nel portale con questa email per tutti i suoi ${account.numeroFigli} figli: la correzione vale per tutti, e si aggiorna anche sulle loro schede.`"
        />

        <UCheckbox
          v-model="stato.inviaLink"
          label="Manda un link nuovo alla nuova email"
          description="Toglila solo se ha già scelto la sua password: entrerà con la nuova email e la password di sempre."
        />

        <p class="text-xs text-slate-500 flex items-start gap-1.5">
          <UIcon name="i-heroicons-shield-check" class="w-4 h-4 mt-0.5 shrink-0" />
          <span>Il link per la password già mandato al vecchio indirizzo smette di funzionare.</span>
        </p>
      </UForm>
    </template>
    <template #footer>
      <div class="flex flex-wrap justify-end gap-3 w-full">
        <UButton variant="ghost" :disabled="salvando" @click="chiudi">Annulla</UButton>
        <UButton icon="i-heroicons-check" :loading="salvando" @click="conferma">Salva</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// LA FINESTRA "CORREGGI L'EMAIL DI ACCESSO" (alunno o genitore).
// Raccoglie solo la nuova email e la spunta del link: la chiamata al server la fa
// la pagina, che è la stessa strada usata dalla finestra "Prima di salvare" della
// Modifica. Così le due strade non possono comportarsi in modo diverso.
import { z } from 'zod'

const props = defineProps<{
  /** L'account da correggere. `nome` è quello da leggere nelle frasi ("Maria Bianchi"). */
  account: {
    tipo: 'STUDENTE' | 'GENITORE'
    nome: string
    email: string
    /** Solo genitori: quanti alunni vede nel portale, questo compreso */
    numeroFigli?: number
  } | null
  salvando?: boolean
}>()

const emit = defineEmits<{ salva: [dati: { email: string; inviaLink: boolean }] }>()
const isOpen = defineModel<boolean>('open', { default: false })

const form = ref()
const stato = reactive({ email: '', inviaLink: true })

// Ogni apertura riparte pulita: campo vuoto e spunta del link ATTIVA. Il caso
// normale è "ho sbagliato una lettera, il ragazzo non ha mai potuto entrare":
// senza un link nuovo resterebbe fuori.
watch(isOpen, (aperta) => {
  if (!aperta) return
  stato.email = ''
  stato.inviaLink = true
})

// Stessi controlli del server, detti prima: email scritta bene e diversa da
// quella che c'è già (confrontata come la salverebbe il server, in minuscolo).
const schema = computed(() => z.object({
  email: z.string()
    .trim()
    .min(1, 'Scrivi la nuova email')
    .email('Indirizzo email non valido')
    .refine((v) => v.toLowerCase() !== props.account?.email, 'È già questa l\'email di accesso'),
  inviaLink: z.boolean(),
}))

function conferma() {
  form.value?.submit()
}

function chiudi() {
  isOpen.value = false
}

function invia() {
  emit('salva', { email: stato.email.trim().toLowerCase(), inviaLink: stato.inviaLink })
}
</script>
