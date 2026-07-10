<template>
  <div class="min-h-screen bg-gradient-to-br from-tfn-50 to-white flex items-center justify-center p-4">
    <div class="w-full max-w-md space-y-6">

      <div class="text-center space-y-2">
        <div class="w-14 h-14 rounded-2xl bg-tfn-500 flex items-center justify-center mx-auto">
          <UIcon name="i-heroicons-academic-cap" class="w-8 h-8 text-white" />
        </div>
        <h1 class="font-heading text-2xl font-bold text-slate-900">Ti Formiamo Noi</h1>
        <p class="text-sm text-slate-500">Richiedi informazioni per il tuo figlio</p>
      </div>

      <!-- Successo -->
      <UCard v-if="inviato">
        <div class="text-center py-8 space-y-4">
          <div class="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto">
            <UIcon name="i-heroicons-check" class="w-8 h-8 text-success-600" />
          </div>
          <div>
            <h2 class="font-heading text-xl font-bold text-slate-900">Grazie!</h2>
            <p class="text-sm text-slate-500 mt-1">
              Abbiamo ricevuto la tua richiesta. Ti contatteremo presto per fornirti tutte le informazioni.
            </p>
          </div>
        </div>
      </UCard>

      <!-- Form -->
      <UCard v-else>
        <template #header>
          <span class="font-medium text-slate-800">Compila il modulo</span>
        </template>

        <div class="space-y-4">
          <UFormField label="Nome e cognome del figlio" required>
            <UInput v-model="form.nomeStudente" class="w-full" placeholder="Es. Marco Rossi" />
            <p v-if="errors.nomeStudente" class="text-xs text-red-500 mt-1">{{ errors.nomeStudente }}</p>
          </UFormField>

          <UFormField label="Classe e scuola">
            <UInput v-model="form.classeScuola" class="w-full" placeholder="Es. 3a Liceo Scientifico Fermi" />
          </UFormField>

          <UFormField label="Materie di interesse" required>
            <UInput
              v-model="form.materie"
              class="w-full"
              placeholder="Es. Matematica, Fisica, Inglese"
            />
            <p class="text-xs text-slate-400 mt-1">Puoi elencare più materie separate da virgola</p>
            <p v-if="errors.materie" class="text-xs text-red-500 mt-1">{{ errors.materie }}</p>
          </UFormField>

          <UFormField label="Telefono o email di contatto" required>
            <UInput v-model="form.contatto" class="w-full" placeholder="Es. 333 1234567 o nome@email.it" />
            <p v-if="errors.contatto" class="text-xs text-red-500 mt-1">{{ errors.contatto }}</p>
          </UFormField>

          <UFormField label="Note aggiuntive">
            <UTextarea
              v-model="form.note"
              class="w-full"
              placeholder="Orari preferiti, domande, esigenze particolari..."
              :rows="3"
            />
          </UFormField>

          <!-- Honeypot anti-bot: invisibile agli umani, i bot lo compilano -->
          <input
            v-model="form.sitoWeb"
            type="text"
            name="sitoWeb"
            tabindex="-1"
            autocomplete="off"
            aria-hidden="true"
            class="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
        </div>

        <template #footer>
          <UButton
            block
            color="primary"
            :loading="inviando"
            @click="inviaRichiesta"
          >
            Invia richiesta
          </UButton>
        </template>
      </UCard>

      <p class="text-center text-xs text-slate-400">
        Hai già un account?
        <NuxtLink to="/login" class="text-tfn-600 hover:underline">Accedi al portale</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PublicContactSchema } from '#shared/schemas/contact.schema'

definePageMeta({ layout: false })
useHead({ title: 'Richiedi informazioni — Ti Formiamo Noi' })

const form = reactive({
  nomeStudente: '',
  classeScuola: '',
  materie: '',
  contatto: '',
  note: '',
  sitoWeb: '', // honeypot: deve restare vuoto
})

const errors = reactive<Record<string, string>>({})
const inviando = ref(false)
const inviato = ref(false)

async function inviaRichiesta() {
  // Reset errori
  for (const key of Object.keys(errors)) {
    delete errors[key]
  }

  const result = PublicContactSchema.safeParse(form)
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    for (const [field, msgs] of Object.entries(fieldErrors)) {
      if (msgs?.[0]) errors[field] = msgs[0]
    }
    return
  }

  inviando.value = true
  try {
    await $fetch('/api/contact', {
      method: 'POST',
      body: form
    })
    inviato.value = true
  } catch (err: any) {
    // Gestione errore (es. Toast o messaggio)
    console.error('Errore durante invio form', err)
    alert('Si è verificato un errore durante l\'invio. Riprova più tardi.')
  } finally {
    inviando.value = false
  }
}
</script>
