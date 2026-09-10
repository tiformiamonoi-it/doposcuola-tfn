<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4">
    <div class="w-full max-w-sm">

      <!-- Logo -->
      <div class="text-center mb-8">
        <img src="/logo.svg" alt="tiformiamonoi.it" class="w-56 mx-auto" />
        <p class="text-sm text-slate-500 mt-2">Scegli la tua password</p>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">

        <!-- Caricamento -->
        <div v-if="caricando" class="py-6 text-center text-sm text-slate-500">
          <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
          <p class="mt-2">Controllo il link…</p>
        </div>

        <!-- Fatto -->
        <div v-else-if="fatto" class="space-y-4 text-center">
          <UIcon name="i-heroicons-check-circle" class="w-10 h-10 text-emerald-500 mx-auto" />
          <h1 class="font-heading text-lg font-bold text-slate-900">Password salvata</h1>
          <p class="text-sm text-slate-600">
            Da ora entri nel gestionale con la password che hai appena scelto.
          </p>
          <UButton block to="/login">Vai all'accesso</UButton>
        </div>

        <!-- Link non valido -->
        <div v-else-if="!valido" class="space-y-4 text-center">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-10 h-10 text-amber-500 mx-auto" />
          <h1 class="font-heading text-lg font-bold text-slate-900">Link non più valido</h1>
          <p class="text-sm text-slate-600">
            Questo link non è più valido: può essere scaduto o già usato.
          </p>
          <UButton block to="/login?recupero=1">Richiedi un nuovo link</UButton>
          <p class="text-xs text-slate-500">
            Ti si apre la richiesta di un nuovo link: basta inserire la tua email.
            Oppure chiedi alla segreteria di rimandartelo.
          </p>
        </div>

        <!-- Scelta password -->
        <div v-else class="space-y-4">
          <h1 class="font-heading text-lg font-bold text-slate-900 text-center">
            Ciao {{ nome }}, scegli la tua password
          </h1>

          <UFormField label="Nuova password" required>
            <UInput
              v-model="password"
              type="password"
              placeholder="••••••••"
              icon="i-heroicons-lock-closed"
              autocomplete="new-password"
              class="w-full"
              @keyup.enter="salva"
            />
          </UFormField>

          <UFormField label="Ripeti la password" required>
            <UInput
              v-model="conferma"
              type="password"
              placeholder="••••••••"
              icon="i-heroicons-lock-closed"
              autocomplete="new-password"
              class="w-full"
              @keyup.enter="salva"
            />
          </UFormField>

          <p class="text-xs text-slate-500">{{ REGOLE_PASSWORD }}</p>

          <UAlert
            v-if="errore"
            color="error"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            :description="errore"
          />

          <UButton block :loading="salvando" @click="salva">Salva password</UButton>
        </div>
      </div>

      <p class="text-center text-xs text-slate-400 mt-6">
        Problemi? Contatta la segreteria.
      </p>

      <p class="text-center text-xs text-slate-300 mt-2">
        <NuxtLink to="/privacy" class="hover:underline">Privacy</NuxtLink> ·
        <NuxtLink to="/termini" class="hover:underline">Termini</NuxtLink> ·
        <NuxtLink to="/cookie" class="hover:underline">Cookie</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
// PAGINA PUBBLICA: ci si arriva dal link ricevuto per email o su WhatsApp,
// quindi SENZA essere collegati. Nessun middleware di autenticazione, come
// /login, /prenota, /termini e /privacy.
import { REGOLE_PASSWORD } from '#shared/schemas/password.schema'

definePageMeta({ layout: false })
useHead({ title: 'Scegli la tua password — Ti Formiamo Noi' })

const route = useRoute()
const token = computed(() => String(route.query.token ?? ''))

const caricando = ref(true)
const valido = ref(false)
const nome = ref('')
const password = ref('')
const conferma = ref('')
const errore = ref('')
const salvando = ref(false)
const fatto = ref(false)

onMounted(async () => {
  if (!token.value) {
    caricando.value = false
    return
  }
  try {
    const res = await $fetch<{ valido: boolean; nome?: string }>('/api/auth/imposta-password', {
      query: { token: token.value },
    })
    valido.value = res.valido === true
    nome.value = res.nome ?? ''
  } catch {
    // Qualsiasi errore (link inesistente, limite di tentativi) → stesso messaggio semplice
    valido.value = false
  } finally {
    caricando.value = false
  }
})

async function salva() {
  errore.value = ''
  if (password.value.length < 8) {
    errore.value = 'La password deve essere di almeno 8 caratteri'
    return
  }
  if (password.value !== conferma.value) {
    errore.value = 'Le due password non coincidono'
    return
  }
  salvando.value = true
  try {
    await $fetch('/api/auth/imposta-password', {
      method: 'POST',
      body: { token: token.value, password: password.value },
    })
    fatto.value = true
  } catch (e: any) {
    errore.value = e?.data?.statusMessage ?? 'Non è stato possibile salvare la password. Riprova.'
  } finally {
    salvando.value = false
  }
}
</script>
