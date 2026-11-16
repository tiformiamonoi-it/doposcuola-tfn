<template>
  <!-- ACCESSO (schermata 14). La stessa pagina serve a famiglie, alunni e staff: i testi
       restano validi per tutti ("Accedi al tuo account", niente "portale delle famiglie"). -->
  <div class="pf min-h-screen bg-pf-fondo text-pf-testo flex flex-col">
    <header class="pf-testata-sfondo text-white rounded-b-[40px] min-h-[300px] px-5 pb-[84px] flex flex-col items-center justify-end">
      <h1 class="sr-only">Accedi a tiformiamonoi.it</h1>
      <PortaleMarchio grande />
      <p class="mt-3.5 text-[15px] text-pf-su-blu">Accedi al tuo account</p>
    </header>

    <div class="w-full max-w-[420px] mx-auto px-5 -mt-[60px] flex-1 flex flex-col">
      <div class="bg-white rounded-[26px] px-[18px] py-[22px] pf-ombra-alta">
        <UForm :schema="schema" :state="state" class="flex flex-col gap-4" @submit="onSubmit">
          <UFormField name="email" label="Email" required>
            <UInput
              v-model="state.email"
              type="email"
              placeholder="nome@esempio.it"
              autocomplete="email"
              size="xl"
              class="w-full"
            />
          </UFormField>

          <UFormField name="password" label="Password" required>
            <UInput
              v-model="state.password"
              type="password"
              placeholder="La tua password"
              autocomplete="current-password"
              size="xl"
              class="w-full"
            />
          </UFormField>

          <button type="button" class="self-end min-h-11 text-sm font-semibold text-pf-blu hover:text-pf-blu-scuro" @click="recuperoAperto = true">
            Password dimenticata?
          </button>

          <div class="flex items-start gap-3">
            <USwitch v-model="state.ricordami" size="xl" aria-label="Ricordami su questo dispositivo" />
            <div class="text-sm">
              <p class="font-medium">Ricordami su questo dispositivo</p>
              <p class="text-xs text-pf-grigio">Resti collegato per 30 giorni. Spegnilo se il dispositivo è condiviso con altri.</p>
            </div>
          </div>

          <p v-if="errorMsg" role="alert" class="text-sm text-pf-rosso bg-pf-rosso-chiaro rounded-xl px-3 py-2">{{ errorMsg }}</p>

          <PortaleBottone type="submit" grande blocco :loading="loading">Accedi</PortaleBottone>
        </UForm>
      </div>

      <p class="mt-8 mx-2 text-[13px] leading-[19px] text-pf-grigio text-center">
        Primo accesso? Apri il link che ti abbiamo mandato per email: ti farà scegliere la password.
      </p>

      <p class="mt-auto pt-8 pb-6 text-center text-xs text-pf-grigio">
        <NuxtLink to="/privacy" class="inline-block py-2 px-1 hover:underline">Privacy</NuxtLink> ·
        <NuxtLink to="/termini" class="inline-block py-2 px-1 hover:underline">Termini</NuxtLink> ·
        <NuxtLink to="/cookie" class="inline-block py-2 px-1 hover:underline">Cookie</NuxtLink>
      </p>
    </div>

    <!-- Recupero password -->
    <UModal v-model:open="recuperoAperto" title="Recupera password">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-slate-600">
            Inserisci l'email del tuo account: se è registrata ti invieremo un link per scegliere una nuova password.
          </p>
          <UFormField label="Email">
            <UInput v-model="recuperoEmail" type="email" placeholder="nome@esempio.it" icon="i-heroicons-envelope" class="w-full" />
          </UFormField>
          <UAlert
            v-if="recuperoMessaggio"
            color="success"
            variant="subtle"
            icon="i-heroicons-check-circle"
            :description="recuperoMessaggio"
          />
          <UAlert
            v-if="recuperoErrore"
            color="error"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            :description="recuperoErrore"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="() => { recuperoAperto = false }">Chiudi</UButton>
          <UButton :loading="recuperoLoading" :disabled="!recuperoEmail" @click="inviaRecupero">Invia</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ layout: false })
useHead({ title: 'Accedi — tiformiamonoi.it' })

// Redirect se già loggato (solo client-side per evitare SSR loop)
const { loggedIn, user } = useUserSession()
function homePerRuolo() {
  const role = user.value?.role ?? ''
  if (['GENITORE', 'STUDENTE'].includes(role)) return '/portale'
  return role === 'TUTOR' ? '/area-tutor' : '/'
}
onMounted(async () => {
  if (loggedIn.value) {
    await navigateTo(homePerRuolo(), { replace: true })
  }
})
watch(loggedIn, async (isLoggedIn) => {
  if (isLoggedIn) {
    await navigateTo(homePerRuolo(), { replace: true })
  }
})

const schema = z.object({
  email:    z.string().email('Email non valida'),
  password: z.string().min(1, 'Inserisci la password'),
  ricordami: z.boolean(),
})

type Schema = z.output<typeof schema>

// `ricordami` acceso di default: la webapp installata sul telefono non deve
// chiedere le credenziali a ogni riapertura. Viene inviato con il resto di state.
const state = reactive<Partial<Schema>>({
  email:    '',
  password: '',
  ricordami: true,
})

const loading  = ref(false)
const errorMsg = ref('')

// ─── Recupero password ───
// `/login?recupero=1` apre subito il modale: ci arriva chi ha trovato scaduto
// il link "scegli la tua password" e deve chiedersene uno nuovo.
const recuperoAperto = ref(useRoute().query.recupero === '1')
const recuperoEmail = ref('')
const recuperoLoading = ref(false)
const recuperoMessaggio = ref('')
const recuperoErrore = ref('')

async function inviaRecupero() {
  recuperoLoading.value = true
  recuperoMessaggio.value = ''
  recuperoErrore.value = ''
  try {
    const res = await $fetch<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: recuperoEmail.value },
    })
    recuperoMessaggio.value = res.message
  } catch (e: any) {
    recuperoErrore.value = e?.data?.statusMessage ?? 'Errore, riprova più tardi'
  } finally {
    recuperoLoading.value = false
  }
}

async function onSubmit() {
  loading.value  = true
  errorMsg.value = ''
  try {
    const res = await $fetch<{ ok: boolean; redirectTo: string }>('/api/auth/login', {
      method: 'POST',
      body:   state,
    })
    
    const { fetch: refreshSession } = useUserSession()
    await refreshSession()
    
    await navigateTo(res.redirectTo)
  }
  catch (err: unknown) {
    const e = err as { data?: { message?: string } }
    errorMsg.value = e.data?.message ?? 'Errore di accesso. Riprova.'
  }
  finally {
    loading.value = false
  }
}
</script>
