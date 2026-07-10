<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4">
    <div class="w-full max-w-sm">

      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-tfn-500 mb-4">
          <UIcon name="i-heroicons-book-open" class="w-6 h-6 text-white" />
        </div>
        <h1 class="font-heading text-xl font-bold text-slate-900">Ti Formiamo Noi</h1>
        <p class="text-sm text-slate-500 mt-1">Accedi al tuo account</p>
      </div>

      <!-- Card form -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <UForm :schema="schema" :state="state" @submit="onSubmit" class="space-y-4">

          <UFormField name="email" label="Email" required>
            <UInput
              v-model="state.email"
              type="email"
              placeholder="nome@esempio.com"
              icon="i-heroicons-envelope"
              autocomplete="email"
              class="w-full"
            />
          </UFormField>

          <UFormField name="password" label="Password" required>
            <UInput
              v-model="state.password"
              type="password"
              placeholder="••••••••"
              icon="i-heroicons-lock-closed"
              autocomplete="current-password"
              class="w-full"
            />
          </UFormField>

          <UAlert
            v-if="errorMsg"
            color="error"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            :description="errorMsg"
          />

          <UButton type="submit" block :loading="loading" class="mt-2">
            Accedi
          </UButton>

        </UForm>

        <button type="button" class="block w-full text-center text-xs text-tfn-600 hover:text-tfn-700 hover:underline mt-4" @click="recuperoAperto = true">
          Password dimenticata?
        </button>
      </div>

      <p class="text-center text-xs text-slate-400 mt-6">
        Problemi di accesso? Contatta l'amministratore.
      </p>
    </div>

    <!-- Recupero password -->
    <UModal v-model:open="recuperoAperto" title="Recupera password">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-slate-600">
            Inserisci l'email del tuo account: se è registrata ti invieremo una password temporanea.
          </p>
          <UFormField label="Email">
            <UInput v-model="recuperoEmail" type="email" placeholder="nome@esempio.com" icon="i-heroicons-envelope" class="w-full" />
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
          <UButton variant="ghost" @click="recuperoAperto = false">Chiudi</UButton>
          <UButton :loading="recuperoLoading" :disabled="!recuperoEmail" @click="inviaRecupero">Invia</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ layout: false })
useHead({ title: 'Accedi — Ti Formiamo Noi' })

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
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  email:    '',
  password: '',
})

const loading  = ref(false)
const errorMsg = ref('')

// ─── Recupero password ───
const recuperoAperto = ref(false)
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
