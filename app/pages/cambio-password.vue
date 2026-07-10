<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4">
    <div class="w-full max-w-sm">

      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-tfn-500 mb-4">
          <UIcon name="i-heroicons-lock-closed" class="w-6 h-6 text-white" />
        </div>
        <h1 class="font-heading text-xl font-bold text-slate-900">Imposta la tua password</h1>
        <p class="text-sm text-slate-500 mt-1">
          Per motivi di sicurezza devi sostituire la password temporanea prima di continuare.
        </p>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <UFormField label="Password attuale (temporanea)" required>
          <UInput v-model="form.currentPassword" type="password" icon="i-heroicons-key" autocomplete="current-password" class="w-full" />
        </UFormField>
        <UFormField label="Nuova password (minimo 8 caratteri)" required>
          <UInput v-model="form.newPassword" type="password" icon="i-heroicons-lock-closed" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UFormField label="Ripeti nuova password" required>
          <UInput v-model="form.confirmPassword" type="password" icon="i-heroicons-lock-closed" autocomplete="new-password" class="w-full" />
        </UFormField>

        <UAlert
          v-if="errorMsg"
          color="error"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          :description="errorMsg"
        />

        <UButton block :loading="saving" @click="salva">Salva e continua</UButton>
      </div>

      <p class="text-center text-xs text-slate-400 mt-6">
        Problemi? Contatta la segreteria.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false, middleware: ['auth'] })
useHead({ title: 'Cambio password — Ti Formiamo Noi' })

const { user, fetch: refreshSession } = useUserSession()

const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const errorMsg = ref('')
const saving = ref(false)

async function salva() {
  errorMsg.value = ''
  if (form.newPassword.length < 8) {
    errorMsg.value = 'La nuova password deve essere di almeno 8 caratteri'
    return
  }
  if (form.newPassword !== form.confirmPassword) {
    errorMsg.value = 'Le password non coincidono'
    return
  }
  if (form.newPassword === form.currentPassword) {
    errorMsg.value = 'La nuova password deve essere diversa da quella attuale'
    return
  }
  saving.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
    })
    await refreshSession()
    const role = user.value?.role
    // I gate globali (es. accettazione termini per i genitori) intercettano se serve
    await navigateTo(role === 'GENITORE' ? '/portale' : (role === 'TUTOR' ? '/area-tutor' : '/'))
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage ?? 'Errore durante il cambio password'
  } finally {
    saving.value = false
  }
}
</script>
