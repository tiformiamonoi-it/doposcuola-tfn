<template>
  <div class="space-y-6">
    <h2 class="font-heading text-xl font-bold text-slate-900">Il mio account</h2>

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

    <UCard v-if="!isStudente">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-academic-cap" class="w-4 h-4 text-tfn-500" />
          <span class="font-medium text-slate-800">Figli collegati</span>
        </div>
      </template>
      <template v-if="pendingStudents">
        <USkeleton class="h-8 w-full" />
      </template>
      <template v-else-if="students.length === 0">
        <p class="text-sm text-slate-500">Nessuno studente collegato.</p>
      </template>
      <ul v-else class="space-y-1">
        <li v-for="s in students" :key="s.id" class="flex items-center gap-2 text-sm py-1">
          <UIcon name="i-heroicons-user" class="w-4 h-4 text-slate-400" />
          <span class="text-slate-800">{{ s.firstName }} {{ s.lastName }}</span>
          <span v-if="s.classe" class="text-slate-400">— {{ s.classe }}</span>
        </li>
      </ul>
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
          <UInput v-model="pwForm.currentPassword" type="password" class="w-full" />
        </UFormField>
        <UFormField label="Nuova password (minimo 8 caratteri)">
          <UInput v-model="pwForm.newPassword" type="password" class="w-full" />
        </UFormField>
        <UFormField label="Ripeti nuova password">
          <UInput v-model="pwForm.confirmPassword" type="password" class="w-full" />
        </UFormField>
        <p v-if="pwError" class="text-xs text-red-500">{{ pwError }}</p>
      </div>
      <template #footer>
        <UButton color="primary" :loading="savingPw" @click="cambiaPassword">
          Aggiorna password
        </UButton>
      </template>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-document-text" class="w-4 h-4 text-tfn-500" />
          <span class="font-medium text-slate-800">Documentazione e Privacy</span>
        </div>
      </template>
      <div class="space-y-2 text-sm">
        <NuxtLink :to="isStudente ? '/privacy-studente' : '/privacy'" class="flex items-center justify-between py-2 border-b border-slate-100 text-slate-600 hover:text-indigo-600 transition-colors">
          <span>Privacy Policy</span>
          <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
        </NuxtLink>
        <NuxtLink v-if="!isStudente" to="/termini" class="flex items-center justify-between py-2 text-slate-600 hover:text-indigo-600 transition-colors">
          <span>Termini e Condizioni</span>
          <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
        </NuxtLink>
      </div>
    </UCard>

    <UButton
      block
      variant="outline"
      color="error"
      icon="i-heroicons-arrow-right-on-rectangle"
      :loading="loggingOut"
      @click="esciDalPortale"
    >
      Esci dall'account
    </UButton>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Profilo — Portale Famiglie' })

const toast = useToast()
const { user } = useUserSession()
const isStudente = computed(() => user.value?.role === 'STUDENTE')

const { data: studentsData, pending: pendingStudents } = useLazyFetch('/api/portal/students')
const students = computed(() => (studentsData.value as any[]) ?? [])

const pwForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const pwError = ref('')
const savingPw = ref(false)
const loggingOut = ref(false)

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
    // Lo STUDENTE usa l'endpoint condiviso (profile.put è riservato ai genitori)
    if (isStudente.value) {
      await $fetch('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword },
      })
    } else {
      await $fetch('/api/portal/profile', {
        method: 'PUT',
        body: { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword },
      })
    }
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

async function esciDalPortale() {
  loggingOut.value = true
  try {
    const { clear } = useUserSession()
    await clear()
    await navigateTo('/login', { external: true })
  } catch {
    loggingOut.value = false
  }
}
</script>

