<template>
  <div class="max-w-lg space-y-6">
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-user-circle" class="w-4 h-4 text-tfn-500" />
          <span class="font-medium text-slate-800">Dati account</span>
        </div>
      </template>
      <dl class="space-y-2 text-sm">
        <div class="flex justify-between py-1 border-b border-slate-100">
          <span class="text-slate-500">Nome</span>
          <span class="font-medium text-slate-800">{{ user?.firstName }} {{ user?.lastName }}</span>
        </div>
        <div class="flex justify-between py-1">
          <span class="text-slate-500">Email</span>
          <span class="font-medium text-slate-800">{{ user?.email }}</span>
        </div>
      </dl>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-lock-closed" class="w-4 h-4 text-tfn-500" />
          <span class="font-medium text-slate-800">Cambia password</span>
        </div>
      </template>
      <div class="space-y-3">
        <UFormField label="Password attuale">
          <UInput v-model="pwForm.currentPassword" type="password" autocomplete="current-password" class="w-full" />
        </UFormField>
        <UFormField label="Nuova password (minimo 8 caratteri)">
          <UInput v-model="pwForm.newPassword" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UFormField label="Ripeti nuova password">
          <UInput v-model="pwForm.confirmPassword" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <p v-if="pwError" class="text-xs text-red-500">{{ pwError }}</p>
      </div>
      <template #footer>
        <UButton color="primary" :loading="savingPw" @click="cambiaPassword">
          Aggiorna password
        </UButton>
      </template>
    </UCard>

    <UButton
      block
      variant="soft"
      icon="i-heroicons-play-circle"
      @click="tutorialRiapri = true"
    >
      Rivedi il tutorial di benvenuto
    </UButton>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['staff-only'] })
useHead({ title: 'Il mio profilo — Ti Formiamo Noi' })

const toast = useToast()
const { user } = useUserSession()
const tutorialRiapri = useState('tutorial-riapri', () => false)

const pwForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const pwError = ref('')
const savingPw = ref(false)

async function cambiaPassword() {
  pwError.value = ''
  if (pwForm.newPassword.length < 8) {
    pwError.value = 'La nuova password deve essere di almeno 8 caratteri'
    return
  }
  if (pwForm.newPassword !== pwForm.confirmPassword) {
    pwError.value = 'Le password non coincidono'
    return
  }
  savingPw.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword },
    })
    toast.add({ title: 'Password aggiornata', color: 'success' })
    pwForm.currentPassword = ''
    pwForm.newPassword = ''
    pwForm.confirmPassword = ''
  } catch (e: any) {
    pwError.value = e?.data?.statusMessage ?? 'Errore durante il cambio password'
  } finally {
    savingPw.value = false
  }
}
</script>
