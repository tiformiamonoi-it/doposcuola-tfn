<template>
  <div class="max-w-2xl mx-auto space-y-4">
    <div class="text-center">
      <h2 class="font-heading text-xl font-bold text-slate-900">Termini e privacy</h2>
      <p class="text-sm text-slate-500 mt-1">
        Prima di usare il portale ti chiediamo di leggere e accettare i documenti qui sotto.
      </p>
    </div>

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

    <UCard>
      <div class="space-y-3">
        <UCheckbox v-model="accettoTermini" label="Ho letto e accetto i Termini e condizioni" />
        <UCheckbox v-model="accettoPrivacy" label="Ho letto l'Informativa privacy" />
        <UAlert
          v-if="errorMsg"
          color="error"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          :description="errorMsg"
        />
      </div>
      <template #footer>
        <UButton block :disabled="!accettoTermini || !accettoPrivacy" :loading="saving" @click="accetta">
          Accetta e continua
        </UButton>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { TERMINI_TESTO, PRIVACY_TESTO, TERMS_VERSION } from '#shared/legal'

definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Termini e privacy — Portale Famiglie' })

const { fetch: refreshSession } = useUserSession()

const accettoTermini = ref(false)
const accettoPrivacy = ref(false)
const errorMsg = ref('')
const saving = ref(false)

async function accetta() {
  errorMsg.value = ''
  saving.value = true
  try {
    await $fetch('/api/auth/accept-terms', {
      method: 'POST',
      body: { version: TERMS_VERSION },
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
