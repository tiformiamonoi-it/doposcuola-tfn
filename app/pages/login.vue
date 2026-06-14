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
      </div>

      <p class="text-center text-xs text-slate-400 mt-6">
        Problemi di accesso? Contatta l'amministratore.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ layout: false })
useHead({ title: 'Accedi — Ti Formiamo Noi' })

// Redirect se già loggato
const { loggedIn, user } = useUserSession()
if (loggedIn.value) {
  await navigateTo(user.value?.role === 'GENITORE' ? '/portale' : (user.value?.role === 'TUTOR' ? '/area-tutor' : '/'))
}

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
