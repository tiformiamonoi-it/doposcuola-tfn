<template>
  <div v-if="perTutor">
    <!-- ═══════════ TUTOR: veste nuova (bozza Profilo), stesse funzioni ═══════════ -->
    <PortaleTestata titolo="Profilo" sovrapposta :campanella="false" />

    <section aria-label="I tuoi dati" class="relative -mt-[52px] mx-5 bg-white rounded-3xl p-5 flex items-center gap-4 pf-ombra-alta">
      <span aria-hidden="true" class="size-14 shrink-0 rounded-full bg-pf-celeste text-pf-blu font-heading font-bold text-lg flex items-center justify-center">{{ iniziali }}</span>
      <span class="min-w-0 flex flex-col gap-0.5">
        <span class="font-heading font-bold text-lg break-words">{{ user?.firstName }} {{ user?.lastName }}</span>
        <span class="text-[13px] text-pf-grigio">Tutor</span>
        <span class="text-[13px] text-pf-grigio-scuro break-all">{{ user?.email }}</span>
      </span>
    </section>

    <nav aria-label="Impostazioni" class="mx-5 mt-5 bg-white rounded-[22px] pf-ombra divide-y divide-pf-fondo overflow-hidden">
      <button type="button" :aria-expanded="pwAperto" aria-controls="cambia-password" :class="RIGA" @click="() => { pwAperto = !pwAperto }">
        <span :class="ICONA" aria-hidden="true"><UIcon name="i-heroicons-lock-closed" class="size-5" /></span>
        <span class="flex-1">Cambia password</span>
        <UIcon :name="pwAperto ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="size-4 text-pf-grigio" aria-hidden="true" />
      </button>

      <!-- Il modulo si apre qui sotto, senza cambiare pagina -->
      <form v-if="pwAperto" id="cambia-password" class="p-4 flex flex-col gap-3 bg-pf-fondo" @submit.prevent="cambiaPassword">
        <label class="flex flex-col gap-1.5 text-sm font-semibold">
          Password attuale
          <input v-model="pwForm.currentPassword" type="password" autocomplete="current-password" :class="CAMPO" />
        </label>
        <label class="flex flex-col gap-1.5 text-sm font-semibold">
          Nuova password (minimo 8 caratteri)
          <input v-model="pwForm.newPassword" type="password" autocomplete="new-password" :class="CAMPO" />
        </label>
        <label class="flex flex-col gap-1.5 text-sm font-semibold">
          Ripeti nuova password
          <input v-model="pwForm.confirmPassword" type="password" autocomplete="new-password" :class="CAMPO" />
        </label>
        <p v-if="pwError" role="alert" class="text-sm text-pf-rosso">{{ pwError }}</p>
        <PortaleBottone type="submit" variante="blu" :loading="savingPw" blocco>Aggiorna password</PortaleBottone>
      </form>

      <NuxtLink to="/area-tutor/disponibilita" :class="RIGA">
        <span :class="ICONA" aria-hidden="true"><UIcon name="i-heroicons-calendar-days" class="size-5" /></span>
        <span class="flex-1">La mia disponibilità</span>
        <UIcon name="i-heroicons-chevron-right" class="size-4 text-pf-grigio" aria-hidden="true" />
      </NuxtLink>
      <button type="button" :class="RIGA" @click="() => { tutorialRiapri = true }">
        <span :class="ICONA" aria-hidden="true"><UIcon name="i-heroicons-play-circle" class="size-5" /></span>
        <span class="flex-1">Rivedi il tutorial di benvenuto</span>
        <UIcon name="i-heroicons-chevron-right" class="size-4 text-pf-grigio" aria-hidden="true" />
      </button>
      <NuxtLink to="/regolamento-card" :class="RIGA">
        <span :class="ICONA" aria-hidden="true"><UIcon name="i-heroicons-document-text" class="size-5" /></span>
        <span class="flex-1">Regolamento della card</span>
        <UIcon name="i-heroicons-chevron-right" class="size-4 text-pf-grigio" aria-hidden="true" />
      </NuxtLink>
    </nav>

    <div class="mx-5 mt-5">
      <button
        type="button"
        :disabled="uscendo"
        class="w-full min-h-12 rounded-2xl bg-white border border-pf-bordo text-pf-rosso font-semibold flex items-center justify-center gap-2 hover:bg-pf-rosso-chiaro transition-colors disabled:opacity-50"
        @click="logout"
      >
        <UIcon :name="uscendo ? 'i-heroicons-arrow-path' : 'i-heroicons-arrow-right-on-rectangle'" class="size-5" :class="uscendo ? 'animate-spin' : ''" aria-hidden="true" />
        Esci
      </button>
    </div>
  </div>

  <div v-else class="max-w-lg space-y-6">
    <!-- ═══════════ SUPER TUTOR E ADMIN: la veste del gestionale (D1) ═══════════ -->
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

    <!-- "Esci" anche qui, ben in vista: sul telefono è il primo posto dove un tutor lo cerca -->
    <UButton
      block
      color="error"
      variant="soft"
      icon="i-heroicons-arrow-right-on-rectangle"
      :loading="uscendo"
      @click="logout"
    >
      Esci
    </UButton>
  </div>
</template>

<script setup lang="ts">
// Il layout lo sceglie il middleware per ruolo (middleware/layout-di-ruolo.ts)
definePageMeta({ middleware: ['staff-only', 'layout-di-ruolo'] })
useHead({ title: 'Il mio profilo — tiformiamonoi.it' })

const toast = useToast()
const { user } = useUserSession()
const perTutor = computed(() => user.value?.role === 'TUTOR')
const tutorialRiapri = useState('tutorial-riapri', () => false)
const { uscendo, logout } = useLogout()

const iniziali = computed(() => `${user.value?.firstName?.[0] ?? ''}${user.value?.lastName?.[0] ?? ''}`.toUpperCase())

// Le classi ripetute delle righe del menu Impostazioni (bersagli da 56 px)
const RIGA = 'w-full min-h-14 px-4 flex items-center gap-3 text-left text-[15px] font-medium text-pf-testo hover:bg-pf-fondo transition-colors'
const ICONA = 'size-9 shrink-0 rounded-xl bg-pf-celeste text-pf-blu flex items-center justify-center'
const CAMPO = 'min-h-12 px-4 rounded-2xl bg-white border border-pf-bordo text-[15px] font-normal text-pf-testo focus:border-pf-blu'

const pwAperto = ref(false)
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
  } catch (e) {
    pwError.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Errore durante il cambio password'
  } finally {
    savingPw.value = false
  }
}
</script>
