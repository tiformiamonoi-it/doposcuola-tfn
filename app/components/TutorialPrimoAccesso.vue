<template>
  <UModal v-model:open="aperto" :dismissible="false" :title="`Benvenuto, ${user?.firstName}!`">
    <template #body>
      <div class="space-y-4">
        <!-- Indicatore passi -->
        <div class="flex justify-center gap-1.5">
          <div
            v-for="(_, i) in steps"
            :key="i"
            class="h-1.5 rounded-full transition-all"
            :class="i === stepCorrente ? 'w-6 bg-tfn-500' : 'w-1.5 bg-slate-200'"
          />
        </div>

        <div class="text-center py-4 space-y-3 min-h-40">
          <UIcon :name="steps[stepCorrente]!.icona" class="w-12 h-12 text-tfn-500 mx-auto" />
          <h3 class="font-semibold text-slate-900">{{ steps[stepCorrente]!.titolo }}</h3>
          <p class="text-sm text-slate-600 leading-relaxed px-2">{{ steps[stepCorrente]!.testo }}</p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex items-center justify-between w-full">
        <UButton variant="ghost" color="neutral" size="sm" :loading="chiudendo" @click="chiudi">Salta</UButton>
        <div class="flex gap-2">
          <UButton v-if="stepCorrente > 0" variant="outline" size="sm" @click="stepCorrente--">Indietro</UButton>
          <UButton v-if="stepCorrente < steps.length - 1" size="sm" @click="stepCorrente++">Avanti</UButton>
          <UButton v-else size="sm" :loading="chiudendo" @click="chiudi">Ho capito, iniziamo!</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Tutorial di benvenuto al SOLO primo accesso (tutor, genitori, studenti).
// Si mostra quando user.tutorialVisto è false; "Salta" o "Fine" lo marcano visto per sempre.
const { user, fetch: refreshSession } = useUserSession()

const stepCorrente = ref(0)
const chiudendo = ref(false)

const STEPS_PER_RUOLO: Record<string, { icona: string; titolo: string; testo: string }[]> = {
  TUTOR: [
    { icona: 'i-heroicons-calendar', titolo: 'Il mio Calendario', testo: 'Qui vedi le tue lezioni e registri quelle di oggi. Ricorda: puoi inserirle o modificarle solo entro le 20:00 del giorno stesso.' },
    { icona: 'i-heroicons-check-circle', titolo: 'Le tue disponibilità', testo: 'In Area Tutor segni i giorni in cui sei disponibile. La disponibilità di oggi si può cambiare solo entro le 11:30; domeniche, festivi e giorni passati sono bloccati.' },
    { icona: 'i-heroicons-document-text', titolo: 'Note sugli studenti', testo: 'Dopo ogni lezione puoi scrivere una nota: scegli tu se tenerla interna o condividerla con la famiglia. Trovi lo storico in Cronologia Note.' },
    { icona: 'i-heroicons-printer', titolo: 'Stampa il programma', testo: 'Dal calendario puoi stampare (o salvare in PDF) l\'elenco delle tue lezioni della settimana.' },
    { icona: 'i-heroicons-identification', titolo: 'Il tuo profilo', testo: 'Da "Il mio profilo" puoi cambiare la password quando vuoi.' },
  ],
  GENITORE: [
    { icona: 'i-heroicons-home', titolo: 'La tua Home', testo: 'Appena entri vedi i pacchetti dei tuoi figli: quante ore restano e quando scadono, più le lezioni prenotate.' },
    { icona: 'i-heroicons-calendar-days', titolo: 'Prenotare una lezione', testo: 'Se la prenotazione online è attiva, da "Prenota" scegli giorno e materie. Puoi prenotare o spostare la lezione di oggi solo entro le 11:30, e annullarla entro le 12:30.' },
    { icona: 'i-heroicons-document-text', titolo: 'Note del tutor', testo: 'In "Note" trovi gli aggiornamenti che i tutor condividono con la famiglia sull\'andamento di tuo figlio.' },
    { icona: 'i-heroicons-user', titolo: 'Il tuo profilo', testo: 'Da "Profilo" cambi la password e trovi i documenti (privacy e termini). Le comunicazioni del centro arrivano alla tua email.' },
  ],
  STUDENTE: [
    { icona: 'i-heroicons-home', titolo: 'La tua Home', testo: 'Qui vedi il tuo pacchetto (quante ore ti restano) e le tue lezioni prenotate.' },
    { icona: 'i-heroicons-calendar-days', titolo: 'Prenotare una lezione', testo: 'Da "Prenota" scegli giorno e materie. Per oggi puoi prenotare o spostare solo entro le 11:30, e annullare entro le 12:30. I tuoi genitori vedono le tue prenotazioni.' },
    { icona: 'i-heroicons-user', titolo: 'Il tuo profilo', testo: 'Da "Profilo" puoi cambiare la password quando vuoi.' },
  ],
}

const steps = computed(() => STEPS_PER_RUOLO[user.value?.role ?? ''] ?? [])

const aperto = computed({
  get: () =>
    steps.value.length > 0
    && user.value?.tutorialVisto === false
    && user.value?.mustChangePassword !== true
    && user.value?.termsAccepted !== false,
  set: (v) => { if (!v) chiudi() },
})

async function chiudi() {
  chiudendo.value = true
  try {
    await $fetch('/api/auth/tutorial-visto', { method: 'POST' })
    await refreshSession()
  } catch {
    // se fallisce, il tutorial ricomparirà al prossimo accesso: non blocca nulla
  } finally {
    chiudendo.value = false
  }
}
</script>
